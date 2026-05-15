@echo off
chcp 65001 >nul
echo ========================================
echo   LearningTool — Windows 一键启动
echo ========================================
echo.
cd /d "%~dp0\.."

if not exist ".env" (
    echo [0/3] Creating .env from .env.example...
    copy .env.example .env >nul
    echo   Please edit .env to set your DEEPSEEK_API_KEY
)

if not exist "node_modules" (
    echo [1/3] Installing dependencies...
    call npm install
)

echo [2/3] Starting server...
echo.
call npm start
pause
