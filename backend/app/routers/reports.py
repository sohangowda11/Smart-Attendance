from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Student, AttendanceRecord, Subject, Department
from ..services.report_generator import report_generator
from ..auth import require_faculty_or_admin

router = APIRouter(prefix="/reports", tags=["Reports & Exports"])

class ReportRequest(BaseModel):
    subject_id: Optional[int] = None
    department_id: Optional[int] = None
    semester: Optional[int] = None
    section: Optional[str] = "A"
    title: Optional[str] = "Institutional Attendance Audit Report"

@router.post("/generate-pdf")
def generate_pdf_report(req: ReportRequest, db: Session = Depends(get_db), current_user = Depends(require_faculty_or_admin)):
    query = db.query(Student).filter(Student.is_active == True)
    if req.department_id:
        query = query.filter(Student.department_id == req.department_id)
    if req.semester:
        query = query.filter(Student.semester == req.semester)
    if req.section:
        query = query.filter(Student.section == req.section)

    students = query.all()
    if not students:
        raise HTTPException(status_code=404, detail="No students found matching specified criteria")

    dept_name = students[0].department.name if students and students[0].department else "All Departments"
    
    subject_name = "All Subjects"
    if req.subject_id:
        subj = db.query(Subject).filter(Subject.id == req.subject_id).first()
        if subj:
            subject_name = f"{subj.code} - {subj.name}"

    records_data = []
    for s in students:
        att_query = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == s.id)
        if req.subject_id:
            att_query = att_query.join(AttendanceRecord.session).filter(AttendanceRecord.session.has(subject_id=req.subject_id))
        
        recs = att_query.all()
        total = len(recs)
        attended = len([r for r in recs if r.status in ["PRESENT", "LATE"]])
        absent = total - attended
        pct = round((attended / total * 100.0), 1) if total > 0 else 100.0

        records_data.append({
            "usn": s.usn,
            "name": s.full_name,
            "total_lectures": total,
            "attended_lectures": attended,
            "absent_lectures": absent,
            "attendance_pct": pct
        })

    pdf_url = report_generator.generate_pdf_report(
        title=req.title or "SYNAPSE Institutional Attendance Audit Report",
        department_name=dept_name,
        subject_name=subject_name,
        records=records_data,
        generated_by=current_user.full_name
    )

    return {
        "report_url": pdf_url,
        "format": "PDF",
        "student_count": len(records_data),
        "generated_by": current_user.full_name
    }

@router.post("/generate-excel")
def generate_excel_report(req: ReportRequest, db: Session = Depends(get_db), current_user = Depends(require_faculty_or_admin)):
    query = db.query(Student).filter(Student.is_active == True)
    if req.department_id:
        query = query.filter(Student.department_id == req.department_id)
    if req.semester:
        query = query.filter(Student.semester == req.semester)

    students = query.all()
    records_data = []
    for s in students:
        recs = db.query(AttendanceRecord).filter(AttendanceRecord.student_id == s.id).all()
        total = len(recs)
        attended = len([r for r in recs if r.status in ["PRESENT", "LATE"]])
        absent = total - attended
        pct = round((attended / total * 100.0), 1) if total > 0 else 100.0

        records_data.append({
            "USN": s.usn,
            "Student Name": s.full_name,
            "Department": s.department.code if s.department else "N/A",
            "Semester": s.semester,
            "Section": s.section,
            "Total Classes": total,
            "Attended": attended,
            "Absent": absent,
            "Attendance %": pct,
            "Status": "SHORTAGE" if pct < 75.0 else "ELIGIBLE"
        })

    excel_url = report_generator.generate_excel_report(
        title=req.title or "Attendance Export",
        records=records_data
    )

    return {
        "report_url": excel_url,
        "format": "Excel",
        "rows": len(records_data)
    }

