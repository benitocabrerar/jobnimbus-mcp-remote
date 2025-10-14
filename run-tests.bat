@echo off
REM Script para ejecutar tests del sistema de Attachments
REM JobNimbus MCP Remote

echo ================================
echo JobNimbus MCP - Test Runner
echo ================================
echo.

:menu
echo Selecciona el tipo de test a ejecutar:
echo.
echo 1. Tests Unitarios (rapido)
echo 2. Tests de Integracion
echo 3. Tests E2E (requiere API key)
echo 4. Todos los tests (Unit + Integration)
echo 5. Tests con Coverage
echo 6. Tests en modo Watch
echo 7. Solo tests de Attachments
echo 8. Ver reporte de Coverage
echo 9. Limpiar y ejecutar todo
echo 0. Salir
echo.

set /p choice="Ingresa tu opcion (0-9): "

if "%choice%"=="1" goto unit
if "%choice%"=="2" goto integration
if "%choice%"=="3" goto e2e
if "%choice%"=="4" goto all
if "%choice%"=="5" goto coverage
if "%choice%"=="6" goto watch
if "%choice%"=="7" goto attachments
if "%choice%"=="8" goto view_coverage
if "%choice%"=="9" goto clean_all
if "%choice%"=="0" goto end

echo Opcion invalida. Intenta de nuevo.
goto menu

:unit
echo.
echo Ejecutando tests unitarios...
echo ==============================
call npm run test:unit
goto continue

:integration
echo.
echo Ejecutando tests de integracion...
echo ==================================
call npm run test:integration
goto continue

:e2e
echo.
echo ================================
echo ATENCION: Tests E2E
echo ================================
echo.
echo Los tests E2E requieren:
echo - API key valida de JobNimbus
echo - Variables de entorno configuradas
echo.
echo Asegurate de tener configurado .env.test con:
echo   JOBNIMBUS_API_KEY_STAMFORD=tu-api-key
echo   TEST_JOB_ID=job-con-archivos
echo   RUN_E2E_TESTS=true
echo.
set /p confirm="Continuar? (S/N): "
if /i "%confirm%"=="S" (
    echo.
    echo Ejecutando tests E2E...
    call npm run test:e2e
) else (
    echo Tests E2E cancelados.
)
goto continue

:all
echo.
echo Ejecutando todos los tests (Unit + Integration)...
echo ==================================================
call npm run test:all
goto continue

:coverage
echo.
echo Ejecutando tests con coverage...
echo ================================
call npm run test:coverage
echo.
echo Coverage generado en: coverage/lcov-report/index.html
goto continue

:watch
echo.
echo Iniciando modo Watch...
echo =======================
echo Presiona Ctrl+C para salir
echo.
call npm run test:watch
goto continue

:attachments
echo.
echo Ejecutando tests de Attachments...
echo ==================================
call npm run test:attachments
goto continue

:view_coverage
echo.
echo Abriendo reporte de coverage...
if exist "coverage\lcov-report\index.html" (
    start coverage\lcov-report\index.html
    echo Reporte abierto en el navegador.
) else (
    echo Error: No existe reporte de coverage.
    echo Ejecuta primero: npm run test:coverage
)
goto continue

:clean_all
echo.
echo Limpiando y ejecutando todo...
echo ==============================
call npm run clean
echo.
echo Ejecutando tests con coverage...
call npm run test:coverage
echo.
echo Listo! Coverage disponible en: coverage/lcov-report/index.html
goto continue

:continue
echo.
echo ================================
echo Tests completados
echo ================================
echo.
set /p again="Ejecutar mas tests? (S/N): "
if /i "%again%"=="S" goto menu

:end
echo.
echo Gracias por usar el test runner!
echo.
pause
