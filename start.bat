@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Установите Node.js 24 LTS с https://nodejs.org/ и повторите запуск.
  pause
  exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 (
  echo Требуется Node.js 24 LTS или новее.
  pause
  exit /b 1
)
if not exist node_modules\.package-lock.json (
  call install.bat
  if errorlevel 1 exit /b 1
)
if not exist dist\index.html (
  call npm run build
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
node scripts\launch.mjs
if errorlevel 1 pause
