/**
 * Create Workflow Tool - Create new workflow in JobNimbus account
 * Based on official JobNimbus API documentation
 *
 * Endpoint: POST /api1/account/workflow
 *
 * Note: The token used must have an access profile level with access to the account settings page.
 * If a workflow already exists, the API will return the existing workflow.
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface CreateWorkflowInput {
  name: string;
  object_type: 'contact' | 'job' | 'workorder';
  is_sub_contractor?: boolean;
  can_access_by_all?: boolean;
  is_vendor?: boolean;
  is_active?: boolean;
  is_supplier?: boolean;
}

export class CreateWorkflowTool extends BaseTool<CreateWorkflowInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'create_workflow',
      description: 'Account: create workflow, object types, sub-contractor/vendor flags',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Workflow name - Required',
          },
          object_type: {
            type: 'string',
            description: 'Workflow object type - Required (valid values: contact, job, workorder)',
            enum: ['contact', 'job', 'workorder'],
          },
          is_sub_contractor: {
            type: 'boolean',
            description: 'Whether this workflow is for sub-contractors (default: false)',
          },
          can_access_by_all: {
            type: 'boolean',
            description: 'Whether workflow can be accessed by all (default: false)',
          },
          is_vendor: {
            type: 'boolean',
            description: 'Whether this workflow is for vendors (default: false)',
          },
          is_active: {
            type: 'boolean',
            description: 'Whether workflow is active (default: true)',
          },
          is_supplier: {
            type: 'boolean',
            description: 'Whether this workflow is for suppliers (default: false)',
          },
        },
        required: ['name', 'object_type'],
      },
    };
  }

  async execute(input: CreateWorkflowInput, context: ToolContext): Promise<any> {
    try {
      // Build request body
      const requestBody: any = {
        name: input.name,
        object_type: input.object_type,
        is_sub_contractor: input.is_sub_contractor ?? false,
        can_access_by_all: input.can_access_by_all ?? false,
        is_vendor: input.is_vendor ?? false,
        is_active: input.is_active ?? true,
        is_supplier: input.is_supplier ?? false,
      };

      // Call JobNimbus API
      const response = await this.client.post(
        context.apiKey,
        'account/workflow',
        requestBody
      );

      return {
        success: true,
        message: 'Workflow created successfully',
        data: response.data,
        summary: {
          id: response.data.id,
          name: input.name,
          object_type: input.object_type,
          is_active: response.data.is_active,
          status_count: response.data.status?.length || 0,
        },
        _metadata: {
          api_endpoint: 'POST /api1/account/workflow',
          note: 'If workflow already exists, returns existing workflow',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create workflow',
        _metadata: {
          api_endpoint: 'POST /api1/account/workflow',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export default new CreateWorkflowTool();
