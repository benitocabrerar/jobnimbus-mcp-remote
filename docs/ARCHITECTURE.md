# 🏗️ Architecture Documentation

## Overview

JobNimbus MCP Remote Server is a **stateless, secure** proxy that enables multiple Claude Desktop clients to access JobNimbus APIs without storing API keys server-side.

## Core Principles

### 1. 🔒 Zero Storage Security

**API keys are NEVER stored anywhere on the server:**

- ✅ Client sends API key in each request header
- ✅ Server extracts and validates temporarily
- ✅ Server uses key only for that request
- ✅ Server clears key from memory immediately
- ❌ No database storage
- ❌ No file storage
- ❌ No environment variables

### 2. 🌐 Stateless Design

Every request is independent:

- No sessions
- No authentication tokens
- No cached credentials
- Each request carries its own API key

### 3. 🚦 Per-Client Rate Limiting

Rate limiting is based on **client ID** (IP + user agent hash), not API key:

- Prevents rate limit info from exposing API keys
- Fair resource allocation
- Configurable limits per window

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     CLAUDE DESKTOP CLIENTS                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Client A (Stamford)     Client B (Guilford)    Client C   │
│  ┌─────────────┐         ┌─────────────┐      ┌──────────┐ │
│  │ API Key A   │         │ API Key B   │      │ Both Keys│ │
│  └──────┬──────┘         └──────┬──────┘      └────┬─────┘ │
│         │                       │                   │       │
└─────────┼───────────────────────┼───────────────────┼───────┘
          │                       │                   │
          │   HTTPS + Headers     │                   │
          │   X-JobNimbus-Api-Key │                   │
          ▼                       ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    RENDER.COM SERVER                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                Express Application                    │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │                                                       │  │
│  │  1. Security Middleware (Helmet)                     │  │
│  │  2. API Key Extractor                                │  │
│  │  3. Rate Limiter (per client)                        │  │
│  │  4. Tool Router                                      │  │
│  │  5. Error Handler                                    │  │
│  │                                                       │  │
│  └───────────────────────┬──────────────────────────────┘  │
│                          │                                  │
│  ┌───────────────────────▼──────────────────────────────┐  │
│  │            Tool Execution Engine                     │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │                                                       │  │
│  │  • get_jobs         • get_contacts                   │  │
│  │  • search_jobs      • get_estimates                  │  │
│  │  • analyze_*        • and more...                    │  │
│  │                                                       │  │
│  └───────────────────────┬──────────────────────────────┘  │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           │ API Key from request context
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   JOBNIMBUS API                             │
│              https://app.jobnimbus.com/api1                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Request Flow

### 1. Client Request

```typescript
POST https://your-server.onrender.com/mcp/tools/call
Headers:
  X-JobNimbus-Api-Key: sk_live_xxxxx
  X-JobNimbus-Instance: stamford
  Content-Type: application/json
Body:
  {
    "name": "get_jobs",
    "arguments": { "size": 10 }
  }
```

### 2. API Key Extraction

```typescript
// middleware/apiKeyExtractor.ts
const apiKey = req.headers['x-jobnimbus-api-key'];
const instance = req.headers['x-jobnimbus-instance'];

// Validate format
if (!isValidFormat(apiKey)) {
  throw new ValidationError();
}

// Attach temporarily to request
req.apiKey = apiKey;
req.instance = instance;

// Auto-cleanup on response
res.on('finish', () => {
  delete req.apiKey;
});
```

### 3. Rate Limiting

```typescript
// middleware/rateLimiter.ts
const clientId = hash(req.ip + req.userAgent);
const limit = rateLimitStore.get(clientId);

if (limit.count > MAX_REQUESTS) {
  throw new RateLimitError();
}

limit.count++;
```

### 4. Tool Execution

```typescript
// server/index.ts
const tool = toolRegistry.getTool(name);

const context = {
  apiKey: req.apiKey,  // From request context
  instance: req.instance,
  clientId: req.clientId,
};

const result = await tool.execute(args, context);
```

### 5. JobNimbus API Call

```typescript
// services/jobNimbusClient.ts
const response = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${apiKey}`,  // Used here
  },
});

