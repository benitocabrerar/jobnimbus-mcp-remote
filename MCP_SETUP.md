# MCP Setup para Claude Code

## 📋 Configuración Rápida

### 1. Configurar Variables de Entorno

Copia el archivo de ejemplo y agrega tus API keys:

```bash
cp .env.mcp.example .env.mcp
```

Edita `.env.mcp` y agrega tus API keys:
```bash
JOBNIMBUS_API_KEY_STAMFORD=tu_api_key_de_stamford
JOBNIMBUS_API_KEY_GUILFORD=tu_api_key_de_guilford
```

### 2. Cargar Variables de Entorno

**Opción A: PowerShell (Windows)**
```powershell
Get-Content .env.mcp | ForEach-Object {
    if ($_ -match '^([^=]+)=(.+)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}
```

**Opción B: CMD (Windows)**
```cmd
for /f "tokens=1,2 delims==" %a in (.env.mcp) do set %a=%b
```

**Opción C: Bash/Git Bash (Cross-platform)**
```bash
export $(grep -v '^#' .env.mcp | xargs)
```

### 3. Verificar MCP

Ejecuta en Claude Code:
```
/mcp
```

Deberías ver los servidores configurados:
- `jobnimbus-stamford`
- `jobnimbus-guilford`

### 4. Listar Herramientas Disponibles

En Claude Code, pregunta:
```
Lista las herramientas MCP disponibles
```

O ejecuta:
```
/mcp list
```

## 🔧 Estructura de Archivos

```
jobnimbus-mcp-remote/
├── .mcp.json                 # Configuración MCP para Claude Code
├── .env.mcp                  # Variables de entorno (NO COMMITEAR)
├── .env.mcp.example          # Ejemplo de variables
├── examples/
│   └── mcp-client.js         # Cliente MCP
└── MCP_SETUP.md              # Esta guía
```

## 📖 Uso de Herramientas

### Ejemplo: Buscar Actividades

```
Busca las actividades de Juan Villavicencio en Stamford para hoy
```

Claude Code usará automáticamente las herramientas MCP:
1. `get_activities` - Para obtener actividades
2. Filtrado local por usuario y fecha

### Herramientas Disponibles (58 total)

**Actividades:**
- `get_activities` - Buscar actividades con filtros
- `get_activities_analytics` - Analytics de actividades
- `get_calendar_activities` - Vista de calendario
- `create_activity` - Crear actividad

**Jobs:**
- `get_jobs`, `search_jobs`, `search_jobs_enhanced`
- `get_job`, `search_job_notes`, `get_job_tasks`

**Contactos:**
- `get_contacts`, `search_contacts`, `create_contact`

**Analytics:** (48+ herramientas)
- Pipeline analysis
- Performance metrics
- Revenue reports
- Y muchas más...

## 🔐 Seguridad

- ✅ Las API keys se leen desde variables de entorno
- ✅ El archivo `.env.mcp` está en `.gitignore`
- ✅ Nunca se commitean credenciales
- ✅ El servidor MCP nunca almacena API keys

## 🚨 Troubleshooting

### Error: "No MCP servers configured"

**Solución:** Verifica que las variables de entorno estén cargadas:
```bash
echo $JOBNIMBUS_API_KEY_STAMFORD
```

Si está vacío, carga las variables de nuevo (ver paso 2).

### Error: "JOBNIMBUS_API_KEY not configured"

**Solución:** El cliente MCP no puede leer la variable de entorno. Asegúrate de:
1. Haber creado `.env.mcp` con tus API keys
2. Haber cargado las variables en el terminal actual
3. Estar ejecutando Claude Code en el mismo terminal

### Error: "Connection refused"

**Solución:** El servidor MCP en Render.com puede estar dormido. Espera 30 segundos y reintenta.

Verificar health del servidor:
```bash
curl https://jobnimbus-mcp-remote.onrender.com/health
```

## 📚 Más Información

- [Documentación MCP](https://docs.claude.com/en/docs/claude-code/mcp)
- [Arquitectura del Proyecto](docs/ARCHITECTURE.md)
- [Agregar Herramientas](docs/ADDING_TOOLS.md)
