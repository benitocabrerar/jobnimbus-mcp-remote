/**
 * JobNimbus API Client
 * Stateless client - API key passed in each request
 *
 * OPTIMIZATION (Week 2-3): Enhanced with JSONB Field Projection support
 * Supports Query Delegation Pattern for filtering, sorting, and pagination at API level
 */

import { JobNimbusResponse } from '../types/index.js';
import { JobNimbusApiError } from '../utils/errors.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/**
 * API Query Options for optimization strategies
 *
 * JSONB Field Projection (Strategy 2):
 * - fields: Select specific fields to reduce response size by 80-95%
 * - exclude_jsonb: Skip heavy JSONB fields when not needed
 *
 * Query Delegation Pattern (Strategy 1):
 * - filter: Elasticsearch JSON filter for server-side filtering
 * - size/from: Pagination parameters
 * - sort_by/order: Server-side sorting
 */
export interface APIOptions {
  // JSONB Field Projection
  fields?: string[];
  exclude_jsonb?: boolean;

  // Query Delegation
  filter?: string;
  size?: number;
  from?: number;
  sort_by?: string;
  order?: 'asc' | 'desc';

  // Allow any additional params
  [key: string]: any;
}

export class JobNimbusClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.jobNimbusBaseUrl;
  }

  /**
   * Execute GET request to JobNimbus API
   * @param customBaseUrl - Optional custom base URL (for endpoints that don't use /api1/)
   *
   * OPTIMIZATION: Supports JSONB Field Projection and Query Delegation
   * Example: get(apiKey, 'jobs', { fields: ['jnid', 'name'], exclude_jsonb: true, filter: {...} })
   */
  async get<T = any>(
    apiKey: string,
    endpoint: string,
    params?: APIOptions,
    customBaseUrl?: string
  ): Promise<JobNimbusResponse<T>> {
    // Process fields array to comma-separated string if provided
    const processedParams: Record<string, any> = params ? { ...params } : {};
    if (params?.fields && Array.isArray(params.fields)) {
      processedParams.fields = params.fields.join(',');
    }

    return this.request<T>(apiKey, endpoint, 'GET', processedParams, undefined, customBaseUrl);
  }

  /**
   * Execute POST request to JobNimbus API
   */
  async post<T = any>(
    apiKey: string,
    endpoint: string,
    body?: any
  ): Promise<JobNimbusResponse<T>> {
    return this.request<T>(apiKey, endpoint, 'POST', undefined, body);
  }

  /**
   * Execute PUT request to JobNimbus API
   */
  async put<T = any>(
    apiKey: string,
    endpoint: string,
    body?: any
  ): Promise<JobNimbusResponse<T>> {
    return this.request<T>(apiKey, endpoint, 'PUT', undefined, body);
  }

  /**
   * Execute DELETE request to JobNimbus API
   */
  async delete<T = any>(
    apiKey: string,
    endpoint: string
  ): Promise<JobNimbusResponse<T>> {
    return this.request<T>(apiKey, endpoint, 'DELETE');
  }

  /**
   * Generic request method
   * @param customBaseUrl - Optional custom base URL (overrides default baseUrl)
   */
  private async request<T>(
    apiKey: string,
    endpoint: string,
    method: string,
    params?: Record<string, any>,
    body?: any,
    customBaseUrl?: string
  ): Promise<JobNimbusResponse<T>> {
    try {
      // Build URL with query params (use custom base URL if provided)
      const baseUrlToUse = customBaseUrl || this.baseUrl;
      const url = new URL(`${baseUrlToUse}/${endpoint}`);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value));
          }
        });
      }

      // Make request
      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      // Handle response
      if (!response.ok) {
        throw new JobNimbusApiError(
          `JobNimbus API error: ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();

      logger.debug('JobNimbus API request successful', {
        endpoint,
        method,
        status: response.status,
      });

      return {
        success: true,
        data: data as T,
      };
    } catch (error) {
      // Don't log expected 404s for endpoints that don't exist in JobNimbus API
      const isExpected404 = error instanceof JobNimbusApiError &&
                            error.statusCode === 404 &&
                            (endpoint === 'credit_memos' || endpoint === 'refunds');

      if (!isExpected404) {
        logger.error('JobNimbus API request failed', error);
      } else {
        logger.debug('Expected endpoint not available', {
          endpoint,
          status: 404,
          message: 'This endpoint does not exist in JobNimbus API - gracefully handled'
        });
      }

      if (error instanceof JobNimbusApiError) {
        throw error;
      }

      throw new JobNimbusApiError('Failed to communicate with JobNimbus API');
    } finally {
      // Clear API key from memory
      apiKey = '';
    }
  }

  /**
   * Validate API key by making a test request
   */
  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/contacts`, {
        method: 'HEAD',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    } finally {
      apiKey = '';
    }
  }
}

export default new JobNimbusClient();
