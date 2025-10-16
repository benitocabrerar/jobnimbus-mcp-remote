/**
 * Create Status Tool - Create new status within a workflow
 * Based on official JobNimbus API documentation
 *
 * Endpoint: POST /api1/account/workflow/<workflowid>/status
 *
 * Note: The token used must have an access profile level with access to the account settings page.
 * If status already exists, the API will return the existing status.
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface CreateStatusInput {
  workflow_id: number;
  name: string;
  is_lead?: boolean;
  is_closed?: boolean;
  is_archived?: boolean;
  send_to_quickbooks?: boolean;
  force_mobile_sync?: boolean;
  is_active?: boolean;
}

export class CreateStatusTool extends BaseTool<CreateStatusInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'create_status',
      description: 'Account: create workflow status, lead/closed flags, QuickBooks sync',
      inputSchema: {
        type: 'object',
        properties: {
          workflow_id: {
            type: 'number',
            description: 'Workflow ID where status will be created - Required',
          },
          name: {
            type: 'string',
            description: 'Status name - Required (e.g., "Lead", "Closed", "In Progress")',
          },
          is_lead: {
            type: 'boolean',
            description: 'Whether this is a lead status (default: false)',
          },
          is_closed: {
            type: 'boolean',
            description: 'Whether this is a closed status (default: false)',
          },
          is_archived: {
            type: 'boolean',
            description: 'Whether this status is archived (default: false)',
          },
          send_to_quickbooks: {
            type: 'boolean',
            description: 'Whether to send to QuickBooks (default: false)',
          },
          force_mobile_sync: {
            type: 'boolean',
            description: 'Whether to force mobile sync (default: false)',
          },
          is_active: {
            type: 'boolean',
            description: 'Whether status is active (default: true)',
          },
        },
        required: ['workflow_id', 'name'],
      },
    };
  }

  async execute(input: CreateStatusInput, context: ToolContext): Promise<any> {
    try {
      // Build request body
      const requestBody: any = {
        name: input.name,
        is_lead: input.is_lead ?? false,
        is_closed: input.is_closed ?? false,
        is_archived: input.is_archived ?? false,
        send_to_quickbooks: input.send_to_quickbooks ?? false,
        force_mobile_sync: input.force_mobile_sync ?? false,
        is_active: input.is_active ?? true,
      };

      // Call JobNimbus API
      const response = await this.client.post(
        context.apiKey,
        `account/workflow/${input.workflow_id}/status`,
        requestBody
      );

      return {
        success: true,
        message: 'Status created successfully',
        data: response.data,
        summary: {
          id: response.data.id,
          name: input.name,
          workflow_id: input.workflow_id,
          is_active: response.data.is_active,
          is_lead: response.data.is_lead,
          is_closed: response.data.is_closed,
        },
        _metadata: {
          api_endpoint: `POST /api1/account/workflow/${input.workflow_id}/status`,
          note: 'If status already exists, returns existing status',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create status',
        _metadata: {
          api_endpoint: `POST /api1/account/workflow/<workflowid>/status`,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export default new CreateStatusTool();
