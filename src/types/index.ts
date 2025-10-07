/**
 * Type Definitions for JobNimbus MCP Remote Server
 */

import { Request } from 'express';

/**
 * Extended Express Request with API key context
 */
export interface AuthenticatedRequest extends Request {
  apiKey?: string;
  clientId?: string;
  instance?: 'stamford' | 'guilford';
}

/**
 * JobNimbus API Response
 */
export interface JobNimbusResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    page?: number;
    total?: number;
    hasMore?: boolean;
  };
}

/**
 * MCP Tool Definition
 */
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * MCP Tool Context (per request)
 */
export interface ToolContext {
  apiKey: string;
  instance: 'stamford' | 'guilford';
  clientId: string;
}

/**
 * Rate Limiter Info
 */
export interface RateLimitInfo {
  count: number;
  resetTime: number;
}

/**
 * Health Check Response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  checks?: {
    [key: string]: boolean;
  };
}

/**
 * Error Response
 */
export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  requestId?: string;
}

/**
 * Configuration
 */
export interface ServerConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  jobNimbusBaseUrl: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  logLevel: string;
}
