/**
 * Get Attachments Tool
 * Retrieve file attachments from multiple JobNimbus endpoints
 *
 * MULTI-SOURCE DOCUMENT RETRIEVAL - Matches JobNimbus UI behavior
 * Queries THREE sources in parallel:
 * 1. /api1/files - Direct file attachments
 * 2. /api1/documents - Documents
 * 3. /api1/orders - Orders (optional)
 *
 * Response structure is normalized across all sources and deduplicated.
 * This ensures we retrieve ALL documents that appear in the JobNimbus UI,
 * not just direct file attachments.
 *
 * PHASE 3: Handle-based response system for token optimization
 * - Automatic response size detection and handle storage
 * - Verbosity levels: summary/compact/detailed/raw
 * - Field selection support
 * - Redis cache + handle storage integration
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext, BaseToolInput } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetAttachmentsInput extends BaseToolInput {
  // Entity filtering
  job_id?: string;
  contact_id?: string;
  related_to?: string;

  // Pagination
  from?: number;
  size?: number;
  page_size?: number;

  // Response control (Phase 3: Handle-based system)
  verbosity?: 'summary' | 'compact' | 'detailed' | 'raw';
  fields?: string;

  // File filtering
  file_type?: string;
}

interface FileRelated {
  id: string;
  type?: string;
  name?: string;
}

interface FilePrimary {
  id: string;
  type?: string;
  number?: string;
  name?: string;
}

interface FileOwner {
  id: string;
}

/**
 * Complete File interface matching JobNimbus API
 * Based on official JobNimbus API documentation for GET /api1/files
 */
interface JobNimbusFile {
  // Core identifiers
  jnid: string;
  customer?: string;
  type?: string;

  // File information
  filename: string;
  content_type: string;
  size: number;

  // Dates
  date_created: number;
  date_updated?: number;
  date_file_created?: number;

  // Relationships
  related: FileRelated[];
  primary?: FilePrimary;
  owners: FileOwner[];

  // Classification
  record_type?: number;
  record_type_name?: string;

  // Status
  is_active: boolean;
  is_archived: boolean;
  is_private: boolean;

  // Creator and sales
  created_by: string;
  created_by_name: string;
  sales_rep?: string;

  // Additional
  url?: string;

  // Allow additional fields from API
  [key: string]: any;
}

/**
 * Generate deterministic cache identifier from input parameters
 * Format: {entity_id}:{file_type}:{from}:{size}:{page_size}:{verbosity}:{fields}
 *
 * CRITICAL: Must include verbosity and page_size to prevent returning wrong cached responses
 */
function generateCacheIdentifier(input: GetAttachmentsInput): string {
  const entityId = input.job_id || input.contact_id || input.related_to || 'all';
  const fileType = input.file_type || 'all';
  const from = input.from || 0;
  const size = input.size || 100;
  const pageSize = input.page_size || 'null';
  const verbosity = input.verbosity || 'null';
  const fields = input.fields || 'null';
  return `${entityId}:${fileType}:${from}:${size}:${pageSize}:${verbosity}:${fields}`;
}

