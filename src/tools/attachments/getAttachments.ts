/**
 * Get Attachments Tool
 * Retrieve file attachments from JobNimbus /files endpoint
 *
 * VERIFIED WORKING - Uses official JobNimbus API endpoint
 * Based on official documentation: GET /files
 *
 * Response structure:
 * {
 *   "count": number,
 *   "files": [
 *     {
 *       "jnid": string,
 *       "filename": string,
 *       "content_type": string,
 *       "size": number,
 *       "date_created": timestamp,
 *       "related": [...],
 *       "primary": {...},
 *       ...
 *     }
 *   ]
 * }
 *
 * Integrated with Redis cache system for performance optimization
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetAttachmentsInput {
  job_id?: string;
  contact_id?: string;
  related_to?: string;
  from?: number;
  size?: number;
  file_type?: string;
}

interface JobNimbusFile {
  jnid?: string;
  filename?: string;
  content_type?: string;
  size?: number;
  date_created?: number;
  date_file_created?: number;
  related?: Array<{ id: string; name?: string; type?: string }>;
  primary?: { id: string; name?: string; number?: string; type?: string };
  type?: string;
  url?: string;
  is_active?: boolean;
  is_archived?: boolean;
  [key: string]: any;
}

/**
 * Generate deterministic cache identifier from input parameters
 * Format: {entity_id}:{file_type}:{from}:{size}
 */
function generateCacheIdentifier(input: GetAttachmentsInput): string {
  const entityId = input.job_id || input.contact_id || input.related_to || 'all';
  const fileType = input.file_type || 'all';
  const from = input.from || 0;
  const size = input.size || 100;
  return `${entityId}:${fileType}:${from}:${size}`;
}

export class GetAttachmentsTool extends BaseTool<GetAttachmentsInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_attachments',
      description: 'Retrieve file attachments from JobNimbus /files endpoint. Returns all file attachments with metadata including filename, content type, size, related entities, and creation dates. Supports filtering by related entity (job_id, contact_id) and file type. Based on official JobNimbus API documentation.',
      inputSchema: {
        type: 'object',
        properties: {
          job_id: {
            type: 'string',
            description: 'Filter files by job ID (searches in related array and primary field)',
          },
          contact_id: {
            type: 'string',
            description: 'Filter files by contact ID (searches in related array)',
          },
          related_to: {
            type: 'string',
            description: 'Filter files by any related entity ID (job, contact, estimate, etc.)',
          },
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
          },
          size: {
            type: 'number',
            description: 'Number of records to fetch (default: 100, max: 500). NOTE: Filtering is client-side.',
          },
          file_type: {
            type: 'string',
            description: 'Filter by file type (e.g., "pdf", "jpg", "png", "application/pdf")',
          },
        },
      },
    };
  }

  /**
   * Filter files by related entity ID (client-side filtering)
   */
  private filterByRelatedEntity(files: JobNimbusFile[], entityId: string): JobNimbusFile[] {
    return files.filter((file) => {
      // Check if entityId is in related array
      const inRelated = file.related?.some((rel) => rel.id === entityId);

      // Check if entityId is the primary
      const isPrimary = file.primary?.id === entityId;

      return inRelated || isPrimary;
    });
  }

  /**
   * Filter files by file type
   */
  private filterByFileType(files: JobNimbusFile[], fileType: string): JobNimbusFile[] {
    const fileTypeFilter = fileType.toLowerCase();
    return files.filter((file) => {
      const fileName = file.filename || '';
      const contentType = file.content_type || '';
      const fileExt = fileName.split('.').pop()?.toLowerCase() || '';

      return (
        fileExt === fileTypeFilter ||
        contentType.toLowerCase().includes(fileTypeFilter) ||
        fileName.toLowerCase().includes(fileTypeFilter)
      );
    });
  }

  async execute(input: GetAttachmentsInput, context: ToolContext): Promise<any> {
    const fromIndex = input.from || 0;
    const fetchSize = Math.min(input.size || 100, 500);

    // Generate cache identifier
    const cacheIdentifier = generateCacheIdentifier(input);

    // Wrap with cache layer (Redis cache integration)
    return await withCache(
      {
        entity: CACHE_PREFIXES.ATTACHMENTS,
        operation: CACHE_PREFIXES.LIST,
        identifier: cacheIdentifier,
      },
      getTTL('ATTACHMENTS_LIST'),
      async () => {
        try {
          // Query /files endpoint
          // NOTE: We fetch more than needed because filtering is client-side
          const response = await this.client.get(context.apiKey, 'files', {
            size: fetchSize,
          });

          // Extract files from response (API returns { count, files })
          let allFiles: JobNimbusFile[] = response.data?.files || response.data || [];
          if (!Array.isArray(allFiles)) {
            allFiles = [];
          }

          const totalFromAPI = response.data?.count || allFiles.length;

          // Apply entity filtering if provided (client-side)
          const entityId = input.job_id || input.contact_id || input.related_to;
          if (entityId) {
            allFiles = this.filterByRelatedEntity(allFiles, entityId);
          }

          // Apply file_type filter if provided (client-side)
          if (input.file_type) {
            allFiles = this.filterByFileType(allFiles, input.file_type);
          }

          // Sort by date_created descending (newest first)
          allFiles.sort((a, b) => {
            const dateA = a.date_created || 0;
            const dateB = b.date_created || 0;
            return dateB - dateA;
          });

          // Apply pagination
          const paginatedFiles = allFiles.slice(fromIndex, fromIndex + fetchSize);

          // Calculate total size
          const totalSizeMB = paginatedFiles.reduce((sum, file) => {
            return sum + (file.size || 0) / (1024 * 1024);
          }, 0);

          // Analyze file types
          const fileTypeMap = new Map<string, number>();
          for (const file of paginatedFiles) {
            const ext = file.filename?.split('.').pop()?.toLowerCase() || 'unknown';
            fileTypeMap.set(ext, (fileTypeMap.get(ext) || 0) + 1);
          }

          return {
            count: paginatedFiles.length,
            total_from_api: totalFromAPI,
            total_after_filtering: allFiles.length,
            from: fromIndex,
            size: fetchSize,
            filter_applied: {
              entity_id: entityId,
              job_id: input.job_id,
              contact_id: input.contact_id,
              related_to: input.related_to,
              file_type: input.file_type,
            },
            total_size_mb: totalSizeMB.toFixed(2),
            file_types: Object.fromEntries(fileTypeMap),
            has_more: fromIndex + paginatedFiles.length < allFiles.length,
            files: paginatedFiles.map((file) => ({
              jnid: file.jnid,
              filename: file.filename,
              content_type: file.content_type,
              file_extension: file.filename?.split('.').pop()?.toLowerCase(),
              size_bytes: file.size,
              size_mb: ((file.size || 0) / (1024 * 1024)).toFixed(2),
              date_created: file.date_created,
              is_active: file.is_active,
              is_archived: file.is_archived,
              is_private: file.is_private,
              created_by: file.created_by,
              created_by_name: file.created_by_name,
              primary: file.primary,
              related: file.related,
              customer: file.customer,
              sales_rep: file.sales_rep,
              record_type: file.record_type,
              record_type_name: file.record_type_name,
              type: file.type,
            })),
            _note: 'Uses official /files endpoint. Filtering by entity is client-side. To get ALL files without entity filtering, omit job_id/contact_id/related_to.',
          };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : 'Failed to fetch files',
            status: 'error',
            filter_applied: {
              job_id: input.job_id,
              contact_id: input.contact_id,
              related_to: input.related_to,
            },
            note: 'Error querying /files endpoint',
          };
        }
      }
    );
  }
}
