import asyncio
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import cv2
import threading
import time
import os
import csv
import io
import mimetypes

# Fix Windows registry MIME type issues
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/javascript', '.js')

from database import init_db, add_student, mark_attendance, get_connection
from face_recognition_module import face_rec_engine
from datetime import datetime
from auth import verify_password, create_session_token, verify_session, require_admin
import json
import shutil

import openpyxl
from apscheduler.schedulers.background import BackgroundScheduler

app = FastAPI()

# Initialize Database
init_db()

# Initialize Scheduler
scheduler = BackgroundScheduler()

def auto_export_attendance():
    conn = get_connection()
    cursor = conn.cursor()
    today = datetime.now().strftime("%Y-%m-%d")
    cursor.execute('''
        SELECT a.date, a.time, s.name, s.usn, a.status 
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE a.date = ?
        ORDER BY a.time DESC
    ''', (today,))
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        return

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Daily Attendance"
    ws.append(["Date", "Time", "Name", "USN", "Status"])
    for row in rows:
        ws.append(row)
    
    export_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "exports")
    os.makedirs(export_dir, exist_ok=True)
    filename = os.path.join(export_dir, f"attendance_{today}.xlsx")
    wb.save(filename)
    print(f"Nightly Export Completed: {filename}")

@app.on_event("startup")
def start_scheduler():
    scheduler.add_job(auto_export_attendance, 'cron', hour=23, minute=59)
    scheduler.add_job(auto_backup_db, 'cron', hour=3, minute=0)
    scheduler.start()

def auto_backup_db():
    try:
        backup_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backup")
        os.makedirs(backup_dir, exist_ok=True)
        db_source = os.path.join(os.path.dirname(__file__), "database.db")
        bkp_filename = f"database_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        shutil.copy2(db_source, os.path.join(backup_dir, bkp_filename))
        print(f"Database backup created: {bkp_filename}")
    except Exception as e:
        print(f"Backup failed: {e}")

@app.on_event("shutdown")
def stop_scheduler():
    scheduler.shutdown()

# Serve Frontend Static Files
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

class Camera:
    def __init__(self):
        self.video = None
        self.lock = threading.Lock()
        self.users = 0
        
    def start(self):
        with self.lock:
            if self.users == 0:
                self.video = cv2.VideoCapture(0)
            self.users += 1
            
    def stop(self):
        with self.lock:
            if self.users > 0:
                self.users -= 1
            if self.users == 0 and self.video:
                self.video.release()
                self.video = None
                
    def get_frame(self):
        with self.lock:
            if self.video and self.video.isOpened():
                success, image = self.video.read()
                if success:
                    return image
        return None

cloud_sync_enabled = False

class CloudSyncStub:
    @staticmethod
    def sync_log(student_id, date, time):
        if not cloud_sync_enabled: return
        print(f"[CloudSync] Pushed attendance log for student {student_id} at {date} {time}")

try:
    camera = Camera()
except Exception as e:
    camera = None
    print("WARNING: Camera not available:", e)

# Global variables to handle cross-thread logic for Face Registration
registration_mode = False
registration_frames = []
registration_student_id = None
registration_student_name = None
registration_result = None

# Smart Attendance Globals
detection_events = []
last_detected = {} # {student_id: timestamp}
COOLDOWN_SECONDS = 5

global_session = {
    "active": False,
    "date": None,
    "time": None
}

# Routing for HTML Pages
@app.get("/")
def serve_index(request: Request):
    return FileResponse(os.path.join(frontend_dir, "index.html"))

@app.get("/login")
def serve_login(request: Request):
    return FileResponse(os.path.join(frontend_dir, "login.html"))

@app.get("/logs")
def serve_logs(request: Request):
    if not verify_session(request): return RedirectResponse(url="/login")
    return FileResponse(os.path.join(frontend_dir, "logs.html"))

@app.get("/dashboard")
def serve_dashboard(request: Request):
    if not verify_session(request):
        return RedirectResponse(url="/login")
    return FileResponse(os.path.join(frontend_dir, "dashboard.html"))

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/login")
def login(data: LoginRequest):
    if data.username == "admin" and verify_password(data.password):
        response = JSONResponse({"status": "success"})
        token = create_session_token(data.username)
        response.set_cookie(key="admin_session", value=token, httponly=True, max_age=86400)
        return response
    return JSONResponse({"status": "error", "message": "Invalid credentials"}, status_code=401)

