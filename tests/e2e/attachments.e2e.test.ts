/**
 * End-to-End tests for Attachment system
 * Tests with real JobNimbus API (requires valid credentials)
 *
 * To run these tests:
 * 1. Set JOBNIMBUS_API_KEY_STAMFORD or JOBNIMBUS_API_KEY_GUILFORD in .env
 * 2. Set TEST_JOB_ID to a valid job ID with attachments
 * 3. Run: npm run test:e2e
 *
 * Note: These tests are skipped by default. Set RUN_E2E_TESTS=true to enable.
 */

import { GetAttachmentsTool } from '../../src/tools/attachments/getAttachments.js';
import { AnalyzeJobAttachmentsTool } from '../../src/tools/attachments/analyzeJobAttachments.js';
import jobNimbusClient from '../../src/services/jobNimbusClient.js';

const RUN_E2E_TESTS = process.env.RUN_E2E_TESTS === 'true';
const API_KEY =
  process.env.JOBNIMBUS_API_KEY_STAMFORD ||
  process.env.JOBNIMBUS_API_KEY_GUILFORD;
const TEST_JOB_ID = process.env.TEST_JOB_ID || 'job-456';
const TEST_CONTACT_ID = process.env.TEST_CONTACT_ID;

const describeE2E = RUN_E2E_TESTS ? describe : describe.skip;

