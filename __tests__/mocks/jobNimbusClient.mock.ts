/**
 * Mock JobNimbus Client
 * FASE 0: Testing Infrastructure
 */

export const mockJobNimbusClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  validateApiKey: jest.fn(),
};

export const createMockClient = () => ({
  get: jest.fn().mockResolvedValue({
    success: true,
    data: { files: [], count: 0 },
  }),
  post: jest.fn().mockResolvedValue({
    success: true,
    data: {},
  }),
  put: jest.fn().mockResolvedValue({
    success: true,
    data: {},
  }),
  delete: jest.fn().mockResolvedValue({
    success: true,
    data: {},
  }),
  validateApiKey: jest.fn().mockResolvedValue(true),
});
