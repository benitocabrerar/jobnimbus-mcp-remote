/**
 * Global Error Handler Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { ErrorResponse } from '../types/index.js';
import {
  UnauthorizedError,
  ValidationError,
  RateLimitError,
  JobNimbusApiError,
  ToolExecutionError,
} from '../utils/errors.js';
import logger from '../utils/logger.js';

/**
 * Error handler middleware
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Determine status code
  let statusCode = 500;
  let message = 'Internal server error';

  if (err instanceof UnauthorizedError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ValidationError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof RateLimitError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof JobNimbusApiError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ToolExecutionError) {
    statusCode = err.statusCode;
    message = err.message;
  }

  // Log error (sanitized)
  logger.error('Request error', {
    statusCode,
    message: err.message,
    path: req.path,
    method: req.method,
  });

  // Build error response
  const errorResponse: ErrorResponse = {
    error: err.name || 'Error',
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  };

  // Include stack trace only in development
  if (process.env.NODE_ENV === 'development') {
    (errorResponse as any).stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};
