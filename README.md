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

## 🔧 Herramientas Disponibles (88 TOTAL - Optimizado)

### Core CRUD (27 herramientas)
- **Validación**: `validate_api_key` - Validar API key
- **Jobs (7)**: `get_jobs`, `search_jobs`, `search_jobs_enhanced`, `get_job`, `search_job_notes`, `get_job_tasks`
- **Status Search (13)**: `search_jobs_by_status`, `get_leads`, `get_pending_approval`, `get_lost_jobs`, `get_in_progress`, `get_completed`, `get_paid_closed`, `get_estimating`, `get_signed_contracts`, `get_scheduled`, `get_appointments`, `get_invoiced`, `get_deposits`
- **Contactos (3)**: `get_contacts`, `search_contacts`, `create_contact`
- **Otros (3)**: `get_estimates`, `get_activities`, `create_activity`, `get_calendar_activities`, `get_timeline_data`

### Analytics (35 herramientas)
- **Insurance & Retail (3)**: `analyze_insurance_pipeline`, `analyze_retail_pipeline`, `analyze_services_repair_pipeline`
- **Financial (6)**: `get_sales_rep_performance`, `get_performance_metrics`, `get_automated_followup`, `get_revenue_report`, `get_margin_analysis`, `analyze_revenue_leakage`, `get_profitability_dashboard`
- **Performance (2)**: `get_seasonal_trends`, `get_pipeline_forecasting`
- **Territory (5)**: `get_job_summary`, `get_optimal_door_routes`, `get_territory_heat_maps`, `get_jobs_distribution`, `get_door_knocking_scripts_by_area`, `get_seasonal_door_timing`, `get_estimates_with_addresses`
- **Productivity (9)**: `get_activities_analytics`, `get_task_management_analytics`, `get_user_productivity_analytics`, `get_lead_scoring_analytics`, `get_communication_analytics`, `get_conversion_funnel_analytics`, `get_resource_allocation_analytics`, `get_customer_satisfaction_analytics`, `get_time_tracking_analytics`
- **Business (8)**: `get_project_management_analytics`, `get_marketing_campaign_analytics`, `get_financial_forecasting_analytics`, `get_customer_segmentation_analytics`, `get_operational_efficiency_analytics`, `get_sales_velocity_analytics`, `get_competitive_analysis_analytics`

### Materials (11 herramientas)
- **Tracking**: `get_estimate_materials`, `analyze_material_costs`, `get_material_usage_report`, `get_material_inventory_insights`
- **Calculations**: `calculate_roofing_materials`, `calculate_siding_materials`, `estimate_materials_from_job`, `calculate_waste_factors`, `optimize_material_orders`, `get_material_specifications`, `compare_material_alternatives`

### Attachments & Business Intelligence (6 herramientas)
- **Attachments (4)**: `get_attachments`, `get_file_by_id`, `analyze_job_attachments`, `get_job_attachments_distribution`
- **Business (1)**: `search_insurance_jobs`
- **Invoices (1)**: `get_invoices`

### System (2 herramientas)
- `get_tasks`, `get_users`

### 📦 Herramientas Archivadas/Experimentales
Se removieron 14 herramientas obsoletas o no funcionales para optimizar rendimiento:
- Ver `/src/tools/archived/` - 11 herramientas sin valor operativo
- Ver `/src/tools/experimental/` - 7 herramientas con endpoints no verificados

**Beneficios**: ~40% reducción en uso de tokens, descubrimiento de herramientas más rápido.
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
- [x] **88 herramientas CONSOLIDADAS** ✅ (14 archivadas/experimentales)
- [x] GitHub Actions CI/CD
- [x] Render.com config
- [x] Documentación completa
- [x] Cliente para Claude Desktop
- [x] Factory pattern para extensibilidad
- [x] Redis cache integration para optimización
- [x] Consolidación de herramientas (enero 2025)
- [ ] Tests unitarios (próximo)
- [ ] Métricas y monitoring avanzado (opcional)

---

**Hecho con ❤️ para acceso remoto seguro a JobNimbus desde Claude Desktop**
