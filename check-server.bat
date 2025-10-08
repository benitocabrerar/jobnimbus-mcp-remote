@echo off
REM ============================================
REM JobNimbus MCP Server - CHECK STATUS
REM ============================================
echo.
echo ========================================
echo   JobNimbus MCP Server - DIAGNOSTICO
echo ========================================
echo.

REM Cambiar al directorio del proyecto
cd /d "%~dp0"

REM Variables
set SERVER_PORT=3000
set SERVER_URL=http://localhost:%SERVER_PORT%

REM ============================================
REM 1. Verificar proceso en puerto
REM ============================================
echo [1/5] Verificando puerto %SERVER_PORT%...
netstat -ano | findstr ":%SERVER_PORT%" | findstr "LISTENING" > temp_check.txt

if %errorlevel% equ 0 (
    echo [OK] Puerto %SERVER_PORT% esta en uso
    for /f "tokens=5" %%a in (temp_check.txt) do (
        echo [OK] PID del proceso: %%a
    )
    set SERVER_RUNNING=1
) else (
    echo [X] Puerto %SERVER_PORT% NO esta en uso
    echo [X] El servidor NO esta corriendo
    set SERVER_RUNNING=0
)

if exist temp_check.txt del temp_check.txt
echo.

REM ============================================
REM 2. Verificar procesos de Node.js
REM ============================================
echo [2/5] Verificando procesos de Node.js...
tasklist | findstr /i "node.exe" > nul
if %errorlevel% equ 0 (
    echo [OK] Node.js esta corriendo
    tasklist | findstr /i "node.exe"
) else (
    echo [X] No se encontraron procesos de Node.js
)
echo.

REM ============================================
REM 3. Verificar conectividad HTTP
REM ============================================
echo [3/5] Verificando conectividad HTTP...
if %SERVER_RUNNING% equ 1 (
    echo Intentando conectar a %SERVER_URL%...

    REM Intentar hacer curl sin API key (deberia retornar 401)
    curl -s -o temp_response.txt -w "%%{http_code}" %SERVER_URL%/ > temp_status.txt
    set /p HTTP_STATUS=<temp_status.txt

    if "!HTTP_STATUS!" == "401" (
        echo [OK] Servidor respondio correctamente ^(HTTP 401 - API key requerida^)
        echo [OK] El servidor esta funcionando
        type temp_response.txt
    ) else if "!HTTP_STATUS!" == "200" (
        echo [OK] Servidor respondio ^(HTTP 200^)
        type temp_response.txt
    ) else (
        echo [?] Servidor respondio con codigo HTTP: !HTTP_STATUS!
        type temp_response.txt
    )

    if exist temp_response.txt del temp_response.txt
    if exist temp_status.txt del temp_status.txt
) else (
    echo [X] Servidor no esta corriendo, no se puede verificar HTTP
)
echo.

REM ============================================
REM 4. Verificar archivos del proyecto
REM ============================================
echo [4/5] Verificando archivos del proyecto...

if exist "package.json" (
    echo [OK] package.json encontrado
) else (
    echo [X] package.json NO encontrado
)

if exist "node_modules\" (
    echo [OK] node_modules/ encontrado
) else (
    echo [X] node_modules/ NO encontrado - ejecuta: npm install
)

if exist "dist\" (
    echo [OK] dist/ encontrado ^(proyecto compilado^)
) else (
    echo [X] dist/ NO encontrado - ejecuta: npm run build
)

if exist ".env" (
    echo [OK] .env encontrado
) else (
    echo [X] .env NO encontrado - copia .env.example a .env
)
echo.

REM ============================================
REM 5. Resumen del estado
REM ============================================
echo [5/5] Resumen del estado
echo ========================================

if %SERVER_RUNNING% equ 1 (
    echo.
    echo   ESTADO: SERVIDOR CORRIENDO
    echo   Puerto: %SERVER_PORT%
    echo   URL:    %SERVER_URL%
    echo.
    echo [ACCIONES DISPONIBLES]
    echo - Ver logs: Revisa la ventana donde ejecutaste start-server.bat
    echo - Detener: Ejecuta stop-server.bat
    echo.
) else (
    echo.
    echo   ESTADO: SERVIDOR DETENIDO
    echo.
    echo [ACCIONES RECOMENDADAS]
    echo - Iniciar servidor: Ejecuta start-server.bat
    echo - Verificar configuracion: Revisa el archivo .env
    echo.
)

echo ========================================
echo.
pause
