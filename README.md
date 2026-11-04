# SYNAPSE // AI-POWERED SMART ATTENDANCE & CLASSROOM INTELLIGENCE PLATFORM

> **Tagline:** Intelligence. Accuracy. Attendance.  
> **Brand Identity:** Jet Black (`#080808`), Hot Pink (`#FF168B`), Electric Yellow (`#EFFF00`)  
> **Status:** Production-Ready Full-Stack AI/ML Platform

---

## 1. Executive Summary

**SYNAPSE** is an enterprise-grade intelligent classroom monitoring and attendance automation platform that uses computer vision and facial biometrics to identify enrolled students from CCTV surveillance footage, monitor classroom occupancy, track student movement, and automatically generate verified lecture-wise attendance records with zero manual roll-calls.

---

## 2. Technical Architecture & Tech Stack

### Frontend Architecture
- **Framework:** React 18 + Vite + TypeScript
- **Styling:** Tailwind CSS with custom editorial theme, scanlines, and cybernetic glows
- **Motion & Animations:** Framer Motion staggered reveals, real-time telemetry HUD
- **Icons:** Lucide React
- **Data Visualization:** Recharts (Chronological Area Trends, Cross-Course Benchmarks, Occupancy Gauges)
- **HTTP Client:** Axios with JWT request/response interceptors

### Backend & API Architecture
- **Framework:** Python FastAPI (58 REST API endpoints + WebSockets)
- **Database Engine:** SQLAlchemy 2.0 ORM with PostgreSQL / SQLite compatibility
- **Authentication & Security:** Argon2 password hashing, HS256 JWT tokens, Role-Based Access Control (`ADMIN` vs `FACULTY`)
- **Document & Data Export:** ReportLab (Formatted branded PDF reports), OpenPyXL & Pandas (Excel exports)

### Computer Vision & Biometric Pipeline
- **Computer Vision:** OpenCV (Hardware-accelerated frame ingestion, sampling, and video annotation)
- **Face Detection:** Dlib HOG frontal detector with Laplacian variance blur & quality filtering
- **Feature Extraction:** 128-dimensional facial biometric embedding space
- **Biometric Matcher:** Calibrated Euclidean distance matching with multi-observation temporal integration
- **Multi-Object Tracking (MOT):** Centroid + Intersection-over-Union (IoU) tracker with greedy Hungarian association and 15-frame disappearance buffer

---

## 3. Brand Identity & Color Palette

SYNAPSE strictly follows an editorial visual language:
- **JET BLACK (`#080808` / `#101010` / `#151515`):** Primary backgrounds, surfaces, and navigation.
- **HOT PINK (`#FF168B` / `#FF4FA3`):** Primary brand accent, verified status, active states, and primary CTAs.
- **ELECTRIC YELLOW (`#EFFF00`):** Live telemetry indicators, active tracks, camera status, and warnings.
- **PRIMARY WHITE (`#FFFFFF`) & SECONDARY GREY (`#A1A1AA`):** High-contrast editorial typography.

---

## 4. Default Seed Accounts

The platform includes seed data with 20 enrolled students, academic departments, classrooms, subjects, weekly timetable, historical records, and pre-generated classroom surveillance footage:

| Role | Email Address | Password | Privileges |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@synapse.ai` | `Admin@123` | Full access to students, faculty, cameras, settings, reports, audit logs |
| **FACULTY** | `dr.sharma@synapse.ai` | `Faculty@123` | Assigned classes, live CCTV monitor, lecture attendance, review queue |
| **FACULTY** | `prof.menon@synapse.ai` | `Faculty@123` | Computer Science classes, timetable, attendance override audit |

---

## 5. Quick Start & Execution Guide

### 🚀 One-Click Run (Windows)
Simply **double-click** the [`run.bat`](file:///d:/B%20Vcoding/attend/run.bat) file in the project folder!
It will automatically:
1. Verify database integrity and biometric models.
2. Launch the FastAPI backend server (`http://localhost:8000`).
3. Launch the Vite React frontend client (`http://localhost:5173`).
4. Automatically open your web browser to **SYNAPSE**.

Alternatively, from the terminal:
```bash
python start.py
```

---

### Manual Step-by-Step Launch
```bash
# Navigate to project root
cd "d:\B Vcoding\attend"

# Seed database, generate 128-D student biometrics & synthesize sample CCTV footage
python -m backend.app.seed.seed_data
```

### Step 2: Launch the FastAPI Backend Server
```bash
# Start backend server on port 8000
python backend/run.py
```
*Swagger / OpenAPI Docs are accessible at:* `http://localhost:8000/docs`

### Step 3: Launch the Frontend Application
```bash
cd frontend

# Run development server with live HMR
npm run dev
```
*Frontend application is accessible at:* `http://localhost:5173`

---

## 6. Key Functional Modules

1. **Cinematic Landing Page:** Introduces the platform with smooth Framer Motion animations, interactive CV HUD preview, 6-stage pipeline walkthrough, and technology specifications.
2. **Admin Command Overview:** Real database metrics, 14-day attendance trend area chart, live classroom occupancy gauges, and recent lecture session logs.
3. **Faculty Teaching Hub:** Personalized instructor dashboard with today's scheduled lectures, assigned courses, and verification alerts.
4. **Student Directory & Biometric Enrollment:** Student roster with search & filters, dedicated 128-D face enrollment with Laplacian quality score check, and detailed student dossiers.
5. **CCTV Video Upload & Analysis:** Drag-and-drop footage uploader, one-click preset test footage, real-time FPS & detection telemetry, and annotated output video player with bounding box HUD.
6. **Live CCTV Classroom Monitor:** Live IP/RTSP camera ingestion via MJPEG streaming, real-time student occupancy counter, and camera health index.
7. **Attendance Sessions & Audit:** Lecture-wise attendance ledger, duplicate prevention, and faculty manual override workflow requiring mandatory justification reasons.
8. **Attendance Verification Centre:** Human-in-the-loop review queue for borderline recognitions with approve, reject, and reassign actions.
9. **Analytics & Shortage Alerts:** Cross-subject benchmarks and automatic alerts for students falling below the institutional 75% attendance threshold.
10. **Reports & Exports:** One-click generation of university-formatted ReportLab PDF audit reports and Excel (.xlsx) spreadsheets.
11. **Camera Fleet Management:** Register and monitor RTSP, webcam, or simulated CCTV feeds.
12. **Immutable Audit Trail:** Chronological tamper-evident logging of all logins, biometric updates, and overrides.
13. **System Configuration:** Dynamic calibration of face recognition thresholds, grace periods, and privacy retention rules.

---

## 7. Verification & Testing

To run the complete automated test suite:
```bash
python -m backend.test_system
```
All 9 core verification checks validate authentication, JWT security, 128-D biometric profiles, timetable auto-mapping, analytics calculations, ReportLab PDF rendering, and attendance records with 100% pass rate.

