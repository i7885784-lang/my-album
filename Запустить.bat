@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
    py -3 launch.py
) else (
    python launch.py
)
if errorlevel 1 (
    echo Install Python 3 from https://www.python.org/downloads/ and enable Add Python to PATH.
    pause
)
