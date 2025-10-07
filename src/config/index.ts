/**
 * Server Configuration
 */

import { config } from 'dotenv';
import { ServerConfig } from '../types/index.js';

// Load environment variables
config();

/**
 * Get configuration from environment
 */
export const getConfig = (): ServerConfig => {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
    jobNimbusBaseUrl: process.env.JOBNIMBUS_API_BASE_URL || 'https://app.jobnimbus.com/api1',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
  };
};

/**
 * Validate configuration
 */
export const validateConfig = (config: ServerConfig): void => {
  if (!config.jobNimbusBaseUrl) {
    throw new Error('JOBNIMBUS_API_BASE_URL is required');
  }

  if (config.port < 1 || config.port > 65535) {
    throw new Error('PORT must be between 1 and 65535');
  }

  if (config.rateLimitMaxRequests < 1) {
    throw new Error('RATE_LIMIT_MAX_REQUESTS must be positive');
  }
};

export default getConfig();
