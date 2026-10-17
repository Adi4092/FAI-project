@echo off
setlocal enabledelayedexpansion

:: Root directory of the repository (strip trailing backslash to avoid \" escape issues in cmd)
set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

:: -----------------------------------------------------------------------------
:: 1. Prerequisite Validation
:: -----------------------------------------------------------------------------
set "MISSING=0"

if not exist "%ROOT_DIR%\ai-service\.venv" (
    echo [ERROR] Missing Python virtual environment: ai-service\.venv
    echo Setup step to run:
    echo   cd /d "%ROOT_DIR%\ai-service"
    echo   python -m venv .venv
    echo   call .venv\Scripts\activate.bat
    echo   pip install -r requirements.txt
    echo.
    set "MISSING=1"
)

if not exist "%ROOT_DIR%\server\node_modules" (
    echo [ERROR] Missing Node.js dependencies: server\node_modules
    echo Setup step to run:
    echo   cd /d "%ROOT_DIR%\server"
    echo   npm install
    echo.
    set "MISSING=1"
)

if not exist "%ROOT_DIR%\client\node_modules" (
    echo [ERROR] Missing Node.js dependencies: client\node_modules
    echo Setup step to run:
    echo   cd /d "%ROOT_DIR%\client"
    echo   npm install
    echo.
    set "MISSING=1"
)

if not exist "%ROOT_DIR%\server\.env" (
    echo [ERROR] Missing server configuration file: server\.env
    echo Setup step to run:
    echo   copy "%ROOT_DIR%\server\.env.example" "%ROOT_DIR%\server\.env"
    echo   Configure MONGODB_URI and JWT secrets in server\.env
    echo.
    set "MISSING=1"
)

if "!MISSING!"=="1" (
    echo ==============================================================================
    echo [ERROR] Prerequisites check failed. Please run the setup steps above and retry.
    echo ==============================================================================
    exit /b 1
)

:: -----------------------------------------------------------------------------
:: 2. Port Configuration Resolution
:: -----------------------------------------------------------------------------
set "AI_PORT=8000"
set "SERVER_PORT=5000"
set "CLIENT_PORT=5173"

:: Read PORT from server/.env if present
if exist "%ROOT_DIR%\server\.env" (
    for /f "usebackq tokens=1,2 delims==" %%A in ("%ROOT_DIR%\server\.env") do (
        if /i "%%A"=="PORT" set "SERVER_PORT=%%B"
    )
)

echo ==============================================================================
echo Starting MedStock AI - All Three Services
echo ==============================================================================
echo  1. AI Service   : http://localhost:%AI_PORT%
echo  2. Express API  : http://localhost:%SERVER_PORT%
echo  3. Client Web   : http://localhost:%CLIENT_PORT%
echo ==============================================================================
echo.

:: -----------------------------------------------------------------------------
:: 3. Launch Services in Separate Titled CMD Windows
:: -----------------------------------------------------------------------------
echo Launching AI Service window...
cd /d "%ROOT_DIR%\ai-service"
start "AI Service (%AI_PORT%)" cmd /k "call .venv\Scripts\activate.bat && uvicorn app.main:app --reload --reload-dir app --port %AI_PORT%"

echo Launching Express Server window...
cd /d "%ROOT_DIR%\server"
start "Server (%SERVER_PORT%)" cmd /k "npm run dev"

echo Launching Vite Client window...
cd /d "%ROOT_DIR%\client"
start "Client (%CLIENT_PORT%)" cmd /k "npm run dev"

cd /d "%ROOT_DIR%"

:: -----------------------------------------------------------------------------
:: 4. Wait ~8 Seconds and Open Browser
:: -----------------------------------------------------------------------------
echo.
echo Waiting 8 seconds for services to initialize...
ping 127.0.0.1 -n 9 >nul

echo Opening MedStock Client at http://localhost:%CLIENT_PORT% ...
start http://localhost:%CLIENT_PORT%

echo.
echo [OK] All services launched. Keep the three service windows open while developing.
echo To terminate all three services cleanly, run: stop-all.bat
exit /b 0
