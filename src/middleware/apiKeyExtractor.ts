/**
 * API Key Extractor Middleware
 * Extracts JobNimbus API key from request headers
 * NEVER stores the key - only passes it through request context
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';

const API_KEY_HEADER = 'x-jobnimbus-api-key';
const INSTANCE_HEADER = 'x-jobnimbus-instance';

/**
 * Validate API key format
 */
function isValidApiKeyFormat(apiKey: string): boolean {
  // Basic validation - length and characters
  if (apiKey.length < 20 || apiKey.length > 256) {
    return false;
  }

  // Only alphanumeric and some special chars
  return /^[A-Za-z0-9\-_]+$/.test(apiKey);
}

/**
 * Extract and validate API key from request
 */
export const extractApiKey = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract API key from header
    const apiKey = req.headers[API_KEY_HEADER] as string;

    if (!apiKey) {
      throw new UnauthorizedError('API key required in X-JobNimbus-Api-Key header');
    }

    // Validate format
    if (!isValidApiKeyFormat(apiKey)) {
      throw new ValidationError('Invalid API key format');
    }

    // Extract instance (stamford or guilford)
    const instance = req.headers[INSTANCE_HEADER] as string;
    if (instance && !['stamford', 'guilford'].includes(instance)) {
      throw new ValidationError('Invalid instance. Must be "stamford" or "guilford"');
    }

    // Generate client ID for rate limiting (hash of IP + user agent)
    const clientId = generateClientId(req);

    // Attach to request context (TEMPORARY - will be cleared)
    req.apiKey = apiKey;
    req.instance = instance as 'stamford' | 'guilford' || 'stamford';
    req.clientId = clientId;

    // Log request (without API key)
    logger.info('API request received', {
      clientId,
      instance: req.instance,
      path: req.path,
      method: req.method,
    });

    // Clear API key from memory after response
    res.on('finish', () => {
      if (req.apiKey) {
        req.apiKey = undefined;
        delete req.apiKey;
      }
    });

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Generate unique client ID for rate limiting
 */
function generateClientId(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  // Simple hash (in production, use crypto.createHash)
  return Buffer.from(`${ip}:${userAgent}`).toString('base64').substring(0, 16);
}
