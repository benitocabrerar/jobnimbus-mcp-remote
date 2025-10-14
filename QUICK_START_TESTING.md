# Quick Start - Ejecutar Tests

## Opción 1: Script Interactivo de Windows (Recomendado) 🎯

```bash
# Doble click en el archivo o ejecutar desde terminal
run-tests.bat
```

**El menú te permitirá:**
1. Tests Unitarios (rápido - 2 segundos)
2. Tests de Integración
3. Tests E2E (requiere API key)
4. Todos los tests
5. Tests con Coverage
6. Modo Watch (para desarrollo)
7. Solo tests de Attachments
8. Ver reporte de Coverage
9. Limpiar y ejecutar todo

## Opción 2: Comandos NPM Directos 🚀

### Tests Rápidos (Desarrollo)
```bash
# Lo más común - tests unitarios
npm run test:unit

# Solo attachments (46 tests + 46 tests)
npm run test:attachments

# Modo watch (se re-ejecuta al guardar)
npm run test:watch
```

### Tests Completos
```bash
# Todos los tests unit + integration
npm run test:all

# Con reporte de cobertura
npm run test:coverage
```

### Tests por Categoría
```bash
# Solo unitarios
npm run test:unit

# Solo integración
npm run test:integration

# Solo E2E (ver configuración abajo)
npm run test:e2e
```

## Opción 3: Tests E2E con API Real 🌐

### Paso 1: Configurar Credenciales
```bash
# Copiar template
copy .env.test.example .env.test

# Editar .env.test con tus valores
notepad .env.test
```

### Paso 2: Agregar tus Credenciales
```env
# En .env.test
JOBNIMBUS_API_KEY_STAMFORD=tu-api-key-aqui
TEST_JOB_ID=job-456-con-archivos
RUN_E2E_TESTS=true
```

### Paso 3: Ejecutar
```bash
npm run test:e2e
```

## Ver Resultados 📊

### Reporte de Cobertura en HTML
```bash
# Generar reporte
npm run test:coverage

# Abrir en navegador (Windows)
start coverage\lcov-report\index.html
```

### Output Detallado
```bash
npm run test:verbose
```

## Ejemplos de Output Esperado

### ✅ Tests Unitarios - Output Exitoso
```
Test Suites: 2 passed, 2 total
Tests:       73 passed, 73 total
Snapshots:   0 total
Time:        1.845 s

PASS tests/unit/getAttachments.test.ts
  GetAttachmentsTool
    Tool Definition
      ✓ should have correct tool name
      ✓ should have a description
      ✓ should define input schema with correct properties
    Basic Functionality
      ✓ should fetch all files without filters
      ✓ should include metadata in response
      ... (46 tests total)

PASS tests/unit/analyzeJobAttachments.test.ts
  AnalyzeJobAttachmentsTool
    Tool Definition
      ✓ should have correct tool name
      ✓ should have comprehensive description
      ... (46 tests total)
```

### 📊 Coverage Report - Output Esperado
```
----------------------|---------|----------|---------|---------|
File                  | % Stmts | % Branch | % Funcs | % Lines |
----------------------|---------|----------|---------|---------|
All files             |   85.23 |    78.45 |   82.15 |   86.32 |
 tools/attachments    |   92.15 |    85.32 |   90.12 |   93.45 |
  getAttachments.ts   |   94.23 |    88.15 |   92.34 |   95.12 |
  analyzeJob...ts     |   90.12 |    82.45 |   88.23 |   91.78 |
----------------------|---------|----------|---------|---------|
```

## Troubleshooting Común 🔧

### Error: "Cannot find module"
```bash
# Solución: Reinstalar dependencias
npm install
```

### Error: "Timeout exceeded"
```bash
# Solución: Ya está configurado en jest.config.js (30s)
# Si necesitas más tiempo, edita jest.config.js:
# testTimeout: 60000
```

### Tests E2E no corren
```bash
# Verificar que RUN_E2E_TESTS=true
echo $RUN_E2E_TESTS   # Linux/Mac
echo %RUN_E2E_TESTS%  # Windows

# Verificar API key
echo $JOBNIMBUS_API_KEY_STAMFORD
```

### Nock no intercepta (Tests de Integración)
```bash
# Verificar que nock está limpio
# Los tests deberían hacer clearApiMocks() en afterEach
```

## Desarrollo con TDD 🎯

### Flujo Recomendado

#### 1. Iniciar Watch Mode
```bash
npm run test:watch
```

