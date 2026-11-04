from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import VerificationQueue, AttendanceRecord, Student, AuditLog
from ..schemas.attendance import VerificationQueueItem, VerificationAction
from ..auth import require_faculty_or_admin

router = APIRouter(prefix="/verification", tags=["Attendance Verification Centre"])

@router.get("/queue", response_model=List[VerificationQueueItem])
def get_verification_queue(
    session_id: Optional[int] = None,
    status_filter: str = "PENDING",
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    query = db.query(VerificationQueue).filter(VerificationQueue.status == status_filter)
    if session_id:
        query = query.filter(VerificationQueue.session_id == session_id)

    items = query.order_by(VerificationQueue.detected_at.desc()).all()
    results = []
    for item in items:
        cand_name = item.candidate_student.full_name if item.candidate_student else "Unidentified Individual"
        cand_usn = item.candidate_student.usn if item.candidate_student else "UNKNOWN"
        results.append(VerificationQueueItem(
            id=item.id,
            session_id=item.session_id,
            candidate_student_id=item.candidate_student_id,
            candidate_name=cand_name,
            candidate_usn=cand_usn,
            frame_snapshot_path=item.frame_snapshot_path,
            confidence=item.confidence,
            track_id=item.track_id,
            status=item.status,
            detected_at=item.detected_at
        ))
    return results

@router.post("/{item_id}/action")
def process_verification_action(
    item_id: int,
    action_in: VerificationAction,
    db: Session = Depends(get_db),
    current_user = Depends(require_faculty_or_admin)
):
    item = db.query(VerificationQueue).filter(VerificationQueue.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")

    action = action_in.action.upper()
    now = datetime.now(timezone.utc)
    target_student_id = item.candidate_student_id

    if action == "REASSIGN":
        if not action_in.reassigned_student_id:
            raise HTTPException(status_code=400, detail="Reassigned student ID required for REASSIGN action")
        target_student_id = action_in.reassigned_student_id

    if action in ["APPROVE", "REASSIGN"] and target_student_id:
        # Mark or update attendance record for target student
        record = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == item.session_id,
            AttendanceRecord.student_id == target_student_id
        ).first()

        if record:
            record.status = "PRESENT"
            record.manual_correction = True
            record.corrected_by_user_id = current_user.id
            record.correction_reason = f"Verified via Attendance Verification Centre: {action_in.review_notes or 'Approved by faculty'}"
        else:
            record = AttendanceRecord(
                session_id=item.session_id,
                student_id=target_student_id,
                status="PRESENT",
                confidence_score=item.confidence,
                observations_count=1,
                duration_minutes=15.0,
                manual_correction=True,
                corrected_by_user_id=current_user.id,
                correction_reason=f"Verified via Attendance Verification Centre: {action_in.review_notes or 'Approved by faculty'}",
                marked_at=now
            )
            db.add(record)

    item.status = action
    item.reviewed_by_user_id = current_user.id
    item.review_notes = action_in.review_notes
    item.resolved_at = now

    db.add(AuditLog(
        user_email=current_user.email,
        action=f"VERIFICATION_{action}",
        entity="VerificationQueue",
        entity_id=str(item.id),
        details=f"Verification decision: {action}. Notes: {action_in.review_notes}",
        ip_address="127.0.0.1"
    ))
    db.commit()

    return {
        "message": f"Verification decision '{action}' recorded successfully",
        "item_id": item.id,
        "status": item.status
    }

