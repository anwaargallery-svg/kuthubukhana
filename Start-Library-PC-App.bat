@echo off
title Kuthbukhana Anwariyya Library App
cd /d "%~dp0"

echo ==============================================================
echo   KUTHBUKHANA ANWARIYYA - LIBRARY DESKTOP APPLICATION
echo ==============================================================
echo.
echo Starting Library Backend Server & Desktop Window...
echo.

:: Launch Electron app directly (which auto-spawns server if not running)
npx electron .

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Electron launch exited or not available.
    echo Launching Native Windows Desktop App Mode...
    start "" node server.js
    timeout /t 2 /nobreak >nul
    start msedge --app=http://localhost:5000
)

