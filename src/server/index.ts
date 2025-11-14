/**
 * Main Express Server with MCP Protocol Support
 * FASE 1: Redis cache integration enabled
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { extractApiKey } from '../middleware/apiKeyExtractor.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { HealthCheckResponse } from '../types/index.js';
import config, { validateConfig } from '../config/index.js';
import logger from '../utils/logger.js';
import { initializeCache, registerCacheRoutes } from '../services/cacheIntegration.js';

// Validate configuration on startup
validateConfig(config);

const app = express();
const startTime = Date.now();

/**
 * Security middleware
 */
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

/**
 * Compression middleware (OPTIMIZATION: 60-70% bandwidth reduction)
 */
app.use(compression({
  level: 6, // Balanced compression (1-9, higher = more compression but slower)
  threshold: 1024, // Only compress responses > 1KB
  filter: (req: express.Request, res: express.Response) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
}));

/**
 * Body parsing
 */
app.use(express.json({ limit: '1mb' }));

/**
 * Request ID
 */
app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

/**
 * Initialize cache on startup (FASE 1)
 */
await initializeCache(app);

/**
 * Health check endpoint (no auth required)
 */
app.get('/health', (_req, res) => {
  const uptime = Date.now() - startTime;

  const health: HealthCheckResponse = {
    status: 'healthy',
    version: '1.0.0',
    uptime,
    timestamp: new Date().toISOString(),
    build: {
      phase: 'Phase 3 Migration',
      tools_migrated: 43,
      commit: process.env.RENDER_GIT_COMMIT?.substring(0, 7) || 'unknown',
    },
  };

  res.json(health);
});

/**
 * MCP Introspection endpoints (no auth required for discovery)
 * These must be placed before authentication middleware
 */
import toolRegistry from '../tools/index.js';
import { AuthenticatedRequest } from '../types/index.js';

/**
 * MCP tools/list - Lists all tool definitions
 */
app.post('/mcp/tools/list', async (_req, res, next) => {
  try {
    const tools = toolRegistry.getAllDefinitions();
    return res.json({ tools });
  } catch (error) {
    return next(error);
  }
});

/**
 * MCP list_resources - Lists all available resources (tools organized by category)
 * Standard MCP introspection method
 */
app.post('/mcp/list_resources', async (_req, res, next) => {
  try {
    const toolsByCategory = toolRegistry.getToolsByCategory();
    const allTools = toolRegistry.getAllDefinitions();

    const resources = {
      tools: {
        total: toolRegistry.getToolCount(),
        categories: Object.keys(toolsByCategory).map(category => ({
          name: category,
          count: toolsByCategory[category].length,
          tools: toolsByCategory[category].map(tool => ({
            name: tool.name,
            description: tool.description,
          })),
        })),
        all: allTools.map(tool => ({
          name: tool.name,
          description: tool.description,
        })),
      },
      metadata: {
        version: '1.0.0',
        server: 'jobnimbus-mcp-remote',
        timestamp: new Date().toISOString(),
      },
    };

    return res.json(resources);
  } catch (error) {
    return next(error);
  }
});

/**
 * MCP search_tools - Searches tools by query string
 * Standard MCP introspection method
 */
app.post('/mcp/search_tools', async (req, res, next) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query string is required',
      });
    }

    const results = toolRegistry.searchTools(query);

    return res.json({
      success: true,
      query,
      count: results.length,
      tools: results,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * MCP tools/names - Quick list of all tool names
 * Useful for autocomplete and discovery
 */
app.post('/mcp/tools/names', async (_req, res, next) => {
  try {
    const names = toolRegistry.getAllToolNames();
    return res.json({
      success: true,
      count: names.length,
      names,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * Apply authentication and rate limiting to protected routes
 */
app.use(extractApiKey);
app.use(rateLimiter);

/**
 * Cache management routes (FASE 1)
 * Protected by authentication middleware above
 */
registerCacheRoutes(app);

/**
 * MCP tool execution endpoint (requires authentication)
 */
app.post('/mcp/tools/call', async (req: AuthenticatedRequest, res, next) => {
  try {
    const { name, arguments: args } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Tool name is required',
      });
    }

    const tool = toolRegistry.getTool(name);

    if (!tool) {
      return res.status(404).json({
        success: false,
        error: `Tool "${name}" not found`,
      });
    }

    // Execute tool with context
    const context = {
      apiKey: req.apiKey!,
      instance: req.instance!,
      clientId: req.clientId!,
    };

    const result = await tool.execute(args || {}, context);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * 404 handler
 */
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
  });
});

/**
 * Error handler (must be last)
 */
app.use(errorHandler);

/**
 * Start server
 */
const server = app.listen(config.port, () => {
  logger.info('Server started', {
    port: config.port,
    env: config.nodeEnv,
  });
});

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;
