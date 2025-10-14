/**
 * Unit tests for GetAttachmentsTool
 */

import { GetAttachmentsTool } from '../../src/tools/attachments/getAttachments.js';
import { MockJobNimbusClient } from '../mocks/jobNimbusClient.mock.js';
import {
  mockContext,
  mockFilesResponse,
  mockJobNimbusFile,
  mockImageFile,
  mockEmptyFilesResponse,
} from '../fixtures/attachments.js';
import { validateFileStructure } from '../helpers/testHelpers.js';

describe('GetAttachmentsTool', () => {
  let tool: GetAttachmentsTool;
  let mockClient: MockJobNimbusClient;

  beforeEach(() => {
    mockClient = new MockJobNimbusClient();
    tool = new GetAttachmentsTool();
    // Override the client getter
    Object.defineProperty(tool, 'client', {
      get: () => mockClient,
      configurable: true,
    });
  });

  afterEach(() => {
    mockClient.clearCallHistory();
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(tool.definition.name).toBe('get_attachments');
    });

    it('should have a description', () => {
      expect(tool.definition.description).toBeDefined();
      expect(tool.definition.description.length).toBeGreaterThan(0);
    });

    it('should define input schema with correct properties', () => {
      const schema = tool.definition.inputSchema;
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('job_id');
      expect(schema.properties).toHaveProperty('contact_id');
      expect(schema.properties).toHaveProperty('related_to');
      expect(schema.properties).toHaveProperty('from');
      expect(schema.properties).toHaveProperty('size');
      expect(schema.properties).toHaveProperty('file_type');
    });
  });

  describe('Basic Functionality', () => {
    it('should fetch all files without filters', async () => {
      const result = await tool.execute({}, mockContext);

      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('total_available');
      expect(Array.isArray(result.files)).toBe(true);
    });

    it('should include metadata in response', async () => {
      const result = await tool.execute({}, mockContext);

      expect(result).toHaveProperty('from');
      expect(result).toHaveProperty('fetch_size');
      expect(result).toHaveProperty('total_size_mb');
      expect(result).toHaveProperty('file_types');
    });

    it('should call JobNimbus API with correct endpoint', async () => {
      await tool.execute({}, mockContext);

      const history = mockClient.getCallHistory();
      expect(history).toHaveLength(1);
      expect(history[0].method).toBe('GET');
      expect(history[0].endpoint).toBe('files');
    });

    it('should respect pagination parameters', async () => {
      await tool.execute({ from: 10, size: 50 }, mockContext);

      const history = mockClient.getCallHistory();
      expect(history[0].params).toEqual({ from: 10, size: 50 });
    });

    it('should limit size to maximum of 500', async () => {
      await tool.execute({ size: 1000 }, mockContext);

      const history = mockClient.getCallHistory();
      expect(history[0].params?.size).toBeLessThanOrEqual(500);
    });
  });

  describe('Filtering by Entity ID', () => {
    it('should filter files by job_id', async () => {
      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result.count).toBeGreaterThan(0);
      expect(result.filter_applied.job_id).toBe('job-456');

      // Verify all files are related to the job
      result.files.forEach((file: any) => {
        const hasJobInPrimary = file.primary?.id === 'job-456';
        const hasJobInRelated = file.related?.some(
          (rel: any) => rel.id === 'job-456'
        );
        expect(hasJobInPrimary || hasJobInRelated).toBe(true);
      });
    });

    it('should filter files by contact_id', async () => {
      const result = await tool.execute(
        { contact_id: 'contact-789' },
        mockContext
      );

      expect(result.filter_applied.contact_id).toBe('contact-789');

      // Verify filtering was applied
      result.files.forEach((file: any) => {
        const hasContact = file.related?.some(
          (rel: any) => rel.id === 'contact-789'
        );
        expect(hasContact).toBe(true);
      });
    });

    it('should filter files by related_to ID', async () => {
      const result = await tool.execute({ related_to: 'job-456' }, mockContext);

      expect(result.filter_applied.related_to).toBe('job-456');
      expect(result.count).toBeGreaterThan(0);
    });

    it('should return empty array when no files match filter', async () => {
      const result = await tool.execute(
        { job_id: 'non-existent-job' },
        mockContext
      );

      expect(result.count).toBe(0);
      expect(result.files).toEqual([]);
    });
  });

  describe('File Type Filtering', () => {
    it('should filter by file extension', async () => {
      const result = await tool.execute({ file_type: 'pdf' }, mockContext);

      expect(result.filter_applied.file_type).toBe('pdf');
      result.files.forEach((file: any) => {
        expect(file.file_extension).toBe('pdf');
      });
    });

    it('should filter by content type', async () => {
      const result = await tool.execute(
        { file_type: 'application/pdf' },
        mockContext
      );

      result.files.forEach((file: any) => {
        expect(file.content_type).toContain('pdf');
      });
    });

    it('should handle case-insensitive file type matching', async () => {
      const resultLower = await tool.execute({ file_type: 'pdf' }, mockContext);
      const resultUpper = await tool.execute({ file_type: 'PDF' }, mockContext);

      expect(resultLower.count).toBe(resultUpper.count);
    });

    it('should combine entity and file type filters', async () => {
      const result = await tool.execute(
        { job_id: 'job-456', file_type: 'jpg' },
        mockContext
      );

      expect(result.filter_applied.job_id).toBe('job-456');
      expect(result.filter_applied.file_type).toBe('jpg');

      result.files.forEach((file: any) => {
        expect(file.file_extension).toBe('jpg');
      });
    });
  });

  describe('File Metadata Calculation', () => {
    it('should calculate total size in MB', async () => {
      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result).toHaveProperty('total_size_mb');
      expect(typeof result.total_size_mb).toBe('string');
      expect(parseFloat(result.total_size_mb)).toBeGreaterThanOrEqual(0);
    });

    it('should group files by type', async () => {
      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result).toHaveProperty('file_types');
      expect(typeof result.file_types).toBe('object');
    });

    it('should include individual file size in MB', async () => {
      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      result.files.forEach((file: any) => {
        expect(file).toHaveProperty('size_mb');
        expect(typeof file.size_mb).toBe('string');
      });
    });
  });

  describe('File Structure', () => {
    it('should return files with correct structure', async () => {
      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result.files.length).toBeGreaterThan(0);
      result.files.forEach(validateFileStructure);
    });

    it('should include file extension property', async () => {
      const result = await tool.execute({}, mockContext);

      result.files.forEach((file: any) => {
        expect(file).toHaveProperty('file_extension');
        if (file.filename) {
          const expectedExt = file.filename.split('.').pop()?.toLowerCase();
          expect(file.file_extension).toBe(expectedExt);
        }
      });
    });

    it('should include primary and related entities', async () => {
      const result = await tool.execute({}, mockContext);

      result.files.forEach((file: any) => {
        expect(file).toHaveProperty('primary');
        expect(file).toHaveProperty('related');
        expect(Array.isArray(file.related)).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      // Mock an error response
      mockClient.get = jest.fn().mockRejectedValue(new Error('API Error'));

      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('status', 'error');
    });

    it('should include debug information in error response', async () => {
      mockClient.get = jest.fn().mockRejectedValue(new Error('API Error'));

      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result).toHaveProperty('endpoint_used');
      expect(result).toHaveProperty('note');
      expect(result.endpoint_used).toBe('files');
    });

    it('should handle empty response from API', async () => {
      mockClient.setMockResponse('files', mockEmptyFilesResponse);

      const result = await tool.execute({}, mockContext);

      expect(result.count).toBe(0);
      expect(result.files).toEqual([]);
    });

    it('should handle missing files array in response', async () => {
      mockClient.setMockResponse('files', { count: 0 });

      const result = await tool.execute({}, mockContext);

      expect(result.files).toBeDefined();
      expect(Array.isArray(result.files)).toBe(true);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large file lists efficiently', async () => {
      // Create a large mock response
      const largeResponse = {
        files: Array(100).fill(mockJobNimbusFile),
        count: 100,
      };
      mockClient.setMockResponse('files', largeResponse);

      const startTime = Date.now();
      const result = await tool.execute({}, mockContext);
      const executionTime = Date.now() - startTime;

      expect(result.count).toBe(100);
      expect(executionTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle files without URLs', async () => {
      const fileWithoutUrl = { ...mockJobNimbusFile, url: undefined };
      mockClient.setMockResponse('files', {
        files: [fileWithoutUrl],
        count: 1,
      });

      const result = await tool.execute({}, mockContext);

      expect(result.files[0].url).toBeUndefined();
    });

    it('should handle files without size', async () => {
      const fileWithoutSize = { ...mockJobNimbusFile, size: undefined };
      mockClient.setMockResponse('files', {
        files: [fileWithoutSize],
        count: 1,
      });

      const result = await tool.execute({}, mockContext);

      expect(result.files[0].size_mb).toBe('0.00');
    });

    it('should handle files without filenames', async () => {
      const fileWithoutName = { ...mockJobNimbusFile, filename: undefined };
      mockClient.setMockResponse('files', {
        files: [fileWithoutName],
        count: 1,
      });

      const result = await tool.execute({}, mockContext);

      expect(result.files[0].file_extension).toBeUndefined();
    });
  });

  describe('Debug Information', () => {
    it('should include debug information in response', async () => {
      const result = await tool.execute({}, mockContext);

      expect(result).toHaveProperty('_debug');
      expect(result._debug).toHaveProperty('endpoint');
      expect(result._debug).toHaveProperty('note');
    });

    it('should indicate correct endpoint usage', async () => {
      const result = await tool.execute({}, mockContext);

      expect(result._debug.endpoint).toBe('files');
      expect(result._debug.note).toContain('/files endpoint');
    });
  });
});
