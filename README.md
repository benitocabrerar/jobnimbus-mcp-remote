# JobNimbus MCP Client

**Connect Claude Desktop to your remote JobNimbus MCP server from any computer**

This package provides an MCP (Model Context Protocol) client that connects Claude Desktop to a remote JobNimbus MCP server. No local installation or repository cloning required!

## ✨ Características

- 🔒 **Zero Storage Security**: API keys NUNCA almacenadas en el servidor
- 🌐 **Multi-Cliente**: Soporta múltiples clientes simultáneos
- ⚡ **Stateless**: Cada request es independiente
- 🚦 **Rate Limiting**: Protección automática por cliente
- 🛠️ **Extensible**: Agregar nuevas herramientas en ~10 minutos
- 🔄 **CI/CD Automático**: Deploy con `git push`
- 📊 **Monitoreo**: Health checks y logs sanitizados

## 🎯 Arquitectura

```
Claude Desktop (API Key) → Render.com Server → JobNimbus API
         ↓                         ↓
   Local Config            Valida temporalmente
   (Nunca sale)            (Nunca almacena)
```

**Principio clave**: El servidor es un proxy stateless. Las API keys vienen del cliente en cada request y se limpian de memoria inmediatamente después de usarlas.

## 📦 Instalación Rápida

### 1. Clonar e Instalar

```bash
cd jobnimbus-mcp-remote
npm install
```

### 2. Configurar Entorno Local

```bash
cp .env.example .env
```

### 3. Ejecutar Localmente

```bash
npm run dev
```

Visitar: http://localhost:3000/health

### 4. Desplegar a Render.com

Ver: [docs/SETUP.md](docs/SETUP.md) para guía completa de deployment.

## 🔧 Herramientas Disponibles (48 TOTAL)

### Básicas (11)
- `get_system_info` - Info del sistema
- `validate_api_key` - Validar API key
- `get_jobs`, `search_jobs`, `get_job` - Trabajos
- `get_contacts`, `search_contacts`, `create_contact` - Contactos
- `get_estimates` - Estimados
- `get_activities`, `create_activity` - Actividades

### Analytics (16)
- `analyze_insurance_pipeline` - Análisis de pipeline de seguros
- `analyze_retail_pipeline` - Análisis de pipeline retail
- `analyze_services_repair_pipeline` - Servicios y reparaciones
- `analyze_public_adjuster_pipeline` - Ajustadores públicos
- `analyze_duplicate_contacts`, `analyze_duplicate_jobs` - Duplicados
- `analyze_pricing_anomalies`, `analyze_revenue_leakage` - Anomalías
- Y 8 más...

### Performance & Revenue (8)
- `get_sales_rep_performance` - Performance por rep
- `get_revenue_report` - Reporte de ingresos
- `get_margin_analysis` - Análisis de márgenes
- `get_pricing_optimization` - Optimización de precios
- `get_profitability_dashboard` - Dashboard de rentabilidad
- Y 3 más...

### Advanced (13)
- `get_optimal_door_routes` - Rutas óptimas puerta a puerta
- `get_pipeline_forecasting` - Pronósticos
- `get_automated_followup` - Seguimiento automático
- `get_smart_scheduling` - Programación inteligente
- Y 9 más...

**Ver lista completa**: Las 48 herramientas están implementadas y listas.
**Agregar más**: Ver [docs/ADDING_TOOLS.md](docs/ADDING_TOOLS.md)

## 💻 Configuración MCP

### Opción 1: Claude Code (Recomendado)

1. **Configurar variables de entorno**:
```bash
cp .env.mcp.example .env.mcp
# Edita .env.mcp con tus API keys
```

2. **Cargar variables** (PowerShell):
```powershell
Get-Content .env.mcp | ForEach-Object {
    if ($_ -match '^([^=]+)=(.+)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}
```

3. **Verificar**:
```
/mcp
```

Ver guía completa: [MCP_SETUP.md](MCP_SETUP.md)

### Opción 2: Claude Desktop

