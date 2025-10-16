/**
 * Create Work Order Tool - Create new work order in JobNimbus
 * Based on official JobNimbus API documentation (WorkOrders.txt)
 *
 * Endpoint: POST /api1/v2/workorders
 *
 * Creates a new work order with specified details. Returns the created
 * work order with JNID and complete field information.
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface CreateWorkOrderInput {
  // Required fields
  location_id: number;

  // Optional fields
  name?: string;
  description?: string;
  number?: string;
  external_id?: string | null;
  status?: number;
  status_name?: string;
  owners?: Array<{ id: string }>;
  related?: Array<{ id: string; name?: string; number?: string; type?: string }>;
  sales_rep?: string;
  total?: number;
  is_active?: boolean;
  is_archived?: boolean;
}

export class CreateWorkOrderTool extends BaseTool<CreateWorkOrderInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'create_work_order',
      description: 'WorkOrders: create, location_id required, status/owners/related',
      inputSchema: {
        type: 'object',
        properties: {
          location_id: {
            type: 'number',
            description: 'Location ID (typically 1 for primary location) - Required',
          },
          name: {
            type: 'string',
            description: 'Work order name/title',
          },
          description: {
            type: 'string',
            description: 'Work order description',
          },
          number: {
            type: 'string',
            description: 'Work order number (auto-generated if not provided)',
          },
          external_id: {
            type: 'string',
            description: 'External system ID for integration',
          },
          status: {
            type: 'number',
            description: 'Status code',
          },
          status_name: {
            type: 'string',
            description: 'Status name (e.g., Draft, In Progress, Completed)',
          },
          owners: {
            type: 'array',
            description: 'Array of owner objects with id property (user JNIDs)',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'User JNID' },
              },
              required: ['id'],
            },
          },
          related: {
            type: 'array',
            description: 'Array of related entities (jobs, contacts, etc.)',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Entity JNID' },
                name: { type: 'string', description: 'Entity name' },
                number: { type: 'string', description: 'Entity number' },
                type: { type: 'string', description: 'Entity type (job, contact, etc.)' },
              },
              required: ['id'],
            },
          },
          sales_rep: {
            type: 'string',
            description: 'Sales representative user JNID',
          },
          total: {
            type: 'number',
            description: 'Total amount for the work order',
          },
          is_active: {
            type: 'boolean',
            description: 'Whether the work order is active (default: true)',
          },
          is_archived: {
            type: 'boolean',
            description: 'Whether the work order is archived (default: false)',
          },
        },
        required: ['location_id'],
      },
    };
  }

  async execute(input: CreateWorkOrderInput, context: ToolContext): Promise<any> {
    try {
      // Build request body
      const requestBody: any = {
        // Required fields
        location: {
          id: input.location_id,
        },

        // Optional fields with defaults
        is_active: input.is_active ?? true,
        is_archived: input.is_archived ?? false,
        name: input.name || null,
        description: input.description || null,
        number: input.number || null,
        external_id: input.external_id || null,
      };

      // Add optional fields if provided
      if (input.owners) {
        requestBody.owners = input.owners;
      }

      if (input.related) {
        requestBody.related = input.related;
      }

      if (input.sales_rep) {
        requestBody.sales_rep = input.sales_rep;
      }

      if (input.status !== undefined) {
        requestBody.status = input.status;
      }

      if (input.status_name) {
        requestBody.status_name = input.status_name;
      }

      if (input.total !== undefined) {
        requestBody.total = input.total;
      }

      // Call JobNimbus API v2
      const response = await this.client.post(
        context.apiKey,
        'v2/workorders',
        requestBody
      );

      return {
        success: true,
        message: 'Work order created successfully',
        data: response.data,
        summary: {
          jnid: response.data.jnid,
          name: response.data.name || 'Unnamed Work Order',
          number: response.data.number || 'Auto-generated',
          status: response.data.status_name || 'Draft',
          total: response.data.total || 0,
          owners_count: response.data.owners?.length || 0,
          related_count: response.data.related?.length || 0,
        },
        _metadata: {
          api_endpoint: 'POST /api1/v2/workorders',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create work order',
        _metadata: {
          api_endpoint: 'POST /api1/v2/workorders',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export default new CreateWorkOrderTool();