@app.post("/api/logout")
def logout():
    response = JSONResponse({"status": "success"})
    response.delete_cookie("admin_session")
    return response

# Cloud Sync Route
@app.post("/api/admin/toggle-sync")
def toggle_sync(request: Request):
    require_admin(request)
    global cloud_sync_enabled
    cloud_sync_enabled = not cloud_sync_enabled
    return {"status": "success", "cloud_sync": cloud_sync_enabled}

class RegisterRequest(BaseModel):
    name: str
    usn: str

@app.post("/api/register")
async def register(data: RegisterRequest):
    global registration_mode, registration_frames, registration_student_id, registration_student_name, registration_result
    if not camera:
        return JSONResponse({"status": "error", "message": "Camera not available"}, status_code=500)
        
    try:
        student_id = add_student(data.name, data.usn)
    except Exception as e:
        return JSONResponse({"status": "error", "message": f"DB Error: {str(e)}"}, status_code=500)

    registration_student_id = student_id
    registration_student_name = data.name
    
    # Enter registration mode
    registration_frames = []
    registration_result = None
    registration_mode = True
    
    # Wait for frame generator to collect images
    timeout = 15 # seconds
    start_time = time.time()
    
    while registration_mode:
        if time.time() - start_time > timeout:
            registration_mode = False
            return JSONResponse({"status": "error", "message": "Registration timed out. Ensure your face is clearly visible."}, status_code=408)
        await asyncio.sleep(0.1)
        
    if registration_result and registration_result[0]:
        return JSONResponse({"status": "success", "message": registration_result[1]})
    else:
        return JSONResponse({"status": "error", "message": registration_result[1] if registration_result else "Failed to capture face."})