Ubicación: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "jobnimbus-stamford": {
      "command": "node",
      "args": ["C:/ruta/a/examples/mcp-client.js"],
      "env": {
        "MCP_SERVER_URL": "https://tu-servidor.onrender.com",
        "JOBNIMBUS_API_KEY": "tu_api_key_stamford",
        "JOBNIMBUS_INSTANCE": "stamford"
      }
    }
  }
}
```

Ver ejemplo completo: [examples/claude-desktop-config.json](examples/claude-desktop-config.json)

## 📚 Documentación

- [📖 Setup Guide](docs/SETUP.md) - Instalación y deployment
- [🔌 MCP Setup](MCP_SETUP.md) - Configuración de MCP para Claude Code
- [🏗️ Arquitectura](docs/ARCHITECTURE.md) - Diseño técnico completo
- [🛠️ Agregar Herramientas](docs/ADDING_TOOLS.md) - Cómo crear nuevas tools

## 🔐 Seguridad

### ✅ Lo que HACE el servidor:

- Extrae API key del header `X-JobNimbus-Api-Key`
- Valida formato del API key
- Usa el API key para llamar a JobNimbus
- Limpia el API key de memoria inmediatamente

### ❌ Lo que NO HACE el servidor:

- Almacenar API keys en base de datos
- Guardar API keys en archivos
- Loggear API keys
- Cachear API keys
- Compartir API keys entre clientes

### Verificación de Seguridad

```bash
# Buscar si hay API keys hardcodeados (debe retornar vacío)
grep -r "api[_-]key.*=" src/

# Audit de dependencias
npm audit

# Tests de seguridad en CI
npm run lint
```

## 🚀 Deployment

### Automático (Recomendado)

```bash
git add .
git commit -m "feat: nueva funcionalidad"
git push origin main
```

GitHub Actions despliega automáticamente a Render.com.

### Manual

```bash
npm run build
npm run start:prod
```

## 🧪 Testing

### Health Check

```bash
curl https://tu-servidor.onrender.com/health
```

### Listar Herramientas

```bash
curl -X POST https://tu-servidor.onrender.com/mcp/tools/list \
  -H "X-JobNimbus-Api-Key: tu_api_key" \
  -H "Content-Type: application/json"
```

### Ejecutar Herramienta

```bash
curl -X POST https://tu-servidor.onrender.com/mcp/tools/call \
  -H "X-JobNimbus-Api-Key: tu_api_key" \
  -H "Content-Type: application/json" \
  -d '{"name":"get_jobs","arguments":{"size":10}}'
```

## 📊 Monitoreo

### Health Check Endpoint

- `GET /health` - Estado del servidor

### Rate Limit Headers

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1234567890
```

### Logs

Todos los logs están sanitizados - no incluyen API keys ni información sensible.

## 🛠️ Desarrollo

### Estructura del Proyecto

```
jobnimbus-mcp-remote/
├── src/
│   ├── server/         # Express server
│   ├── middleware/     # Auth, rate limiting
│   ├── tools/          # MCP tools
│   ├── services/       # JobNimbus client
│   ├── config/         # Configuración
│   ├── types/          # TypeScript types
│   └── utils/          # Logger, errors
├── .github/workflows/  # CI/CD
├── docs/               # Documentación
├── scripts/            # Scripts útiles
└── examples/           # Ejemplos de uso
```

### Comandos Disponibles

```bash
npm run dev          # Desarrollo con hot reload
npm run build        # Compilar TypeScript
npm run start        # Ejecutar producción
npm run lint         # Linter
npm run type-check   # Verificar tipos
npm test             # Tests
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m 'feat: agregar nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

## 📄 Licencia

MIT

## 🆘 Soporte

- **Documentación**: Ver carpeta `docs/`
- **Issues**: GitHub Issues
- **Logs**: Render.com dashboard

## ✅ Estado del Proyecto

- [x] Estructura base
- [x] Servidor Express con MCP
- [x] Middleware de seguridad
- [x] JobNimbus API client
- [x] Sistema de tools extensible
- [x] **48 herramientas COMPLETAS** ✅
- [x] GitHub Actions CI/CD
- [x] Render.com config
- [x] Documentación completa
- [x] Cliente para Claude Desktop
- [x] Factory pattern para extensibilidad
- [ ] Tests unitarios (próximo)
- [ ] Métricas y monitoring avanzado (opcional)

---

**Hecho con ❤️ para acceso remoto seguro a JobNimbus desde Claude Desktop**