// Clear from memory immediately
apiKey = '';
```

### 6. Response

```json
{
  "success": true,
  "data": { /* JobNimbus response */ }
}
```

---

## Security Layers

### Layer 1: Transport Security

- **HTTPS only** (TLS 1.3)
- **Helmet.js** security headers
- **CORS** configured

### Layer 2: Input Validation

- API key format validation
- Request body validation
- Parameter sanitization

### Layer 3: Rate Limiting

- Per-client limits (60 req/min default)
- Configurable windows
- Automatic cleanup

### Layer 4: Error Handling

- Sanitized error messages
- No stack traces in production
- No sensitive data in logs

### Layer 5: Memory Management

- API keys cleared after each request
- No persistent connections
- Automatic garbage collection

---

## Tool System

### Base Tool Class

```typescript
abstract class BaseTool<TInput, TOutput> {
  abstract get definition(): MCPToolDefinition;
  abstract execute(input: TInput, context: ToolContext): Promise<TOutput>;
}
```

### Example Tool

```typescript
class GetJobsTool extends BaseTool {
  get definition() {
    return {
      name: 'get_jobs',
      description: 'Get jobs from JobNimbus',
      inputSchema: { /* ... */ },
    };
  }

  async execute(input, context) {
    return this.client.get(
      context.apiKey,  // API key from context
      'jobs',
      input
    );
  }
}
```

### Tool Registry

```typescript
class ToolRegistry {
  private tools = new Map<string, BaseTool>();

  registerTool(tool: BaseTool) {
    this.tools.set(tool.definition.name, tool);
  }

  getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }
}
```

---

## Deployment Pipeline

### Local Development

```bash
npm run dev  # TypeScript watch mode
```

### GitHub Push

```bash
git push origin main
```

### GitHub Actions

1. **CI Workflow** (on every push/PR):
   - Install dependencies
   - Type check
   - Lint
   - Build
   - Security audit

2. **Deploy Workflow** (on main push):
   - Trigger Render deployment
   - Wait for deploy
   - Health check

### Render.com

1. Reads `render.yaml`
2. Runs `npm ci && npm run build`
3. Runs `npm run start:prod`
4. Monitors `/health` endpoint
5. Auto-scales as needed

---

## Monitoring

### Health Check

```bash
GET /health

Response:
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 123456,
  "timestamp": "2025-..."
}
```

### Rate Limit Headers

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1234567890
```

### Logs

- **Info**: Request received, tool executed
- **Warn**: Rate limit exceeded
- **Error**: API failures, validation errors
- **Debug**: Detailed flow (dev only)

All logs are **sanitized** - no API keys logged.

---

## Scalability

### Horizontal Scaling

- Stateless design enables infinite scaling
- Render auto-scales based on load
- No shared state between instances

### Performance

- In-memory rate limiting (fast)
- No database queries (fast)
- Direct pass-through to JobNimbus (minimal latency)

### Costs

- **Starter**: $7/month, 512 MB RAM
- **Standard**: $25/month, 2 GB RAM
- Auto-scale as needed

---

## Adding New Tools

1. Create tool file: `src/tools/category/myTool.ts`
2. Extend `BaseTool`
3. Define `definition` and `execute`
4. Register in `src/tools/index.ts`

**That's it!** Auto-discovered and available.

See `docs/ADDING_TOOLS.md` for detailed guide.

---

## Security Checklist

- [x] API keys never stored
- [x] HTTPS only
- [x] Rate limiting per client
- [x] Input validation
- [x] Error sanitization
- [x] Helmet.js security headers
- [x] No secrets in code/repo
- [x] Logs sanitized
- [x] Memory cleanup
- [x] Security audit in CI

---

## Technology Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.3+
- **Framework**: Express 4.18
- **Security**: Helmet, CORS
- **Logging**: Winston
- **Validation**: Zod (future)
- **Deployment**: Render.com
- **CI/CD**: GitHub Actions

---

## Future Enhancements

- [ ] Add caching (optional, without API keys)
- [ ] Metrics dashboard
- [ ] Custom domains
- [ ] More tools (~50 total)
- [ ] WebSocket support for real-time
- [ ] Redis for distributed rate limiting
