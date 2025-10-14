/**
 * Integration tests for Attachment tools
 * Tests interaction between components with mocked external APIs
 */

import nock from 'nock';
import { GetAttachmentsTool } from '../../src/tools/attachments/getAttachments.js';
import { AnalyzeJobAttachmentsTool } from '../../src/tools/attachments/analyzeJobAttachments.js';
import jobNimbusClient from '../../src/services/jobNimbusClient.js';
import {
  mockContext,
  mockFilesResponse,
  mockJob,
  mockPdfBuffer,
  mockImageBuffer,
} from '../fixtures/attachments.js';
import {
  setupJobNimbusApiMocks,
  setupJobNimbusApiErrors,
  setupNetworkError,
  clearApiMocks,
} from '../helpers/testHelpers.js';

describe('Attachments Integration Tests', () => {
  beforeEach(() => {
    setupJobNimbusApiMocks();
  });

  afterEach(() => {
    clearApiMocks();
  });

  describe('GetAttachmentsTool with Real Client', () => {
    let tool: GetAttachmentsTool;

    beforeEach(() => {
      tool = new GetAttachmentsTool();
      // Use real client (already the default, no need to override)
    });

    it('should fetch attachments from mocked API', async () => {
      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result.count).toBeGreaterThan(0);
      expect(result.files).toBeDefined();
      expect(Array.isArray(result.files)).toBe(true);
    });

    it('should handle API authentication errors', async () => {
      clearApiMocks();
      setupJobNimbusApiErrors(401);

      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result).toHaveProperty('error');
      expect(result.status).toBe('error');
    });

    it('should handle network errors', async () => {
      clearApiMocks();
      setupNetworkError();

      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result).toHaveProperty('error');
      expect(result.status).toBe('error');
    });

    it('should correctly filter files by job ID', async () => {
      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result.count).toBeGreaterThan(0);
      result.files.forEach((file: any) => {
        const relatedToJob =
          file.primary?.id === 'job-456' ||
          file.related?.some((rel: any) => rel.id === 'job-456');
        expect(relatedToJob).toBe(true);
      });
    });

    it('should calculate file statistics correctly', async () => {
      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result.total_size_mb).toBeDefined();
      expect(parseFloat(result.total_size_mb)).toBeGreaterThan(0);
      expect(result.file_types).toBeDefined();
      expect(Object.keys(result.file_types).length).toBeGreaterThan(0);
    });
  });

  describe('AnalyzeJobAttachmentsTool with Real Client', () => {
    let tool: AnalyzeJobAttachmentsTool;

    beforeEach(() => {
      tool = new AnalyzeJobAttachmentsTool();
      // Use real client (already the default)
    });

    it('should analyze job attachments end-to-end', async () => {
      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result.job_id).toBe('job-456');
      expect(result.job_name).toBeDefined();
      expect(result.analysis_summary).toBeDefined();
      expect(result.files).toBeDefined();
    });

    it('should download and analyze PDFs', async () => {
      const result = await tool.execute(
        { job_id: 'job-456', file_types: ['pdf'], max_files: 5 },
        mockContext
      );

      const successfulAnalyses = result.files.filter(
        (f: any) => f.analysis_status === 'success'
      );

      if (successfulAnalyses.length > 0) {
        expect(successfulAnalyses[0].content_analysis).toBeDefined();
        expect(successfulAnalyses[0].content_analysis.document_type).toBeDefined();
      }
    });

    it('should handle jobs with no attachments', async () => {
      // Mock empty response
      clearApiMocks();
      nock('https://api.jobnimbus.com')
        .get('/api1/jobs/empty-job')
        .reply(200, mockJob);
      nock('https://api.jobnimbus.com')
        .get('/api1/files')
        .query(true)
        .reply(200, { files: [], count: 0 });

      const result = await tool.execute({ job_id: 'empty-job' }, mockContext);

      expect(result.analysis_summary.total_files_found).toBe(0);
      expect(result.files.length).toBe(0);
    });

    it('should apply size limits correctly', async () => {
      const result = await tool.execute(
        { job_id: 'job-456', max_file_size_mb: 1 },
        mockContext
      );

      const largeFiles = result.files.filter(
        (f: any) => parseFloat(f.size_mb) > 1
      );

      largeFiles.forEach((file: any) => {
        expect(file.analysis_status).toBe('skipped');
        expect(file.skip_reason).toContain('too large');
      });
    });
  });

  describe('Tool Interaction Scenarios', () => {
    let getTool: GetAttachmentsTool;
    let analyzeTool: AnalyzeJobAttachmentsTool;

    beforeEach(() => {
      getTool = new GetAttachmentsTool();
      analyzeTool = new AnalyzeJobAttachmentsTool();
      // Use real clients (already the default)
    });

    it('should use getAttachments to list files, then analyze specific ones', async () => {
      // Step 1: Get all attachments
      const listResult = await getTool.execute({ job_id: 'job-456' }, mockContext);
      expect(listResult.files.length).toBeGreaterThan(0);

      // Step 2: Analyze only PDFs
      const pdfFiles = listResult.files.filter((f: any) =>
        f.filename?.endsWith('.pdf')
      );

      if (pdfFiles.length > 0) {
        const analyzeResult = await analyzeTool.execute(
          { job_id: 'job-456', file_types: ['pdf'] },
          mockContext
        );

        expect(analyzeResult.files.length).toBeGreaterThan(0);
      }
    });

    it('should filter by file type in both tools consistently', async () => {
      const listResult = await getTool.execute(
        { job_id: 'job-456', file_type: 'pdf' },
        mockContext
      );

      const analyzeResult = await analyzeTool.execute(
        { job_id: 'job-456', file_types: ['pdf'] },
        mockContext
      );

      // Both should return only PDFs
      listResult.files.forEach((f: any) => {
        expect(f.file_extension).toBe('pdf');
      });

      analyzeResult.files.forEach((f: any) => {
        if (f.analysis_status !== 'skipped') {
          expect(f.filename).toMatch(/\.pdf$/i);
        }
      });
    });
  });

  describe('Error Recovery', () => {
    let getTool: GetAttachmentsTool;

    beforeEach(() => {
      getTool = new GetAttachmentsTool();
    });

    it('should recover from transient API errors', async () => {
      // First call fails
      clearApiMocks();
      setupJobNimbusApiErrors(500);

      const firstResult = await getTool.execute({ job_id: 'job-456' }, mockContext);
      expect(firstResult.status).toBe('error');

      // Second call succeeds
      clearApiMocks();
      setupJobNimbusApiMocks();

      const secondResult = await getTool.execute({ job_id: 'job-456' }, mockContext);
      expect(secondResult.status).not.toBe('error');
      expect(secondResult.files).toBeDefined();
    });

    it('should handle partial data in API responses', async () => {
      clearApiMocks();
      nock('https://api.jobnimbus.com')
        .get('/api1/files')
        .query(true)
        .reply(200, {
          files: [
            { jnid: 'file-1', filename: 'test.pdf' },
            // Missing required fields
          ],
          count: 1,
        });

      const result = await getTool.execute({}, mockContext);

      expect(result.files).toBeDefined();
      expect(result.count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Rate Limiting and Throttling', () => {
    it('should handle multiple concurrent requests', async () => {
      const tool = new GetAttachmentsTool();


      const requests = [
        tool.execute({ job_id: 'job-456' }, mockContext),
        tool.execute({ contact_id: 'contact-789' }, mockContext),
        tool.execute({ file_type: 'pdf' }, mockContext),
      ];

      const results = await Promise.all(requests);

      results.forEach((result) => {
        expect(result).toHaveProperty('files');
        expect(result.status).not.toBe('error');
      });
    });

    it('should handle API rate limit errors gracefully', async () => {
      clearApiMocks();
      nock('https://api.jobnimbus.com')
        .get('/api1/files')
        .query(true)
        .reply(429, { error: 'Rate limit exceeded' });

      const tool = new GetAttachmentsTool();


      const result = await tool.execute({}, mockContext);

      expect(result).toHaveProperty('error');
      expect(result.status).toBe('error');
    });
  });

  describe('Data Consistency', () => {
    it('should return consistent file counts', async () => {
      const tool = new GetAttachmentsTool();


      const result1 = await tool.execute({ job_id: 'job-456' }, mockContext);
      const result2 = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result1.count).toBe(result2.count);
      expect(result1.total_available).toBe(result2.total_available);
    });

    it('should maintain referential integrity in related entities', async () => {
      const tool = new GetAttachmentsTool();


      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      result.files.forEach((file: any) => {
        if (file.primary) {
          expect(file.primary).toHaveProperty('id');
        }

        if (file.related && file.related.length > 0) {
          file.related.forEach((rel: any) => {
            expect(rel).toHaveProperty('id');
          });
        }
      });
    });
  });

  describe('Pagination Integration', () => {
    it('should handle paginated requests correctly', async () => {
      const tool = new GetAttachmentsTool();


      // First page
      const page1 = await tool.execute({ from: 0, size: 2 }, mockContext);
      expect(page1.from).toBe(0);
      expect(page1.fetch_size).toBe(2);

      // Second page
      const page2 = await tool.execute({ from: 2, size: 2 }, mockContext);
      expect(page2.from).toBe(2);
      expect(page2.fetch_size).toBe(2);
    });

    it('should fetch all files across multiple pages', async () => {
      const tool = new GetAttachmentsTool();


      const allFiles: any[] = [];
      let from = 0;
      const size = 2;
      let hasMore = true;

      while (hasMore && from < 10) {
        const result = await tool.execute({ from, size }, mockContext);
        allFiles.push(...result.files);

        if (result.files.length < size) {
          hasMore = false;
        } else {
          from += size;
        }
      }

      expect(allFiles.length).toBeGreaterThan(0);
    });
  });

  describe('Content Type Handling', () => {
    it('should handle various PDF content types', async () => {
      const tool = new GetAttachmentsTool();


      const result = await tool.execute({ file_type: 'pdf' }, mockContext);

      result.files.forEach((file: any) => {
        const isPdf =
          file.content_type?.includes('pdf') || file.file_extension === 'pdf';
        expect(isPdf).toBe(true);
      });
    });

    it('should handle various image types', async () => {
      const tool = new GetAttachmentsTool();


      const result = await tool.execute({ file_type: 'jpg' }, mockContext);

      result.files.forEach((file: any) => {
        const isImage =
          file.content_type?.includes('image') ||
          ['jpg', 'jpeg', 'png', 'gif'].includes(file.file_extension);
        expect(isImage).toBe(true);
      });
    });
  });

  describe('Performance Under Load', () => {
    it('should handle large file lists efficiently', async () => {
      // Mock large response
      clearApiMocks();
      const largeFileList = Array(100)
        .fill(null)
        .map((_, i) => ({
          jnid: `file-${i}`,
          filename: `file-${i}.pdf`,
          content_type: 'application/pdf',
          size: 1048576,
          date_created: Date.now(),
          is_active: true,
          primary: { id: 'job-456', type: 'job' },
          related: [{ id: 'job-456', type: 'job' }],
        }));

      nock('https://api.jobnimbus.com')
        .get('/api1/files')
        .query(true)
        .reply(200, { files: largeFileList, count: 100 });

      const tool = new GetAttachmentsTool();


      const startTime = Date.now();
      const result = await tool.execute({}, mockContext);
      const duration = Date.now() - startTime;

      expect(result.count).toBe(100);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});
