@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0\.."

echo.
echo ================================================================
echo   LearningTool - Startup Log
echo ================================================================
echo.

REM ---- 1. Environment ----
echo [1/7] Environment check ...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERR] Node.js not found in PATH
    pause & exit /b 1
)
for /f "tokens=*" %%V in ('node -v') do echo   Node.js : %%V
for /f "tokens=*" %%V in ('npm -v') do echo   npm     : %%V
echo   OK
echo.

REM ---- 2. Project files ----
echo [2/7] Project file check ...
if not exist "server.js"     echo   [WARN] server.js missing
if not exist "index.html"    echo   [WARN] index.html missing
if not exist "package.json"  echo   [WARN] package.json missing

set "JSCOUNT=0" & set "VIEWCOUNT=0" & set "CSCOUNT=0"
for /f "delims=" %%F in ('dir /s /b src\js\*.js 2^>nul ^| find /c ".js"') do set "JSCOUNT=%%F"
for /f "delims=" %%F in ('dir /s /b src\views\*.html 2^>nul ^| find /c ".html"') do set "VIEWCOUNT=%%F"
for /f "delims=" %%F in ('dir /s /b src\css\*.css 2^>nul ^| find /c ".css"') do set "CSCOUNT=%%F"
echo   JS files   : !JSCOUNT!
echo   View files : !VIEWCOUNT!
echo   CSS files  : !CSCOUNT!
echo.

REM ---- 3. .env config ----
echo [3/7] Environment config (.env) ...
if not exist ".env" (
    if exist ".env.example" (
        copy /y .env.example .env >nul 2>&1
        echo   [WARN] .env created from .env.example
    ) else (
        echo PORT=3000> .env
        echo DEEPSEEK_API_KEY=sk-your-key-here>> .env
        echo SESSION_SECRET=learningtool-dev-secret>> .env
        echo   [WARN] .env created with placeholders
    )
)
findstr /c:"DEEPSEEK_API_KEY=sk-" .env >nul 2>&1
if !errorlevel! equ 0 (
    findstr /c:"DEEPSEEK_API_KEY=sk-your-key-here" .env >nul 2>&1
    if !errorlevel! equ 0 (
        echo   [WARN] DEEPSEEK_API_KEY is placeholder - AI will fail
    ) else (
        echo   DEEPSEEK_API_KEY : configured
    )
) else (
    echo   [WARN] DEEPSEEK_API_KEY not set
)
echo.

REM ---- 4. Dependencies ----
echo [4/7] Dependencies (node_modules) ...
if not exist "node_modules" (
    echo   Running npm install ...
    call npm install
    if !errorlevel! neq 0 (
        echo   [ERR] npm install failed
        pause & exit /b 1
    )
)
if exist "node_modules\express"  (echo   express         : OK) else (echo   [WARN] express missing)
if exist "node_modules\multer"   (echo   multer          : OK) else (echo   [WARN] multer missing)
if exist "node_modules\dotenv"   (echo   dotenv          : OK) else (echo   [WARN] dotenv missing)
echo.

REM ---- 5. Port check ----
echo [5/7] Port availability ...
set "PORT=3000"
for /f "tokens=2 delims==" %%P in ('findstr /c:"PORT=" .env 2^>nul') do set "PORT=%%P"
netstat -ano 2>nul | findstr /r ":%PORT% .*LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    echo   [WARN] Port %PORT% in use - killing ...
    for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr /r ":%PORT% .*LISTENING"') do (
        taskkill /F /PID %%P >nul 2>&1
    )
    timeout /t 1 /nobreak >nul
)
echo   Port %PORT% OK
echo.

REM ---- 6. Start server ----
echo [6/7] Starting Node.js server ...
if not exist "data\logs" mkdir data\logs 2>nul
start /B "" node server.js > data\logs\server.log 2>&1

echo   Waiting for server ...
set "READY=0"
for /L %%i in (1,1,15) do (
    timeout /t 1 /nobreak >nul
    curl -s -o NUL http://localhost:%PORT%/ 2>nul
    if !errorlevel! equ 0 (
        set "READY=1"
        goto :ready
    )
    echo   ... %%i/15
)
:ready
if "!READY!"=="0" (
    echo   [ERR] Server did not start within 15s
    echo   Last lines from server.log:
    powershell -Command "Get-Content data\logs\server.log -Tail 20" 2>nul
    pause & exit /b 1
)
echo   Server is UP
echo.

REM ---- 7. Quick validation ----
echo [7/7] Quick validation ...
curl -s -o NUL http://localhost:%PORT%/src/js/app.js          && echo   GET /src/js/app.js          : 200
curl -s -o NUL http://localhost:%PORT%/src/js/router.js       && echo   GET /src/js/router.js       : 200
curl -s -o NUL http://localhost:%PORT%/src/views/settings.html && echo   GET /src/views/settings.html : 200
echo.

echo ================================================================
echo   Server running at http://localhost:%PORT%
echo   Logs : data\logs\server.log
echo   Press ENTER to stop
echo ================================================================
echo.

set /p STOP=

echo Shutting down ...
taskkill /F /IM node.exe >nul 2>&1
echo Done.
pause
exit /b 0
