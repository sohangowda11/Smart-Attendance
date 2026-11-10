import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "database.db")

def get_connection():
    return sqlite3.connect(DB_PATH, check_same_thread=False)

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            usn TEXT NOT NULL UNIQUE
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            status TEXT NOT NULL,
            FOREIGN KEY (student_id) REFERENCES students (id)
        )
    ''')
    conn.commit()
    conn.close()

def add_student(name, usn):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO students (name, usn) VALUES (?, ?)", (name, usn))
        conn.commit()
        student_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        cursor.execute("SELECT id FROM students WHERE usn=?", (usn,))
        student_id = cursor.fetchone()[0]
    conn.close()
    return student_id

def get_student_by_id(student_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM students WHERE id=?", (student_id,))
    res = cursor.fetchone()
    conn.close()
    if res:
        return {"id": res[0], "name": res[1], "usn": res[2]}
    return None

def check_can_mark(student_id):
    today = datetime.now().strftime("%Y-%m-%d")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT time FROM attendance WHERE student_id=? AND date=?", (student_id, today))
    records = cursor.fetchall()
    conn.close()
    
    if len(records) > 0:
        # Already marked today. Based on pseudo logic: if already_marked_today -> ignore
        return False
    return True

def mark_attendance(student_id):
    if check_can_mark(student_id):
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%H:%M:%S")
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO attendance (student_id, date, time, status) VALUES (?, ?, ?, ?)",
                       (student_id, date_str, time_str, "Present"))
        conn.commit()
        conn.close()
        return True
    return False

def get_all_attendance():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT attendance.date, attendance.time, students.name, students.usn, attendance.status
        FROM attendance
        JOIN students ON attendance.student_id = students.id
        ORDER BY attendance.date DESC, attendance.time DESC
    ''')
    records = cursor.fetchall()
    conn.close()
    return records

def get_student_drilldown(student_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name, usn FROM students WHERE id=?", (student_id,))
    s = cursor.fetchone()
    if not s: return None
    
    # All attendance logs
    cursor.execute("SELECT date, time, status FROM attendance WHERE student_id=? ORDER BY date DESC, time DESC", (student_id,))
    logs = cursor.fetchall()
    
    # Total distinct total days
    cursor.execute("SELECT COUNT(DISTINCT date) FROM attendance WHERE student_id=?", (student_id,))
    total_days = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(DISTINCT date) FROM attendance WHERE student_id=? AND date >= date('now', '-7 days')", (student_id,))
    week_days = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(DISTINCT date) FROM attendance WHERE student_id=? AND date >= date('now', '-30 days')", (student_id,))
    month_days = cursor.fetchone()[0]

    conn.close()
    
    # Generic approx: assume 5-day week approx (say max 5 possible days)
    # To be extremely accurate we'd track actual class days. We'll use 5 for week, 22 for month.
    week_pct = min(100, round((week_days / 5.0) * 100))
    month_pct = min(100, round((month_days / 22.0) * 100))
    
    return {
        "name": s[0],
        "usn": s[1],
        "attendance": [{"date": l[0], "time": l[1], "status": l[2]} for l in logs],
        "total_days": total_days,
        "weekly_percentage": week_pct,
        "monthly_percentage": month_pct
    }

def get_advanced_analytics():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Get total possible active days (days where at least 1 person was present)
    cursor.execute("SELECT COUNT(DISTINCT date) FROM attendance")
    total_active_days = max(1, cursor.fetchone()[0])
    
    # Top 5 students
    cursor.execute('''
        SELECT s.id, s.name, COUNT(DISTINCT a.date) as c 
        FROM students s LEFT JOIN attendance a ON s.id = a.student_id 
        GROUP BY s.id ORDER BY c DESC LIMIT 5
    ''')
    top_5 = cursor.fetchall()
    
    # Students below 75%
    cursor.execute('''
        SELECT s.id, s.name, COUNT(DISTINCT a.date) as c 
        FROM students s LEFT JOIN attendance a ON s.id = a.student_id 
        GROUP BY s.id
    ''')
    all_attendance = cursor.fetchall()
    below_75 = []
    total_class_pct_sum = 0
    total_count = len(all_attendance)
    
    for row in all_attendance:
        pct = (row[2] / total_active_days) * 100
        total_class_pct_sum += pct
        if pct < 75:
            below_75.append({"id": row[0], "name": row[1], "pct": round(pct)})
            
    avg_class = round(total_class_pct_sum / total_count) if total_count > 0 else 0
    conn.close()
    
    return {
        "top_5": [{"id": t[0], "name": t[1], "days": t[2]} for t in top_5],
        "below_75": below_75,
        "avg_class_attendance": avg_class
    }
