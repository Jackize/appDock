@echo off
chcp 65001 >nul

echo.
echo   ___              ____             _    
echo  / _ \            ^|  _ \           ^| ^|   
echo ^| ^|_^| ^|_ __  _ __ ^| ^| ^| ^| ___   ___^| ^| __
echo ^|  _  ^| '_ \^| '_ \^| ^| ^| ^|/ _ \ / __^| ^|/ /
echo ^| ^| ^| ^| ^|_) ^| ^|_) ^| ^|_^| ^| (_) ^| (__^|   ^< 
echo ^|_^| ^|_^| .__/^| .__/^|____/ \___/ \___^|_^|\_\
echo       ^| ^|   ^| ^|                          
echo       ^|_^|   ^|_^|    Docker Management UI  
echo.

:: Check if Docker is running
echo Checking Docker...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)
echo [OK] Docker is running

:: Start AppDock
echo.
echo Starting AppDock...
docker compose up -d --build

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] AppDock is now running!
    echo.
    echo Open http://localhost:3000 in your browser
    echo.
    echo Commands:
    echo   Stop:    docker compose down
    echo   Logs:    docker compose logs -f
    echo   Restart: docker compose restart
) else (
    echo [ERROR] Failed to start AppDock
    pause
    exit /b 1
)

pause
