from datetime import datetime, timezone, timedelta, time
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from ..models import AttendanceRecord, Student, LectureSession, VerificationQueue, RecognitionEvent
from ..config import settings

class AttendanceEngine:
    """
    SYNAPSE Automatic Attendance Engine.
    Evaluates computer vision tracking and recognition evidence, applies institutional
    attendance rules, detects late arrivals, and maintains verified attendance states.
    """

    def process_detection_evidence(
        self,
        db: Session,
        session_id: int,
        student_id: int,
        confidence: float,
        timestamp_sec: float,
        track_id: int,
        frame_number: int,
        bbox: List[int]
    ) -> Optional[AttendanceRecord]:
        """
        Records detection evidence and evaluates whether student qualifies for 'PRESENT' status.
        """
        session = db.query(LectureSession).filter(LectureSession.id == session_id).first()
        if not session or session.status in ["COMPLETED", "CANCELLED"]:
            return None

        # Check existing attendance record for this student in this session
        record = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == session_id,
            AttendanceRecord.student_id == student_id
        ).first()

        now = datetime.now(timezone.utc)
        
        # Calculate late arrival status based on lecture start time
        is_late = False
        if session.start_time:
            # If session has scheduled start time
            grace_period = timedelta(minutes=settings.LATE_GRACE_PERIOD_MINUTES)
            # Estimate detection wall-clock time relative to lecture start
            if timestamp_sec > (settings.LATE_GRACE_PERIOD_MINUTES * 60):
                is_late = True

        if not record:
            # First observation
            record = AttendanceRecord(
                session_id=session_id,
                student_id=student_id,
                status="PRESENT" if settings.MIN_OBSERVATION_COUNT <= 1 else "PENDING_VERIFICATION",
                confidence_score=confidence,
                first_detected_at=now,
                last_detected_at=now,
                observations_count=1,
                duration_minutes=0.1,
                is_late=is_late,
                marked_at=now
            )
            db.add(record)
        else:
            # Subsequent observation - accumulate evidence
            record.observations_count += 1
            record.last_detected_at = now
            # Update max confidence
            if confidence > record.confidence_score:
                record.confidence_score = confidence
            
            # Update duration
            if record.first_detected_at:
                delta_minutes = (now - record.first_detected_at.replace(tzinfo=timezone.utc)).total_seconds() / 60.0
                record.duration_minutes = max(record.duration_minutes, delta_minutes)

            # Check if student graduated from PENDING_VERIFICATION to PRESENT
            if record.observations_count >= settings.MIN_OBSERVATION_COUNT and record.status == "PENDING_VERIFICATION":
                record.status = "LATE" if record.is_late else "PRESENT"

        # Record recognition event for forensic audit
        event = RecognitionEvent(
            session_id=session_id,
            student_id=student_id,
            frame_number=frame_number,
            video_timestamp_sec=timestamp_sec,
            confidence=confidence,
            track_id=track_id,
            bounding_box=",".join(map(str, bbox)),
            is_identified=True,
            timestamp=now
        )
        db.add(event)
        db.commit()
        db.refresh(record)
        return record

    def queue_for_verification(
        self,
        db: Session,
        session_id: int,
        candidate_student_id: Optional[int],
        confidence: float,
        track_id: int,
        frame_snapshot_path: Optional[str] = None
    ):
        """
        Adds uncertain/borderline recognition events to the Verification Queue.
        """
        # Avoid duplicate pending reviews for the same track
        existing = db.query(VerificationQueue).filter(
            VerificationQueue.session_id == session_id,
            VerificationQueue.track_id == track_id,
            VerificationQueue.status == "PENDING"
        ).first()

        if not existing:
            item = VerificationQueue(
                session_id=session_id,
                candidate_student_id=candidate_student_id,
                frame_snapshot_path=frame_snapshot_path,
                confidence=confidence,
                track_id=track_id,
                status="PENDING",
                detected_at=datetime.now(timezone.utc)
            )
            db.add(item)
            db.commit()

    def finalize_lecture_attendance(self, db: Session, session_id: int) -> Dict[str, Any]:
        """
        Finalizes attendance for a completed lecture:
        1. Identifies all enrolled students for the session's subject/department/semester.
        2. Automatically marks absent for any students not detected.
        3. Updates session completion status and totals.
        """
        session = db.query(LectureSession).filter(LectureSession.id == session_id).first()
        if not session:
            return {"error": "Session not found"}

        # Fetch all enrolled active students in this semester & section
        subject = session.subject
        students_query = db.query(Student).filter(
            Student.department_id == subject.department_id,
            Student.semester == subject.semester,
            Student.is_active == True
        )
        all_students = students_query.all()

        # Existing recorded attendances
        records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session_id).all()
        recorded_student_ids = {r.student_id for r in records}

        # Students never detected get marked ABSENT
        absent_count = 0
        for student in all_students:
            if student.id not in recorded_student_ids:
                absent_record = AttendanceRecord(
                    session_id=session_id,
                    student_id=student.id,
                    status="ABSENT",
                    confidence_score=0.0,
                    observations_count=0,
                    duration_minutes=0.0,
                    is_late=False,
                    marked_at=datetime.now(timezone.utc)
                )
                db.add(absent_record)
                absent_count += 1

        # Check early departure for present students
        for r in records:
            if r.status in ["PRESENT", "LATE"] and r.duration_minutes < 15.0 and session.total_frames > 200:
                r.is_early_departure = True

        session.status = "COMPLETED"
        session.completed_at = datetime.now(timezone.utc)
        db.commit()

        present_count = len([r for r in records if r.status in ["PRESENT", "LATE"]])
        return {
            "session_id": session_id,
            "total_enrolled": len(all_students),
            "present_count": present_count,
            "absent_count": absent_count,
            "status": "COMPLETED"
        }

attendance_engine = AttendanceEngine()

