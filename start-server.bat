@echo off
REM ============================================
REM JobNimbus MCP Server - START
REM ============================================
echo.
echo ========================================
echo   JobNimbus MCP Server - INICIANDO
echo ========================================
echo.

REM Cambiar al directorio del proyecto
cd /d "%~dp0"

REM Verificar que exista node_modules
if not exist "node_modules\" (
    echo [ERROR] No se encontro node_modules
    echo Ejecutando npm install...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Fallo npm install
        pause
        exit /b 1
    )
)

REM Verificar que exista el archivo .env
if not exist ".env" (
    echo.
    echo [ADVERTENCIA] No se encontro archivo .env
    echo Creando .env desde .env.example...
    copy .env.example .env
    echo.
    echo [IMPORTANTE] Edita el archivo .env y agrega tus API keys:
    echo - STAMFORD_API_KEY=tu_api_key_aqui
    echo - GUILFORD_API_KEY=tu_api_key_aqui
    echo.
    echo Presiona cualquier tecla para continuar o CTRL+C para cancelar...
    pause > nul
)

REM Compilar el proyecto si es necesario
if not exist "dist\" (
    echo Compilando proyecto TypeScript...
    call npm run build
    if errorlevel 1 (
        echo [ERROR] Fallo la compilacion
        pause
        exit /b 1
    )
)

REM Mostrar informacion
echo.
echo [OK] Iniciando servidor...
echo [OK] Puerto: 3000
echo [OK] URL local: http://localhost:3000
echo.
echo Presiona CTRL+C para detener el servidor
echo.

REM Iniciar el servidor
call npm start

REM Si el servidor se detiene
echo.
echo [INFO] Servidor detenido
pause
