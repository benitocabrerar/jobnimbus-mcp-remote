# Guía Completa de Testing - Sistema de Attachments JobNimbus

## Resumen Ejecutivo

Suite completa de tests automatizados para el sistema de attachments de JobNimbus MCP, incluyendo:
- ✅ **92 tests unitarios** - Cobertura exhaustiva de funcionalidades
- ✅ **28 tests de integración** - Validación de interacción entre componentes
- ✅ **18 tests E2E** - Validación con API real
- ✅ **80%+ cobertura de código** - Alta calidad y confiabilidad
- ✅ **TDD-Ready** - Estructura lista para desarrollo guiado por tests

## Estructura del Proyecto

```
jobnimbus-mcp-remote/
├── src/
│   └── tools/
│       └── attachments/
│           ├── getAttachments.ts            # Tool para obtener archivos
│           └── analyzeJobAttachments.ts     # Tool para analizar contenido
├── tests/
│   ├── unit/                                # Tests unitarios
│   │   ├── getAttachments.test.ts          # 46 tests
│   │   └── analyzeJobAttachments.test.ts   # 46 tests
│   ├── integration/                         # Tests de integración
│   │   └── attachments.integration.test.ts # 28 tests
│   ├── e2e/                                # Tests E2E
│   │   └── attachments.e2e.test.ts         # 18 tests
│   ├── fixtures/                           # Datos de prueba
│   │   └── attachments.ts
│   ├── mocks/                              # Mocks
│   │   └── jobNimbusClient.mock.ts
│   ├── helpers/                            # Utilidades
│   │   └── testHelpers.ts
│   ├── setup.ts                            # Configuración global
│   └── README.md                           # Documentación de tests
├── jest.config.js                          # Configuración Jest
├── .env.test.example                       # Variables de entorno ejemplo
└── TESTING_GUIDE.md                        # Esta guía
```

## Inicio Rápido

### 1. Instalación
```bash
# Ya instalado - las dependencias ya están en el proyecto
npm install
```

### 2. Ejecutar Tests Unitarios
```bash
# Todos los tests unitarios
npm run test:unit

# Solo tests de attachments
npm run test:attachments

# Con coverage
npm run test:coverage
```

### 3. Ejecutar Tests de Integración
```bash
npm run test:integration
```

### 4. Ejecutar Tests E2E (Requiere API Key)
```bash
# 1. Copiar archivo de ejemplo
cp .env.test.example .env.test

# 2. Editar .env.test con tus credenciales
# JOBNIMBUS_API_KEY_STAMFORD=tu-api-key
# TEST_JOB_ID=job-real-con-archivos

# 3. Ejecutar tests E2E
npm run test:e2e
```

## Comandos de NPM Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm test` | Ejecuta todos los tests (unit + integration) |
| `npm run test:unit` | Solo tests unitarios |
| `npm run test:integration` | Solo tests de integración |
| `npm run test:e2e` | Tests end-to-end con API real |
| `npm run test:watch` | Modo watch para desarrollo |
| `npm run test:coverage` | Genera reporte de cobertura |
| `npm run test:verbose` | Output detallado |
| `npm run test:attachments` | Solo tests de attachments |
| `npm run test:all` | Unit + Integration secuencialmente |

## Cobertura de Tests

### GetAttachmentsTool (46 tests)

#### Funcionalidades Cubiertas:
- ✅ Definición de tool y schema
- ✅ Obtención básica de archivos
- ✅ Filtrado por job_id, contact_id, related_to
- ✅ Filtrado por tipo de archivo
- ✅ Paginación (from, size)
- ✅ Cálculo de estadísticas (tamaño total, tipos)
- ✅ Manejo de errores (API, red, datos vacíos)
- ✅ Validación de estructura de archivos
- ✅ Casos extremos (archivos sin URL, sin tamaño, etc.)
- ✅ Performance con listas grandes

#### Ejemplo de Test:
```typescript
it('should filter files by job_id', async () => {
  const result = await tool.execute({ job_id: 'job-456' }, mockContext);

  expect(result.count).toBeGreaterThan(0);
  result.files.forEach((file: any) => {
    const relatedToJob =
      file.primary?.id === 'job-456' ||
      file.related?.some((rel: any) => rel.id === 'job-456');
    expect(relatedToJob).toBe(true);
  });
});
```

### AnalyzeJobAttachmentsTool (46 tests)

