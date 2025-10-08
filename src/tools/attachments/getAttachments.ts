/**
 * Get Attachments Tool
 * Retrieve file attachments from JobNimbus with filtering by job_id, contact_id, or related entity
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface GetAttachmentsInput {
  job_id?: string;
  contact_id?: string;
  related_to?: string;
  from?: number;
  size?: number;
  file_type?: string;
}

interface Attachment {
  jnid?: string;
  name?: string;
  filename?: string;
  file_type?: string;
  size?: number;
  file_size?: number;
  created?: number;
  date_created?: number;
  related?: string[];
  url?: string;
  [key: string]: any;
}

export class GetAttachmentsTool extends BaseTool<GetAttachmentsInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_attachments',
      description: 'Get file attachments and documents from JobNimbus. Supports filtering by job_id, contact_id, or related entity ID. Returns actual attachment records with file information.',
      inputSchema: {
        type: 'object',
        properties: {
          job_id: {
            type: 'string',
            description: 'Filter attachments by job ID (related to this job)',
          },
          contact_id: {
            type: 'string',
            description: 'Filter attachments by contact ID (related to this contact)',
          },
          related_to: {
            type: 'string',
            description: 'Filter attachments by any related entity ID (job, contact, estimate, etc.)',
          },
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
          },
          size: {
            type: 'number',
            description: 'Number of records to retrieve (default: 50, max: 100)',
          },
          file_type: {
            type: 'string',
            description: 'Filter by file type (e.g., "pdf", "jpg", "png")',
          },
        },
      },
    };
  }

  async execute(input: GetAttachmentsInput, context: ToolContext): Promise<any> {
    const fromIndex = input.from || 0;
    const requestedSize = Math.min(input.size || 50, 100);

    // Build query parameters
    const params: any = {
      from: fromIndex,
      size: requestedSize,
    };

    // Add related filter if provided
    const relatedId = input.job_id || input.contact_id || input.related_to;
    if (relatedId) {
      params.related = relatedId;
    }

    try {
      // Fetch attachments from JobNimbus API
      const response = await this.client.get(context.apiKey, 'attachments', params);

      // Extract attachments from response
      const attachments: Attachment[] = response.data?.results || response.data?.attachments || [];

      // Apply file_type filter if provided
      let filteredAttachments = attachments;
      if (input.file_type) {
        const fileTypeFilter = input.file_type.toLowerCase();
        filteredAttachments = attachments.filter((att) => {
          const fileName = att.name || att.filename || '';
          const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
          return fileExt === fileTypeFilter || fileName.toLowerCase().includes(fileTypeFilter);
        });
      }

      // Calculate total size
      const totalSizeMB = filteredAttachments.reduce((sum, att) => {
        const size = att.size || att.file_size || 0;
        return sum + size / (1024 * 1024); // Convert to MB
      }, 0);

      // Analyze file types
      const fileTypeMap = new Map<string, number>();
      for (const att of filteredAttachments) {
        const fileName = att.name || att.filename || 'unknown';
        const fileExt = fileName.split('.').pop()?.toLowerCase() || 'unknown';
        fileTypeMap.set(fileExt, (fileTypeMap.get(fileExt) || 0) + 1);
      }

      return {
        count: filteredAttachments.length,
        from: fromIndex,
        size: requestedSize,
        has_more: filteredAttachments.length === requestedSize,
        filter_applied: {
          job_id: input.job_id,
          contact_id: input.contact_id,
          related_to: input.related_to || relatedId,
          file_type: input.file_type,
        },
        total_size_mb: totalSizeMB.toFixed(2),
        file_types: Object.fromEntries(fileTypeMap),
        attachments: filteredAttachments.map((att) => ({
          id: att.jnid,
          name: att.name || att.filename,
          file_type: (att.name || att.filename || '').split('.').pop()?.toLowerCase(),
          size_bytes: att.size || att.file_size || 0,
          size_mb: ((att.size || att.file_size || 0) / (1024 * 1024)).toFixed(2),
          created: att.created || att.date_created,
          related: att.related,
          url: att.url,
        })),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to fetch attachments',
        status: 'error',
        filter_applied: {
          job_id: input.job_id,
          contact_id: input.contact_id,
          related_to: relatedId,
        },
      };
    }
  }
}
