import os
import io
import pandas as pd
from datetime import datetime, timezone
from typing import List, Dict, Any
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from ..config import REPORTS_DIR

class ReportGenerator:
    """
    SYNAPSE Professional Attendance Report Generator.
    Generates branded PDF and Excel reports with analytics and shortage indicators.
    """

    def generate_pdf_report(
        self,
        title: str,
        department_name: str,
        subject_name: str,
        records: List[Dict[str, Any]],
        generated_by: str = "Admin"
    ) -> str:
        filename = f"Attendance_Report_{int(datetime.now().timestamp())}.pdf"
        file_path = str(REPORTS_DIR / filename)

        doc = SimpleDocTemplate(
            file_path,
            pagesize=landscape(letter),
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        elements = []
        styles = getSampleStyleSheet()

        # Custom SYNAPSE styles
        title_style = ParagraphStyle(
            'SynapseTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=22,
            textColor=colors.HexColor('#FF168B'),
            spaceAfter=4
        )

        subtitle_style = ParagraphStyle(
            'SynapseSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=11,
            textColor=colors.HexColor('#333333'),
            spaceAfter=15
        )

        # Header
        elements.append(Paragraph("SYNAPSE // CLASSROOM INTELLIGENCE", title_style))
        gen_time = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        elements.append(Paragraph(
            f"<b>{title}</b> &nbsp;|&nbsp; Department: {department_name} &nbsp;|&nbsp; Subject: {subject_name} &nbsp;|&nbsp; Generated on: {gen_time} by {generated_by}",
            subtitle_style
        ))

        # Table data
        headers = ["USN", "Student Name", "Total Lectures", "Attended", "Absent", "Attendance %", "Status"]
        table_data = [headers]

        for r in records:
            pct = r.get("attendance_pct", 0.0)
            status = "CRITICAL" if pct < 65.0 else ("SHORTAGE" if pct < 75.0 else "ELIGIBLE")
            table_data.append([
                r.get("usn", "N/A"),
                r.get("name", "N/A"),
                str(r.get("total_lectures", 0)),
                str(r.get("attended_lectures", 0)),
                str(r.get("absent_lectures", 0)),
                f"{pct:.1f}%",
                status
            ])

        t = Table(table_data, colWidths=[90, 180, 80, 70, 70, 90, 80])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#101010')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            ('ALIGN', (2, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E5E7EB')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F9FAFB')]),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        elements.append(t)
        doc.build(elements)

        return f"/storage/reports/{filename}"

    def generate_excel_report(
        self,
        title: str,
        records: List[Dict[str, Any]]
    ) -> str:
        filename = f"Attendance_Export_{int(datetime.now().timestamp())}.xlsx"
        file_path = str(REPORTS_DIR / filename)

        df = pd.DataFrame(records)
        df.to_excel(file_path, index=False, sheet_name="Attendance Summary")
        return f"/storage/reports/{filename}"

report_generator = ReportGenerator()

