/**
 * Get Job Tool - Get specific job by ID
 * Enhanced with complete field coverage matching JobNimbus API
 * Based on official JobNimbus API documentation
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface GetJobInput {
  job_id: string;
  verify_attachments?: boolean;
}

interface JobOwner {
  id: string;
}

interface JobLocation {
  id: number;
  parent_id?: number | null;
  name?: string;
}

interface JobGeo {
  lat: number;
  lon: number;
}

interface JobPrimary {
  id: string;
  name?: string;
  number?: string;
  type?: string;
}

/**
 * Complete Job interface matching JobNimbus API
 * Based on official JobNimbus API documentation
 */
interface Job {
  // Core identifiers
  jnid: string;
  recid: number;
  number?: string;
  display_number?: string;
  type: string;
  customer?: string;

  // Metadata
  created_by: string;
  created_by_name: string;
  date_created: number;
  date_updated: number;
  date_status_change?: number;

  // Ownership & Location
  owners: JobOwner[];
  subcontractors: any[];
  location: JobLocation;

  // Job Information
  name?: string;
  display_name?: string;
  description?: string;

  // Classification
  record_type: number;
  record_type_name: string;
  status?: number;
  status_name?: string;
  source?: number;
  source_name?: string;

  // Sales
  sales_rep?: string;
  sales_rep_name?: string;

  // Address
  address_line1?: string;
  address_line2?: string | null;
  city?: string;
  state_text?: string;
  country_name?: string;
  zip?: string;
  geo?: JobGeo;

  // Primary Contact/Customer
  primary?: JobPrimary;

  // Scheduling
  date_start?: number;
  date_end?: number;

  // Financial
  approved_estimate_total?: number;
  approved_invoice_total?: number;
  last_estimate?: number;
  last_invoice?: number;
  work_order_total?: number;

  // Attachments
  attachment_count?: number;

  // Status
  is_active?: boolean;
  is_archived?: boolean;

  // Additional
  tags?: any[];
  external_id?: string | null;

  // Allow additional fields from API
  [key: string]: any;
}