def generate_frames():
    global registration_mode, registration_frames, registration_result, registration_student_id, registration_student_name, global_session
    
    if camera:
        camera.start()
        
    try:
        while True:
            # SAFETY: Only stream if a session is active (or in registration mode)
            if not global_session["active"] and not registration_mode:
                time.sleep(1)
                continue

            if not camera:
                time.sleep(1)
                continue
                
            frame = camera.get_frame()
            if frame is None:
                time.sleep(0.1)
                continue
                
            # Optional: Flip horizontally for a mirror effect
            frame = cv2.flip(frame, 1)
                
            if registration_mode:
                registration_frames.append(frame.copy())
                cv2.putText(frame, f"Capturing {len(registration_frames)}/8...", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 2)
                
                if len(registration_frames) >= 8:
                    registration_mode = False
                    success, msg = face_rec_engine.register_user(registration_student_id, registration_student_name, registration_frames)
                    registration_result = (success, msg)
            else:
                # Normal Recognition
                results = face_rec_engine.recognize_frame(frame)
                current_time = time.time()
                
                for res in results:
                    top, right, bottom, left = res["loc"]
                    name = res["name"]
                    student_id = res["student_id"]
                    
                    status_label = ""
                    color = (255, 255, 255) # Default white
                    
                    if name == "Unknown":
                        status_label = "Unknown"
                        color = (0, 0, 255) # Red
                    else:
                        # Check cooldown to prevent flickering/spamming
                        last_time = last_detected.get(student_id, 0)
                        
                        if current_time - last_time > COOLDOWN_SECONDS:
                            # Try to mark attendance
                            try:
                                marked = mark_attendance(student_id)
                                if marked:
                                    status_label = "Marked Present"
                                    color = (0, 255, 0) # Green
                                    
                                    # Use session date/time if available
                                    s_date = global_session["date"] if global_session["date"] else datetime.now().strftime("%Y-%m-%d")
                                    s_time = global_session["time"] if global_session["time"] else datetime.now().strftime("%H:%M:%S")

                                    detection_events.append({"name": name, "status": "present", "time": s_time})
                                    CloudSyncStub.sync_log(student_id, s_date, s_time)
                                else:
                                    status_label = "Already Present"
                                    color = (0, 255, 255) # Yellow
                                    detection_events.append({"name": name, "status": "already_present", "time": datetime.now().strftime("%H:%M:%S")})
                                
                                last_detected[student_id] = current_time
                            except Exception as e:
                                print(f"Error marking attendance: {e}")
                        else:
                            # Within cooldown, just show the last known status or just name
                            status_label = "Recognized"
                            color = (255, 191, 0) # Blue-ish

                    # Draw boundary box
                    cv2.rectangle(frame, (left, top), (right, bottom), color, 2)
                    # Draw status label
                    cv2.rectangle(frame, (left, bottom), (right, bottom + 35), color, cv2.FILLED)
                    cv2.putText(frame, f"{name}: {status_label}", (left + 6, bottom + 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

            ret, buffer = cv2.imencode('.jpg', frame)
            if not ret:
                continue
            
            # FPS LIMITER (approx max ~15 fps) to save CPU
            time.sleep(0.06)
            
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            
    except GeneratorExit:
        pass
    except Exception as e:
        print("Camera stream closed:", e)
    finally:
        if camera:
            camera.stop()

@app.get("/api/video_feed")
def video_feed():
    if not camera:
        return JSONResponse({"status": "error", "message": "Camera not available"}, status_code=500)
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")


# Analytics endpoints
@app.get("/api/stats")
def get_stats():
    from database import get_advanced_analytics
    conn = get_connection()
    cursor = conn.cursor()
    
    # Total students
    cursor.execute("SELECT COUNT(*) FROM students")
    total_students = cursor.fetchone()[0]
    
    # Present today
    today = datetime.now().strftime("%Y-%m-%d")
    cursor.execute("SELECT COUNT(DISTINCT student_id) FROM attendance WHERE date=?", (today,))
    present_today = cursor.fetchone()[0]
    
    absent_today = total_students - present_today if total_students > 0 else 0
    
    # Let's say working days this week is up to 5
    # Simplistic approximation:
    cursor.execute("SELECT COUNT(DISTINCT student_id) FROM attendance WHERE date >= date('now', '-7 days')")
    present_week = cursor.fetchone()[0]
    weekly_pct = round((present_week / max(total_students, 1)) * 100, 1) 
    
    cursor.execute("SELECT COUNT(DISTINCT student_id) FROM attendance WHERE date >= date('now', '-30 days')")
    present_month = cursor.fetchone()[0]
    monthly_pct = round((present_month / max(total_students, 1)) * 100, 1)

    conn.close()
    
    adv = get_advanced_analytics()
    
    return {
        "total_students": total_students,
        "present_today": present_today,
        "absent_today": absent_today,
        "weekly_pct": weekly_pct,
        "monthly_pct": monthly_pct,
        "advanced": adv
    }

@app.get("/api/chart/weekly")
def get_weekly_chart():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT date, COUNT(DISTINCT student_id) 
        FROM attendance 
        WHERE date >= date('now', '-7 days')
        GROUP BY date
        ORDER BY date ASC
    ''')
    data = cursor.fetchall()
    conn.close()
    
    labels = [row[0] for row in data]
    values = [row[1] for row in data]
    return {"labels": labels, "values": values}

@app.get("/api/chart/monthly")
def get_monthly_chart():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT date, COUNT(DISTINCT student_id) 
        FROM attendance 
        WHERE date >= date('now', '-30 days')
        GROUP BY date
        ORDER BY date ASC
    ''')
    data = cursor.fetchall()
    conn.close()
    
    labels = [row[0][-5:] for row in data] # display MM-DD for compactness
    values = [row[1] for row in data]
    return {"labels": labels, "values": values}

@app.get("/api/export")
def export_csv():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT a.date, a.time, s.name, s.usn, a.status 
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        ORDER BY a.date DESC, a.time DESC
    ''')
    rows = cursor.fetchall()
    conn.close()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Time", "Name", "USN", "Status"])
    for row in rows:
        writer.writerow(row)
        
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=attendance.csv"}
    )

class AddStudentRequest(BaseModel):
    name: str
    usn: str

@app.post("/api/students/add")
def add_new_student(data: AddStudentRequest, request: Request):
    require_admin(request)
    name = data.name.strip()
    usn = data.usn.strip().upper()
    
    if not name or not usn:
        return JSONResponse({"status": "error", "message": "Name and USN are required"}, status_code=400)
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check for duplicate
    cursor.execute("SELECT id FROM students WHERE usn=?", (usn,))
    if cursor.fetchone():
        conn.close()
        return JSONResponse({"status": "error", "message": "Student already exists with this USN"}, status_code=400)
    
    # Insert
    try:
        cursor.execute("INSERT INTO students (name, usn) VALUES (?, ?)", (name, usn))
        conn.commit()
        student_id = cursor.lastrowid
    except Exception as e:
        conn.close()
        return JSONResponse({"status": "error", "message": f"Database error: {str(e)}"}, status_code=500)
    
    conn.close()
    return {"status": "success", "message": "Student added successfully", "student_id": student_id}

@app.get("/api/students")
def get_students():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, usn FROM students ORDER BY id ASC")
    records = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "name": r[1], "usn": r[2]} for r in records]

class ManualAttendance(BaseModel):
    student_id: int
    status: str
    date: str = None
    time: str = None

@app.post("/api/admin/attendance")
def manual_attendance(data: ManualAttendance, request: Request):
    require_admin(request)
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now()
    d = data.date if data.date else now.strftime("%Y-%m-%d")
    t = data.time if data.time else now.strftime("%H:%M:%S")
    
    # Check for duplicate date manually
    cursor.execute("SELECT id FROM attendance WHERE student_id=? AND date=?", (data.student_id, d))
    if cursor.fetchone():
        conn.close()
        return JSONResponse({"status": "error", "message": "Attendance already marked for this date."}, status_code=400)
    
    cursor.execute("INSERT INTO attendance (student_id, date, time, status) VALUES (?, ?, ?, ?)", 
                   (data.student_id, d, t, data.status))
    conn.commit()
    conn.close()
    CloudSyncStub.sync_log(data.student_id, d, t)
    return {"status": "success"}

@app.get("/api/student/{student_id}/details")
def student_details(student_id: int, request: Request):
    require_admin(request)
    from database import get_student_drilldown
    data = get_student_drilldown(student_id)
    if not data:
        return JSONResponse({"status": "error", "message": "Not found"}, status_code=404)
    return data

@app.get("/api/logs")
def get_all_logs(request: Request):
    require_admin(request)
    from database import get_all_attendance
    records = get_all_attendance()
    return [{"date": r[0], "time": r[1], "name": r[2], "usn": r[3], "status": r[4]} for r in records]

@app.delete("/api/admin/students/{student_id}")
def delete_student(student_id: int, request: Request):
    require_admin(request)
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM attendance WHERE student_id=?", (student_id,))
    cursor.execute("DELETE FROM students WHERE id=?", (student_id,))
    conn.commit()
    conn.close()
    # Ideally delete encoding too if tracking files
    return {"status": "success"}

@app.get("/api/recent_events")
def get_recent_events(request: Request):
    require_admin(request)
    global detection_events
    events = detection_events[:]
    detection_events.clear() # Clear after fetch to avoid repeat toasts
    return events

class RegisterFaceRequest(BaseModel):
    student_id: int

@app.post("/api/students/register-face")
async def register_student_face(data: RegisterFaceRequest, request: Request):
    require_admin(request)
    global registration_mode, registration_frames, registration_student_id, registration_student_name, registration_result
    
    # 1. Verify student exists
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM students WHERE id=?", (data.student_id,))
    res = cursor.fetchone()
    conn.close()
    
    if not res:
        return JSONResponse({"status": "error", "message": "Student not found"}, status_code=404)
    
    student_name = res[0]
    
    # 2. Setup registration state
    registration_student_id = data.student_id
    registration_student_name = student_name
    registration_frames = []
    registration_result = None
    registration_mode = True
    
    # 3. Wait for generate_frames to collect data
    # We timeout after 10 seconds of waiting for frames
    timeout = 10
    start_wait = time.time()
    while registration_mode:
        if time.time() - start_wait > timeout:
            registration_mode = False
            return JSONResponse({"status": "error", "message": "Face registration timed out. Ensure your face is visible to the camera."}, status_code=408)
        await asyncio.sleep(0.1)
        
    if registration_result and registration_result[0]:
        return {"status": "success", "message": registration_result[1]}
    else:
        return JSONResponse({"status": "error", "message": registration_result[1] if registration_result else "Failed to capture face."}, status_code=400)

class SessionStartRequest(BaseModel):
    date: str
    time: str

@app.post("/api/session/start")
def start_session(data: SessionStartRequest, request: Request):
    require_admin(request)
    global global_session
    global_session["active"] = True
    global_session["date"] = data.date
    global_session["time"] = data.time
    print(f"Session Started: {global_session}")
    return {"status": "success"}

@app.post("/api/session/stop")
def stop_session(request: Request):
    require_admin(request)
    global global_session
    global_session["active"] = False
    global_session["date"] = None
    global_session["time"] = None
    print("Session Stopped")
    return {"status": "success"}
