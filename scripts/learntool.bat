@echo off
setlocal enabledelayedexpansion

:: ============================================================
:: LearningTool CLI — learntool.bat (Windows)
:: Usage: learntool [start|stop|status|install] [options]
:: ============================================================

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%\.."

:: ---- Defaults ----
set "PORT=3000"
set "DEV_MODE=false"
set "VERBOSE=false"
set "SKIP_ENV=false"
set "ACTION=start"

:: ---- Parse arguments ----
:parse_args
if "%~1"=="" goto :dispatch

set "ARG=%~1"
if /I "%ARG%"=="start"        goto :set_start
if /I "%ARG%"=="stop"         goto :set_stop
if /I "%ARG%"=="status"       goto :set_status
if /I "%ARG%"=="install"      goto :set_install
if /I "%ARG%"=="docker-start" goto :set_docker_start
if /I "%ARG%"=="docker-stop"  goto :set_docker_stop
if /I "%ARG%"=="docker-build" goto :set_docker_build
if /I "%ARG%"=="-p"           goto :set_port
if /I "%ARG%"=="--port"       goto :set_port
if /I "%ARG%"=="-d"           set "DEV_MODE=true" & shift & goto :parse_args
if /I "%ARG%"=="--dev"        set "DEV_MODE=true" & shift & goto :parse_args
if /I "%ARG%"=="-v"           set "VERBOSE=true" & shift & goto :parse_args
if /I "%ARG%"=="--verbose"    set "VERBOSE=true" & shift & goto :parse_args
if /I "%ARG%"=="--skip-env"   set "SKIP_ENV=true" & shift & goto :parse_args
if /I "%ARG%"=="-h"           goto :show_help
if /I "%ARG%"=="--help"       goto :show_help

echo 未知选项: %ARG%
echo 使用 learntool --help 查看帮助
exit /b 1

:set_start
set "ACTION=start"
shift
goto :parse_args

:set_stop
set "ACTION=stop"
shift
goto :parse_args

:set_status
set "ACTION=status"
shift
goto :parse_args

:set_install
set "ACTION=install"
shift
goto :parse_args

:set_docker_start
set "ACTION=docker-start"
shift
goto :parse_args

:set_docker_stop
set "ACTION=docker-stop"
shift
goto :parse_args

:set_docker_build
set "ACTION=docker-build"
shift
goto :parse_args

:set_port
set "PORT=%~2"
shift
shift
goto :parse_args

:show_help
echo.
echo LearningTool — 智能论文阅读 ^& 刷题工具
echo.
echo 用法:
echo   learntool [命令] [选项]
echo.
echo 命令:
echo   start              启动服务器 (默认)
echo   stop               停止服务器
echo   status             查看服务器状态
echo   install            安装依赖
echo   docker-start       容器化启动
echo   docker-stop        容器化停止
echo   docker-build       构建容器镜像
echo.
echo 选项:
echo   -p, --port ^<port^>      指定端口 (默认: 3000)
echo   -d, --dev              开发模式
echo   -v, --verbose          详细日志模式
echo   --skip-env             跳过 .env 文件检查
echo   -h, --help             显示此帮助信息
echo.
echo 示例:
echo   learntool                          # 默认端口启动
echo   learntool --port 8080              # 指定端口启动
echo   learntool --dev --verbose          # 开发模式 + 详细日志
echo   learntool start -p 8080 -v         # 等同于上面
echo   learntool stop                     # 停止服务器
echo   learntool status                   # 查看运行状态
echo.
exit /b 0

:: ============================================================
:dispatch
if "%ACTION%"=="stop"         goto :action_stop
if "%ACTION%"=="status"       goto :action_status
if "%ACTION%"=="install"      goto :action_install
if "%ACTION%"=="docker-start" goto :action_docker_start
if "%ACTION%"=="docker-stop"  goto :action_docker_stop
if "%ACTION%"=="docker-build" goto :action_docker_build

:: ==== start (default) ====
echo.
echo ================================================================
echo   LearningTool CLI
echo   Time: %date% %time%
echo ================================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERR] Node.js not found. Install Node.js ^>= 20.
    exit /b 1
)

echo   Node.js :
node -v
echo   npm     :
npm -v
echo   CWD     : %cd%
echo.

if "%SKIP_ENV%"=="false" (
    if not exist ".env" (
        if exist ".env.example" (
            copy /y .env.example .env >nul 2>&1
            echo   [WARN] .env created from .env.example
        ) else (
            echo PORT=3000> .env
            echo DEEPSEEK_API_KEY=sk-your-key-here>> .env
            echo SESSION_SECRET=learningtool-dev-secret>> .env
            echo   [WARN] .env created with defaults
        )
    )
)

if not exist "node_modules" (
    echo   Installing dependencies...
    call npm install
    if !errorlevel! neq 0 (
        echo   [ERR] npm install failed
        exit /b 1
    )
)

if "%DEV_MODE%"=="true" set "NODE_ENV=development"
if not "%PORT%"=="" set "PORT=%PORT%"

if "%VERBOSE%"=="true" (
    echo   Verbose mode: ON
    echo   Port: %PORT%
    echo   Dev Mode: %DEV_MODE%
    echo.
)

echo   Starting LearningTool on port %PORT%...
echo ================================================================
echo.

node server.js

echo.
echo   Server stopped.
pause
exit /b 0

:action_stop
echo Stopping LearningTool...
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr /r ":%PORT% .*LISTENING"') do (
    echo   Killing PID %%P...
    taskkill /F /PID %%P >nul 2>&1
)
echo   Done.
exit /b 0

:action_status
echo Checking LearningTool status...
netstat -ano 2>nul | findstr /r ":%PORT% " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo   Status: RUNNING on port %PORT%
    netstat -ano 2>nul | findstr /r ":%PORT% .*LISTENING"
) else (
    echo   Status: STOPPED
)
exit /b 0

:action_install
echo Installing dependencies...
call npm install
echo Done.
exit /b 0

:action_docker_start
echo Starting via Docker Compose...
docker-compose up -d
docker-compose ps
echo Done.
exit /b 0

:action_docker_stop
echo Stopping Docker containers...
docker-compose down
echo Done.
exit /b 0

:action_docker_build
echo Building Docker image...
docker build -t learntool:latest .
echo Done.
exit /b 0
