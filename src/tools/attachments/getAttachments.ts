/**
 * Get Attachments Tool
 * Retrieve file attachments and documents from JobNimbus by querying multiple endpoints
 *
 * CRITICAL: JobNimbus UI combines data from three endpoints:
 * - /files: Direct file attachments
 * - /documents: Document records
 * - /orders: Order-related documents (optional)
 *
 * This tool queries all three endpoints in parallel, consolidates results,
 * deduplicates by id/filename, and sorts by date_created desc.
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
      description: 'Get file attachments and documents from JobNimbus by querying /files, /documents, and /orders endpoints. Consolidates and deduplicates results to match JobNimbus UI. Supports filtering by job_id, contact_id, or related entity ID.',
      inputSchema: {
        type: 'object',
        properties: {
          job_id: {
            type: 'string',
            description: 'Filter files by job ID (queries all three endpoints: /files, /documents, /orders)',
          },
          contact_id: {
            type: 'string',
            description: 'Filter files by contact ID (queries all three endpoints)',
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
            description: 'Number of records to fetch per endpoint (default: 100, max: 500)',
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
   * Query a specific endpoint with filter for related entity
   */
  private async queryEndpoint(
    context: ToolContext,
    endpoint: string,
    entityId: string,
    size: number
  ): Promise<JobNimbusFile[]> {
    try {
      // Build filter for related.id
      const filter = JSON.stringify({
        must: [{ term: { 'related.id': entityId } }],
      });

      const response = await this.client.get(context.apiKey, endpoint, {
        filter,
        size,
      });

      // Different endpoints may return data in different formats
      const results = response.data?.results || response.data?.files || response.data || [];
      return Array.isArray(results) ? results : [];
    } catch (error) {
      // Log error but don't fail - just return empty array
      console.error(`Error querying ${endpoint}:`, error);
      return [];
    }
  }

  /**
   * Deduplicate files by id (jnid) and filename
   */
  private deduplicateFiles(files: JobNimbusFile[]): JobNimbusFile[] {
    const seenIds = new Set<string>();
    const seenFilenames = new Set<string>();
    const uniqueFiles: JobNimbusFile[] = [];

    for (const file of files) {
      const id = file.jnid;
      const filename = file.filename;

      // Skip if we've already seen this id
      if (id && seenIds.has(id)) {
        continue;
      }

      // Skip if we've already seen this filename (for files without id)
      if (filename && seenFilenames.has(filename) && !id) {
        continue;
      }

      // Add to results
      uniqueFiles.push(file);

      // Track what we've seen
      if (id) seenIds.add(id);
      if (filename) seenFilenames.add(filename);
    }

    return uniqueFiles;
  }

  /**
   * Sort files by date_created descending
   */
  private sortByDateCreated(files: JobNimbusFile[]): JobNimbusFile[] {
    return [...files].sort((a, b) => {
      const dateA = a.date_created || 0;
      const dateB = b.date_created || 0;
      return dateB - dateA; // Descending order (newest first)
    });
  }

  async execute(input: GetAttachmentsInput, context: ToolContext): Promise<any> {
    const fromIndex = input.from || 0;
    const fetchSize = Math.min(input.size || 100, 500);

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
          // Get entity ID for filtering
          const entityId = input.job_id || input.contact_id || input.related_to;

          if (!entityId) {
            return {
              error: 'job_id, contact_id, or related_to is required',
              status: 'error',
              note: 'Please provide at least one entity ID to filter documents',
            };
          }

          // Query all three endpoints in parallel
          const [filesResults, documentsResults, ordersResults] = await Promise.all([
            this.queryEndpoint(context, 'files', entityId, fetchSize),
            this.queryEndpoint(context, 'documents', entityId, fetchSize),
            this.queryEndpoint(context, 'orders', entityId, fetchSize),
          ]);

          // Consolidate all results
          let allFiles: JobNimbusFile[] = [
            ...filesResults,
            ...documentsResults,
            ...ordersResults,
          ];

          // Deduplicate by id and filename
          allFiles = this.deduplicateFiles(allFiles);

          // Sort by date_created descending
          allFiles = this.sortByDateCreated(allFiles);

          // Apply file_type filter if provided
          let filteredFiles = allFiles;
          if (input.file_type) {
            const fileTypeFilter = input.file_type.toLowerCase();
            filteredFiles = allFiles.filter((file) => {
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

          // Apply pagination
          const paginatedFiles = filteredFiles.slice(fromIndex, fromIndex + fetchSize);

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
            total_available: filteredFiles.length,
            total_before_deduplication: filesResults.length + documentsResults.length + ordersResults.length,
            from: fromIndex,
            fetch_size: fetchSize,
            endpoints_queried: {
              files: filesResults.length,
              documents: documentsResults.length,
              orders: ordersResults.length,
            },
            filter_applied: {
              entity_id: entityId,
              job_id: input.job_id,
              contact_id: input.contact_id,
              related_to: input.related_to,
              file_type: input.file_type,
            },
            total_size_mb: totalSizeMB.toFixed(2),
            file_types: Object.fromEntries(fileTypeMap),
            has_more: fromIndex + paginatedFiles.length < filteredFiles.length,
            files: paginatedFiles.map((file) => ({
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
              endpoints: ['files', 'documents', 'orders'],
              note: 'Queries all three endpoints in parallel, consolidates, deduplicates, and sorts by date_created desc',
              filter_used: `{"must":[{"term":{"related.id":"${entityId}"}}]}`,
            },
          };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : 'Failed to fetch documents',
            status: 'error',
            filter_applied: {
              job_id: input.job_id,
              contact_id: input.contact_id,
              related_to: input.related_to,
            },
            note: 'Error querying /files, /documents, and /orders endpoints',
          };
        }
      }
    );
  }
}
