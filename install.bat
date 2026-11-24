@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Установите Node.js 24 LTS с https://nodejs.org/
  pause
  exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 (
  echo Требуется Node.js 24 LTS или новее.
  pause
  exit /b 1
)
call npm ci
if errorlevel 1 (
  echo Не удалось установить зависимости. Проверьте интернет и сообщения выше.
  pause
  exit /b 1
)
call npm run build
if errorlevel 1 (
  echo Ошибка сборки.
  pause
  exit /b 1
)
echo Установка завершена. Откройте start.bat.
