# 🚀 Guía de Scripts BAT - JobNimbus MCP Server

Esta guía explica cómo usar los scripts batch (.bat) para gestionar el servidor JobNimbus MCP local en Windows.

---

## 📋 Scripts Disponibles

### 1. **start-server.bat** - Iniciar el Servidor

#### ¿Qué hace?
- ✅ Verifica que `node_modules` esté instalado
- ✅ Verifica que exista el archivo `.env`
- ✅ Compila el proyecto TypeScript si es necesario
- ✅ Inicia el servidor en el puerto 3000
- ✅ Mantiene la ventana abierta mostrando los logs

#### Cómo usar:
```cmd
# Doble clic en el archivo o ejecuta desde CMD:
start-server.bat
```

#### Salida esperada:
```
========================================
  JobNimbus MCP Server - INICIANDO
========================================

[OK] Iniciando servidor...
[OK] Puerto: 3000
[OK] URL local: http://localhost:3000

Presiona CTRL+C para detener el servidor

> jobnimbus-mcp-client@1.0.0 start
> node dist/index.js

Server running on port 3000
```

#### Detener el servidor:
- Presiona `CTRL + C` en la ventana del servidor
- O ejecuta `stop-server.bat` en otra ventana

---

### 2. **stop-server.bat** - Detener el Servidor

#### ¿Qué hace?
- 🛑 Busca el proceso corriendo en el puerto 3000
- 🛑 Termina el proceso (PID)
- 🛑 Muestra otros procesos de Node.js activos
- 🛑 Limpia archivos temporales

#### Cómo usar:
```cmd
# Doble clic en el archivo o ejecuta desde CMD:
stop-server.bat
```

#### Salida esperada:
```
========================================
  JobNimbus MCP Server - DETENIENDO
========================================

Buscando servidor en puerto 3000...
[OK] Servidor encontrado en puerto 3000
[INFO] PID del proceso: 12345
SUCCESS: The process with PID 12345 has been terminated.
[OK] Servidor detenido exitosamente

Verificando otros procesos de Node.js relacionados...
[OK] No hay procesos de Node.js corriendo

========================================
  Operacion completada
========================================
```

---

### 3. **check-server.bat** - Verificar Estado del Servidor

#### ¿Qué hace?
- 🔍 Verifica si el puerto 3000 está en uso
- 🔍 Verifica procesos de Node.js
- 🔍 Intenta conectarse al servidor HTTP
- 🔍 Verifica archivos del proyecto
- 🔍 Muestra un resumen completo del estado

#### Cómo usar:
```cmd
# Doble clic en el archivo o ejecuta desde CMD:
check-server.bat
```

#### Salida esperada (servidor corriendo):
```
========================================
  JobNimbus MCP Server - DIAGNOSTICO
========================================

[1/5] Verificando puerto 3000...
[OK] Puerto 3000 esta en uso
[OK] PID del proceso: 12345

[2/5] Verificando procesos de Node.js...
[OK] Node.js esta corriendo
node.exe                     12345 Console                    1    125,432 K

[3/5] Verificando conectividad HTTP...
Intentando conectar a http://localhost:3000/...
[OK] Servidor respondio correctamente (HTTP 401 - API key requerida)
[OK] El servidor esta funcionando

[4/5] Verificando archivos del proyecto...
[OK] package.json encontrado
[OK] node_modules/ encontrado
[OK] dist/ encontrado (proyecto compilado)
[OK] .env encontrado

[5/5] Resumen del estado
========================================

  ESTADO: SERVIDOR CORRIENDO
  Puerto: 3000
  URL:    http://localhost:3000

[ACCIONES DISPONIBLES]
- Ver logs: Revisa la ventana donde ejecutaste start-server.bat
- Detener: Ejecuta stop-server.bat

========================================
```

#### Salida esperada (servidor detenido):
```
========================================
  JobNimbus MCP Server - DIAGNOSTICO
========================================

[1/5] Verificando puerto 3000...
[X] Puerto 3000 NO esta en uso
[X] El servidor NO esta corriendo

[2/5] Verificando procesos de Node.js...
[X] No se encontraron procesos de Node.js

[3/5] Verificando conectividad HTTP...
[X] Servidor no esta corriendo, no se puede verificar HTTP

[4/5] Verificando archivos del proyecto...
[OK] package.json encontrado
[OK] node_modules/ encontrado
[OK] dist/ encontrado (proyecto compilado)
[OK] .env encontrado

[5/5] Resumen del estado
========================================

  ESTADO: SERVIDOR DETENIDO

[ACCIONES RECOMENDADAS]
- Iniciar servidor: Ejecuta start-server.bat
- Verificar configuracion: Revisa el archivo .env

========================================
```

