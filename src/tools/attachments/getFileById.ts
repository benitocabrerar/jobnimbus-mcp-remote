/**
 * Get File By ID Tool
 * Retrieve file metadata from JobNimbus by searching the /files list endpoint
 *
 * IMPLEMENTATION NOTE: The GET /files/<jnid> endpoint returns a redirect to download
 * the file, not JSON metadata. To get file metadata, we query the /files list endpoint
 * and filter client-side for the specific JNID.
 *
 * Response structure: Single file object with complete metadata
 *
 * Integrated with Redis cache system for performance optimization
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetFileByIdInput {
  jnid: string;
}

export class GetFileByIdTool extends BaseTool<GetFileByIdInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_file_by_id',
      description: 'Retrieve a specific file attachment metadata from JobNimbus by its JNID. Queries the /files list endpoint and filters for the specific file. Returns complete file metadata including filename, content type, size, related entities, creator info, and timestamps. Note: GET /files/<jnid> returns a download redirect, not metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          jnid: {
            type: 'string',
            description: 'Required: File JNID (JobNimbus unique identifier for the file)',
          },
        },
        required: ['jnid'],
      },
    };
  }

  async execute(input: GetFileByIdInput, context: ToolContext): Promise<any> {
    // Wrap with cache layer (Redis cache integration)
    return await withCache(
      {
        entity: CACHE_PREFIXES.ATTACHMENTS,
        operation: CACHE_PREFIXES.DETAIL,
        identifier: input.jnid,
      },
      getTTL('ATTACHMENTS_DETAIL'),
      async () => {
        try {
          // Query /files list endpoint
          // NOTE: GET /files/<jnid> returns a redirect for downloading, not metadata
          // We need to query the list endpoint and filter for the specific JNID
          const response = await this.client.get(context.apiKey, 'files', {
            size: 100, // Fetch a reasonable batch size
          });

          // Extract files from response
          const allFiles: any[] = response.data?.files || response.data || [];

          if (!Array.isArray(allFiles)) {
            return {
              error: 'Invalid response from /files endpoint',
              status: 'error',
              jnid: input.jnid,
              note: 'Expected array of files from API',
            };
          }

          // Find the file with matching JNID
          const file = allFiles.find((f) => f.jnid === input.jnid);

          if (!file) {
            // File not found in first batch, try fetching more
            // This is a simplified approach; in production you might want pagination
            return {
              error: 'File not found',
              status: 'not_found',
              jnid: input.jnid,
              note: `No file found with JNID ${input.jnid}. Searched ${allFiles.length} most recent files. For older files, use get_attachments with filtering.`,
            };
          }

          // Calculate file size in MB
          const sizeMB = file.size ? (file.size / (1024 * 1024)).toFixed(2) : '0.00';

          // Extract file extension
          const fileExtension = file.filename?.split('.').pop()?.toLowerCase() || 'unknown';

          return {
            status: 'success',
            file: {
              jnid: file.jnid,
              filename: file.filename,
              content_type: file.content_type,
              file_extension: fileExtension,
              size_bytes: file.size,
              size_mb: sizeMB,
              date_created: file.date_created,
              date_updated: file.date_updated,
              is_active: file.is_active,
              is_archived: file.is_archived,
              is_private: file.is_private,
              created_by: file.created_by,
              created_by_name: file.created_by_name,
              customer: file.customer,
              sales_rep: file.sales_rep,
              owners: file.owners,
              primary: file.primary,
              related: file.related,
              record_type: file.record_type,
              record_type_name: file.record_type_name,
              type: file.type,
            },
            _note: 'Retrieved from /files list endpoint (GET /files/<jnid> returns download redirect, not metadata)',
          };
        } catch (error: any) {
          return {
            error: error instanceof Error ? error.message : 'Failed to fetch file',
            status: 'error',
            jnid: input.jnid,
            note: 'Error querying /files list endpoint',
          };
        }
      }
    );
  }
}
