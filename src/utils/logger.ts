/**
 * Secure Logger - Never logs sensitive information
 */

import winston from 'winston';

const sensitivePatterns = [
  /api[-_]?key/gi,
  /password/gi,
  /token/gi,
  /secret/gi,
  /authorization/gi,
  /bearer/gi,
];

/**
 * Sanitize log data to remove sensitive information
 */
function sanitize(data: any): any {
  if (typeof data === 'string') {
    // Check if string contains sensitive patterns
    for (const pattern of sensitivePatterns) {
      if (pattern.test(data)) {
        return '[REDACTED]';
      }
    }
    return data;
  }

  if (typeof data === 'object' && data !== null) {
    const sanitized: any = Array.isArray(data) ? [] : {};

    for (const [key, value] of Object.entries(data)) {
      // Redact keys that match sensitive patterns
      if (sensitivePatterns.some((pattern) => pattern.test(key))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitize(value);
      }
    }

    return sanitized;
  }

  return data;
}

/**
 * Winston logger configuration
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const sanitizedMeta = sanitize(meta);
          const metaString = Object.keys(sanitizedMeta).length
            ? JSON.stringify(sanitizedMeta)
            : '';
          return `${timestamp} [${level}]: ${message} ${metaString}`;
        })
      ),
    }),
  ],
});

/**
 * Export safe logging functions
 */
export default {
  info: (message: string, meta?: any) => {
    logger.info(message, sanitize(meta || {}));
  },

  error: (message: string, error?: Error | any) => {
    const sanitizedError = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : sanitize(error);
    logger.error(message, sanitizedError);
  },

  warn: (message: string, meta?: any) => {
    logger.warn(message, sanitize(meta || {}));
  },

  debug: (message: string, meta?: any) => {
    logger.debug(message, sanitize(meta || {}));
  },
};
