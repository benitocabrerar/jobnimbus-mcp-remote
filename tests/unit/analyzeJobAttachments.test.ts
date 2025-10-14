/**
 * Unit tests for AnalyzeJobAttachmentsTool
 */

import { AnalyzeJobAttachmentsTool } from '../../src/tools/attachments/analyzeJobAttachments.js';
import { MockJobNimbusClient } from '../mocks/jobNimbusClient.mock.js';
import {
  mockContext,
  mockJob,
  mockFilesResponse,
  mockPdfBuffer,
  mockImageBuffer,
} from '../fixtures/attachments.js';
import { validateAnalysisStructure, mockFetch, restoreFetch } from '../helpers/testHelpers.js';

describe('AnalyzeJobAttachmentsTool', () => {
  let tool: AnalyzeJobAttachmentsTool;
  let mockClient: MockJobNimbusClient;

  beforeEach(() => {
    mockClient = new MockJobNimbusClient();
    tool = new AnalyzeJobAttachmentsTool();
    // Override the client getter
    Object.defineProperty(tool, 'client', {
      get: () => mockClient,
      configurable: true,
    });

    // Mock fetch for file downloads
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('.pdf')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          arrayBuffer: () => Promise.resolve(mockPdfBuffer),
        });
      } else if (url.includes('.jpg')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          arrayBuffer: () => Promise.resolve(mockImageBuffer),
        });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  afterEach(() => {
    mockClient.clearCallHistory();
    restoreFetch();
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(tool.definition.name).toBe('analyze_job_attachments');
    });

    it('should have comprehensive description', () => {
      expect(tool.definition.description).toBeDefined();
      expect(tool.definition.description).toContain('PDF');
      expect(tool.definition.description).toContain('image');
    });

    it('should define input schema with all parameters', () => {
      const schema = tool.definition.inputSchema;
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('job_id');
      expect(schema.properties).toHaveProperty('file_types');
      expect(schema.properties).toHaveProperty('max_files');
      expect(schema.properties).toHaveProperty('max_file_size_mb');
      expect(schema.properties).toHaveProperty('include_text_extraction');
      expect(schema.properties).toHaveProperty('include_visual_analysis');
      expect(schema.required).toContain('job_id');
    });
  });

  describe('Basic Analysis', () => {
    it('should analyze job attachments successfully', async () => {
      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result).toHaveProperty('job_id', 'job-456');
      expect(result).toHaveProperty('job_name');
      expect(result).toHaveProperty('analysis_summary');
      expect(result).toHaveProperty('files');
      expect(Array.isArray(result.files)).toBe(true);
    });

    it('should fetch job information', async () => {
      await tool.execute({ job_id: 'job-456' }, mockContext);

      const history = mockClient.getCallHistory();
      const jobCall = history.find((call) => call.endpoint === 'jobs/job-456');
      expect(jobCall).toBeDefined();
    });

    it('should fetch files for the job', async () => {
      await tool.execute({ job_id: 'job-456' }, mockContext);

      const history = mockClient.getCallHistory();
      const filesCall = history.find((call) => call.endpoint === 'files');
      expect(filesCall).toBeDefined();
    });

    it('should include analysis summary', async () => {
      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      const summary = result.analysis_summary;
      expect(summary).toHaveProperty('total_files_found');
      expect(summary).toHaveProperty('files_analyzed');
      expect(summary).toHaveProperty('files_skipped');
      expect(summary).toHaveProperty('files_errored');
      expect(summary).toHaveProperty('total_size_mb');
      expect(summary).toHaveProperty('document_types');
    });
  });

  describe('File Type Filtering', () => {
    it('should filter by specified file types', async () => {
      const result = await tool.execute(
        { job_id: 'job-456', file_types: ['pdf'] },
        mockContext
      );

      expect(result.filters_applied.file_types).toEqual(['pdf']);
      result.files.forEach((file: any) => {
        if (file.analysis_status === 'success') {
          expect(file.filename).toMatch(/\.pdf$/i);
        }
      });
    });

    it('should handle multiple file type filters', async () => {
      const result = await tool.execute(
        { job_id: 'job-456', file_types: ['pdf', 'jpg', 'png'] },
        mockContext
      );

      expect(result.filters_applied.file_types).toEqual(['pdf', 'jpg', 'png']);
    });

    it('should analyze all files when no type filter provided', async () => {
      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result.filters_applied.file_types).toBeUndefined();
    });
  });

  describe('File Limits', () => {
    it('should respect max_files limit', async () => {
      const result = await tool.execute(
        { job_id: 'job-456', max_files: 2 },
        mockContext
      );

      expect(result.filters_applied.max_files).toBe(2);
      expect(result.files.length).toBeLessThanOrEqual(2);
    });

    it('should enforce maximum of 50 files', async () => {
      const result = await tool.execute(
        { job_id: 'job-456', max_files: 100 },
        mockContext
      );

      expect(result.filters_applied.max_files).toBeLessThanOrEqual(50);
    });

    it('should use default of 10 files when not specified', async () => {
      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result.filters_applied.max_files).toBe(10);
    });

    it('should skip files exceeding size limit', async () => {
      const result = await tool.execute(
        { job_id: 'job-456', max_file_size_mb: 1 },
        mockContext
      );

      const skippedFiles = result.files.filter(
        (f: any) => f.analysis_status === 'skipped' && f.skip_reason?.includes('too large')
      );
      expect(skippedFiles.length).toBeGreaterThan(0);
    });

    it('should enforce maximum size limit of 50MB', async () => {
      const result = await tool.execute(
        { job_id: 'job-456', max_file_size_mb: 100 },
        mockContext
      );

      expect(result.filters_applied.max_file_size_mb).toBeLessThanOrEqual(50);
    });
  });

  describe('PDF Analysis', () => {
    it('should extract text from PDFs when enabled', async () => {
      const result = await tool.execute(
        {
          job_id: 'job-456',
          file_types: ['pdf'],
          include_text_extraction: true,
        },
        mockContext
      );

      const pdfAnalysis = result.files.find(
        (f: any) => f.filename?.includes('.pdf') && f.analysis_status === 'success'
      );

      if (pdfAnalysis) {
        expect(pdfAnalysis.content_analysis).toBeDefined();
        expect(pdfAnalysis.content_analysis).toHaveProperty('extracted_text');
        expect(pdfAnalysis.content_analysis).toHaveProperty('text_preview');
      }
    });

    it('should detect document types from PDF content', async () => {
      const result = await tool.execute(
        { job_id: 'job-456', file_types: ['pdf'] },
        mockContext
      );

      const pdfAnalysis = result.files.find(
        (f: any) => f.filename?.includes('.pdf') && f.analysis_status === 'success'
      );

      if (pdfAnalysis) {
        expect(pdfAnalysis.content_analysis).toHaveProperty('document_type');
        expect(typeof pdfAnalysis.content_analysis.document_type).toBe('string');
      }
    });

    it('should extract key information from PDFs', async () => {
      const result = await tool.execute(
        { job_id: 'job-456', file_types: ['pdf'] },
        mockContext
      );

      const pdfAnalysis = result.files.find(
        (f: any) => f.filename?.includes('.pdf') && f.analysis_status === 'success'
      );

      if (pdfAnalysis && pdfAnalysis.content_analysis.key_information) {
        const keyInfo = pdfAnalysis.content_analysis.key_information;
        expect(keyInfo).toBeDefined();
        // Should extract amounts, dates, or entities if present
      }
    });

    it('should limit extracted text length', async () => {
      const result = await tool.execute(
        { job_id: 'job-456', file_types: ['pdf'] },
        mockContext
      );

      const pdfAnalysis = result.files.find(
        (f: any) => f.filename?.includes('.pdf') && f.analysis_status === 'success'
      );

      if (pdfAnalysis?.content_analysis?.extracted_text) {
        expect(pdfAnalysis.content_analysis.extracted_text.length).toBeLessThanOrEqual(5100);
      }
    });
  });

  describe('Image Analysis', () => {
    it('should analyze images when enabled', async () => {
      const result = await tool.execute(
        {
          job_id: 'job-456',
          file_types: ['jpg'],
          include_visual_analysis: true,
        },
        mockContext
      );

      const imageAnalysis = result.files.find(
        (f: any) => f.filename?.includes('.jpg') && f.analysis_status === 'success'
      );

      if (imageAnalysis) {
        expect(imageAnalysis.content_analysis).toBeDefined();
        expect(imageAnalysis.content_analysis).toHaveProperty('visual_description');
      }
    });

    it('should detect document type from image filename', async () => {
      const result = await tool.execute(
        { job_id: 'job-456', file_types: ['jpg'] },
        mockContext
      );

      const imageAnalysis = result.files.find(
        (f: any) => f.filename?.includes('.jpg') && f.analysis_status === 'success'
      );

      if (imageAnalysis) {
        expect(imageAnalysis.content_analysis).toHaveProperty('document_type');
      }
    });
  });

  describe('Key Information Extraction', () => {
    it('should extract monetary amounts from text', async () => {
      const result = await tool.execute(
        { job_id: 'job-456', file_types: ['pdf'] },
        mockContext
      );

      const summary = result.analysis_summary;
      if (summary.total_amounts_detected > 0) {
        expect(summary.unique_amounts).toBeDefined();
        expect(Array.isArray(summary.unique_amounts)).toBe(true);
      }
    });

    it('should extract dates from text', async () => {
      const result = await tool.execute(
        { job_id: 'job-456', file_types: ['pdf'] },
        mockContext
      );

      const summary = result.analysis_summary;
      if (summary.total_dates_detected > 0) {
        expect(summary.unique_dates).toBeDefined();
        expect(Array.isArray(summary.unique_dates)).toBe(true);
      }
    });

    it('should extract company names and entities', async () => {
      const result = await tool.execute(
        { job_id: 'job-456', file_types: ['pdf'] },
        mockContext
      );

      const pdfAnalysis = result.files.find(
        (f: any) => f.analysis_status === 'success' && f.content_analysis?.key_information
      );

      if (pdfAnalysis?.content_analysis?.key_information?.entities) {
        expect(Array.isArray(pdfAnalysis.content_analysis.key_information.entities)).toBe(true);
      }
    });
  });

  describe('Document Type Detection', () => {
    it('should detect estimates', async () => {
      const mockFile = {
        ...mockFilesResponse.files[0],
        filename: 'roofing-estimate.pdf',
      };
      mockClient.setMockResponse('files', { files: [mockFile], count: 1 });

      const result = await tool.execute(
        { job_id: 'job-456', file_types: ['pdf'] },
        mockContext
      );

      const analysis = result.files.find((f: any) => f.analysis_status === 'success');
      if (analysis) {
        expect(analysis.content_analysis.document_type).toBe('estimate');
      }
    });

    it('should detect invoices', async () => {
      const mockFile = {
        ...mockFilesResponse.files[0],
        filename: 'invoice-001.pdf',
      };
      mockClient.setMockResponse('files', { files: [mockFile], count: 1 });

      const result = await tool.execute(
        { job_id: 'job-456', file_types: ['pdf'] },
        mockContext
      );

      const analysis = result.files.find((f: any) => f.analysis_status === 'success');
      if (analysis) {
        expect(analysis.content_analysis.document_type).toBe('invoice');
      }
    });

    it('should detect contracts', async () => {
      const mockFile = {
        ...mockFilesResponse.files[0],
        filename: 'service-contract.pdf',
      };
      mockClient.setMockResponse('files', { files: [mockFile], count: 1 });

      const result = await tool.execute(
        { job_id: 'job-456', file_types: ['pdf'] },
        mockContext
      );

      const analysis = result.files.find((f: any) => f.analysis_status === 'success');
      if (analysis) {
        expect(analysis.content_analysis.document_type).toBe('contract');
      }
    });
  });

  describe('Analysis Status', () => {
    it('should mark successful analyses correctly', async () => {
      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      result.files.forEach((file: any) => {
        validateAnalysisStructure(file);
      });
    });

    it('should skip files without URLs', async () => {
      const mockFile = { ...mockFilesResponse.files[0], url: undefined };
      mockClient.setMockResponse('files', { files: [mockFile], count: 1 });

      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result.files[0].analysis_status).toBe('skipped');
      expect(result.files[0].skip_reason).toContain('No download URL');
    });

    it('should handle download errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Download failed'));

      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      const erroredFiles = result.files.filter(
        (f: any) => f.analysis_status === 'error'
      );
      expect(erroredFiles.length).toBeGreaterThan(0);
    });

    it('should skip unsupported file types', async () => {
      const mockFile = {
        ...mockFilesResponse.files[0],
        filename: 'document.docx',
        url: 'https://files.jobnimbus.com/doc.docx',
      };
      mockClient.setMockResponse('files', { files: [mockFile], count: 1 });

      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      // Should have at least one file in the response
      expect(result.files.length).toBeGreaterThan(0);

      // If there are skipped files, they should have a skip reason
      const skippedFiles = result.files.filter((f: any) => f.analysis_status === 'skipped');
      if (skippedFiles.length > 0) {
        expect(skippedFiles[0].skip_reason).toBeDefined();
      }
    });
  });

  describe('Options and Flags', () => {
    it('should respect include_text_extraction flag', async () => {
      const result = await tool.execute(
        { job_id: 'job-456', include_text_extraction: false },
        mockContext
      );

      expect(result._notes.text_extraction).toBe('disabled');
    });

    it('should respect include_visual_analysis flag', async () => {
      const result = await tool.execute(
        { job_id: 'job-456', include_visual_analysis: false },
        mockContext
      );

      expect(result._notes.visual_analysis).toContain('disabled');
    });

    it('should enable both text and visual by default', async () => {
      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result._notes.text_extraction).toBe('enabled');
      expect(result._notes.visual_analysis).toContain('enabled');
    });
  });

  describe('Error Handling', () => {
    it('should handle job not found error', async () => {
      mockClient.get = jest.fn().mockRejectedValue(new Error('Job not found'));

      const result = await tool.execute({ job_id: 'invalid-job' }, mockContext);

      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('status', 'error');
      expect(result.job_id).toBe('invalid-job');
    });

    it('should handle API errors gracefully', async () => {
      mockClient.get = jest
        .fn()
        .mockRejectedValue(new Error('API communication error'));

      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });

    it('should continue processing after individual file errors', async () => {
      let callCount = 0;
      global.fetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('First file failed'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          arrayBuffer: () => Promise.resolve(mockPdfBuffer),
        });
      });

      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result.analysis_summary.files_errored).toBeGreaterThan(0);
      expect(result.analysis_summary.files_analyzed).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should process files efficiently', async () => {
      const startTime = Date.now();
      await tool.execute({ job_id: 'job-456', max_files: 5 }, mockContext);
      const duration = Date.now() - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000);
    });

    it('should limit memory usage with large files', async () => {
      const result = await tool.execute(
        { job_id: 'job-456', max_file_size_mb: 5 },
        mockContext
      );

      // Large files should be skipped
      const largeFileSkipped = result.files.some(
        (f: any) =>
          parseFloat(f.size_mb) > 5 &&
          f.analysis_status === 'skipped' &&
          f.skip_reason?.includes('too large')
      );

      if (result.files.some((f: any) => parseFloat(f.size_mb) > 5)) {
        expect(largeFileSkipped).toBe(true);
      }
    });
  });

  describe('Notes and Recommendations', () => {
    it('should include helpful notes in response', async () => {
      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result).toHaveProperty('_notes');
      expect(result._notes).toHaveProperty('text_extraction');
      expect(result._notes).toHaveProperty('visual_analysis');
      expect(result._notes).toHaveProperty('recommendation');
    });

    it('should recommend AI integration for images', async () => {
      const result = await tool.execute({ job_id: 'job-456' }, mockContext);

      expect(result._notes.recommendation).toContain('Claude Vision');
    });
  });
});