---

## 🔧 Configuración Inicial

### Antes de usar los scripts:

1. **Asegúrate de tener Node.js instalado:**
   ```cmd
   node --version
   npm --version
   ```

2. **Crea el archivo `.env` desde `.env.example`:**
   ```cmd
   copy .env.example .env
   ```

3. **Edita el archivo `.env` y agrega tus API keys:**
   ```env
   # JobNimbus API Keys
   STAMFORD_API_KEY=tu_api_key_de_stamford_aqui
   GUILFORD_API_KEY=tu_api_key_de_guilford_aqui

   # Server Configuration
   PORT=3000
   NODE_ENV=development
   ```

4. **Instala las dependencias (si no se instalaron automáticamente):**
   ```cmd
   npm install
   ```

---

## 📝 Flujo de Trabajo Recomendado

### Inicio del día:
1. ✅ Ejecuta `check-server.bat` para verificar el estado
2. ✅ Ejecuta `start-server.bat` para iniciar el servidor
3. ✅ Verifica que el servidor esté funcionando

### Durante el desarrollo:
- Mantén la ventana de `start-server.bat` abierta para ver los logs
- Si haces cambios en el código, reinicia el servidor:
  1. Presiona `CTRL + C` en la ventana del servidor
  2. Ejecuta `start-server.bat` nuevamente

### Fin del día:
1. ✅ Ejecuta `stop-server.bat` para detener el servidor
2. ✅ (Opcional) Ejecuta `check-server.bat` para confirmar que se detuvo

---

## 🐛 Solución de Problemas

### Problema: "Puerto 3000 ya está en uso"
**Solución:**
```cmd
# 1. Detén el servidor actual
stop-server.bat

# 2. Verifica que se detuvo
check-server.bat

# 3. Si aún está corriendo, mata todos los procesos de Node.js:
taskkill /F /IM node.exe

# 4. Inicia el servidor nuevamente
start-server.bat
```

### Problema: "No se encontró node_modules"
**Solución:**
```cmd
npm install
```

### Problema: "No se encontró dist/"
**Solución:**
```cmd
npm run build
```

### Problema: "API key required"
**Solución:**
1. Verifica que el archivo `.env` existe
2. Verifica que las API keys están configuradas correctamente en `.env`
3. Reinicia el servidor

---

## 🔐 Seguridad

⚠️ **IMPORTANTE:**
- **NUNCA** compartas tu archivo `.env` con nadie
- **NUNCA** subas `.env` a GitHub (ya está en `.gitignore`)
- Las API keys son **confidenciales**

---

## 📊 Verificar que todo funciona

### Prueba rápida:
1. **Inicia el servidor:**
   ```cmd
   start-server.bat
   ```

2. **Verifica el estado:**
   ```cmd
   check-server.bat
   ```

3. **Verifica conectividad (en otra ventana CMD):**
   ```cmd
   curl http://localhost:3000/
   ```

   Deberías recibir:
   ```json
   {"error":"UnauthorizedError","message":"API key required in X-JobNimbus-Api-Key header"}
   ```

4. **Prueba con API key:**
   ```cmd
   curl -H "X-JobNimbus-Api-Key: TU_API_KEY" http://localhost:3000/jobs
   ```

---

## 📞 Soporte

Si tienes problemas:
1. Revisa la salida de `check-server.bat`
2. Revisa los logs en la ventana de `start-server.bat`
3. Verifica que tus API keys están configuradas correctamente
4. Consulta la documentación completa en `README.md`

---

## ✅ Checklist Rápido

Antes de reportar un problema, verifica:
- [ ] Node.js está instalado (`node --version`)
- [ ] Dependencias instaladas (`node_modules` existe)
- [ ] Proyecto compilado (`dist` existe)
- [ ] Archivo `.env` configurado con API keys válidas
- [ ] Puerto 3000 no está en uso por otra aplicación
- [ ] `check-server.bat` no muestra errores

---

**¡Listo!** 🎉 Ahora puedes gestionar tu servidor JobNimbus MCP fácilmente con estos scripts.
