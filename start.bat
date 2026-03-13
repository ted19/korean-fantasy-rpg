@echo off
echo Starting Backend (port 3000) and Frontend (port 4000)...

start "Backend" cmd /k "cd /d %~dp0server && set PORT=3000 && node index.js"
start "Frontend" cmd /k "cd /d %~dp0client && set PORT=4000 && npm start"
