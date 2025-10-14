/**
 * Update Estimate Tool - Update existing estimate in JobNimbus
 * Based on official JobNimbus API documentation
 *
 * Endpoint: PUT /api1/v2/estimates/<jnid>
 *
 * CRITICAL: JobNimbus API v2 requires jnid in request body (not just URL path)
 * This was discovered during MaterialOrders implementation testing.
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface EstimateItemInput {
  jnid: string;
  name: string;
  description?: string;
  uom: string;
  item_type: string;
  quantity: number;
  price: number;
  cost?: number;
  category?: string;
  sku?: string;
  color?: string | null;
  photos?: any[];
  tax_rate?: number;
  tax_name?: string;
}

interface UpdateEstimateInput {
  // Required field
  jnid: string;

  // Optional update fields
  type?: 'estimate';
  items?: EstimateItemInput[];
  date_estimate?: number;
  date_created?: number;
  date_updated?: number;
  external_id?: string | null;
  number?: string;
  internal_note?: string | null;
  note?: string | null;
  terms?: string | null;
  location_id?: number;
  owners?: Array<{ id: string }>;
  related?: Array<{ id: string; type?: string; name?: string; number?: string }>;
  sales_rep?: string;
  sections?: any[];
  template_id?: string;
  status?: number;
  status_name?: string;
  is_active?: boolean;
  is_archived?: boolean;
  esigned?: boolean;
  subtotal?: number;
  tax?: number;
  total?: number;
  cost?: number;
  margin?: number;
}

export class UpdateEstimateTool extends BaseTool<UpdateEstimateInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'update_estimate',
      description: 'Update an existing estimate in JobNimbus by JNID. Can update items, status, dates, notes, terms, owners, related entities, financial totals, and any other estimate properties. Only include fields you want to update. Returns the updated estimate.',
      inputSchema: {
        type: 'object',
        properties: {
          jnid: {
            type: 'string',
            description: 'Estimate JNID to update - Required',
          },
          type: {
            type: 'string',
            description: 'Type must be "estimate" if provided',
            enum: ['estimate'],
          },
          items: {
            type: 'array',
            description: 'Array of estimate items (replaces existing items)',
            items: {
              type: 'object',
              properties: {
                jnid: { type: 'string', description: 'Product/Service JNID' },
                name: { type: 'string', description: 'Item name' },
                description: { type: 'string', description: 'Item description' },
                uom: { type: 'string', description: 'Unit of measure' },
                item_type: { type: 'string', description: 'Item type (material, labor, etc.)' },
                quantity: { type: 'number', description: 'Quantity' },
                price: { type: 'number', description: 'Unit price' },
                cost: { type: 'number', description: 'Unit cost' },
                category: { type: 'string', description: 'Item category' },
                sku: { type: 'string', description: 'Item SKU' },
                color: { type: 'string', description: 'Item color' },
                photos: { type: 'array', description: 'Array of photo URLs or IDs' },
                tax_rate: { type: 'number', description: 'Tax rate' },
                tax_name: { type: 'string', description: 'Tax name' },
              },
            },
          },
          date_estimate: {
            type: 'number',
            description: 'Unix timestamp of estimate date',
          },
          date_created: {
            type: 'number',
            description: 'Unix timestamp of creation date',
          },
          date_updated: {
            type: 'number',
            description: 'Unix timestamp of last update',
          },
          external_id: {
            type: 'string',
            description: 'External system ID for integration',
          },
          number: {
            type: 'string',
            description: 'Estimate number',
          },
          internal_note: {
            type: 'string',
            description: 'Internal note (not visible to customer)',
          },
          note: {
            type: 'string',
            description: 'Customer-visible note',
          },
          terms: {
            type: 'string',
            description: 'Terms and conditions',
          },
          location_id: {
            type: 'number',
            description: 'Location ID',
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
          },
          template_id: {
            type: 'string',
            description: 'Template ID',
          },
          status: {
            type: 'number',
            description: 'Status code',
          },
          status_name: {
            type: 'string',
            description: 'Status name (Draft, Approved, Sent, etc.)',
          },
          is_active: {
            type: 'boolean',
            description: 'Whether the estimate is active',
          },
          is_archived: {
            type: 'boolean',
            description: 'Whether the estimate is archived',
          },
          esigned: {
            type: 'boolean',
            description: 'Whether the estimate is electronically signed',
          },
          subtotal: {
            type: 'number',
            description: 'Subtotal amount',
          },
          tax: {
            type: 'number',
            description: 'Tax amount',
          },
          total: {
            type: 'number',
            description: 'Total amount',
          },
          cost: {
            type: 'number',
            description: 'Total cost',
          },
          margin: {
            type: 'number',
            description: 'Profit margin',
          },
        },
        required: ['jnid'],
      },
    };
  }

  async execute(input: UpdateEstimateInput, context: ToolContext): Promise<any> {
    try {
      // Build update body with only provided fields
      // CRITICAL: Include jnid in body (JobNimbus API v2 requirement)
      const updateBody: any = {
        jnid: input.jnid,
      };

      // Add type if provided
      if (input.type !== undefined) {
        updateBody.type = input.type;
      }

      // Handle items update (calculate totals if items are provided)
      if (input.items) {
        const calculatedSubtotal = input.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const calculatedCost = input.items.reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0);

        updateBody.items = input.items.map(item => ({
          jnid: item.jnid,
          name: item.name,
          description: item.description || '',
          uom: item.uom,
          item_type: item.item_type,
          quantity: item.quantity,
          price: item.price,
          cost: item.cost || 0,
          amount: item.price * item.quantity,
          category: item.category || '',
          sku: item.sku || '',
          color: item.color || null,
          photos: item.photos || [],
          tax_rate: item.tax_rate || 0,
          tax_name: item.tax_name || null,
        }));

        // Update financial totals if not explicitly provided
        if (input.subtotal === undefined) {
          updateBody.subtotal = calculatedSubtotal;
        }
        if (input.cost === undefined) {
          updateBody.cost = calculatedCost;
        }
        if (input.total === undefined) {
          updateBody.total = calculatedSubtotal + (input.tax || 0);
        }
        if (input.margin === undefined) {
          updateBody.margin = (calculatedSubtotal + (input.tax || 0)) - calculatedCost;
        }
      }

      // Add dates if provided
      if (input.date_estimate !== undefined) {
        updateBody.date_estimate = input.date_estimate;
      }

      if (input.date_created !== undefined) {
        updateBody.date_created = input.date_created;
      }

      if (input.date_updated !== undefined) {
        updateBody.date_updated = input.date_updated;
      } else {
        // Always update date_updated
        updateBody.date_updated = Math.floor(Date.now() / 1000);
      }

      // Add location if provided
      if (input.location_id !== undefined) {
        updateBody.location = { id: input.location_id };
      }

      // Add all optional fields if provided
      if (input.external_id !== undefined) {
        updateBody.external_id = input.external_id;
      }

      if (input.number !== undefined) {
        updateBody.number = input.number;
      }

      if (input.internal_note !== undefined) {
        updateBody.internal_note = input.internal_note;
      }

      if (input.note !== undefined) {
        updateBody.note = input.note;
      }

      if (input.terms !== undefined) {
        updateBody.terms = input.terms;
      }

      if (input.template_id !== undefined) {
        updateBody.template_id = input.template_id;
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

      if (input.esigned !== undefined) {
        updateBody.esigned = input.esigned;
      }

      // Add financial fields if explicitly provided
      if (input.subtotal !== undefined) {
        updateBody.subtotal = input.subtotal;
      }

      if (input.tax !== undefined) {
        updateBody.tax = input.tax;
      }

      if (input.total !== undefined) {
        updateBody.total = input.total;
      }

      if (input.cost !== undefined) {
        updateBody.cost = input.cost;
      }

      if (input.margin !== undefined) {
        updateBody.margin = input.margin;
      }

      // Call JobNimbus API v2
      const response = await this.client.put(
        context.apiKey,
        `v2/estimates/${input.jnid}`,
        updateBody
      );

      // Build summary
      const summary: any = {
        jnid: input.jnid,
        updated_fields: Object.keys(updateBody),
      };

      if (input.items) {
        const calculatedSubtotal = input.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const calculatedCost = input.items.reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0);
        const calculatedTotal = calculatedSubtotal + (input.tax || 0);

        summary.items_count = input.items.length;
        summary.subtotal = calculatedSubtotal.toFixed(2);
        summary.total = calculatedTotal.toFixed(2);
        summary.cost = calculatedCost.toFixed(2);
        summary.profit = (calculatedTotal - calculatedCost).toFixed(2);
        summary.margin_percent = calculatedTotal > 0
          ? ((calculatedTotal - calculatedCost) / calculatedTotal * 100).toFixed(2) + '%'
          : '0%';
      }

      return {
        success: true,
        message: 'Estimate updated successfully',
        data: response.data,
        summary,
        _metadata: {
          api_endpoint: `PUT /api1/v2/estimates/${input.jnid}`,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update estimate',
        jnid: input.jnid,
        _metadata: {
          api_endpoint: `PUT /api1/v2/estimates/${input.jnid}`,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export default new UpdateEstimateTool();
