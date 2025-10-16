/**
 * Create Activity Type Tool - Create new activity type
 * Based on official JobNimbus API documentation
 *
 * Endpoint: POST /api1/account/activitytype
 *
 * Note: The token used must have an access profile level with access to the account settings page.
 * If activity type already exists, the API will return the existing activity type.
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface CreateActivityTypeInput {
  TypeName: string;
  IsActive?: boolean;
  ShowInJobShare?: boolean;
}

export class CreateActivityTypeTool extends BaseTool<CreateActivityTypeInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'create_activity_type',
      description: 'Account: create activity type, note/call/meeting/email, JobShare',
      inputSchema: {
        type: 'object',
        properties: {
          TypeName: {
            type: 'string',
            description: 'Activity type name - Required (e.g., "Note", "Call", "Meeting", "Email")',
          },
          IsActive: {
            type: 'boolean',
            description: 'Whether activity type is active (default: true)',
          },
          ShowInJobShare: {
            type: 'boolean',
            description: 'Whether to show in JobShare (default: false)',
          },
        },
        required: ['TypeName'],
      },
    };
  }

  async execute(input: CreateActivityTypeInput, context: ToolContext): Promise<any> {
    try {
      // Build request body
      const requestBody: any = {
        TypeName: input.TypeName,
        IsActive: input.IsActive ?? true,
        ShowInJobShare: input.ShowInJobShare ?? false,
      };

      // Call JobNimbus API
      const response = await this.client.post(
        context.apiKey,
        'account/activitytype',
        requestBody
      );

      return {
        success: true,
        message: 'Activity type created successfully',
        data: response.data,
        summary: {
          activity_type_id: response.data.ActivityTypeId,
          type_name: input.TypeName,
          is_active: response.data.IsActive,
          show_in_jobshare: response.data.ShowInJobShare,
        },
        _metadata: {
          api_endpoint: 'POST /api1/account/activitytype',
          note: 'If activity type already exists, returns existing type',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create activity type',
        _metadata: {
          api_endpoint: 'POST /api1/account/activitytype',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export default new CreateActivityTypeTool();
