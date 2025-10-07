/**
 * JobNimbus API Client
 * Stateless client - API key passed in each request
 */

import { JobNimbusResponse } from '../types/index.js';
import { JobNimbusApiError } from '../utils/errors.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

export class JobNimbusClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.jobNimbusBaseUrl;
  }

  /**
   * Execute GET request to JobNimbus API
   */
  async get<T = any>(
    apiKey: string,
    endpoint: string,
    params?: Record<string, any>
  ): Promise<JobNimbusResponse<T>> {
    return this.request<T>(apiKey, endpoint, 'GET', params);
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
   */
  private async request<T>(
    apiKey: string,
    endpoint: string,
    method: string,
    params?: Record<string, any>,
    body?: any
  ): Promise<JobNimbusResponse<T>> {
    try {
      // Build URL with query params
      const url = new URL(`${this.baseUrl}/${endpoint}`);
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
      logger.error('JobNimbus API request failed', error);

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
