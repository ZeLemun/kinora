@echo off
title Kinora Server
echo Starting Kinora server...
echo.

REM Set project directory
set PROJECT_DIR=%~dp0

REM Check if node_modules exists
if not exist "%PROJECT_DIR%node_modules" (
    echo Installing dependencies...
    cd /d "%PROJECT_DIR%"
    npm install
    echo.
)

echo Server will be available at: http://localhost:3000
echo HLS proxy at: http://localhost:3000/api/stream
echo TMDB proxy at: http://localhost:3000/api/tmdb/...
echo.
echo Press Ctrl+C to stop the server
echo.

cd /d "%PROJECT_DIR%"
node server.cjs

pause