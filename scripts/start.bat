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

:: Check for mode argument
set MODE=%1
if "%MODE%"=="" set MODE=compose

if "%MODE%"=="pull" goto :docker_pull
if "%MODE%"=="docker" goto :docker_pull

:: Default: Docker Compose mode
:compose
echo.
echo Building and starting AppDock...
docker compose up -d --build
goto :check_result

:: Docker Hub mode
:docker_pull
set IMAGE=nguyenhao2042/appdock:latest
if defined APPDOCK_IMAGE set IMAGE=%APPDOCK_IMAGE%

echo.
echo Starting AppDock from Docker Hub...
echo Image: %IMAGE%

:: Stop existing container
docker stop appdock >nul 2>&1
docker rm appdock >nul 2>&1

:: Pull and run
docker pull %IMAGE%
docker run -d --name appdock -p 3000:3000 -v //var/run/docker.sock:/var/run/docker.sock --restart unless-stopped %IMAGE%
goto :check_result

:check_result
if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] AppDock is now running!
    echo.
    echo Open http://localhost:3000 in your browser
    echo.
    echo Commands:
    echo   docker compose down        - Stop AppDock
    echo   docker compose logs -f     - View logs
    echo   docker compose restart     - Restart
    echo.
    echo Or if using Docker run:
    echo   docker stop appdock        - Stop
    echo   docker logs -f appdock     - View logs
    echo   docker start appdock       - Restart
) else (
    echo [ERROR] Failed to start AppDock
    pause
    exit /b 1
)

pause
