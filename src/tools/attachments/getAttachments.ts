/**
 * Get Attachments Tool
 * Retrieve file attachments from JobNimbus using the correct /files endpoint
 *
 * CRITICAL: JobNimbus uses /files endpoint, NOT /attachments
 * Files have a 'related' array that must be searched to filter by entity
 *
 * FASE 1: Integrated Redis cache system for performance optimization
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
      description: 'Get file attachments and documents from JobNimbus. Supports filtering by job_id, contact_id, or related entity ID. Returns actual file records with metadata. NOTE: Uses /files endpoint internally.',
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
            description: 'Number of records to fetch for filtering (default: 100, max: 500). NOTE: Filtering is client-side.',
          },
          file_type: {
            type: 'string',
            description: 'Filter by file type (e.g., "pdf", "jpg", "png", "application/pdf")',
          },
        },
      },
    };
  }

  async execute(input: GetAttachmentsInput, context: ToolContext): Promise<any> {
    const fromIndex = input.from || 0;
    const fetchSize = Math.min(input.size || 100, 500); // Fetch more for client-side filtering

    // Generate cache identifier
    const cacheIdentifier = generateCacheIdentifier(input);

    // Wrap with cache layer (FASE 1: Redis cache integration)
    return await withCache(
      {
        entity: CACHE_PREFIXES.ATTACHMENTS,
        operation: CACHE_PREFIXES.LIST,
        identifier: cacheIdentifier,
      },
      getTTL('ATTACHMENTS_LIST'),
      async () => {
        try {
          // Fetch files from JobNimbus API (correct endpoint is /files)
          const response = await this.client.get(context.apiKey, 'files', {
            from: fromIndex,
            size: fetchSize,
          });

          // Extract files from response
          const allFiles: JobNimbusFile[] = response.data?.files || [];
          const totalAvailable = response.data?.count || 0;

          // Filter by entity ID (job_id, contact_id, or related_to)
          const filterId = input.job_id || input.contact_id || input.related_to;
          let filteredFiles = allFiles;

          if (filterId) {
            filteredFiles = allFiles.filter((file) => {
              // Check if ID is in primary
              if (file.primary?.id === filterId) return true;

              // Check if ID is in related array
              if (file.related && Array.isArray(file.related)) {
                return file.related.some((rel) => rel.id === filterId);
              }

              return false;
            });
          }

          // Apply file_type filter if provided
          if (input.file_type) {
            const fileTypeFilter = input.file_type.toLowerCase();
            filteredFiles = filteredFiles.filter((file) => {
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

          // Calculate total size
          const totalSizeMB = filteredFiles.reduce((sum, file) => {
            return sum + (file.size || 0) / (1024 * 1024);
          }, 0);

          // Analyze file types
          const fileTypeMap = new Map<string, number>();
          for (const file of filteredFiles) {
            const ext = file.filename?.split('.').pop()?.toLowerCase() || 'unknown';
            fileTypeMap.set(ext, (fileTypeMap.get(ext) || 0) + 1);
          }

          return {
            count: filteredFiles.length,
            total_available: totalAvailable,
            from: fromIndex,
            fetch_size: fetchSize,
            filter_applied: {
              entity_id: filterId,
              job_id: input.job_id,
              contact_id: input.contact_id,
              related_to: input.related_to,
              file_type: input.file_type,
            },
            total_size_mb: totalSizeMB.toFixed(2),
            file_types: Object.fromEntries(fileTypeMap),
            files: filteredFiles.map((file) => ({
              id: file.jnid,
              filename: file.filename,
              content_type: file.content_type,
              file_extension: file.filename?.split('.').pop()?.toLowerCase(),
              size_bytes: file.size,
              size_mb: ((file.size || 0) / (1024 * 1024)).toFixed(2),
              date_created: file.date_created,
              date_file_created: file.date_file_created,
              is_active: file.is_active,
              is_archived: file.is_archived,
              primary: file.primary,
              related: file.related,
              url: file.url,
              type: file.type,
            })),
            _debug: {
              endpoint: 'files',
              note: 'JobNimbus uses /files endpoint. Filtering is done client-side by searching related array.',
            },
          };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : 'Failed to fetch files',
            status: 'error',
            endpoint_used: 'files',
            filter_applied: {
              job_id: input.job_id,
              contact_id: input.contact_id,
              related_to: input.related_to,
            },
            note: 'JobNimbus uses /files endpoint, not /attachments',
          };
        }
      }
    );
  }
}
