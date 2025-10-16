/**
 * Create File Type Tool - Create new file type (attachment category)
 * Based on official JobNimbus API documentation
 *
 * Endpoint: POST /api1/account/filetype
 *
 * Note: The token used must have an access profile level with access to the account settings page.
 * If file type already exists, the API will return the existing file type.
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface CreateFileTypeInput {
  TypeName: string;
  IsActive?: boolean;
}

export class CreateFileTypeTool extends BaseTool<CreateFileTypeInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'create_file_type',
      description: 'Account: create file type, attachment categories, document classification',
      inputSchema: {
        type: 'object',
        properties: {
          TypeName: {
            type: 'string',
            description: 'File type name (attachment category) - Required (e.g., "Document", "Photo", "Invoice")',
          },
          IsActive: {
            type: 'boolean',
            description: 'Whether file type is active (default: true)',
          },
        },
        required: ['TypeName'],
      },
    };
  }

  async execute(input: CreateFileTypeInput, context: ToolContext): Promise<any> {
    try {
      // Build request body
      const requestBody: any = {
        TypeName: input.TypeName,
        IsActive: input.IsActive ?? true,
      };

      // Call JobNimbus API
      const response = await this.client.post(
        context.apiKey,
        'account/filetype',
        requestBody
      );

      return {
        success: true,
        message: 'File type created successfully',
        data: response.data,
        summary: {
          file_type_id: response.data.FileTypeId,
          type_name: input.TypeName,
          is_active: response.data.IsActive,
        },
        _metadata: {
          api_endpoint: 'POST /api1/account/filetype',
          note: 'If file type already exists, returns existing type',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create file type',
        _metadata: {
          api_endpoint: 'POST /api1/account/filetype',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export default new CreateFileTypeTool();
