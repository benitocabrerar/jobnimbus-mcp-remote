/**
 * Unit Tests for GetAttachmentsTool
 * FASE 0: Testing Infrastructure
 */

import { GetAttachmentsTool } from '../../../../src/tools/attachments/getAttachments';
import { MOCK_FILES, MOCK_FILE_PDF } from '../../../fixtures/files.fixtures';

// Mock the jobNimbusClient module
const mockGet = jest.fn();
jest.mock('../../../../src/services/jobNimbusClient', () => ({
  default: {
    get: mockGet,
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('GetAttachmentsTool - Unit Tests', () => {
  let tool: GetAttachmentsTool;

  beforeEach(() => {
    tool = new GetAttachmentsTool();
    jest.clearAllMocks();
  });

  describe('definition', () => {
    it('should have correct tool name', () => {
      expect(tool.definition.name).toBe('get_attachments');
    });

    it('should have description', () => {
      expect(tool.definition.description).toContain('attachments');
    });

    it('should define input schema', () => {
      expect(tool.definition.inputSchema).toBeDefined();
      expect(tool.definition.inputSchema.properties).toBeDefined();
    });
  });

  describe('execute', () => {
    const mockContext = {
      apiKey: 'test-key',
      instance: 'stamford' as const,
      clientId: 'test-client',
    };

    it('should fetch files successfully', async () => {
      mockGet.mockResolvedValueOnce({
        success: true,
        data: { files: MOCK_FILES, count: 2 },
      });

      const result = await tool.execute({}, mockContext);

      expect(mockGet).toHaveBeenCalledWith(
        'test-key',
        'files',
        expect.any(Object)
      );
      expect(result.count).toBeGreaterThanOrEqual(0);
      expect(result.files).toBeDefined();
    });

    it('should filter by job_id', async () => {
      mockGet.mockResolvedValueOnce({
        success: true,
        data: { files: MOCK_FILES, count: 2 },
      });

      const result = await tool.execute(
        { job_id: 'job-test-001' },
        mockContext
      );

      expect(result.filter_applied.job_id).toBe('job-test-001');
    });

    it('should handle errors gracefully', async () => {
      mockGet.mockRejectedValueOnce(new Error('API Error'));

      const result = await tool.execute({}, mockContext);

      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });
  });
});
