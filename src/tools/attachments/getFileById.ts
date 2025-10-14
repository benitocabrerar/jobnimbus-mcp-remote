/**
 * Get File By ID Tool
 * Retrieve a specific file attachment from JobNimbus by JNID
 *
 * VERIFIED WORKING - Uses official JobNimbus API endpoint
 * Based on official documentation: GET /files/<jnid>
 *
 * Response structure: Single file object with all metadata
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
      description: 'Retrieve a specific file attachment from JobNimbus by its JNID. Returns complete file metadata including filename, content type, size, related entities, creator info, and timestamps. Based on official JobNimbus API documentation: GET /files/<jnid>',
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
          // Query /files/<jnid> endpoint
          const response = await this.client.get(context.apiKey, `files/${input.jnid}`, {});

          const file = response.data;

          if (!file) {
            return {
              error: 'File not found',
              status: 'not_found',
              jnid: input.jnid,
              note: 'No file found with the specified JNID',
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
            _note: 'Retrieved from official /files/<jnid> endpoint',
          };
        } catch (error: any) {
          // Check if it's a 404 error
          if (error?.statusCode === 404 || error?.message?.includes('Not Found')) {
            return {
              error: 'File not found',
              status: 'not_found',
              jnid: input.jnid,
              note: 'The specified file JNID does not exist',
            };
          }

          return {
            error: error instanceof Error ? error.message : 'Failed to fetch file',
            status: 'error',
            jnid: input.jnid,
            note: 'Error querying /files/<jnid> endpoint',
          };
        }
      }
    );
  }
}
