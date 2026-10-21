@echo off
title Control Tower - Demo Launcher
cd /d "%~dp0"

echo ============================================================
echo   SUPPLY CHAIN CONTROL TOWER - DEMO LAUNCHER
echo ============================================================
echo.
echo Three windows will open and STAY OPEN during your demo:
echo    1. Backend        (the data engine)
echo    2. Frontend       (the website)
echo    3. Public Link    (the shareable address)
echo.
echo Keep all three windows open while presenting.
echo To stop the demo, simply close the three windows.
echo ------------------------------------------------------------

start "Control Tower - Backend"  /D "%~dp0backend"  cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

start "Control Tower - Frontend" /D "%~dp0frontend" cmd /k "npm run dev -- --host --port 5173 --strictPort"

start "Control Tower - Public Link (copy the https address from this window)" /D "%~dp0" cmd /k "npx --yes cloudflared tunnel --url http://localhost:5173 --logfile %~dp0tunnel.log"

echo.
echo ============================================================
echo   ALMOST READY
echo ============================================================
echo.
echo In the "Public Link" window, wait about 15 seconds, then look
echo for a line like:
echo.
echo     https://something-something.trycloudflare.com
echo.
echo That is the link to share with your management team.
echo (The address changes each time you launch.)
echo.
echo Login details are in your private archive note - deliberately not stored in git.
echo ============================================================
echo.
pause
