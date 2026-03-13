@echo off
echo Stopping servers...

:: node (backend) 종료
taskkill /f /fi "WINDOWTITLE eq Backend" >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000.*LISTENING"') do taskkill /f /pid %%a >nul 2>&1

:: react (frontend) 종료
taskkill /f /fi "WINDOWTITLE eq Frontend" >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000.*LISTENING"') do taskkill /f /pid %%a >nul 2>&1

timeout /t 2 /nobreak >nul

echo Restarting Backend (port 3000) and Frontend (port 4000)...
start "Backend" cmd /k "cd /d %~dp0server && set PORT=3000 && node index.js"
start "Frontend" cmd /k "cd /d %~dp0client && set PORT=4000 && npm start"