#### 2. Escribir Test que Falla (RED)
```typescript
// tests/unit/myNewFeature.test.ts
it('should do something new', async () => {
  const result = await tool.execute({ newParam: 'value' }, mockContext);
  expect(result.newFeature).toBe('expected');
});
```

**Output esperado:**
```
FAIL tests/unit/myNewFeature.test.ts
  ✕ should do something new
    Expected: 'expected'
    Received: undefined
```

#### 3. Implementar Mínimo (GREEN)
```typescript
// src/tools/myTool.ts
async execute(input: Input, context: Context): Promise<Result> {
  if (input.newParam) {
    return { newFeature: 'expected' };
  }
  // ...
}
```

**Output esperado:**
```
PASS tests/unit/myNewFeature.test.ts
  ✓ should do something new (15ms)
```

#### 4. Refactorizar (REFACTOR)
```typescript
// Mejorar código manteniendo tests verdes
// Optimizar, limpiar, documentar
```

**Output esperado:**
```
PASS tests/unit/myNewFeature.test.ts
  ✓ should do something new (12ms)
```

## Comandos Útiles Durante Desarrollo 💡

```bash
# Ver qué tests hay disponibles
npm test -- --listTests

# Ejecutar test específico
npm test -- getAttachments.test.ts

# Ejecutar tests que coincidan con patrón
npm test -- --testNamePattern="should filter"

# Ejecutar solo tests que fallaron
npm test -- --onlyFailures

# Ejecutar con coverage de archivos específicos
npm test -- --collectCoverageFrom="src/tools/attachments/**"

# Ejecutar sin coverage (más rápido)
npm test -- --no-coverage
```

## Integración con VSCode 🎨

### Extensión Recomendada
1. Instalar "Jest Runner" extension
2. Aparecerán botones "Run" y "Debug" sobre cada test
3. Click derecho → "Run Jest" en cualquier archivo de test

### Tasks.json Sugerido
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Run Unit Tests",
      "type": "shell",
      "command": "npm run test:unit",
      "group": {
        "kind": "test",
        "isDefault": true
      }
    },
    {
      "label": "Run Tests with Coverage",
      "type": "shell",
      "command": "npm run test:coverage"
    }
  ]
}
```

## Preguntas Frecuentes ❓

### ¿Cuánto tiempo toman los tests?
- **Unitarios**: ~2 segundos (73 tests)
- **Integración**: ~5 segundos (28 tests)
- **E2E**: ~30-60 segundos (18 tests, depende de red)

### ¿Puedo ejecutar un solo test?
```bash
# Sí, usando testNamePattern
npm test -- --testNamePattern="should have correct tool name"
```

### ¿Cómo agregar un nuevo test?
1. Crear archivo en `tests/unit/` o `tests/integration/`
2. Importar fixtures y helpers
3. Escribir test siguiendo ejemplos existentes
4. Ejecutar `npm run test:watch`

### ¿Los tests modifican datos reales?
- **Unitarios**: No, usan mocks
- **Integración**: No, usan nock (API mockeada)
- **E2E**: Sí, usan API real (solo lectura por defecto)

### ¿Necesito limpiar algo después de los tests?
No, Jest y los helpers limpian automáticamente:
- Mocks se resetean en `afterEach`
- Nock se limpia en `afterEach`
- Variables globales se restauran

## Checklist Pre-Commit ✅

Antes de hacer commit, ejecuta:

```bash
# 1. Tests unitarios
npm run test:unit

# 2. Linting
npm run lint

# 3. Type checking
npm run type-check

# 4. Build (para verificar que compila)
npm run build
```

O todo junto:
```bash
npm run test:unit && npm run lint && npm run type-check && npm run build
```

## Recursos Adicionales 📚

- **Guía Completa**: Ver `TESTING_GUIDE.md`
- **Documentación Tests**: Ver `tests/README.md`
- **Resumen Implementación**: Ver `TESTING_IMPLEMENTATION_SUMMARY.md`
- **Jest Docs**: https://jestjs.io/
- **Nock Docs**: https://github.com/nock/nock

---

## Comando Más Usado Durante Desarrollo 🌟

```bash
npm run test:watch
```

Este comando:
- ✅ Re-ejecuta automáticamente al guardar
- ✅ Solo ejecuta tests afectados
- ✅ Muestra coverage en tiempo real
- ✅ Permite filtrar por patrón
- ✅ Feedback inmediato

**¡Perfecto para TDD!**

---

**¿Listo para empezar?**

```bash
# Opción 1: Script interactivo
run-tests.bat

# Opción 2: Comando directo
npm run test:unit

# Opción 3: Modo desarrollo
npm run test:watch
```

**¡Feliz Testing!** 🎉
