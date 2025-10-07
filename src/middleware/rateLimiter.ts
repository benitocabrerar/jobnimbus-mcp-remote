/**
 * Rate Limiter Middleware
 * Per-client rate limiting (not per API key to avoid exposing keys)
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, RateLimitInfo } from '../types/index.js';
import { RateLimitError } from '../utils/errors.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

// In-memory rate limit store (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitInfo>();

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, info] of rateLimitStore.entries()) {
    if (now > info.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

/**
 * Rate limiting middleware
 */
export const rateLimiter = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const clientId = req.clientId;

  if (!clientId) {
    return next();
  }

  const now = Date.now();
  const windowMs = config.rateLimitWindowMs;
  const maxRequests = config.rateLimitMaxRequests;

  // Get or create rate limit info
  let limitInfo = rateLimitStore.get(clientId);

  if (!limitInfo || now > limitInfo.resetTime) {
    // New window
    limitInfo = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(clientId, limitInfo);
  } else {
    // Within existing window
    limitInfo.count++;

    if (limitInfo.count > maxRequests) {
      const retryAfter = Math.ceil((limitInfo.resetTime - now) / 1000);

      logger.warn('Rate limit exceeded', {
        clientId,
        count: limitInfo.count,
        max: maxRequests,
      });

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', limitInfo.resetTime);
      res.setHeader('Retry-After', retryAfter);

      return next(new RateLimitError(retryAfter));
    }
  }

  // Set rate limit headers
  const remaining = Math.max(0, maxRequests - limitInfo.count);
  res.setHeader('X-RateLimit-Limit', maxRequests);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', limitInfo.resetTime);

  next();
};