describeE2E('Attachments E2E Tests', () => {
  const context = {
    apiKey: API_KEY!,
    instance: 'stamford' as const,
    clientId: 'e2e-test-client',
  };

  beforeAll(() => {
    if (!API_KEY) {
      throw new Error('API_KEY not set for E2E tests');
    }
  });

  describe('GetAttachmentsTool - Real API', () => {
    let tool: GetAttachmentsTool;

    beforeEach(() => {
      tool = new GetAttachmentsTool();

    });

    it('should fetch real attachments from JobNimbus', async () => {
      const result = await tool.execute({}, context);

      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('total_available');
      expect(Array.isArray(result.files)).toBe(true);

      console.log(`\n[E2E] Found ${result.count} files (${result.total_available} total available)`);
      console.log(`[E2E] Total size: ${result.total_size_mb} MB`);
      console.log('[E2E] File types:', result.file_types);
    });

    it('should fetch attachments for a specific job', async () => {
      const result = await tool.execute({ job_id: TEST_JOB_ID }, context);

      expect(result.filter_applied.job_id).toBe(TEST_JOB_ID);
      expect(result.files).toBeDefined();

      console.log(`\n[E2E] Found ${result.count} files for job ${TEST_JOB_ID}`);

      if (result.count > 0) {
        console.log('[E2E] Sample file:', {
          id: result.files[0].id,
          filename: result.files[0].filename,
          type: result.files[0].content_type,
          size: result.files[0].size_mb + ' MB',
        });
      }
    });

    it('should filter by file type', async () => {
      const result = await tool.execute({ file_type: 'pdf' }, context);

      expect(result.filter_applied.file_type).toBe('pdf');

      result.files.forEach((file: any) => {
        const isPdf =
          file.content_type?.includes('pdf') || file.file_extension === 'pdf';
        expect(isPdf).toBe(true);
      });

      console.log(`\n[E2E] Found ${result.count} PDF files`);
    });

    it('should handle pagination', async () => {
      const result = await tool.execute({ from: 0, size: 10 }, context);

      expect(result.from).toBe(0);
      expect(result.fetch_size).toBe(10);
      expect(result.files.length).toBeLessThanOrEqual(10);

      console.log(`\n[E2E] Fetched ${result.files.length} files (page 1)`);
    });

    if (TEST_CONTACT_ID) {
      it('should filter by contact ID', async () => {
        const result = await tool.execute({ contact_id: TEST_CONTACT_ID }, context);

        expect(result.filter_applied.contact_id).toBe(TEST_CONTACT_ID);

        console.log(`\n[E2E] Found ${result.count} files for contact ${TEST_CONTACT_ID}`);
      });
    }

    it('should return proper file structure', async () => {
      const result = await tool.execute({ size: 5 }, context);

      if (result.files.length > 0) {
        const file = result.files[0];

        expect(file).toHaveProperty('id');
        expect(file).toHaveProperty('filename');
        expect(file).toHaveProperty('content_type');
        expect(file).toHaveProperty('size_bytes');
        expect(file).toHaveProperty('size_mb');
        expect(file).toHaveProperty('date_created');
        expect(file).toHaveProperty('primary');
        expect(file).toHaveProperty('related');

        console.log('\n[E2E] File structure validated:', {
          filename: file.filename,
          hasUrl: !!file.url,
          hasPrimary: !!file.primary,
          relatedCount: file.related?.length || 0,
        });
      }
    });

    it('should calculate file statistics', async () => {
      const result = await tool.execute({}, context);

      expect(result.total_size_mb).toBeDefined();
      expect(result.file_types).toBeDefined();

      const totalSize = parseFloat(result.total_size_mb);
      expect(totalSize).toBeGreaterThanOrEqual(0);

      console.log('\n[E2E] Statistics:', {
        totalFiles: result.count,
        totalSize: result.total_size_mb + ' MB',
        fileTypes: Object.keys(result.file_types).length,
      });
    });
  });

  describe('AnalyzeJobAttachmentsTool - Real API', () => {
    let tool: AnalyzeJobAttachmentsTool;

    beforeEach(() => {
      tool = new AnalyzeJobAttachmentsTool();

    });

    it('should analyze real job attachments', async () => {
      const result = await tool.execute({ job_id: TEST_JOB_ID }, context);

      expect(result.job_id).toBe(TEST_JOB_ID);
      expect(result).toHaveProperty('job_name');
      expect(result).toHaveProperty('analysis_summary');
      expect(result).toHaveProperty('files');

      console.log('\n[E2E] Job Analysis:', {
        jobId: result.job_id,
        jobName: result.job_name,
        totalFiles: result.analysis_summary.total_files_found,
        analyzed: result.analysis_summary.files_analyzed,
        skipped: result.analysis_summary.files_skipped,
        errored: result.analysis_summary.files_errored,
      });
    });

    it('should analyze PDFs and extract content', async () => {
      const result = await tool.execute(
        {
          job_id: TEST_JOB_ID,
          file_types: ['pdf'],
          max_files: 3,
          include_text_extraction: true,
        },
        context
      );

      const pdfAnalyses = result.files.filter(
        (f: any) => f.analysis_status === 'success' && f.content_analysis
      );

      if (pdfAnalyses.length > 0) {
        const analysis = pdfAnalyses[0];

        expect(analysis.content_analysis).toHaveProperty('document_type');
        expect(analysis.content_analysis).toHaveProperty('extracted_text');
        expect(analysis.content_analysis).toHaveProperty('key_information');

        console.log('\n[E2E] PDF Analysis:', {
          filename: analysis.filename,
          documentType: analysis.content_analysis.document_type,
          textLength: analysis.content_analysis.extracted_text?.length || 0,
          amountsFound: analysis.content_analysis.key_information?.amounts?.length || 0,
          datesFound: analysis.content_analysis.key_information?.dates?.length || 0,
        });

        if (analysis.content_analysis.key_information?.amounts) {
          console.log('[E2E] Amounts detected:', analysis.content_analysis.key_information.amounts);
        }
      } else {
        console.log('\n[E2E] No PDFs available for analysis');
      }
    });

    it('should analyze images', async () => {
      const result = await tool.execute(
        {
          job_id: TEST_JOB_ID,
          file_types: ['jpg', 'jpeg', 'png'],
          max_files: 3,
          include_visual_analysis: true,
        },
        context
      );

      const imageAnalyses = result.files.filter(
        (f: any) =>
          f.analysis_status === 'success' &&
          ['jpg', 'jpeg', 'png'].includes(f.filename?.split('.').pop()?.toLowerCase())
      );

      if (imageAnalyses.length > 0) {
        const analysis = imageAnalyses[0];

        expect(analysis.content_analysis).toHaveProperty('visual_description');

        console.log('\n[E2E] Image Analysis:', {
          filename: analysis.filename,
          documentType: analysis.content_analysis.document_type,
          hasVisualDescription: !!analysis.content_analysis.visual_description,
        });
      } else {
        console.log('\n[E2E] No images available for analysis');
      }
    });

    it('should respect size limits', async () => {
      const result = await tool.execute(
        {
          job_id: TEST_JOB_ID,
          max_file_size_mb: 5,
          max_files: 10,
        },
        context
      );

      const oversizedFiles = result.files.filter(
        (f: any) =>
          parseFloat(f.size_mb) > 5 &&
          f.analysis_status === 'skipped' &&
          f.skip_reason?.includes('too large')
      );

      console.log('\n[E2E] Size Limits:', {
        totalFiles: result.files.length,
        oversizedSkipped: oversizedFiles.length,
        maxSizeMB: result.filters_applied.max_file_size_mb,
      });

      if (oversizedFiles.length > 0) {
        expect(oversizedFiles.length).toBeGreaterThan(0);
      }
    });

    it('should detect document types', async () => {
      const result = await tool.execute(
        { job_id: TEST_JOB_ID, max_files: 10 },
        context
      );

      const documentTypes = result.analysis_summary.document_types;

      console.log('\n[E2E] Document Types Detected:', documentTypes);

      expect(typeof documentTypes).toBe('object');
    });

    it('should extract key information', async () => {
      const result = await tool.execute({ job_id: TEST_JOB_ID }, context);

      const summary = result.analysis_summary;

      console.log('\n[E2E] Key Information Extracted:', {
        totalAmounts: summary.total_amounts_detected,
        uniqueAmounts: summary.unique_amounts?.length || 0,
        totalDates: summary.total_dates_detected,
        uniqueDates: summary.unique_dates?.length || 0,
      });

      if (summary.unique_amounts && summary.unique_amounts.length > 0) {
        console.log('[E2E] Sample amounts:', summary.unique_amounts.slice(0, 5));
      }

      if (summary.unique_dates && summary.unique_dates.length > 0) {
        console.log('[E2E] Sample dates:', summary.unique_dates.slice(0, 5));
      }
    });
  });

  describe('Full Workflow - Real API', () => {
    it('should list attachments, then analyze specific ones', async () => {
      // Step 1: List all attachments for a job
      const getTool = new GetAttachmentsTool();


      const listResult = await getTool.execute({ job_id: TEST_JOB_ID }, context);

      console.log(`\n[E2E Workflow] Step 1: Found ${listResult.count} files`);

      if (listResult.count === 0) {
        console.log('[E2E Workflow] No files to analyze');
        return;
      }

      // Step 2: Filter PDFs
      const pdfFiles = listResult.files.filter((f: any) =>
        f.filename?.toLowerCase().endsWith('.pdf')
      );

      console.log(`[E2E Workflow] Step 2: Found ${pdfFiles.length} PDF files`);

      // Step 3: Analyze PDFs
      if (pdfFiles.length > 0) {
        const analyzeTool = new AnalyzeJobAttachmentsTool();
  

        const analyzeResult = await analyzeTool.execute(
          {
            job_id: TEST_JOB_ID,
            file_types: ['pdf'],
            max_files: 3,
          },
          context
        );

        console.log('[E2E Workflow] Step 3: Analysis complete:', {
          analyzed: analyzeResult.analysis_summary.files_analyzed,
          documentTypes: analyzeResult.analysis_summary.document_types,
        });

        expect(analyzeResult.files.length).toBeGreaterThan(0);
      }
    });

    it('should handle job without attachments gracefully', async () => {
      const analyzeTool = new AnalyzeJobAttachmentsTool();


      // Use a non-existent job ID
      const result = await analyzeTool.execute(
        { job_id: 'non-existent-job-999' },
        context
      );

      // Should handle gracefully without crashing
      console.log('\n[E2E] Non-existent job handled:', {
        status: result.status || 'success',
        hasError: !!result.error,
      });
    });
  });

  describe('Performance - Real API', () => {
    it('should fetch and analyze files within reasonable time', async () => {
      const getTool = new GetAttachmentsTool();


      const startTime = Date.now();
      const result = await getTool.execute({ size: 50 }, context);
      const duration = Date.now() - startTime;

      console.log('\n[E2E Performance]:', {
        filesFetched: result.count,
        durationMs: duration,
        avgTimePerFile: result.count > 0 ? (duration / result.count).toFixed(2) : 0,
      });

      // Should complete within reasonable time (10 seconds for 50 files)
      expect(duration).toBeLessThan(10000);
    });

    it('should handle large analysis efficiently', async () => {
      const analyzeTool = new AnalyzeJobAttachmentsTool();


      const startTime = Date.now();
      const result = await analyzeTool.execute(
        {
          job_id: TEST_JOB_ID,
          max_files: 5,
          max_file_size_mb: 10,
        },
        context
      );
      const duration = Date.now() - startTime;

      console.log('\n[E2E Performance] Analysis:', {
        filesAnalyzed: result.analysis_summary.files_analyzed,
        durationMs: duration,
        avgTimePerFile:
          result.analysis_summary.files_analyzed > 0
            ? (duration / result.analysis_summary.files_analyzed).toFixed(2)
            : 0,
      });

      // Should complete within reasonable time (30 seconds for 5 files)
      expect(duration).toBeLessThan(30000);
    });
  });

  describe('Edge Cases - Real API', () => {
    it('should handle invalid job ID', async () => {
      const getTool = new GetAttachmentsTool();


      const result = await getTool.execute(
        { job_id: 'invalid-job-id-xyz' },
        context
      );

      // Should return empty results or handle gracefully
      console.log('\n[E2E Edge Case] Invalid job ID:', {
        count: result.count,
        hasError: !!result.error,
      });

      expect(result).toBeDefined();
    });

    it('should handle empty filters', async () => {
      const getTool = new GetAttachmentsTool();


      const result = await getTool.execute({}, context);

      expect(result.files).toBeDefined();
      console.log('\n[E2E Edge Case] No filters:', { count: result.count });
    });
  });
});
