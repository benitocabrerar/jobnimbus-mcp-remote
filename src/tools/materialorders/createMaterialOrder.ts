/**
 * Create Material Order Tool - Create new material order in JobNimbus
 * Based on official JobNimbus API documentation
 *
 * Endpoint: POST /api1/v2/materialorders
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

interface CreateMaterialOrderInput {
  // Required fields
  items: MaterialOrderItemInput[];
  location_id: number;

  // Optional fields
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

export class CreateMaterialOrderTool extends BaseTool<CreateMaterialOrderInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'create_material_order',
      description: 'Create a new material order in JobNimbus. Requires items array with product details (jnid, name, uom, quantity, cost, price) and location_id. Optionally set owners, related entities (jobs/contacts), sales_rep, notes, and status. Returns the created material order with JNID.',
      inputSchema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            description: 'Array of material order items (products) - Required. Each item must include: jnid, name, uom, quantity, cost, price',
            items: {
              type: 'object',
              properties: {
                jnid: { type: 'string', description: 'Product JNID - Required' },
                name: { type: 'string', description: 'Product name - Required' },
                description: { type: 'string', description: 'Product description' },
                category: { type: 'string', description: 'Product category' },
                sku: { type: 'string', description: 'Product SKU' },
                uom: { type: 'string', description: 'Unit of measure (e.g., CTN, PC, LF) - Required' },
                quantity: { type: 'number', description: 'Quantity - Required' },
                cost: { type: 'number', description: 'Unit cost - Required' },
                price: { type: 'number', description: 'Unit price - Required' },
                color: { type: 'string', description: 'Product color' },
                photos: { type: 'array', description: 'Array of photo URLs or IDs' },
              },
              required: ['jnid', 'name', 'uom', 'quantity', 'cost', 'price'],
            },
          },
          location_id: {
            type: 'number',
            description: 'Location ID (typically 1 for primary location) - Required',
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
            description: 'Whether the order is electronically signed (default: false)',
          },
          owners: {
            type: 'array',
            description: 'Array of owner objects with id property',
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
          sections: {
            type: 'array',
            description: 'Array of sections (for organization)',
          },
          status: {
            type: 'number',
            description: 'Status code (0 = Draft, etc.)',
          },
          status_name: {
            type: 'string',
            description: 'Status name (Draft, Approved, etc.)',
          },
          is_active: {
            type: 'boolean',
            description: 'Whether the order is active (default: true)',
          },
          is_archived: {
            type: 'boolean',
            description: 'Whether the order is archived (default: false)',
          },
        },
        required: ['items', 'location_id'],
      },
    };
  }

  async execute(input: CreateMaterialOrderInput, context: ToolContext): Promise<any> {
    try {
      // Calculate totals from items
      const totalCost = input.items.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
      const totalPrice = input.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Build request body
      const requestBody: any = {
        // Required fields
        items: input.items.map(item => ({
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
        })),
        location: {
          id: input.location_id,
        },

        // Calculated totals
        total_line_item_cost: totalCost,
        total_line_item_price: totalPrice,

        // Optional fields with defaults
        is_active: input.is_active ?? true,
        is_archived: input.is_archived ?? false,
        esigned: input.esigned ?? false,
        customer_note: input.customer_note || null,
        internal_note: input.internal_note || null,
        external_id: input.external_id || null,
        merged: null,
        sections: input.sections || [],
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

      // Call JobNimbus API v2
      const response = await this.client.post(
        context.apiKey,
        'v2/materialorders',
        requestBody
      );

      return {
        success: true,
        message: 'Material order created successfully',
        data: response.data,
        summary: {
          jnid: response.data.jnid,
          items_count: input.items.length,
          total_cost: totalCost.toFixed(2),
          total_price: totalPrice.toFixed(2),
          profit: (totalPrice - totalCost).toFixed(2),
          margin: totalPrice > 0
            ? ((totalPrice - totalCost) / totalPrice * 100).toFixed(2) + '%'
            : '0%',
          status: response.data.status_name || 'Draft',
        },
        _metadata: {
          api_endpoint: 'POST /api1/v2/materialorders',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create material order',
        _metadata: {
          api_endpoint: 'POST /api1/v2/materialorders',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export default new CreateMaterialOrderTool();
