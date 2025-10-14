/**
 * Cache Integration Helper
 *
 * Utilities to integrate Redis caching with Express server lifecycle.
 * Handles connection management, health checks, and graceful shutdown.
 *
 * @author Backend Architecture Team
 * @version 1.0.0
 */

import { Express, Request, Response, NextFunction } from 'express';
import { cacheService, CacheService } from './cacheService.js';
import { isCacheEnabled } from '../config/cache.js';

/**
 * Initialize cache service on server startup
 * Call this in your main server initialization
 *
 * @param app - Express application instance
 * @returns Promise that resolves when cache is connected
 *
 * @example
 * // In src/index.ts or src/server/index.ts
 * import { initializeCache, registerCacheRoutes } from './services/cacheIntegration';
 *
 * const app = express();
 * await initializeCache(app);
 * registerCacheRoutes(app);
 */
export async function initializeCache(app: Express): Promise<void> {
  if (!isCacheEnabled()) {
    console.log('[Cache] Caching is disabled');
    return;
  }

  try {
    console.log('[Cache] Initializing Redis connection...');
    await cacheService.connect();
    console.log('[Cache] Redis connected successfully');

    // Register cleanup on process exit
    registerShutdownHandlers();
  } catch (error) {
    console.error('[Cache] Failed to initialize cache:', error);
    console.warn('[Cache] Application will continue without caching');
    // Don't throw - allow app to run without cache
  }
}

/**
 * Register graceful shutdown handlers
 * Ensures Redis connections are properly closed
 */
function registerShutdownHandlers(): void {
  const shutdown = async (signal: string) => {
    console.log(`\n[Cache] ${signal} received, closing Redis connection...`);
    try {
      await cacheService.disconnect();
      console.log('[Cache] Redis disconnected gracefully');
      process.exit(0);
    } catch (error) {
      console.error('[Cache] Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Handle different shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // Nodemon restart

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('[Cache] Uncaught exception:', error);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Cache] Unhandled rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });
}

/**
 * Register cache management routes
 * Provides endpoints for monitoring and administration
 *
 * Routes:
 * - GET /cache/health - Health check
 * - GET /cache/stats - Detailed statistics
 * - POST /cache/clear - Clear all cache (admin only)
 * - DELETE /cache/invalidate - Invalidate specific patterns
 *
 * @param app - Express application instance
 * @param adminAuthMiddleware - Optional middleware to protect admin routes
 */
export function registerCacheRoutes(
  app: Express,
  adminAuthMiddleware?: (req: Request, res: Response, next: NextFunction) => void
): void {
  // Health check endpoint (public)
  app.get('/cache/health', async (req: Request, res: Response) => {
    try {
      const health = await cacheService.healthCheck();
      const statusCode = health.healthy ? 200 : 503;

      res.status(statusCode).json({
        status: health.healthy ? 'healthy' : 'unhealthy',
        cache: health,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Statistics endpoint (public, but consider auth in production)
  app.get('/cache/stats', async (req: Request, res: Response) => {
    try {
      const stats = await cacheService.getStats();

      res.json({
        status: 'ok',
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Apply admin auth middleware to destructive operations
  const adminAuth = adminAuthMiddleware || ((req, res, next) => next());

  // Clear all cache (admin only)
  app.post('/cache/clear', adminAuth, async (req: Request, res: Response) => {
    try {
      const count = await cacheService.clear();

      res.json({
        status: 'ok',
        message: `Cleared ${count} cache entries`,
        count,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Invalidate specific pattern (admin only)
  app.delete('/cache/invalidate', adminAuth, async (req: Request, res: Response): Promise<void> => {
    try {
      const { entity, operation } = req.body;

      if (!entity) {
        res.status(400).json({
          status: 'error',
          error: 'entity parameter is required',
        });
        return;
      }

      const count = await cacheService.invalidatePattern(entity, operation);

      res.json({
        status: 'ok',
        message: `Invalidated ${count} cache entries`,
        count,
        pattern: { entity, operation },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  console.log('[Cache] Cache management routes registered');
}

/**
 * Express middleware to add cache headers to responses
 * Helps with debugging and monitoring
 *
 * @example
 * app.use(cacheHeadersMiddleware);
 */
export function cacheHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Add cache info to response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    res.setHeader('X-Response-Time', `${duration}ms`);
    res.setHeader('X-Cache-Enabled', isCacheEnabled() ? 'true' : 'false');
  });

  next();
}

/**
 * Express middleware to handle cache errors gracefully
 * Prevents cache failures from breaking the application
 *
 * @example
 * app.use(cacheErrorMiddleware);
 */
export function cacheErrorMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If error is cache-related, log but don't crash
  if (error.message.includes('Redis') || error.message.includes('Cache')) {
    console.error('[Cache] Cache error handled:', error.message);
    // Continue without cache
    return next();
  }

  // Pass other errors to default error handler
  next(error);
}

/**
 * Warmup cache with frequently accessed data
 * Call this after server startup to preload hot data
 *
 * @param warmupFunctions - Array of async functions to execute
 * @returns Promise that resolves when warmup is complete
 *
 * @example
 * await warmupCache([
 *   () => getAttachments({ job_id: 'popular_job_123' }),
 *   () => getJobs({ status: 'active' }),
 * ]);
 */
export async function warmupCache(
  warmupFunctions: Array<() => Promise<any>>
): Promise<void> {
  if (!isCacheEnabled()) {
    console.log('[Cache] Cache warmup skipped (cache disabled)');
    return;
  }

  console.log('[Cache] Starting cache warmup...');
  const startTime = Date.now();

  try {
    // Execute warmup functions in parallel
    await Promise.allSettled(warmupFunctions.map(fn => fn()));

    const duration = Date.now() - startTime;
    console.log(`[Cache] Cache warmup completed in ${duration}ms`);
  } catch (error) {
    console.error('[Cache] Cache warmup error:', error);
    // Don't throw - warmup failures shouldn't crash the server
  }
}

/**
 * Cache monitoring decorator for functions
 * Wraps a function to automatically cache its results
 *
 * @param fn - Function to wrap
 * @param cacheKey - Cache key generator function
 * @param ttl - TTL in seconds
 * @returns Wrapped function with caching
 *
 * @example
 * const cachedGetAttachments = withCacheDecorator(
 *   getAttachmentsFromAPI,
 *   (args) => `attachments:${args.job_id}`,
 *   900 // 15 minutes
 * );
 */
export function withCacheDecorator<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  cacheKeyGenerator: (args: TArgs) => { entity: string; operation: string; identifier: string },
  ttl: number
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    const cacheKey = cacheKeyGenerator(args);

    // Try cache first
    const cached = await cacheService.get<TReturn>(
      cacheKey.entity,
      cacheKey.operation,
      cacheKey.identifier
    );

    if (cached !== null) {
      return cached;
    }

    // Execute function
    const result = await fn(...args);

    // Cache result (fire and forget)
    cacheService.set(
      cacheKey.entity,
      cacheKey.operation,
      cacheKey.identifier,
      result,
      ttl
    ).catch(err => console.error(`[Cache] Background cache write failed: ${err}`));

    return result;
  };
}

/**
 * Export cache service instance for direct use
 */
export { cacheService } from './cacheService.js';
