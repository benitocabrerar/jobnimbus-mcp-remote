@echo off
REM ============================================
REM JobNimbus MCP Server - STOP
REM ============================================
echo.
echo ========================================
echo   JobNimbus MCP Server - DETENIENDO
echo ========================================
echo.

REM Cambiar al directorio del proyecto
cd /d "%~dp0"

REM Buscar proceso Node.js corriendo en puerto 3000
echo Buscando servidor en puerto 3000...
netstat -ano | findstr ":3000" | findstr "LISTENING" > temp_port.txt

REM Verificar si se encontro el proceso
if %errorlevel% equ 0 (
    echo [OK] Servidor encontrado en puerto 3000

    REM Extraer el PID del proceso
    for /f "tokens=5" %%a in (temp_port.txt) do (
        set PID=%%a
        echo [INFO] PID del proceso: %%a

        REM Matar el proceso
        taskkill /F /PID %%a
        if errorlevel 1 (
            echo [ERROR] No se pudo detener el proceso %%a
        ) else (
            echo [OK] Servidor detenido exitosamente
        )
    )
) else (
    echo [INFO] No se encontro servidor corriendo en puerto 3000
)

REM Limpiar archivo temporal
if exist temp_port.txt del temp_port.txt

REM Verificar otros procesos de Node.js relacionados con jobnimbus
echo.
echo Verificando otros procesos de Node.js relacionados...
tasklist | findstr /i "node.exe" > nul
if %errorlevel% equ 0 (
    echo.
    echo Procesos de Node.js activos:
    tasklist | findstr /i "node.exe"
    echo.
    echo Si deseas detener TODOS los procesos de Node.js, ejecuta:
    echo taskkill /F /IM node.exe
) else (
    echo [OK] No hay procesos de Node.js corriendo
)

echo.
echo ========================================
echo   Operacion completada
echo ========================================
pause
