@echo off
setlocal enabledelayedexpansion
title SYNAPSE — AI Smart Attendance & Classroom Intelligence
color 0F

echo ===================================================================
echo   SYNAPSE // AI SMART ATTENDANCE & CLASSROOM INTELLIGENCE PLATFORM
echo   Intelligence. Accuracy. Attendance.
echo ===================================================================
echo.

cd /d "%~dp0"

:: Check Python installation
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python was not found in PATH!
    echo Please install Python 3.10+ and add it to your PATH environment variable.
    echo.
    pause
    exit /b 1
)

:: Run coordinated startup script
python start.py

if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Application stopped or encountered an error.
    pause
)

