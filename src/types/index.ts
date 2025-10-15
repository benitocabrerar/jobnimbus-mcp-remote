/**
 * Type Definitions for JobNimbus MCP Remote Server
 */

import { Request } from 'express';

/**
 * Verbosity Levels for Response Control
 * Controls field selection and data inclusion in responses
 */
export type VerbosityLevel = 'summary' | 'compact' | 'detailed' | 'raw';

/**
 * Response Status
 */
export type ResponseStatus = 'ok' | 'partial' | 'error';

/**
 * Page Information for Pagination
 */
export interface PageInfo {
  has_more: boolean;
  next_cursor?: string;
  prev_cursor?: string;
  total?: number;
  current_page?: number;
  total_pages?: number;
}

/**
 * Response Metadata
 * Provides context about the response structure and caching
 */
export interface ResponseMetadata {
  verbosity: VerbosityLevel;
  size_bytes: number;
  field_count: number;
  row_count: number;
  cache_hit?: boolean;
  expires_in_sec?: number;
  tool_name: string;
  timestamp: string;
}

/**
 * Response Envelope
 * Standard wrapper for all tool responses with handle support
 */
export interface ResponseEnvelope<T = any> {
  status: ResponseStatus;
  summary: T;                      // Always compact, for immediate display
  result_handle?: string;          // Handle for large payloads
  page_info?: PageInfo;            // Pagination information
  metadata: ResponseMetadata;      // Response context
  error?: string;                  // Error message if status is 'error'
}

/**
 * Stored Result in Redis
 * Structure for handle-based storage
 */
export interface StoredResult {
  data: any;
  metadata: {
    created_at: number;
    expires_at: number;
    size_bytes: number;
    tool_name: string;
    verbosity: string;
    instance: string;
  };
}

/**
 * Base Tool Input Interface
 * Common parameters for all tools
 */
export interface BaseToolInput {
  // Verbosity control
  verbosity?: VerbosityLevel;

  // Field selection (comma-separated)
  fields?: string;

  // Cursor pagination
  cursor?: string;
  page_size?: number;

  // Opt-in flags (default: false)
  include_full_details?: boolean;
}

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
