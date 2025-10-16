/**
 * Create Lead Source Tool - Create new lead source
 * Based on official JobNimbus API documentation
 *
 * Endpoint: POST /api1/account/leadsource
 *
 * Note: The token used must have an access profile level with access to the account settings page.
 * If lead source already exists, the API will return the existing lead source.
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface CreateLeadSourceInput {
  SourceName: string;
  IsActive?: boolean;
}

export class CreateLeadSourceTool extends BaseTool<CreateLeadSourceInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'create_lead_source',
      description: 'Account: create lead source, marketing attribution, Google/referral/social',
      inputSchema: {
        type: 'object',
        properties: {
          SourceName: {
            type: 'string',
            description: 'Lead source name - Required (e.g., "Google", "Referral", "Facebook Ads", "Door Knocking")',
          },
          IsActive: {
            type: 'boolean',
            description: 'Whether lead source is active (default: true)',
          },
        },
        required: ['SourceName'],
      },
    };
  }

  async execute(input: CreateLeadSourceInput, context: ToolContext): Promise<any> {
    try {
      // Build request body
      const requestBody: any = {
        SourceName: input.SourceName,
        IsActive: input.IsActive ?? true,
      };

      // Call JobNimbus API
      const response = await this.client.post(
        context.apiKey,
        'account/leadsource',
        requestBody
      );

      return {
        success: true,
        message: 'Lead source created successfully',
        data: response.data,
        summary: {
          source_name: input.SourceName,
          is_active: response.data.IsActive,
        },
        _metadata: {
          api_endpoint: 'POST /api1/account/leadsource',
          note: 'If lead source already exists, returns existing source',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create lead source',
        _metadata: {
          api_endpoint: 'POST /api1/account/leadsource',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export default new CreateLeadSourceTool();
