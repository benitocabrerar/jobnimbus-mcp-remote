/**
 * Get Job Attachments Distribution Tool
 *
 * MULTI-SOURCE DOCUMENT RETRIEVAL - Matches JobNimbus UI behavior
 * Queries THREE sources in parallel:
 * 1. /api1/files - Direct file attachments
 * 2. /api1/documents - Documents
 * 3. /api1/orders - Orders (optional)
 *
 * Comprehensive file distribution analysis for a job including:
 * - Photos, Documents, Invoices, Permit Related, Estimates, Measurements
 * - Pagination, deduplication, and discrepancy detection
 * - Related entity lookup (estimate, invoice, contact)
 *
 * Provides detailed breakdown matching JobNimbus UI behavior
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import logger from '../../utils/logger.js';

interface GetJobAttachmentsDistributionInput {
  job_id: string;
  page_size?: number;
  max_pages?: number;
  min_file_size_kb?: number;
  enable_related_lookup?: boolean;
  estimate_id?: string;
  invoice_id?: string;
  contact_id?: string;
}

interface NormalizedFile {
  id: string;
  filename: string;
  filename_normalized: string;
  mime: string;
  size_bytes: number;
  size_mb: number;
  created_ts: number | null;
  related_ids: {
    jobs: string[];
    estimates: string[];
    invoices: string[];
    contacts: string[];
  };
  record_type_name?: string;
}

interface CategoryStats {
  count: number;
  total_mb: number;
  examples: Array<{ filename: string; mime: string; size_mb: number }>;
}

enum FileCategory {
  PHOTOS = 'photos',
  DOCUMENTS = 'documents',
  EMAIL_ATTACHMENTS = 'email_attachments',
  WORK_ORDERS = 'work_orders',
  ESTIMATES = 'estimates',
  INVOICES = 'invoices',
  PERMIT_RELATED = 'permit_related',
  FINANCING = 'financing',
  RECEIPTS = 'receipts',
  EAGLEVIEW = 'eagleview',
  CREDIT_MEMOS = 'credit_memos',
  INSURANCE_SCOPES = 'insurance_scopes',
  MATERIAL_RECEIPTS = 'material_receipts',
  MEASUREMENTS = 'measurements',
  PAYMENTS = 'payments',
  AGREEMENTS = 'agreements',
  MATERIAL_ORDERS = 'material_orders',
  SUBCONTRACTOR_DOCS = 'subcontractor_docs',
  CHANGE_ORDERS = 'change_orders',
  OTHER = 'other',
}

export class GetJobAttachmentsDistributionTool extends BaseTool<GetJobAttachmentsDistributionInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_job_attachments_distribution',
      description: 'Attachments: distribution analysis, 20+ categories, multi-source, statistics',
      inputSchema: {
        type: 'object',
        properties: {
          job_id: {
            type: 'string',
            description: 'Job number as shown in JobNimbus UI (e.g., "1820"). Users only need to provide the job number they see - internal JNID lookup is automatic.',
          },
          page_size: {
            type: 'number',
            description: 'Files per page for pagination (default: 200, max: 500)',
          },
          max_pages: {
            type: 'number',
            description: 'Maximum pages to fetch (default: 10, prevents runaway queries)',
          },
          min_file_size_kb: {
            type: 'number',
            description: 'Minimum file size in KB to include (default: 0, no filtering)',
          },
          enable_related_lookup: {
            type: 'boolean',
            description: 'Lookup files from related estimate, invoice, contact (default: true)',
          },
          estimate_id: {
            type: 'string',
            description: 'Optional: estimate JNID if already known',
          },
          invoice_id: {
            type: 'string',
            description: 'Optional: invoice JNID if already known',
          },
          contact_id: {
            type: 'string',
            description: 'Optional: contact JNID if already known',
          },
        },
        required: ['job_id'],
      },
    };
  }

  /**
   * Normalize filename for pattern matching
   */
  private normalizeFilename(filename: string): string {
    return filename
      .toLowerCase()
      .replace(/[_\-\.]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Infer MIME type from extension if not provided
   */
  private inferMimeType(filename: string, mime?: string): string {
    if (mime) return mime.toLowerCase();

    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      heic: 'image/heic',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain',
      csv: 'text/csv',
      xml: 'application/xml',
      json: 'application/json',
      esx: 'application/octet-stream',
      dxf: 'application/dxf',
    };

    return mimeMap[ext || ''] || 'application/octet-stream';
  }

  /**
   * Classify file using JobNimbus record_type_name field
   * Maps JobNimbus categories to our FileCategory enum
   *
   * Complete list of JobNimbus record_type_name values:
   * - Photo, Document, Email Attachment, Work Order, Estimate, Invoice
   * - Permit Related, Financing Information, All Other Receipts, EagleView
   * - Credit Memo, Insurances Scopes, Material Receipts, G.A Castro Insurances Scope
   * - Measurements, Payments Received Copy, Agreements, Material Order
   * - Subcontractor Estimates & Invoices, Roof Materials Receipts
   * - Change order Doc & Approval, Siding Materials
   */
  private classifyFile(file: NormalizedFile): FileCategory {
    const recordTypeName = file.record_type_name || 'Unknown';

    // Map JobNimbus record_type_name to FileCategory
    switch (recordTypeName) {
      // Core categories
      case 'Photo':
        return FileCategory.PHOTOS;
      case 'Document':
        return FileCategory.DOCUMENTS;
      case 'Email Attachment':
        return FileCategory.EMAIL_ATTACHMENTS;
      case 'Work Order':
        return FileCategory.WORK_ORDERS;
      case 'Estimate':
        return FileCategory.ESTIMATES;
      case 'Invoice':
        return FileCategory.INVOICES;
      case 'Permit Related':
        return FileCategory.PERMIT_RELATED;

      // Financial categories
      case 'Financing Information':
        return FileCategory.FINANCING;
      case 'Credit Memo':
        return FileCategory.CREDIT_MEMOS;
      case 'Payments Received Copy':
        return FileCategory.PAYMENTS;

      // Receipts categories
      case 'All Other Receipts':
        return FileCategory.RECEIPTS;
      case 'Material Receipts':
      case 'Roof Materials Receipts':
        return FileCategory.MATERIAL_RECEIPTS;

      // Measurements & Inspections
      case 'Measurements':
        return FileCategory.MEASUREMENTS;
      case 'EagleView':
        return FileCategory.EAGLEVIEW;

      // Insurance categories
      case 'Insurances Scopes':
      case 'G.A Castro Insurances Scope':
        return FileCategory.INSURANCE_SCOPES;

      // Orders & Agreements
      case 'Agreements':
        return FileCategory.AGREEMENTS;
      case 'Material Order':
      case 'Siding Materials':
        return FileCategory.MATERIAL_ORDERS;

      // Subcontractor & Changes
      case 'Subcontractor Estimates & Invoices':
        return FileCategory.SUBCONTRACTOR_DOCS;
      case 'Change order Doc & Approval':
        return FileCategory.CHANGE_ORDERS;

      default:
        // Unknown types go to OTHER category
        return FileCategory.OTHER;
    }
  }

  /**
   * Fetch files from single endpoint with pagination and deduplication
   */
  private async fetchFiles(
    apiKey: string,
    filterParams: Record<string, any>,
    pageSize: number,
    maxPages: number,
    seenIds: Set<string>
  ): Promise<any[]> {
    const allFiles: any[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore && page < maxPages) {
      try {
        const params = {
          ...filterParams,
          size: pageSize,
          from: page * pageSize,
        };

        const response = await this.client.get(apiKey, 'files', params);
        const files = response.data?.files || response.data || [];

        if (!Array.isArray(files) || files.length === 0) {
          break;
        }

        // Add new files (deduplicate)
        for (const file of files) {
          const fileId = file.jnid || file.id || `${file.filename}_${file.size}_${file.date_created}`;
          if (!seenIds.has(fileId)) {
            seenIds.add(fileId);
            allFiles.push(file);
          }
        }

        // Check if there are more pages
        const totalFromAPI = response.data?.count || files.length;
        hasMore = (page + 1) * pageSize < totalFromAPI;
        page++;
      } catch (error) {
        logger.error('Error fetching files page', { page, error });
        break;
      }
    }

    return allFiles;
  }

  /**
   * Fetch files from multiple sources (files, documents, orders) in parallel
   * This matches the JobNimbus UI behavior which combines all three sources
   */
  private async fetchFromMultipleSources(
    apiKey: string,
    entityId: string,
    pageSize: number,
    maxPages: number,
    seenIds: Set<string>
  ): Promise<{ files: any[]; sourceCounts: { files: number; documents: number; orders: number } }> {
    // Build Elasticsearch filter for the entity
    const buildFilter = (fieldPath: string) => {
      return JSON.stringify({
        must: [
          {
            term: {
              [fieldPath]: entityId
            }
          }
        ],
      });
    };

    const filesFilter = buildFilter('related.id');
    const documentsFilter = buildFilter('related.id');
    const ordersFilter = buildFilter('related.id');

    // Execute 3 parallel queries to all sources
    const [filesResponse, documentsResponse, ordersResponse] = await Promise.all([
      this.client.get(apiKey, 'files', {
        filter: filesFilter,
        size: pageSize
      }).catch(err => {
        logger.error('Error fetching from /files endpoint', { error: err });
        return { data: { files: [] }, error: err };
      }),
      this.client.get(apiKey, 'documents', {
        filter: documentsFilter,
        size: pageSize
      }).catch(err => {
        logger.error('Error fetching from /documents endpoint', { error: err });
        return { data: { documents: [] }, error: err };
      }),
      this.client.get(apiKey, 'orders', {
        filter: ordersFilter,
        size: pageSize
      }).catch(err => {
        logger.error('Error fetching from /orders endpoint', { error: err });
        return { data: { orders: [] }, error: err };
      }),
    ]);

    // Extract arrays from each response
    const filesArray = filesResponse.data?.files || filesResponse.data || [];
    const documentsArray = documentsResponse.data?.documents || documentsResponse.data || [];
    const ordersArray = ordersResponse.data?.orders || ordersResponse.data || [];

    // Track source counts for metadata
    const sourceCounts = {
      files: Array.isArray(filesArray) ? filesArray.length : 0,
      documents: Array.isArray(documentsArray) ? documentsArray.length : 0,
      orders: Array.isArray(ordersArray) ? ordersArray.length : 0,
    };

    // Combine all sources
    const combinedFiles: any[] = [
      ...(Array.isArray(filesArray) ? filesArray : []),
      ...(Array.isArray(documentsArray) ? documentsArray : []),
      ...(Array.isArray(ordersArray) ? ordersArray : []),
    ];

    // Deduplicate by jnid (primary) or fallback to composite key
    const deduplicatedFiles: any[] = [];

    for (const file of combinedFiles) {
      const fileId = file.jnid || file.id || `${file.filename}_${file.size}_${file.date_created}`;

      if (!seenIds.has(fileId)) {
        seenIds.add(fileId);
        deduplicatedFiles.push(file);
      }
    }

    // Sort by date_created descending (newest first)
    deduplicatedFiles.sort((a, b) => {
      const dateA = a.date_created || 0;
      const dateB = b.date_created || 0;
      return dateB - dateA;
    });

    return {
      files: deduplicatedFiles,
      sourceCounts,
    };
  }

  async execute(input: GetJobAttachmentsDistributionInput, context: ToolContext): Promise<any> {
    const pageSize = Math.min(input.page_size || 200, 500);
    const maxPages = input.max_pages || 10;
    const minFileSizeKb = input.min_file_size_kb !== undefined ? input.min_file_size_kb : 0;
    const enableRelatedLookup = input.enable_related_lookup !== undefined ? input.enable_related_lookup : true;

    const notes: string[] = [];
    const seenIds = new Set<string>();
    let rawFiles: any[] = [];

    try {
      // Step 1: Resolve job metadata
      notes.push(`Tool accepts job NUMBER (e.g., "1820") and automatically resolves internal IDs`);
      notes.push(`Resolving metadata for job_id=${input.job_id}`);
      const jobResponse = await this.client.get(context.apiKey, `jobs/${input.job_id}`);
      const job = jobResponse.data;

      if (!job) {
        return {
          error: `Job not found: ${input.job_id}`,
          job_id: input.job_id,
        };
      }

      const jobJnid = job.jnid;
      const reportedAttachmentCount = job.attachment_count || null;
      const estimateId = input.estimate_id || job.last_estimate_jnid;
      const invoiceId = input.invoice_id || job.last_invoice_jnid;
      const contactId = input.contact_id || job.customer;

      notes.push(`Job JNID: ${jobJnid}`);
      if (reportedAttachmentCount !== null) {
        notes.push(`Reported attachment_count from job: ${reportedAttachmentCount}`);
      }

      // Step 2A: Fetch files from multiple sources (files, documents, orders)
      notes.push(`MULTI-SOURCE RETRIEVAL: Querying /files, /documents, and /orders for job=${jobJnid}`);
      notes.push(`Fetching with page_size=${pageSize}, max_pages=${maxPages}`);

      const jobFilesResult = await this.fetchFromMultipleSources(
        context.apiKey,
        jobJnid,
        pageSize,
        maxPages,
        seenIds
      );

      rawFiles.push(...jobFilesResult.files);
      notes.push(`Source breakdown for job:`);
      notes.push(`  - /files endpoint: ${jobFilesResult.sourceCounts.files} documents`);
      notes.push(`  - /documents endpoint: ${jobFilesResult.sourceCounts.documents} documents`);
      notes.push(`  - /orders endpoint: ${jobFilesResult.sourceCounts.orders} documents`);
      notes.push(`  - Total before deduplication: ${jobFilesResult.sourceCounts.files + jobFilesResult.sourceCounts.documents + jobFilesResult.sourceCounts.orders}`);
      notes.push(`  - Total after deduplication: ${jobFilesResult.files.length}`);

      // Step 2B: Fetch files from related entities using multi-source retrieval
      if (enableRelatedLookup) {
        notes.push('enable_related_lookup=true, fetching from related entities');

        if (estimateId) {
          notes.push(`MULTI-SOURCE retrieval for estimate_id=${estimateId}`);
          const estimateFilesResult = await this.fetchFromMultipleSources(
            context.apiKey,
            estimateId,
            pageSize,
            Math.ceil(maxPages / 3),
            seenIds
          );
          rawFiles.push(...estimateFilesResult.files);
          notes.push(`  Estimate sources: files=${estimateFilesResult.sourceCounts.files}, docs=${estimateFilesResult.sourceCounts.documents}, orders=${estimateFilesResult.sourceCounts.orders}, total=${estimateFilesResult.files.length}`);
        }

        if (invoiceId) {
          notes.push(`MULTI-SOURCE retrieval for invoice_id=${invoiceId}`);
          const invoiceFilesResult = await this.fetchFromMultipleSources(
            context.apiKey,
            invoiceId,
            pageSize,
            Math.ceil(maxPages / 3),
            seenIds
          );
          rawFiles.push(...invoiceFilesResult.files);
          notes.push(`  Invoice sources: files=${invoiceFilesResult.sourceCounts.files}, docs=${invoiceFilesResult.sourceCounts.documents}, orders=${invoiceFilesResult.sourceCounts.orders}, total=${invoiceFilesResult.files.length}`);
        }

        if (contactId) {
          notes.push(`MULTI-SOURCE retrieval for contact_id=${contactId}`);
          const contactFilesResult = await this.fetchFromMultipleSources(
            context.apiKey,
            contactId,
            pageSize,
            Math.ceil(maxPages / 3),
            seenIds
          );
          rawFiles.push(...contactFilesResult.files);
          notes.push(`  Contact sources: files=${contactFilesResult.sourceCounts.files}, docs=${contactFilesResult.sourceCounts.documents}, orders=${contactFilesResult.sourceCounts.orders}, total=${contactFilesResult.files.length}`);
        }
      }

      // Step 3: Normalize and filter
      notes.push(`Normalizing ${rawFiles.length} files (min_file_size_kb=${minFileSizeKb})`);
      const normalizedFiles: NormalizedFile[] = [];
      let excludedBySize = 0;

      for (const file of rawFiles) {
        const sizeBytes = file.size || 0;
        const sizeKb = sizeBytes / 1024;

        if (sizeKb < minFileSizeKb) {
          excludedBySize++;
          continue;
        }

        const filename = file.filename || 'unknown';
        const mime = this.inferMimeType(filename, file.content_type);

        // Extract related IDs
        const relatedIds = {
          jobs: [] as string[],
          estimates: [] as string[],
          invoices: [] as string[],
          contacts: [] as string[],
        };

        if (file.primary?.id) {
          if (file.primary.type === 'job') relatedIds.jobs.push(file.primary.id);
          if (file.primary.type === 'estimate') relatedIds.estimates.push(file.primary.id);
          if (file.primary.type === 'invoice') relatedIds.invoices.push(file.primary.id);
          if (file.primary.type === 'contact') relatedIds.contacts.push(file.primary.id);
        }

        if (Array.isArray(file.related)) {
          for (const rel of file.related) {
            if (rel.type === 'job' && !relatedIds.jobs.includes(rel.id)) relatedIds.jobs.push(rel.id);
            if (rel.type === 'estimate' && !relatedIds.estimates.includes(rel.id)) relatedIds.estimates.push(rel.id);
            if (rel.type === 'invoice' && !relatedIds.invoices.includes(rel.id)) relatedIds.invoices.push(rel.id);
            if (rel.type === 'contact' && !relatedIds.contacts.includes(rel.id)) relatedIds.contacts.push(rel.id);
          }
        }

        normalizedFiles.push({
          id: file.jnid || file.id || `${filename}_${sizeBytes}_${file.date_created}`,
          filename,
          filename_normalized: this.normalizeFilename(filename),
          mime,
          size_bytes: sizeBytes,
          size_mb: Math.round((sizeBytes / (1024 * 1024)) * 100) / 100,
          created_ts: file.date_created || null,
          related_ids: relatedIds,
          record_type_name: file.record_type_name,
        });
      }

      if (excludedBySize > 0) {
        notes.push(`Excluded ${excludedBySize} files below ${minFileSizeKb}KB (likely thumbnails)`);
      }

      // Step 4: Classify files using JobNimbus record_type_name
      notes.push('Classifying files using record_type_name from JobNimbus API');
      const distribution: Record<FileCategory, CategoryStats> = {
        [FileCategory.PHOTOS]: { count: 0, total_mb: 0, examples: [] },
        [FileCategory.DOCUMENTS]: { count: 0, total_mb: 0, examples: [] },
        [FileCategory.EMAIL_ATTACHMENTS]: { count: 0, total_mb: 0, examples: [] },
        [FileCategory.WORK_ORDERS]: { count: 0, total_mb: 0, examples: [] },
        [FileCategory.ESTIMATES]: { count: 0, total_mb: 0, examples: [] },
        [FileCategory.INVOICES]: { count: 0, total_mb: 0, examples: [] },
        [FileCategory.PERMIT_RELATED]: { count: 0, total_mb: 0, examples: [] },
        [FileCategory.FINANCING]: { count: 0, total_mb: 0, examples: [] },
        [FileCategory.RECEIPTS]: { count: 0, total_mb: 0, examples: [] },
        [FileCategory.EAGLEVIEW]: { count: 0, total_mb: 0, examples: [] },
        [FileCategory.CREDIT_MEMOS]: { count: 0, total_mb: 0, examples: [] },
        [FileCategory.INSURANCE_SCOPES]: { count: 0, total_mb: 0, examples: [] },
        [FileCategory.MATERIAL_RECEIPTS]: { count: 0, total_mb: 0, examples: [] },
        [FileCategory.MEASUREMENTS]: { count: 0, total_mb: 0, examples: [] },
        [FileCategory.PAYMENTS]: { count: 0, total_mb: 0, examples: [] },
        [FileCategory.AGREEMENTS]: { count: 0, total_mb: 0, examples: [] },
        [FileCategory.MATERIAL_ORDERS]: { count: 0, total_mb: 0, examples: [] },
        [FileCategory.SUBCONTRACTOR_DOCS]: { count: 0, total_mb: 0, examples: [] },
        [FileCategory.CHANGE_ORDERS]: { count: 0, total_mb: 0, examples: [] },
        [FileCategory.OTHER]: { count: 0, total_mb: 0, examples: [] },
      };

      let firstSeenTs: number | null = null;
      let lastSeenTs: number | null = null;

      for (const file of normalizedFiles) {
        const category = this.classifyFile(file);
        const stats = distribution[category];

        stats.count++;
        stats.total_mb = Math.round((stats.total_mb + file.size_mb) * 100) / 100;

        if (stats.examples.length < 3) {
          stats.examples.push({
            filename: file.filename,
            mime: file.mime,
            size_mb: file.size_mb,
          });
        }

        // Track time range
        if (file.created_ts) {
          if (firstSeenTs === null || file.created_ts < firstSeenTs) {
            firstSeenTs = file.created_ts;
          }
          if (lastSeenTs === null || file.created_ts > lastSeenTs) {
            lastSeenTs = file.created_ts;
          }
        }
      }

      // Step 6: Calculate discrepancy
      const actualAttachmentCount = normalizedFiles.length;
      let discrepancyWarning: string | null = null;

      if (reportedAttachmentCount !== null) {
        if (reportedAttachmentCount !== actualAttachmentCount) {
          discrepancyWarning = `Attachment count del job reporta ${reportedAttachmentCount}, archivos reales asociados suman ${actualAttachmentCount}; posible conteo global o de sistema.`;
        }
      } else {
        discrepancyWarning = 'El job no reporta attachment_count; se usa conteo real.';
      }

      // Step 7: Build output
      const totalSizeMb = Object.values(distribution).reduce((sum, cat) => sum + cat.total_mb, 0);

      return {
        job_id: input.job_id,
        job_jnid: jobJnid,
        attachment_discrepancy: {
          reported_attachment_count: reportedAttachmentCount,
          actual_attachment_count: actualAttachmentCount,
          verified: true,
          warning: discrepancyWarning,
        },
        distribution: {
          photos: distribution[FileCategory.PHOTOS],
          documents: distribution[FileCategory.DOCUMENTS],
          email_attachments: distribution[FileCategory.EMAIL_ATTACHMENTS],
          work_orders: distribution[FileCategory.WORK_ORDERS],
          estimates: distribution[FileCategory.ESTIMATES],
          invoices: distribution[FileCategory.INVOICES],
          permit_related: distribution[FileCategory.PERMIT_RELATED],
          financing: distribution[FileCategory.FINANCING],
          receipts: distribution[FileCategory.RECEIPTS],
          eagleview: distribution[FileCategory.EAGLEVIEW],
          credit_memos: distribution[FileCategory.CREDIT_MEMOS],
          insurance_scopes: distribution[FileCategory.INSURANCE_SCOPES],
          material_receipts: distribution[FileCategory.MATERIAL_RECEIPTS],
          measurements: distribution[FileCategory.MEASUREMENTS],
          payments: distribution[FileCategory.PAYMENTS],
          agreements: distribution[FileCategory.AGREEMENTS],
          material_orders: distribution[FileCategory.MATERIAL_ORDERS],
          subcontractor_docs: distribution[FileCategory.SUBCONTRACTOR_DOCS],
          change_orders: distribution[FileCategory.CHANGE_ORDERS],
          other: distribution[FileCategory.OTHER],
        },
        totals: {
          files: actualAttachmentCount,
          size_mb: Math.round(totalSizeMb * 100) / 100,
        },
        time_range: {
          first_seen_ts: firstSeenTs,
          last_seen_ts: lastSeenTs,
        },
        notes,
      };
    } catch (error) {
      logger.error('Error in get_job_attachments_distribution', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to analyze job attachments',
        job_id: input.job_id,
        notes,
      };
    }
  }
}