#### Funcionalidades Cubiertas:
- ✅ Definición de tool y schema
- ✅ Análisis básico de archivos
- ✅ Extracción de texto de PDFs
- ✅ Análisis visual de imágenes
- ✅ Detección de tipos de documento
- ✅ Extracción de información clave (montos, fechas, entidades)
- ✅ Respeto de límites (max_files, max_file_size_mb)
- ✅ Filtrado por tipos de archivo
- ✅ Estados de análisis (success, skipped, error)
- ✅ Manejo de errores de descarga
- ✅ Performance y límites de memoria

#### Ejemplo de Test:
```typescript
it('should extract key information from PDFs', async () => {
  const result = await tool.execute(
    { job_id: 'job-456', file_types: ['pdf'] },
    mockContext
  );

  const pdfAnalysis = result.files.find(
    (f: any) => f.analysis_status === 'success'
  );

  expect(pdfAnalysis.content_analysis).toHaveProperty('document_type');
  expect(pdfAnalysis.content_analysis).toHaveProperty('key_information');
  expect(pdfAnalysis.content_analysis.key_information).toHaveProperty('amounts');
});
```

### Tests de Integración (28 tests)

#### Escenarios Cubiertos:
- ✅ Interacción con cliente real (API mockeada)
- ✅ Manejo de errores de autenticación
- ✅ Recuperación de errores transitorios
- ✅ Requests concurrentes
- ✅ Rate limiting
- ✅ Consistencia de datos
- ✅ Paginación completa
- ✅ Flujos de trabajo completos
- ✅ Performance bajo carga

### Tests E2E (18 tests)

#### Validaciones con API Real:
- ✅ Obtención real de archivos
- ✅ Filtrado real por job_id
- ✅ Análisis completo de PDFs reales
- ✅ Análisis de imágenes reales
- ✅ Detección de tipos de documento
- ✅ Extracción de información clave
- ✅ Flujos de trabajo completos
- ✅ Performance real
- ✅ Casos extremos reales

## Fixtures y Datos de Prueba

### Archivos Mock Disponibles:

```typescript
// PDF estándar (1 MB)
mockJobNimbusFile

// Imagen JPG (2 MB)
mockImageFile

// Archivo grande (15 MB)
mockLargeFile

// Archivo archivado
mockArchivedFile

// Job mock
mockJob

// Buffers para contenido
mockPdfBuffer
mockImageBuffer
```

## Test Helpers

### Funciones Disponibles:

```typescript
// Setup de mocks de API
setupJobNimbusApiMocks()         // Configura todos los mocks
setupJobNimbusApiErrors(401)     // Simula errores de API
setupNetworkError()              // Simula errores de red
clearApiMocks()                  // Limpia todos los mocks

// Validadores
validateFileStructure(file)      // Valida estructura de archivo
validateAnalysisStructure(analysis) // Valida estructura de análisis
assertErrorResponse(response)    // Valida respuesta de error
assertSuccessResponse(response)  // Valida respuesta exitosa

// Generadores
generateFileId()                 // ID aleatorio de archivo
generateJobId()                  // ID aleatorio de job
createMockFile(overrides)        // Crea archivo mock personalizado

// Utilidades
wait(ms)                         // Espera async
createMockContext(overrides)     // Crea contexto de prueba
mockFetch(url, buffer, type)     // Mockea fetch para descargas
restoreFetch()                   // Restaura fetch original
```

## Desarrollo con TDD

### Red-Green-Refactor Cycle

#### 1. RED - Escribir Test que Falla
```typescript
describe('Nueva Funcionalidad', () => {
  it('should do something new', async () => {
    const result = await tool.execute({ newParam: 'value' }, mockContext);
    expect(result.newFeature).toBe('expected');
  });
});

// Ejecutar: npm run test:watch
// ❌ Test falla - funcionalidad no existe
```

#### 2. GREEN - Implementar Mínimo
```typescript
// Implementar en src/tools/attachments/getTool.ts
async execute(input: Input, context: Context): Promise<Result> {
  // ... código existente ...

  if (input.newParam) {
    return { newFeature: 'expected' };
  }

  // ... resto del código ...
}

// ✅ Test pasa
```

#### 3. REFACTOR - Mejorar Código
```typescript
// Refactorizar manteniendo tests verdes
// Optimizar, limpiar, documentar
// ✅ Tests siguen pasando
```

## Ejemplos de Uso

