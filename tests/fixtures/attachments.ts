/**
 * Test fixtures for attachments
 */

export const mockJobNimbusFile = {
  jnid: 'file-123',
  filename: 'estimate.pdf',
  content_type: 'application/pdf',
  size: 1048576, // 1 MB
  date_created: 1704067200000, // 2024-01-01
  date_file_created: 1704067200000,
  is_active: true,
  is_archived: false,
  url: 'https://files.jobnimbus.com/file-123.pdf',
  type: 'file',
  primary: {
    id: 'job-456',
    name: 'Smith Residence',
    number: 'JOB-001',
    type: 'job',
  },
  related: [
    {
      id: 'job-456',
      name: 'Smith Residence',
      type: 'job',
    },
    {
      id: 'contact-789',
      name: 'John Smith',
      type: 'contact',
    },
  ],
};

export const mockImageFile = {
  jnid: 'file-456',
  filename: 'damage-photo.jpg',
  content_type: 'image/jpeg',
  size: 2097152, // 2 MB
  date_created: 1704153600000, // 2024-01-02
  date_file_created: 1704153600000,
  is_active: true,
  is_archived: false,
  url: 'https://files.jobnimbus.com/file-456.jpg',
  type: 'file',
  primary: {
    id: 'job-456',
    name: 'Smith Residence',
    number: 'JOB-001',
    type: 'job',
  },
  related: [
    {
      id: 'job-456',
      name: 'Smith Residence',
      type: 'job',
    },
  ],
};

export const mockLargeFile = {
  jnid: 'file-789',
  filename: 'large-document.pdf',
  content_type: 'application/pdf',
  size: 15728640, // 15 MB
  date_created: 1704240000000, // 2024-01-03
  date_file_created: 1704240000000,
  is_active: true,
  is_archived: false,
  url: 'https://files.jobnimbus.com/file-789.pdf',
  type: 'file',
  primary: {
    id: 'job-456',
    name: 'Smith Residence',
    number: 'JOB-001',
    type: 'job',
  },
  related: [
    {
      id: 'job-456',
      name: 'Smith Residence',
      type: 'job',
    },
  ],
};

export const mockArchivedFile = {
  jnid: 'file-000',
  filename: 'old-estimate.pdf',
  content_type: 'application/pdf',
  size: 524288, // 0.5 MB
  date_created: 1672531200000, // 2023-01-01
  date_file_created: 1672531200000,
  is_active: false,
  is_archived: true,
  url: 'https://files.jobnimbus.com/file-000.pdf',
  type: 'file',
  primary: {
    id: 'job-456',
    name: 'Smith Residence',
    number: 'JOB-001',
    type: 'job',
  },
  related: [
    {
      id: 'job-456',
      name: 'Smith Residence',
      type: 'job',
    },
  ],
};

export const mockFilesResponse = {
  files: [mockJobNimbusFile, mockImageFile, mockLargeFile, mockArchivedFile],
  count: 4,
};

export const mockJob = {
  jnid: 'job-456',
  display_name: 'Smith Residence',
  name: 'Smith Residence',
  number: 'JOB-001',
  status: {
    name: 'In Progress',
  },
  date_created: 1704067200000,
  primary: {
    id: 'contact-789',
    name: 'John Smith',
  },
};

export const mockPdfBuffer = Buffer.from(
  '%PDF-1.4\nEstimate for Roofing\nTotal: $15,000.00\nDate: 01/15/2024\nAcme Roofing LLC\nLine items:\n- Shingles: $8,000\n- Labor: $5,000\n- Materials: $2,000'
);

export const mockImageBuffer = Buffer.from(
  'fake-image-data-for-testing-purposes'
);

export const mockEmptyFilesResponse = {
  files: [],
  count: 0,
};

export const mockFilteredFilesResponse = {
  files: [mockJobNimbusFile],
  count: 1,
};

// Mock PDF file with various content patterns
export const mockInvoicePdf = {
  jnid: 'file-invoice',
  filename: 'invoice-2024.pdf',
  content_type: 'application/pdf',
  size: 524288,
  date_created: 1704326400000,
  date_file_created: 1704326400000,
  is_active: true,
  is_archived: false,
  url: 'https://files.jobnimbus.com/file-invoice.pdf',
  type: 'file',
  primary: {
    id: 'job-456',
    name: 'Smith Residence',
    type: 'job',
  },
  related: [{ id: 'job-456', name: 'Smith Residence', type: 'job' }],
};

export const mockContractPdf = {
  jnid: 'file-contract',
  filename: 'service-agreement.pdf',
  content_type: 'application/pdf',
  size: 786432,
  date_created: 1704412800000,
  date_file_created: 1704412800000,
  is_active: true,
  is_archived: false,
  url: 'https://files.jobnimbus.com/file-contract.pdf',
  type: 'file',
  primary: {
    id: 'job-456',
    name: 'Smith Residence',
    type: 'job',
  },
  related: [{ id: 'job-456', name: 'Smith Residence', type: 'job' }],
};

// Context for testing
export const mockContext = {
  apiKey: 'test-api-key-123',
  instance: 'stamford' as const,
  clientId: 'test-client',
};

// Error scenarios
export const mockApiError = {
  message: 'JobNimbus API error: Unauthorized',
  statusCode: 401,
};

export const mockNetworkError = {
  message: 'Network request failed',
  code: 'ECONNREFUSED',
};
