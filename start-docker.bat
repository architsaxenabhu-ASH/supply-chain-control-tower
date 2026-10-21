@echo off
REM ============================================================
REM  Supply Chain Control Tower - run in Docker on this machine
REM  Double-click this file whenever you want to use the app.
REM
REM  It does everything for you:
REM    1. Starts Docker Desktop if it is not already running.
REM    2. Waits for Docker to be ready.
REM    3. Starts the app.
REM
REM  Website (frontend):  http://localhost:3000
REM  API (backend):       http://localhost:8000
REM
REM  Your existing data (the data\ folder) is used as-is.
REM  The app does NOT start on its own - only when you run this file.
REM ============================================================

cd /d "%~dp0"

echo.
echo  Checking that Docker is running...
docker info >nul 2>&1
if not errorlevel 1 goto dockerready

echo  Docker is not running. Starting Docker Desktop for you...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
echo  Waiting for Docker to be ready (this can take a minute the first time)...
set /a tries=0

:waitdocker
docker info >nul 2>&1
if not errorlevel 1 goto dockerready
set /a tries+=1
if %tries% geq 60 goto dockertimeout
timeout /t 3 >nul
goto waitdocker

:dockertimeout
echo.
echo  Docker did not become ready in time.
echo  Please open "Docker Desktop" from the Start menu, wait until it says
echo  "Engine running", then double-click this file again.
echo.
pause
exit /b 1

:dockerready
echo  Docker is running. Building and starting the app...
echo  (The first time takes a few minutes; after that it is fast.)
echo.

docker compose -f deployment/docker-compose.local.yml up -d --build
if errorlevel 1 (
  echo.
  echo  Something went wrong while starting. Scroll up to read the message.
  pause
  exit /b 1
)

echo.
echo  ============================================================
echo   App is running in Docker.
echo.
echo   Open in your browser:  http://localhost:3000
echo   Login:  architsaxenabhu@gmail.com
echo.
echo   To stop it later, run:  stop-docker.bat
echo  ============================================================
echo.
pause
