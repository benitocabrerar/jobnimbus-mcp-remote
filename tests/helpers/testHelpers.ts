/**
 * Test helper functions
 */

import nock from 'nock';
import {
  mockPdfBuffer,
  mockImageBuffer,
  mockFilesResponse,
  mockJob,
} from '../fixtures/attachments.js';

/**
 * Setup nock interceptors for JobNimbus API
 */
export function setupJobNimbusApiMocks() {
  const baseUrl = 'https://api.jobnimbus.com';

  // Mock files endpoint
  nock(baseUrl)
    .get('/api1/files')
    .query(true)
    .reply(200, mockFilesResponse)
    .persist();

  // Mock specific job endpoint
  nock(baseUrl)
    .get('/api1/jobs/job-456')
    .reply(200, mockJob)
    .persist();

  // Mock file downloads
  nock('https://files.jobnimbus.com')
    .get(/.*\.pdf$/)
    .reply(200, mockPdfBuffer, {
      'content-type': 'application/pdf',
    })
    .persist();

  nock('https://files.jobnimbus.com')
    .get(/.*\.jpg$/)
    .reply(200, mockImageBuffer, {
      'content-type': 'image/jpeg',
    })
    .persist();
}

/**
 * Setup nock interceptors for API errors
 */
export function setupJobNimbusApiErrors(statusCode: number = 401) {
  const baseUrl = 'https://api.jobnimbus.com';

  nock(baseUrl)
    .get('/api1/files')
    .query(true)
    .reply(statusCode, { error: 'Unauthorized' })
    .persist();
}

/**
 * Setup nock for network errors
 */
export function setupNetworkError() {
  const baseUrl = 'https://api.jobnimbus.com';

  nock(baseUrl)
    .get('/api1/files')
    .query(true)
    .replyWithError({ code: 'ECONNREFUSED', message: 'Network error' })
    .persist();
}

/**
 * Clear all nock interceptors
 */
export function clearApiMocks() {
  nock.cleanAll();
}

/**
 * Wait for a specified time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock tool context
 */
export function createMockContext(overrides?: Partial<any>) {
  return {
    apiKey: 'test-api-key-123',
    instance: 'stamford' as const,
    clientId: 'test-client',
    ...overrides,
  };
}

/**
 * Validate file structure
 */
export function validateFileStructure(file: any) {
  expect(file).toHaveProperty('id');
  expect(file).toHaveProperty('filename');
  expect(file).toHaveProperty('content_type');
  expect(file).toHaveProperty('size_bytes');
  expect(file).toHaveProperty('size_mb');
  expect(file).toHaveProperty('date_created');
  expect(file).toHaveProperty('is_active');
  expect(file).toHaveProperty('primary');
  expect(file).toHaveProperty('related');
}

/**
 * Validate analysis structure
 */
export function validateAnalysisStructure(analysis: any) {
  expect(analysis).toHaveProperty('filename');
  expect(analysis).toHaveProperty('file_type');
  expect(analysis).toHaveProperty('size_mb');
  expect(analysis).toHaveProperty('analysis_status');

  if (analysis.analysis_status === 'success') {
    expect(analysis).toHaveProperty('content_analysis');
  }

  if (analysis.analysis_status === 'skipped') {
    expect(analysis).toHaveProperty('skip_reason');
  }

  if (analysis.analysis_status === 'error') {
    expect(analysis).toHaveProperty('error');
  }
}

/**
 * Generate random file ID
 */
export function generateFileId(): string {
  return `file-${Math.random().toString(36).substring(7)}`;
}

/**
 * Generate random job ID
 */
export function generateJobId(): string {
  return `job-${Math.random().toString(36).substring(7)}`;
}

/**
 * Create a mock file with custom properties
 */
export function createMockFile(overrides?: Partial<any>) {
  return {
    jnid: generateFileId(),
    filename: 'test-file.pdf',
    content_type: 'application/pdf',
    size: 1048576,
    date_created: Date.now(),
    date_file_created: Date.now(),
    is_active: true,
    is_archived: false,
    url: `https://files.jobnimbus.com/${generateFileId()}.pdf`,
    type: 'file',
    primary: {
      id: generateJobId(),
      name: 'Test Job',
      type: 'job',
    },
    related: [],
    ...overrides,
  };
}

/**
 * Assert error response structure
 */
export function assertErrorResponse(response: any) {
  expect(response).toHaveProperty('error');
  expect(response).toHaveProperty('status', 'error');
  expect(typeof response.error).toBe('string');
}

/**
 * Assert success response structure
 */
export function assertSuccessResponse(response: any) {
  expect(response).not.toHaveProperty('error');
  expect(response.status).not.toBe('error');
}

/**
 * Mock fetch for file downloads
 */
export function mockFetch(url: string, buffer: Buffer, contentType: string) {
  global.fetch = jest.fn().mockImplementation((fetchUrl: string) => {
    if (fetchUrl === url) {
      return Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(buffer),
      });
    }
    return Promise.reject(new Error('Not found'));
  });
}

/**
 * Restore original fetch
 */
export function restoreFetch() {
  if (global.fetch && 'mockRestore' in global.fetch) {
    (global.fetch as jest.Mock).mockRestore();
  }
}
