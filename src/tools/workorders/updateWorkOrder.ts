/**
 * Update Work Order Tool - Update existing work order in JobNimbus
 * Based on official JobNimbus API documentation (WorkOrders.txt)
 *
 * Endpoint: PUT /api1/v2/workorders/{id}
 *
 * Updates an existing work order. Only provided fields will be updated,
 * others remain unchanged. Returns the updated work order.
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface UpdateWorkOrderInput {
  // Required field
  jnid: string;

  // Optional fields to update
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
  location_id?: number;
}

export class UpdateWorkOrderTool extends BaseTool<UpdateWorkOrderInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'update_work_order',
      description: 'WorkOrders: update by JNID, status/owners/related, partial updates',
      inputSchema: {
        type: 'object',
        properties: {
          jnid: {
            type: 'string',
            description: 'Work Order JNID to update (required)',
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
            description: 'Work order number',
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
          location_id: {
            type: 'number',
            description: 'Location ID',
          },
          is_active: {
            type: 'boolean',
            description: 'Whether the work order is active',
          },
          is_archived: {
            type: 'boolean',
            description: 'Whether the work order is archived',
          },
        },
        required: ['jnid'],
      },
    };
  }

  async execute(input: UpdateWorkOrderInput, context: ToolContext): Promise<any> {
    const { jnid, ...updateFields } = input;

    if (!jnid) {
      return {
        success: false,
        error: 'Missing required parameter: jnid',
        _metadata: {
          api_endpoint: 'PUT /api1/v2/workorders/{id}',
          timestamp: new Date().toISOString(),
        },
      };
    }

    try {
      // Build update body with jnid (required by JobNimbus API)
      const updateBody: any = {
        jnid: jnid,  // Required by JobNimbus API
      };

      // Add provided fields to update
      if (updateFields.name !== undefined) {
        updateBody.name = updateFields.name;
      }

      if (updateFields.description !== undefined) {
        updateBody.description = updateFields.description;
      }

      if (updateFields.number !== undefined) {
        updateBody.number = updateFields.number;
      }

      if (updateFields.external_id !== undefined) {
        updateBody.external_id = updateFields.external_id;
      }

      if (updateFields.status !== undefined) {
        updateBody.status = updateFields.status;
      }

      if (updateFields.status_name !== undefined) {
        updateBody.status_name = updateFields.status_name;
      }

      if (updateFields.owners !== undefined) {
        updateBody.owners = updateFields.owners;
      }

      if (updateFields.related !== undefined) {
        updateBody.related = updateFields.related;
      }

      if (updateFields.sales_rep !== undefined) {
        updateBody.sales_rep = updateFields.sales_rep;
      }

      if (updateFields.total !== undefined) {
        updateBody.total = updateFields.total;
      }

      if (updateFields.location_id !== undefined) {
        updateBody.location = { id: updateFields.location_id };
      }

      if (updateFields.is_active !== undefined) {
        updateBody.is_active = updateFields.is_active;
      }

      if (updateFields.is_archived !== undefined) {
        updateBody.is_archived = updateFields.is_archived;
      }

      // Call JobNimbus API v2
      const response = await this.client.put(
        context.apiKey,
        `v2/workorders/${jnid}`,
        updateBody
      );

      // Build summary of changed fields
      const changedFields = Object.keys(updateFields).filter(
        key => updateFields[key as keyof typeof updateFields] !== undefined
      );

      return {
        success: true,
        message: 'Work order updated successfully',
        data: response.data,
        summary: {
          jnid: response.data.jnid,
          name: response.data.name || 'Unnamed Work Order',
          status: response.data.status_name || 'Unknown',
          updated_fields: changedFields,
          updated_fields_count: changedFields.length,
        },
        _metadata: {
          api_endpoint: `PUT /api1/v2/workorders/${jnid}`,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update work order',
        jnid: jnid,
        _metadata: {
          api_endpoint: `PUT /api1/v2/workorders/${jnid}`,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export default new UpdateWorkOrderTool();
