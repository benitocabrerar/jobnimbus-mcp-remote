/**
 * Custom Error Classes
 */

export class UnauthorizedError extends Error {
  statusCode = 401;

  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ValidationError extends Error {
  statusCode = 400;

  constructor(message: string = 'Validation failed') {
    super(message);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends Error {
  statusCode = 429;
  retryAfter: number;

  constructor(retryAfter: number = 60) {
    super('Rate limit exceeded');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class JobNimbusApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = 'JobNimbusApiError';
    this.statusCode = statusCode;
  }
}

export class ToolExecutionError extends Error {
  statusCode = 500;

  constructor(message: string) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}
