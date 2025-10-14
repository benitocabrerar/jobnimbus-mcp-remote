/**
 * Test Fixtures for Files
 * FASE 0: Testing Infrastructure
 */

export const MOCK_FILE_PDF = {
  jnid: 'file-test-001',
  filename: 'estimate.pdf',
  content_type: 'application/pdf',
  size: 524288,
  date_created: Date.now() - 86400000,
  date_file_created: Date.now() - 86400000,
  primary: {
    id: 'job-test-001',
    name: 'Test Job',
    type: 'job' as const,
  },
  related: [
    { id: 'job-test-001', name: 'Test Job', type: 'job' as const },
  ],
  type: 'file' as const,
  url: 'https://cdn.test/estimate.pdf',
  is_active: true,
  is_archived: false,
};

export const MOCK_FILE_IMAGE = {
  jnid: 'file-test-002',
  filename: 'damage-photo.jpg',
  content_type: 'image/jpeg',
  size: 2097152,
  date_created: Date.now() - 43200000,
  date_file_created: Date.now() - 43200000,
  primary: {
    id: 'job-test-001',
    name: 'Test Job',
    type: 'job' as const,
  },
  related: [
    { id: 'job-test-001', name: 'Test Job', type: 'job' as const },
  ],
  type: 'file' as const,
  url: 'https://cdn.test/damage.jpg',
  is_active: true,
  is_archived: false,
};

export const MOCK_FILES = [MOCK_FILE_PDF, MOCK_FILE_IMAGE];