export class GetJobTool extends BaseTool<GetJobInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_job',
      description: 'Get job by ID or number with complete details',
      inputSchema: {
        type: 'object',
        properties: {
          job_id: {
            type: 'string',
            description: 'Job ID or number',
          },
          verify_attachments: {
            type: 'boolean',
            description: 'Verify attachment count (auto if >100)',
          },
        },
        required: ['job_id'],
      },
    };
  }

  /**
   * Search for job by number when direct JNID lookup fails
   */
  private async searchJobByNumber(jobNumber: string, context: ToolContext): Promise<Job | null> {
    const batchSize = 100;
    const maxIterations = 50; // Maximum 5,000 jobs
    let offset = 0;

    try {
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        const response = await this.client.get(context.apiKey, 'jobs', {
          size: batchSize,
          from: offset
        });

        const jobs = response.data?.results || [];
        if (jobs.length === 0) break;

        // Search for job by number field
        const found = jobs.find((j: any) =>
          String(j.number) === String(jobNumber) ||
          String(j.display_number) === String(jobNumber)
        );

        if (found) {
          return found;
        }

        offset += batchSize;
        if (jobs.length < batchSize) break;
      }
    } catch (error: any) {
      console.error(`Backward search failed for job ${jobNumber}:`, error.message || error);
      return null;
    }

    return null;
  }

  /**
   * Format Unix timestamp to ISO 8601
   */
  private formatDate(timestamp: number): string | null {
    if (!timestamp || timestamp === 0) return null;
    return new Date(timestamp * 1000).toISOString();
  }

  /**
   * Build full address string from components
   */
  private buildAddress(job: Job): string | null {
    const addressParts = [
      job.address_line1,
      job.address_line2,
      job.city,
      job.state_text,
      job.zip,
    ].filter(Boolean);

    return addressParts.length > 0 ? addressParts.join(', ') : null;
  }

  /**
   * Process job with attachment verification and field formatting
   */
  private async processJob(job: Job, input: GetJobInput, context: ToolContext): Promise<any> {
    const jobJnid = job.jnid || input.job_id;

    // Attachment verification logic
    const reportedCount = job.attachment_count || 0;
    const shouldVerify = input.verify_attachments || reportedCount > 100;

    let attachmentVerification: any = null;
    let correctedAttachmentCount = reportedCount;

    if (shouldVerify && reportedCount > 0) {
      try {
        const filesResponse = await this.client.get(
          context.apiKey,
          'files',
          { size: 500 }
        );

        const allFiles = filesResponse.data?.files || [];
        const jobFiles = allFiles.filter((file: any) => {
          if (file.primary?.id === jobJnid) return true;
          if (file.related && Array.isArray(file.related)) {
            return file.related.some((rel: any) => rel.id === jobJnid);
          }
          return false;
        });

        const actualCount = jobFiles.length;
        correctedAttachmentCount = actualCount;

        attachmentVerification = {
          reported_attachment_count: reportedCount,
          actual_attachment_count: actualCount,
          verified: true,
          discrepancy: reportedCount !== actualCount,
          warning: reportedCount > 100
            ? `Suspicious attachment_count (${reportedCount}). JobNimbus API may be counting all system files. Verified actual count: ${actualCount}`
            : null,
          endpoint_used: 'files',
          job_jnid: jobJnid,
          sample_files: jobFiles.slice(0, 3).map((f: any) => ({
            filename: f.filename,
            size_mb: ((f.size || 0) / (1024 * 1024)).toFixed(2),
            type: f.content_type,
          })),
        };
      } catch (error) {
        attachmentVerification = {
          reported_attachment_count: reportedCount,
          actual_attachment_count: null,
          verified: false,
          error: error instanceof Error ? error.message : 'Failed to verify attachments',
          warning: reportedCount > 100
            ? `Suspicious attachment_count (${reportedCount}). Verification failed - check API permissions.`
            : null,
          endpoint_attempted: 'files',
          job_jnid: jobJnid,
        };
      }
    }

    // Build full name
    const fullName = job.name || job.display_name || 'Unnamed Job';

    // Build full address
    const fullAddress = this.buildAddress(job);

    // Format response with all fields explicitly mapped
    return {
      success: true,
      data: {
        // Identifiers
        jnid: job.jnid,
        recid: job.recid,
        number: job.number || job.display_number || null,
        display_number: job.display_number || job.number || null,
        type: job.type,
        customer: job.customer || null,

        // Job Information
        name: job.name || null,
        display_name: job.display_name || null,
        full_name: fullName,
        description: job.description || null,

        // Classification
        record_type: job.record_type,
        record_type_name: job.record_type_name || 'Unknown',
        status: job.status || null,
        status_name: job.status_name || null,
        source: job.source || null,
        source_name: job.source_name || null,

        // Address
        address_line1: job.address_line1 || null,
        address_line2: job.address_line2 || null,
        city: job.city || null,
        state_text: job.state_text || null,
        country_name: job.country_name || null,
        zip: job.zip || null,
        full_address: fullAddress,
        geo: job.geo || null,

        // Primary Contact/Customer
        primary: job.primary || null,
        primary_name: job.primary?.name || null,
        primary_number: job.primary?.number || null,

        // Ownership & Relationships
        owners: job.owners || [],
        owners_count: job.owners?.length || 0,
        subcontractors: job.subcontractors || [],
        subcontractors_count: job.subcontractors?.length || 0,
        location: job.location,

        // Sales
        sales_rep: job.sales_rep || null,
        sales_rep_name: job.sales_rep_name || null,

        // Scheduling
        date_start: this.formatDate(job.date_start || 0),
        date_start_unix: job.date_start || null,
        date_end: this.formatDate(job.date_end || 0),
        date_end_unix: job.date_end || null,

        // Financial
        approved_estimate_total: job.approved_estimate_total || null,
        approved_invoice_total: job.approved_invoice_total || null,
        last_estimate: job.last_estimate || null,
        last_invoice: job.last_invoice || null,
        work_order_total: job.work_order_total || null,

        // Attachments
        attachment_count: correctedAttachmentCount,
        attachment_verification: attachmentVerification,

        // Metadata
        created_by: job.created_by,
        created_by_name: job.created_by_name,
        date_created: this.formatDate(job.date_created),
        date_created_unix: job.date_created,
        date_updated: this.formatDate(job.date_updated),
        date_updated_unix: job.date_updated,
        date_status_change: this.formatDate(job.date_status_change || 0),
        date_status_change_unix: job.date_status_change || null,

        // Status
        is_active: job.is_active ?? true,
        is_archived: job.is_archived ?? false,

        // Additional
        tags: job.tags || [],
        tags_count: job.tags?.length || 0,
        external_id: job.external_id || null,

        _metadata: {
          api_endpoint: 'GET /api1/jobs/<jnid>',
          field_coverage: 'complete',
          cached: false,
          timestamp: new Date().toISOString(),
        },
      },
    };
  }

  async execute(input: GetJobInput, context: ToolContext): Promise<any> {
    let directLookupError: any = null;

    // 1. Try direct JNID lookup first (fast path for valid JNIDs)
    try {
      const result = await this.client.get(
        context.apiKey,
        `jobs/${input.job_id}`
      );
      const job: Job = result.data;
      return await this.processJob(job, input, context);
    } catch (error: any) {
      directLookupError = error;
      if (error.statusCode !== 404 && error.status !== 404) {
        throw error;
      }
    }

    // 2. Search by job number (backward search for old jobs)
    const job = await this.searchJobByNumber(input.job_id, context);

    if (!job) {
      const errorDetails = [];
      errorDetails.push(`Job not found: ${input.job_id}`);
      errorDetails.push(`Direct lookup: ${directLookupError?.message || 'Not Found (404)'}`);
      errorDetails.push(`Backward search: Searched up to 5,000 jobs by number field`);
      errorDetails.push(`Possible causes:`);
      errorDetails.push(`  - Job doesn't exist in this instance`);
      errorDetails.push(`  - Job is in a different company (Stamford vs Guilford)`);
      errorDetails.push(`  - API key permissions insufficient for listing jobs`);

      throw new Error(errorDetails.join('\n'));
    }

    return await this.processJob(job, input, context);
  }
}

export default new GetJobTool();
