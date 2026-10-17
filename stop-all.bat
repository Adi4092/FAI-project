@echo off
setlocal enabledelayedexpansion

:: Root directory of the repository (strip trailing backslash to avoid \" escape issues in cmd)
set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

:: -----------------------------------------------------------------------------
:: Resolve Ports (Matching start-all.bat)
:: -----------------------------------------------------------------------------
set "AI_PORT=8000"
set "SERVER_PORT=5000"
set "CLIENT_PORT=5173"

if exist "%ROOT_DIR%\server\.env" (
    for /f "usebackq tokens=1,2 delims==" %%A in ("%ROOT_DIR%\server\.env") do (
        if /i "%%A"=="PORT" set "SERVER_PORT=%%B"
    )
)

echo ==============================================================================
echo Stopping MedStock AI Services
echo Target Ports: %AI_PORT% (AI Service), %SERVER_PORT% (Server), %CLIENT_PORT% (Client)
echo ==============================================================================

for %%P in (%AI_PORT% %SERVER_PORT% %CLIENT_PORT%) do (
    call :StopPortProcess %%P
)

echo.
echo ==============================================================================
echo Port Status Verification:
echo ==============================================================================
for %%P in (%AI_PORT% %SERVER_PORT% %CLIENT_PORT%) do (
    set "STILL_ACTIVE=0"
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr /R /C:":%%P[ ]" ^| findstr "LISTENING"') do (
        set "STILL_ACTIVE=1"
    )
    if "!STILL_ACTIVE!"=="0" (
        echo   [OK] Port %%P is free.
    ) else (
        echo   [WAIT] Port %%P is still closing or active.
    )
)
echo ==============================================================================
echo All target services stopped.
exit /b 0

:: Helper to kill process by port
:StopPortProcess
set "PORT=%1"
set "FOUND=0"
echo Scanning for process listening on port %PORT%...
for /f "tokens=5" %%A in ('netstat -ano ^| findstr /R /C:":%PORT%[ ]" ^| findstr "LISTENING"') do (
    set "TARGET_PID=%%A"
    if not "!TARGET_PID!"=="0" (
        echo   Found PID !TARGET_PID! on port %PORT%. Terminating process tree...
        taskkill /F /T /PID !TARGET_PID! >nul 2>&1
        set "FOUND=1"
    )
)
if "!FOUND!"=="0" (
    echo   No active listening process found on port %PORT%.
)
exit /b 0
