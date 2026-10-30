@echo off
setlocal
title ClearMark - PostgreSQL Database Viewer

cd /d "%~dp0"

REM 1. Activate Python virtual environment if available
if exist "%~dp0venv\Scripts\activate.bat" call "%~dp0venv\Scripts\activate.bat"
if exist "%~dp0.venv\Scripts\activate.bat" call "%~dp0.venv\Scripts\activate.bat"
if exist "%~dp0backend\venv\Scripts\activate.bat" call "%~dp0backend\venv\Scripts\activate.bat"
if exist "%~dp0backend\.venv\Scripts\activate.bat" call "%~dp0backend\.venv\Scripts\activate.bat"

REM 2. Verify Python installation
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python is not installed or not found in PATH!
    echo Please install Python 3.9+ from https://www.python.org/
    echo.
    pause
    exit /b 1
)

REM 3. Check required packages
python -c "import sqlalchemy, psycopg2, PIL, dotenv" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [*] Installing required viewing dependencies...
    pip install sqlalchemy psycopg2-binary pillow python-dotenv
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to install viewer dependencies.
        pause
        exit /b 1
    )
)

:VIEWER_LOOP
python "%~dp0view_database.py"

echo.
echo ================================================================
echo  ClearMark - Database Viewer
echo  (c) 2026 Rifath Shifa M. All Rights Reserved.
echo  Developed by Rifath Shifa M
echo ================================================================
echo.
set /p USER_CHOICE="Press [R] to reopen viewer, or press Enter to exit: "
if /i "%USER_CHOICE%"=="r" goto :VIEWER_LOOP

exit /b 0
