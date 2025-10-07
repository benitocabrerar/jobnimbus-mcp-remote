/**
 * Main Express Server with MCP Protocol Support
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { extractApiKey } from '../middleware/apiKeyExtractor.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { HealthCheckResponse } from '../types/index.js';
import config, { validateConfig } from '../config/index.js';
import logger from '../utils/logger.js';

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
 * Health check endpoint (no auth required)
 */
app.get('/health', (_req, res) => {
  const uptime = Date.now() - startTime;

  const health: HealthCheckResponse = {
    status: 'healthy',
    version: '1.0.0',
    uptime,
    timestamp: new Date().toISOString(),
  };

  res.json(health);
});

/**
 * Apply authentication and rate limiting to all other routes
 */
app.use(extractApiKey);
app.use(rateLimiter);

/**
 * MCP endpoints
 */
import toolRegistry from '../tools/index.js';
import { AuthenticatedRequest } from '../types/index.js';

app.post('/mcp/tools/list', async (_req, res, next) => {
  try {
    const tools = toolRegistry.getAllDefinitions();
    return res.json({ tools });
  } catch (error) {
    return next(error);
  }
});

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
