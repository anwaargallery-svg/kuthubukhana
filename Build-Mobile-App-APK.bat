@echo off
title Build Mobile App APK - Kuthbukhana Anwariyya
cd /d "%~dp0"

echo ======================================================================
echo   KUTHBUKHANA ANWARIYYA - MOBILE APP (.APK) BUILDER
echo ======================================================================
echo.
echo Setting up Android environment...
set "JAVA_HOME=D:\fletter\android studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo Building Android Mobile App package (Optimized Release APK)...
echo This will produce an installable .apk file for any Android phone.
echo.

cd mobile_app\android
call gradlew.bat assembleRelease

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ==================================================================
    echo [SUCCESS] Release APK Built Successfully!
    echo ==================================================================
    copy /y "..\build\app\outputs\flutter-apk\app-release.apk" "..\..\Kuthbukhana-Library.apk"
    echo.
    echo The installable APK is located at:
    echo   %~dp0Kuthbukhana-Library.apk
    echo.
    echo You can now:
    echo   1. Send "Kuthbukhana-Library.apk" via WhatsApp, Bluetooth, or USB to any phone.
    echo   2. Tap the APK file on the phone to install it like an .exe!
    echo   3. Connect to either Cloud Server or Local Library Wi-Fi.
    echo.
) else (
    echo.
    echo [ERROR] Build encountered an error.
)

pause
