@echo off
setlocal
cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 goto missing_node
node -e "process.exit(Number(process.versions.node.split('.')[0]) < 24 ? 1 : 0)"
if errorlevel 1 goto old_node

echo Installing dependencies...
call npm ci
if errorlevel 1 goto failed
echo Building Family Albums...
call npm run build
if errorlevel 1 goto failed

echo.
echo Installation complete. Open start.bat to launch Family Albums.
exit /b 0

:missing_node
echo Node.js was not found. Install Node.js 24 LTS from https://nodejs.org/
goto failed

:old_node
echo Node.js 24 or newer is required. Download it from https://nodejs.org/
goto failed

:failed
echo.
echo Installation failed. Please copy the error above.
pause
exit /b 1
