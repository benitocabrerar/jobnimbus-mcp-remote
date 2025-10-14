/**
 * Mock implementation of JobNimbusClient for testing
 */

import { JobNimbusResponse } from '../../src/types/index.js';
import { mockFilesResponse, mockJob } from '../fixtures/attachments.js';

export class MockJobNimbusClient {
  private mockResponses: Map<string, any> = new Map();
  private callHistory: Array<{
    method: string;
    endpoint: string;
    params?: any;
    body?: any;
  }> = [];

  constructor() {
    // Set default responses
    this.setMockResponse('files', mockFilesResponse);
    this.setMockResponse('jobs/job-456', mockJob);
  }

  /**
   * Set a custom mock response for an endpoint
   */
  setMockResponse(endpoint: string, response: any): void {
    this.mockResponses.set(endpoint, response);
  }

  /**
   * Get call history for verification
   */
  getCallHistory() {
    return this.callHistory;
  }

  /**
   * Clear call history
   */
  clearCallHistory(): void {
    this.callHistory = [];
  }

  /**
   * Mock GET request
   */
  async get<T = any>(
    apiKey: string,
    endpoint: string,
    params?: Record<string, any>
  ): Promise<JobNimbusResponse<T>> {
    this.callHistory.push({ method: 'GET', endpoint, params });

    // Check for specific mocked responses
    const mockData = this.mockResponses.get(endpoint);
    if (mockData) {
      return {
        success: true,
        data: mockData as T,
      };
    }

    // Default response
    return {
      success: true,
      data: {} as T,
    };
  }

  /**
   * Mock POST request
   */
  async post<T = any>(
    apiKey: string,
    endpoint: string,
    body?: any
  ): Promise<JobNimbusResponse<T>> {
    this.callHistory.push({ method: 'POST', endpoint, body });

    return {
      success: true,
      data: {} as T,
    };
  }

  /**
   * Mock PUT request
   */
  async put<T = any>(
    apiKey: string,
    endpoint: string,
    body?: any
  ): Promise<JobNimbusResponse<T>> {
    this.callHistory.push({ method: 'PUT', endpoint, body });

    return {
      success: true,
      data: {} as T,
    };
  }

  /**
   * Mock DELETE request
   */
  async delete<T = any>(
    apiKey: string,
    endpoint: string
  ): Promise<JobNimbusResponse<T>> {
    this.callHistory.push({ method: 'DELETE', endpoint });

    return {
      success: true,
      data: {} as T,
    };
  }

  /**
   * Mock validate API key
   */
  async validateApiKey(apiKey: string): Promise<boolean> {
    return apiKey === 'test-api-key-123';
  }
}

export const createMockClient = () => new MockJobNimbusClient();
