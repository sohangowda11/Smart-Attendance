@echo off
title Smart Attendance API Server
echo Starting Smart Attendance API...
echo DO NOT CLOSE THIS WINDOW while using the app!
echo.
cd /d "%~dp0"
cd backend
start http://127.0.0.1:8000/dashboard
python -m uvicorn app:app
pause