export class GetAttachmentsTool extends BaseTool<GetAttachmentsInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_attachments',
      description: 'Attachments: multi-source retrieval, handle-based responses, filtering, deduplication',
      inputSchema: {
        type: 'object',
        properties: {
          // NEW: Handle-based response control
          verbosity: {
            type: 'string',
            description: 'Response detail level: "summary" (5 fields, max 5 files), "compact" (15 fields, max 20 files - DEFAULT), "detailed" (50 fields, max 50 files), "raw" (all fields). Compact mode prevents chat saturation.',
            enum: ['summary', 'compact', 'detailed', 'raw'],
          },
          fields: {
            type: 'string',
            description: 'Comma-separated field names to return. Example: "jnid,filename,size_bytes,content_type,date_created,record_type_name". Overrides verbosity-based field selection.',
          },
          page_size: {
            type: 'number',
            description: 'Number of records per page (default: 20, max: 100). Replaces "size" parameter. Use with cursor for pagination.',
          },

          // Entity filtering
          job_id: {
            type: 'string',
            description: 'Filter files by job number (e.g., "1820") or internal JNID. Both formats work automatically.',
          },
          contact_id: {
            type: 'string',
            description: 'Filter files by contact ID (searches in related array)',
          },
          related_to: {
            type: 'string',
            description: 'Filter files by any related entity ID (job, contact, estimate, etc.)',
          },

          // Legacy pagination
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0). NOTE: Prefer page_size + cursor for large datasets.',
          },
          size: {
            type: 'number',
            description: 'Number of records to fetch (default: 100, max: 500). DEPRECATED: Use page_size instead. Entity filtering is server-side via Elasticsearch.',
          },

          // File filtering
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
    // Determine page size - prefer page_size (new) over size (legacy)
    const pageSize = input.page_size || input.size || 100;
    const fromIndex = input.from || 0;
    const fetchSize = Math.min(pageSize, 100); // OPTIMIZED: reduced max from 500 to 100 for token optimization

    // Generate cache identifier
    const cacheIdentifier = generateCacheIdentifier(input);

    // Wrap with cache layer (Redis cache integration)
    return await withCache(
      {
        entity: CACHE_PREFIXES.ATTACHMENTS,
        operation: CACHE_PREFIXES.LIST,
        identifier: cacheIdentifier,
      instance: context.instance,
      },
      getTTL('ATTACHMENTS_LIST'),
      async () => {
        try {
          // Determine entity ID for filtering
          const entityId = input.job_id || input.contact_id || input.related_to;

          // Build Elasticsearch filters for each source endpoint
          const buildFilter = (fieldPath: string) => {
            if (!entityId) return undefined;
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

          // Execute 3 parallel queries to match JobNimbus UI behavior
          const [filesResponse, documentsResponse, ordersResponse] = await Promise.all([
            this.client.get(context.apiKey, 'files', {
              filter: filesFilter,
              size: fetchSize
            }).catch(err => {
              // Graceful degradation - if endpoint fails, return empty array
              return { data: { files: [] }, error: err };
            }),
            this.client.get(context.apiKey, 'documents', {
              filter: documentsFilter,
              size: fetchSize
            }).catch(err => {
              return { data: { documents: [] }, error: err };
            }),
            this.client.get(context.apiKey, 'orders', {
              filter: ordersFilter,
              size: fetchSize
            }).catch(err => {
              return { data: { orders: [] }, error: err };
            }),
          ]);

          // Extract arrays from each response - handle different response structures
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
          let allFiles: JobNimbusFile[] = [
            ...(Array.isArray(filesArray) ? filesArray : []),
            ...(Array.isArray(documentsArray) ? documentsArray : []),
            ...(Array.isArray(ordersArray) ? ordersArray : []),
          ];

          // Deduplicate by jnid (primary) or fallback to composite key
          const seenIds = new Set<string>();
          const deduplicatedFiles: JobNimbusFile[] = [];

          for (const file of allFiles) {
            // Primary deduplication by jnid, fallback to composite key
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

          // Use deduplicated files for further processing
          allFiles = deduplicatedFiles;
          const totalFromAPI = allFiles.length;

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

          // Analyze file types by extension
          const fileTypeMap = new Map<string, number>();
          for (const file of paginatedFiles) {
            const ext = file.filename?.split('.').pop()?.toLowerCase() || 'unknown';
            fileTypeMap.set(ext, (fileTypeMap.get(ext) || 0) + 1);
          }

          // Analyze by record_type_name (Document, Invoice, Photo, etc.)
          const recordTypeMap = new Map<string, number>();
          for (const file of allFiles) {
            const recordType = file.record_type_name || 'Unknown';
            recordTypeMap.set(recordType, (recordTypeMap.get(recordType) || 0) + 1);
          }

          // Calculate distribution percentages
          const recordTypeDistribution = Array.from(recordTypeMap.entries()).map(([type, count]) => ({
            type,
            count,
            percentage: ((count / allFiles.length) * 100).toFixed(1),
          })).sort((a, b) => b.count - a.count);

          // Build page info
          const pageInfo = {
            has_more: totalFromAPI > fromIndex + paginatedFiles.length,
            total: allFiles.length,
            current_page: Math.floor(fromIndex / pageSize) + 1,
            total_pages: Math.ceil(allFiles.length / pageSize),
          };

          // Map files to clean output format
          const mappedFiles = paginatedFiles.map((file) => ({
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
          }));

          // Check if using new handle-based parameters
          if (this.hasNewParams(input)) {
            // NEW BEHAVIOR: Use handle-based response system
            // ResponseBuilder expects the raw data array, not a wrapper object
            const envelope = await this.wrapResponse(mappedFiles, input, context, {
              entity: 'attachments',
              maxRows: pageSize,
              pageInfo,
            });

            // Add attachments-specific metadata to the envelope
            return {
              ...envelope,
              query_metadata: {
                count: paginatedFiles.length,
                total_from_api: totalFromAPI,
                total_after_filtering: allFiles.length,
                from: fromIndex,
                page_size: pageSize,
                sources_queried: {
                  files_endpoint: sourceCounts.files,
                  documents_endpoint: sourceCounts.documents,
                  orders_endpoint: sourceCounts.orders,
                  total_before_deduplication: sourceCounts.files + sourceCounts.documents + sourceCounts.orders,
                  total_after_deduplication: totalFromAPI,
                  duplicates_removed: (sourceCounts.files + sourceCounts.documents + sourceCounts.orders) - totalFromAPI,
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
                record_type_distribution: recordTypeDistribution,
              },
            };
          } else {
            // LEGACY BEHAVIOR: Maintain backward compatibility
            return {
              count: paginatedFiles.length,
              total_from_api: totalFromAPI,
              total_after_filtering: allFiles.length,
              from: fromIndex,
              size: fetchSize,
              sources_queried: {
                files_endpoint: sourceCounts.files,
                documents_endpoint: sourceCounts.documents,
                orders_endpoint: sourceCounts.orders,
                total_before_deduplication: sourceCounts.files + sourceCounts.documents + sourceCounts.orders,
                total_after_deduplication: totalFromAPI,
                duplicates_removed: (sourceCounts.files + sourceCounts.documents + sourceCounts.orders) - totalFromAPI,
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
              record_type_distribution: recordTypeDistribution,
              has_more: pageInfo.has_more,
              files: mappedFiles,
              _note: 'MULTI-SOURCE RETRIEVAL: Queries /files, /documents, and /orders endpoints in parallel to match JobNimbus UI behavior. Automatically deduplicates across sources. Accepts job NUMBER (users only see numbers like "1820") or internal JNID - both work. File type filtering is client-side. To get ALL files, omit job_id/contact_id/related_to.',
            };
          }
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
