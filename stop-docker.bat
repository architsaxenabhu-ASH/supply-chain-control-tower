@echo off
REM Stop the Docker app started by start-docker.bat.
cd /d "%~dp0"
echo  Stopping the app containers...
docker compose -f deployment/docker-compose.local.yml down
echo.
echo  Stopped. Your data in the data\ folder is kept.
pause
