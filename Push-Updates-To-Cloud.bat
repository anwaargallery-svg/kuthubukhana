@echo off
title Push Updates to Cloud (Render Website)
echo ==============================================================
echo   KUTHBUKHANA ANWARIYYA - CLOUD DEPLOYMENT TOOL
echo ==============================================================
echo.
echo Pushing latest fixes (Teacher login, Principal access, high capacity)
echo to GitHub repository (origin main)...
echo.
git push origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo ==============================================================
    echo  SUCCESS! Changes pushed to GitHub!
    echo  Render will now automatically rebuild and update your site:
    echo  https://kuthubukhana.onrender.com
    echo ==============================================================
) else (
    echo ==============================================================
    echo  PUSH FAILED! Please ensure you are logged into your GitHub account.
    echo ==============================================================
)
echo.
pause
