@echo off
title Share Library Online - Kuthbukhana Anwariyya
cd /d "%~dp0"

echo ==============================================================
echo   SHARE LIBRARY ONLINE FOR PRINCIPAL REMOTE ACCESS
echo ==============================================================
echo.
echo Creating a secure public link for the Principal...
echo.
echo Make sure the Library Server is running!
echo.

npx localtunnel --port 5000

pause