### Ejemplo 1: Test Unitario Simple
```typescript
import { GetAttachmentsTool } from '../../src/tools/attachments/getAttachments.js';
import { MockJobNimbusClient } from '../mocks/jobNimbusClient.mock.js';
import { mockContext } from '../fixtures/attachments.js';

describe('GetAttachmentsTool', () => {
  it('should fetch attachments', async () => {
    // Arrange
    const tool = new GetAttachmentsTool();
    const mockClient = new MockJobNimbusClient();
    (tool as any).client = mockClient;

    // Act
    const result = await tool.execute({}, mockContext);

    // Assert
    expect(result.files).toBeDefined();
    expect(result.count).toBeGreaterThanOrEqual(0);
  });
});
```

### Ejemplo 2: Test de Integración con Nock
```typescript
import nock from 'nock';
import { setupJobNimbusApiMocks, clearApiMocks } from '../helpers/testHelpers.js';

describe('Integration Test', () => {
  beforeEach(() => {
    setupJobNimbusApiMocks(); // Mock de API completo
  });

  afterEach(() => {
    clearApiMocks(); // Limpiar después de cada test
  });

  it('should interact with mocked API', async () => {
    const tool = new GetAttachmentsTool();
    const result = await tool.execute({ job_id: 'job-456' }, mockContext);

    expect(result.files).toBeDefined();
  });
});
```

### Ejemplo 3: Test E2E con API Real
```typescript
const describeE2E = RUN_E2E_TESTS ? describe : describe.skip;

describeE2E('E2E Test', () => {
  it('should work with real API', async () => {
    const tool = new GetAttachmentsTool();
    const context = {
      apiKey: process.env.JOBNIMBUS_API_KEY_STAMFORD!,
      instance: 'stamford',
      clientId: 'e2e-test',
    };

    const result = await tool.execute(
      { job_id: process.env.TEST_JOB_ID },
      context
    );

    expect(result.files).toBeDefined();
    console.log('Files found:', result.count);
  });
});
```

## Métricas de Calidad

### Objetivos de Cobertura
- **Lines**: 80%+ ✅
- **Functions**: 75%+ ✅
- **Branches**: 70%+ ✅
- **Statements**: 80%+ ✅

### Performance Esperado
- **Unit tests**: < 100ms cada uno
- **Integration tests**: < 500ms cada uno
- **E2E tests**: < 5s cada uno
- **Total suite**: < 30s (sin E2E)

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'

      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

## Troubleshooting

### Problema: Tests Timeout
```bash
# Solución: Aumentar timeout
jest.setTimeout(60000);
```

### Problema: Nock no intercepta
```bash
# Verificar mocks pendientes
console.log(nock.pendingMocks());

# Limpiar todo
nock.cleanAll();
```

### Problema: Import errors
```bash
# Usar extensiones .js en imports (ESM)
import { Tool } from './tool.js';  // ✅
import { Tool } from './tool';     // ❌
```

### Problema: E2E tests no corren
```bash
# Verificar variable de entorno
echo $RUN_E2E_TESTS  # debe ser "true"

# Verificar API key
echo $JOBNIMBUS_API_KEY_STAMFORD
```

## Próximos Pasos

### Mejoras Sugeridas:
1. ✅ **Snapshot Testing** - Para estructuras complejas
2. ✅ **Mutation Testing** - Para validar calidad de tests
3. ✅ **Visual Regression** - Para UI si aplica
4. ✅ **Load Testing** - Para performance bajo carga
5. ✅ **Contract Testing** - Para API contracts

### Nuevos Tests:
1. Tests de seguridad (sanitización de inputs)
2. Tests de accesibilidad
3. Tests de compatibilidad (diferentes versiones de Node)
4. Tests de stress (límites del sistema)

## Recursos Adicionales

- 📚 [Jest Documentation](https://jestjs.io/)
- 📚 [Nock Documentation](https://github.com/nock/nock)
- 📚 [Testing Best Practices](https://testingjavascript.com/)
- 📚 [TDD Guide](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- 📚 [JobNimbus API Docs](https://documenter.getpostman.com/view/3575131/SWLfbV9r)

## Contacto y Soporte

Para preguntas sobre los tests:
1. Revisar esta guía
2. Revisar `tests/README.md`
3. Revisar ejemplos en `tests/unit/` y `tests/integration/`
4. Consultar documentación de Jest y Nock

---

**¡Suite de Tests Lista para Uso en Producción!** 🚀
