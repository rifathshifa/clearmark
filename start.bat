@echo off
setlocal
title AuraMark AI - One-Click Launcher

echo ================================================================
echo       AuraMark AI - Neural Watermark Remover Launcher
echo ================================================================
echo.

cd /d "%~dp0"

:: 1. Verify Python installation
echo [1/5] Checking Python environment...
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python 3.9+ from https://www.python.org/
    echo Be sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version 2^>^&1') do set "PYTHON_VER=%%i"
echo   Found %PYTHON_VER%

:: 2. Verify Node.js and NPM installation
echo [2/5] Checking Node.js and npm environment...
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v 2^>^&1') do set "NODE_VER=%%i"
echo   Found Node %NODE_VER%

where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm is not found!
    echo.
    pause
    exit /b 1
)

:: 3. Check and install Backend dependencies
echo [3/5] Verifying backend Python dependencies...
python -c "import flask, cv2, onnxruntime, imageio_ffmpeg, sqlalchemy, psycopg2" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   Installing missing Python packages from backend\requirements.txt...
    pip install -r backend\requirements.txt
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to install Python dependencies!
        pause
        exit /b 1
    )
) else (
    echo   Backend dependencies verified: Flask, OpenCV, ONNXRuntime, FFmpeg, SQLAlchemy, PostgreSQL.
)

:: 4. Check and install Frontend dependencies
echo [4/5] Verifying frontend dependencies...
if not exist "frontend\node_modules\" (
    echo   Installing frontend npm packages in frontend folder...
    pushd "%~dp0frontend"
    call npm install
    if %ERRORLEVEL% neq 0 (
        popd
        echo [ERROR] Failed to install npm dependencies!
        pause
        exit /b 1
    )
    popd
) else (
    echo   Frontend dependencies verified.
)

:: 5. Launch Backend and Frontend in separate windows
echo [5/5] Launching AuraMark AI services...
echo.
echo   Starting Backend  on http://localhost:5000 ...
start "AuraMark AI - Backend Server" cmd /k "cd /d "%~dp0backend" && python app.py"

:: Wait 2 seconds
ping 127.0.0.1 -n 3 >nul

echo   Starting Frontend on http://localhost:5173 ...
start "AuraMark AI - Frontend Client" cmd /k "cd /d "%~dp0frontend" && npm run dev"

:: Wait 3 seconds then open browser
ping 127.0.0.1 -n 4 >nul
start http://localhost:5173/

echo ================================================================
echo   AuraMark AI is running!
echo.
echo   - Web UI:  http://localhost:5173
echo   - Backend: http://localhost:5000
echo.
echo   HOW TO STOP:
echo   Close the two opened terminal windows:
echo     1. AuraMark AI - Backend Server
echo     2. AuraMark AI - Frontend Client
echo   Or press Ctrl+C inside each window.
echo ================================================================
echo.
pause
