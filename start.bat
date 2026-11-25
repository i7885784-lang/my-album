@echo off
setlocal
cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 goto missing_node
node -e "process.exit(Number(process.versions.node.split('.')[0]) < 24 ? 1 : 0)"
if errorlevel 1 goto old_node

if exist "node_modules\.package-lock.json" goto check_build
call "%~dp0install.bat"
if errorlevel 1 goto failed

:check_build
if exist "dist\index.html" goto launch
call npm run build
if errorlevel 1 goto failed

:launch
node "%~dp0scripts\launch.mjs"
if errorlevel 1 goto failed
exit /b 0

:missing_node
echo Node.js was not found. Install Node.js 24 LTS from https://nodejs.org/
goto failed

:old_node
echo Node.js 24 or newer is required. Download it from https://nodejs.org/
goto failed

:failed
echo.
echo Startup failed. Please keep this window open and copy the error above.
pause
exit /b 1
