import os
import json
import time
import math
from datetime import datetime, timezone, date, timedelta
from typing import Dict, Any, List, Optional, Tuple, Set
import numpy as np
from sqlalchemy.orm import Session

from ..config import settings, PROCESSED_DIR, ENROLLMENTS_DIR
from ..models import (
    LectureSession, AttendanceRecord, Student, Subject, Classroom,
    User, BiometricEnrollment, VerificationQueue, RecognitionEvent, AuditLog
)
from .cv_engine import cv_engine
from .attendance_engine import attendance_engine

class WebcamAttendanceManager:
    """
    SYNAPSE Live Laptop Webcam Attendance Engine.
    Provides real-time browser webcam face detection, student identity verification,
    duplicate-prevention tracking, 5-metric classroom intelligence, and review workflows.
    """

    def __init__(self):
        # In-memory tracking of active webcam attendance sessions: session_id -> state
        self.active_sessions: Dict[int, Dict[str, Any]] = {}

    def get_session_state(self, session_id: int) -> Optional[Dict[str, Any]]:
        return self.active_sessions.get(session_id)

    def start_session(
        self,
        db: Session,
        subject_id: int,
        classroom_id: int,
        current_user: User,
        timetable_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Initializes or resumes a live webcam attendance session.
        Loads the academic class roster and cached biometric embeddings.
        """
        subject = db.query(Subject).filter(Subject.id == subject_id).first()
        if not subject:
            raise ValueError(f"Subject with ID {subject_id} not found")

        classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
        if not classroom:
            raise ValueError(f"Classroom with ID {classroom_id} not found")

        today = date.today()
        now_time = datetime.now().time()
        end_est = (datetime.now() + timedelta(hours=1)).time()

        # Check for existing ACTIVE session for this subject, faculty & date
        session = db.query(LectureSession).filter(
            LectureSession.subject_id == subject_id,
            LectureSession.faculty_id == current_user.id,
            LectureSession.session_date == today,
            LectureSession.status.in_(["ACTIVE", "READY"])
        ).first()

        if not session:
            session = LectureSession(
                timetable_id=timetable_id,
                subject_id=subject_id,
                faculty_id=current_user.id,
                classroom_id=classroom_id,
                session_date=today,
                start_time=now_time,
                end_time=end_est,
                status="ACTIVE",
                video_source_type="WEBCAM"
            )
            db.add(session)
            db.commit()
            db.refresh(session)
        else:
            session.status = "ACTIVE"
            session.video_source_type = "WEBCAM"
            db.commit()

        # Fetch all active enrolled students for this subject's department & semester
        students_query = db.query(Student).filter(
            Student.department_id == subject.department_id,
            Student.semester == subject.semester,
            Student.is_active == True
        )
        roster_students = students_query.order_by(Student.usn.asc()).all()

        # Build enrolled biometric cache for matching
        enrolled_cache = []
        roster_dict = {}
        for st in roster_students:
            roster_dict[st.id] = {
                "id": st.id,
                "full_name": st.full_name,
                "usn": st.usn,
                "photo_url": st.photo_url,
                "semester": st.semester,
                "section": st.section,
                "status": "PENDING",
                "confidence": 0.0,
                "marked_at": None
            }

            # Check biometric enrollment (primary consensus & representative pose templates)
            enrollments = db.query(BiometricEnrollment).filter(
                BiometricEnrollment.student_id == st.id
            ).all()
            for enrollment in enrollments:
                if enrollment and enrollment.embedding_data:
                    try:
                        emb = json.loads(enrollment.embedding_data)
                        if isinstance(emb, list) and len(emb) == 128:
                            enrolled_cache.append({
                                "student_id": st.id,
                                "full_name": st.full_name,
                                "usn": st.usn,
                                "embedding": emb
                            })
                    except Exception as e:
                        print(f"[SYNAPSE Webcam] Error decoding embedding for student {st.id}: {e}")

        # Check existing attendance records already in DB for this session
        existing_records = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == session.id
        ).all()
        marked_ids: Set[int] = set()
        for r in existing_records:
            if r.status in ["PRESENT", "LATE"]:
                marked_ids.add(r.student_id)
                if r.student_id in roster_dict:
                    roster_dict[r.student_id]["status"] = r.status
                    roster_dict[r.student_id]["confidence"] = r.confidence_score
                    roster_dict[r.student_id]["marked_at"] = r.first_detected_at.strftime("%H:%M:%S") if r.first_detected_at else None

        # Initialize session tracking state
        self.active_sessions[session.id] = {
            "session_id": session.id,
            "subject_id": subject.id,
            "subject_code": subject.code,
            "subject_name": subject.name,
            "classroom_id": classroom.id,
            "room_number": classroom.room_number,
            "faculty_id": current_user.id,
            "faculty_name": current_user.full_name,
            "roster": roster_dict,
            "enrolled_cache": enrolled_cache,
            "recognized_student_ids": set(marked_ids),
            "attendance_marked_ids": set(marked_ids),
            "unknown_tracks": {}, # track_id -> { centroid: (cx, cy), last_seen: time }
            "next_unknown_id": 1,
            "event_logs": [],
            "frame_counter": 0,
            "started_at": datetime.now(timezone.utc)
        }

        db.add(AuditLog(
            user_email=current_user.email,
            action="WEBCAM_ATTENDANCE_STARTED",
            entity="LectureSession",
            entity_id=str(session.id),
            details=f"Live laptop webcam attendance started for {subject.code} ({len(roster_students)} students on roster)",
            ip_address="127.0.0.1"
        ))
        db.commit()

        total_roster = len(roster_dict)
        marked_count = len(marked_ids)

        return {
            "session_id": session.id,
            "status": "ACTIVE",
            "subject": {
                "id": subject.id,
                "code": subject.code,
                "name": subject.name,
                "semester": subject.semester
            },
            "classroom": {
                "id": classroom.id,
                "room_number": classroom.room_number
            },
            "faculty_name": current_user.full_name,
            "roster": list(roster_dict.values()),
            "metrics": {
                "total_roster": total_roster,
                "total_visible_people": marked_count,
                "recognized_students": marked_count,
                "attendance_marked": marked_count,
                "unknown_individuals": 0,
                "remaining_students": max(0, total_roster - marked_count)
            }
        }

    def _match_unknown_track(
        self,
        session_state: Dict[str, Any],
        centroid: Tuple[int, int]
    ) -> int:
        """
        Associates an unidentified face with an existing unknown track using spatial proximity.
        Prevents multiple frame detections from inflating the unknown individual count.
        """
        cx, cy = centroid
        tracks = session_state["unknown_tracks"]
        now = time.time()

        # Prune tracks that haven't been seen in > 12 seconds
        expired_ids = [tid for tid, data in tracks.items() if (now - data["last_seen"]) > 12.0]
        for tid in expired_ids:
            tracks.pop(tid, None)

        best_id = None
        min_dist = 90.0 # spatial threshold in pixels

        for tid, data in tracks.items():
            tx, ty = data["centroid"]
            dist = math.hypot(cx - tx, cy - ty)
            if dist < min_dist:
                min_dist = dist
                best_id = tid

        if best_id is not None:
            tracks[best_id]["centroid"] = centroid
            tracks[best_id]["last_seen"] = now
            return best_id

        # Register new unknown individual track
        new_tid = session_state["next_unknown_id"]
        session_state["next_unknown_id"] += 1
        tracks[new_tid] = {
            "centroid": centroid,
            "first_seen": now,
            "last_seen": now
        }
        return new_tid

    def process_frame(
        self,
        db: Session,
        session_id: int,
        bgr_frame: np.ndarray,
        client_timestamp: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Processes a single live webcam frame:
        1. Detects faces
        2. Extracts 128-d embeddings
        3. Matches against enrolled students in class roster
        4. Handles spatial association for unknown persons
        5. Automatically marks attendance for confirmed matches
        6. Returns bounding boxes and real-time 5-metric counts
        """
        session_state = self.active_sessions.get(session_id)
        if not session_state:
            # Attempt to rehydrate from DB if session exists
            session = db.query(LectureSession).filter(LectureSession.id == session_id).first()
            if not session or session.status == "COMPLETED":
                raise ValueError("No active attendance session found with this ID")
            # If faculty is re-joining, start/rehydrate
            current_user = session.faculty
            init_res = self.start_session(db, session.subject_id, session.classroom_id, current_user, session.timetable_id)
            session_state = self.active_sessions.get(session_id)

        session_state["frame_counter"] += 1
        frame_idx = session_state["frame_counter"]
        now = datetime.now(timezone.utc)
        time_str = now.strftime("%H:%M:%S")

        t_start = time.perf_counter()

        # Extract faces and 128-d embeddings using cv_engine with 0.5x scaling for sub-second speed
        t0_fe = time.perf_counter()
        raw_faces = cv_engine.extract_face_embeddings(bgr_frame, use_fast_scale=True)
        t_detect_encode_ms = (time.perf_counter() - t0_fe) * 1000.0

        enrolled_cache = session_state["enrolled_cache"]
        roster_dict = session_state["roster"]
        
        detected_faces = []
        newly_marked = []
        t_match_total_ms = 0.0
        t_db_total_ms = 0.0

        for face_info in raw_faces:
            bbox = face_info["bbox"] # [left, top, width, height]
            embedding = face_info["embedding"]
            quality_score = face_info["quality_score"]

            cx = bbox[0] + bbox[2] // 2
            cy = bbox[1] + bbox[3] // 2

            # Match against enrolled students in active class roster
            t0_m = time.perf_counter()
            match_res = cv_engine.match_face(embedding, enrolled_cache)
            t_match_total_ms += (time.perf_counter() - t0_m) * 1000.0

            # Match against enrolled students in active class roster (Reference methodology: Euclidean dist <= tolerance)
            if match_res["matched"]:
                student_id = match_res["student_id"]
                student_info = roster_dict.get(student_id)

                if student_info:
                    # Positively identified student belongs to class roster!
                    confidence = match_res["confidence"]
                    is_new = student_id not in session_state["attendance_marked_ids"]

                    session_state["recognized_student_ids"].add(student_id)
                    session_state["attendance_marked_ids"].add(student_id)

                    student_info["status"] = "PRESENT"
                    student_info["confidence"] = confidence
                    if not student_info["marked_at"]:
                        student_info["marked_at"] = time_str

                    # Record attendance in database
                    if is_new:
                        t0_db = time.perf_counter()
                        # Prevent duplicate attendance entries in database
                        record = db.query(AttendanceRecord).filter(
                            AttendanceRecord.session_id == session_id,
                            AttendanceRecord.student_id == student_id
                        ).first()

                        if not record:
                            record = AttendanceRecord(
                                session_id=session_id,
                                student_id=student_id,
                                status="PRESENT",
                                confidence_score=confidence,
                                first_detected_at=now,
                                last_detected_at=now,
                                observations_count=1,
                                duration_minutes=0.1,
                                is_late=False,
                                marked_at=now
                            )
                            db.add(record)
                        else:
                            record.status = "PRESENT"
                            record.observations_count += 1
                            record.last_detected_at = now
                            if confidence > record.confidence_score:
                                record.confidence_score = confidence

                        db.add(RecognitionEvent(
                            session_id=session_id,
                            student_id=student_id,
                            frame_number=frame_idx,
                            video_timestamp_sec=client_timestamp or 0.0,
                            confidence=confidence,
                            track_id=student_id,
                            bounding_box=",".join(map(str, bbox)),
                            is_identified=True,
                            timestamp=now
                        ))
                        db.commit()
                        t_db_total_ms += (time.perf_counter() - t0_db) * 1000.0

                        newly_marked.append({
                            "student_id": student_id,
                            "full_name": student_info["full_name"],
                            "usn": student_info["usn"],
                            "confidence": round(confidence * 100, 1),
                            "timestamp": time_str
                        })

                    detected_faces.append({
                        "bbox": bbox,
                        "status": "RECOGNIZED",
                        "label": student_info["full_name"],
                        "sub_label": student_info["usn"],
                        "confidence": round(confidence * 100, 1),
                        "student_id": student_id,
                        "track_id": f"st_{student_id}"
                    })
                else:
                    # Student enrolled in university but not enrolled in this subject's class
                    detected_faces.append({
                        "bbox": bbox,
                        "status": "OTHER_CLASS",
                        "label": f"{match_res['student_name']} (Other Class)",
                        "sub_label": match_res.get("student_usn", ""),
                        "confidence": round(match_res["confidence"] * 100, 1),
                        "student_id": match_res["student_id"],
                        "track_id": f"other_{match_res['student_id']}"
                    })

            elif match_res["status"] == "AMBIGUOUS":
                cand_id = match_res.get("candidate_student_id")
                detected_faces.append({
                    "bbox": bbox,
                    "status": "AMBIGUOUS",
                    "label": match_res.get("student_name", "Ambiguous Identity"),
                    "sub_label": "Multiple Near Candidates",
                    "confidence": 50.0,
                    "student_id": cand_id,
                    "track_id": f"amb_{cand_id}" if cand_id else f"amb_{frame_idx}"
                })

            elif match_res["status"] == "MEDIUM" and match_res.get("candidate_student_id"):
                # Uncertain/borderline match -> Queue for verification
                candidate_id = match_res["candidate_student_id"]
                candidate_info = roster_dict.get(candidate_id)
                cand_name = candidate_info["full_name"] if candidate_info else match_res.get("student_name", "Student")

                detected_faces.append({
                    "bbox": bbox,
                    "status": "VERIFY",
                    "label": f"Verify: {cand_name}?",
                    "sub_label": f"Confidence: {int(match_res['confidence'] * 100)}%",
                    "confidence": round(match_res["confidence"] * 100, 1),
                    "student_id": candidate_id,
                    "track_id": f"ver_{candidate_id}"
                })

            else:
                # Unidentified individual -> Track spatially to avoid duplicate counts
                unknown_tid = self._match_unknown_track(session_state, (cx, cy))
                detected_faces.append({
                    "bbox": bbox,
                    "status": "UNKNOWN",
                    "label": f"Unknown Individual #{unknown_tid}",
                    "sub_label": "Not Registered",
                    "confidence": 0.0,
                    "track_id": f"unk_{unknown_tid}"
                })

        # Calculate live 5-metric classroom intelligence
        total_roster = len(roster_dict)
        recognized_count = len(session_state["recognized_student_ids"])
        marked_count = len(session_state["attendance_marked_ids"])
        unknown_count = len(session_state["unknown_tracks"])
        total_visible = recognized_count + unknown_count
        remaining_count = max(0, total_roster - recognized_count)

        total_latency_ms = (time.perf_counter() - t_start) * 1000.0

        return {
            "session_id": session_id,
            "frame_idx": frame_idx,
            "frame_dimensions": {
                "width": int(bgr_frame.shape[1]),
                "height": int(bgr_frame.shape[0])
            },
            "faces": detected_faces,
            "active_faces_in_frame": len(detected_faces),
            "metrics": {
                "total_visible_people": total_visible,
                "recognized_students": recognized_count,
                "attendance_marked": marked_count,
                "unknown_individuals": unknown_count,
                "remaining_students": remaining_count,
                "total_roster": total_roster
            },
            "timing_metrics": {
                "detection_and_encoding_ms": round(t_detect_encode_ms, 1),
                "identity_matching_ms": round(t_match_total_ms, 2),
                "db_persistence_ms": round(t_db_total_ms, 2),
                "total_latency_ms": round(total_latency_ms, 1)
            },
            "newly_marked": newly_marked,
            "timestamp": time_str
        }

    def finalize_session(
        self,
        db: Session,
        session_id: int,
        confirm_absentees: bool = True
    ) -> Dict[str, Any]:
        """
        Completes the attendance session:
        1. Finalizes attendance in database, logging absentees.
        2. Sets session status to COMPLETED.
        3. Cleans up in-memory tracking session.
        4. Returns final attendance summary for faculty confirmation.
        """
        session_state = self.active_sessions.get(session_id)
        session = db.query(LectureSession).filter(LectureSession.id == session_id).first()
        if not session:
            raise ValueError(f"LectureSession {session_id} not found")

        # Use attendance engine to reconcile and mark unrecorded students as absent
        summary = attendance_engine.finalize_lecture_attendance(db, session_id)

        # Update totals on session object
        if session_state:
            session.total_unique_tracks = len(session_state["recognized_student_ids"]) + len(session_state["unknown_tracks"])
            session.total_recognized = len(session_state["recognized_student_ids"])
            session.total_detected = session.total_unique_tracks
        else:
            session.total_recognized = summary.get("present_count", 0)
            session.total_detected = summary.get("total_enrolled", 0)

        session.status = "COMPLETED"
        session.completed_at = datetime.now(timezone.utc)
        db.commit()

        # Log finalization audit
        faculty_email = session.faculty.email if session.faculty else "faculty@synapse.edu"
        db.add(AuditLog(
            user_email=faculty_email,
            action="WEBCAM_ATTENDANCE_COMPLETED",
            entity="LectureSession",
            entity_id=str(session.id),
            details=f"Live webcam attendance finalized: {summary.get('present_count', 0)} present, {summary.get('absent_count', 0)} absent out of {summary.get('total_enrolled', 0)} students.",
            ip_address="127.0.0.1"
        ))
        db.commit()

        # Clean up memory
        self.active_sessions.pop(session_id, None)

        return {
            "session_id": session_id,
            "status": "COMPLETED",
            "total_enrolled": summary.get("total_enrolled", 0),
            "present_count": summary.get("present_count", 0),
            "absent_count": summary.get("absent_count", 0),
            "attendance_rate": round(
                (summary.get("present_count", 0) / max(1, summary.get("total_enrolled", 1))) * 100.0, 1
            ),
            "completed_at": session.completed_at.strftime("%Y-%m-%d %H:%M:%S")
        }

# Singleton instance
webcam_attendance_manager = WebcamAttendanceManager()

