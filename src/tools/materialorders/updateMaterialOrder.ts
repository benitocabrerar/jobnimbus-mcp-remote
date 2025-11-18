/**
 * Update Material Order Tool - Update existing material order in JobNimbus
 * Based on official JobNimbus API documentation
 *
 * Endpoint: PUT /api1/v2/materialorders/<jnid>
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface MaterialOrderItemInput {
  jnid: string;
  name: string;
  description?: string;
  category?: string;
  sku?: string;
  uom: string;
  quantity: number;
  cost: number;
  price: number;
  color?: string | null;
  photos?: any[];
}

interface UpdateMaterialOrderInput {
  // Required field
  jnid: string;

  // Optional update fields
  items?: MaterialOrderItemInput[];
  location_id?: number;
  customer_note?: string | null;
  internal_note?: string | null;
  external_id?: string | null;
  esigned?: boolean;
  owners?: Array<{ id: string }>;
  related?: Array<{ id: string; name?: string; number?: string; type?: string }>;
  sales_rep?: string;
  sections?: any[];
  status?: number;
  status_name?: string;
  is_active?: boolean;
  is_archived?: boolean;
}

export class UpdateMaterialOrderTool extends BaseTool<UpdateMaterialOrderInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'update_material_order',
      description: 'MaterialOrders: update by JNID, items/pricing, status/notes, owners/related',
      inputSchema: {
        type: 'object',
        properties: {
          jnid: {
            type: 'string',
            description: 'Material Order JNID to update - Required',
          },
          items: {
            type: 'array',
            description: 'Array of material order items (replaces existing items)',
            items: {
              type: 'object',
              properties: {
                jnid: { type: 'string', description: 'Product JNID' },
                name: { type: 'string', description: 'Product name' },
                description: { type: 'string', description: 'Product description' },
                category: { type: 'string', description: 'Product category' },
                sku: { type: 'string', description: 'Product SKU' },
                uom: { type: 'string', description: 'Unit of measure' },
                quantity: { type: 'number', description: 'Quantity' },
                cost: { type: 'number', description: 'Unit cost' },
                price: { type: 'number', description: 'Unit price' },
                color: { type: 'string', description: 'Product color' },
                photos: { type: 'array', description: 'Array of photo URLs or IDs', items: { type: 'string' } },
              },
            },
          },
          location_id: {
            type: 'number',
            description: 'Location ID',
          },
          customer_note: {
            type: 'string',
            description: 'Note visible to customer',
          },
          internal_note: {
            type: 'string',
            description: 'Internal note (not visible to customer)',
          },
          external_id: {
            type: 'string',
            description: 'External system ID for integration',
          },
          esigned: {
            type: 'boolean',
            description: 'Whether the order is electronically signed',
          },
          owners: {
            type: 'array',
            description: 'Array of owner objects with id property',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'User JNID' },
              },
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
                type: { type: 'string', description: 'Entity type' },
              },
            },
          },
          sales_rep: {
            type: 'string',
            description: 'Sales representative user JNID',
          },
          sections: {
            type: 'array',
            description: 'Array of sections',
            items: { type: 'object' },
          },
          status: {
            type: 'number',
            description: 'Status code',
          },
          status_name: {
            type: 'string',
            description: 'Status name (Draft, Approved, Ordered, Received, etc.)',
          },
          is_active: {
            type: 'boolean',
            description: 'Whether the order is active',
          },
          is_archived: {
            type: 'boolean',
            description: 'Whether the order is archived',
          },
        },
        required: ['jnid'],
      },
    };
  }

  async execute(input: UpdateMaterialOrderInput, context: ToolContext): Promise<any> {
    try {
      // Build update body with only provided fields
      // IMPORTANT: Include jnid in body (JobNimbus API requirement)
      const updateBody: any = {
        jnid: input.jnid,
      };

      // Handle items update (calculate totals if items are provided)
      if (input.items) {
        const totalCost = input.items.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
        const totalPrice = input.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        updateBody.items = input.items.map(item => ({
          jnid: item.jnid,
          name: item.name,
          description: item.description || '',
          category: item.category || '',
          sku: item.sku || '',
          uom: item.uom,
          quantity: item.quantity,
          cost: item.cost,
          price: item.price,
          color: item.color || null,
          photos: item.photos || [],
        }));

        updateBody.total_line_item_cost = totalCost;
        updateBody.total_line_item_price = totalPrice;
      }

      // Add location if provided
      if (input.location_id !== undefined) {
        updateBody.location = { id: input.location_id };
      }

      // Add all optional fields if provided
      if (input.customer_note !== undefined) {
        updateBody.customer_note = input.customer_note;
      }

      if (input.internal_note !== undefined) {
        updateBody.internal_note = input.internal_note;
      }

      if (input.external_id !== undefined) {
        updateBody.external_id = input.external_id;
      }

      if (input.esigned !== undefined) {
        updateBody.esigned = input.esigned;
      }

      if (input.owners !== undefined) {
        updateBody.owners = input.owners;
      }

      if (input.related !== undefined) {
        updateBody.related = input.related;
      }

      if (input.sales_rep !== undefined) {
        updateBody.sales_rep = input.sales_rep;
      }

      if (input.sections !== undefined) {
        updateBody.sections = input.sections;
      }

      if (input.status !== undefined) {
        updateBody.status = input.status;
      }

      if (input.status_name !== undefined) {
        updateBody.status_name = input.status_name;
      }

      if (input.is_active !== undefined) {
        updateBody.is_active = input.is_active;
      }

      if (input.is_archived !== undefined) {
        updateBody.is_archived = input.is_archived;
      }

      // Call JobNimbus API v2
      const response = await this.client.put(
        context.apiKey,
        `v2/materialorders/${input.jnid}`,
        updateBody
      );

      // Build summary
      const summary: any = {
        jnid: input.jnid,
        updated_fields: Object.keys(updateBody),
      };

      if (input.items) {
        const totalCost = input.items.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
        const totalPrice = input.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        summary.items_count = input.items.length;
        summary.total_cost = totalCost.toFixed(2);
        summary.total_price = totalPrice.toFixed(2);
        summary.profit = (totalPrice - totalCost).toFixed(2);
        summary.margin = totalPrice > 0
          ? ((totalPrice - totalCost) / totalPrice * 100).toFixed(2) + '%'
          : '0%';
      }

      return {
        success: true,
        message: 'Material order updated successfully',
        data: response.data,
        summary,
        _metadata: {
          api_endpoint: `PUT /api1/v2/materialorders/${input.jnid}`,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update material order',
        jnid: input.jnid,
        _metadata: {
          api_endpoint: `PUT /api1/v2/materialorders/${input.jnid}`,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export default new UpdateMaterialOrderTool();
