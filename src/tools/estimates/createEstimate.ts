/**
 * Create Estimate Tool - Create new estimate in JobNimbus
 * Based on official JobNimbus API documentation
 *
 * Endpoint: POST /api1/v2/estimates
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

interface CreateEstimateInput {
  // Required fields per API documentation
  type: 'estimate';
  is_active: boolean;
  status: number;
  related: Array<{ id: string; type: string }>;
  items: EstimateItemInput[];

  // Optional fields
  date_estimate?: number;
  date_created?: number;
  date_updated?: number;
  external_id?: string;
  number?: string;
  internal_note?: string;
  note?: string;
  terms?: string;
  location_id?: number;
  owners?: Array<{ id: string }>;
  sales_rep?: string;
  sections?: any[];
  template_id?: string;
  is_archived?: boolean;
  esigned?: boolean;
  subtotal?: number;
  tax?: number;
  total?: number;
  cost?: number;
  margin?: number;
}

export class CreateEstimateTool extends BaseTool<CreateEstimateInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'create_estimate',
      description: 'Create a new estimate in JobNimbus. REQUIRED: type="estimate", is_active (boolean), status (integer), related array with entities (jobs/contacts), and items array with estimate line items. Each item must include: jnid, name, uom, item_type, quantity, price. Optionally set dates, notes, terms, owners, sales_rep, location, and financial totals. Returns the created estimate with JNID.',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'Must be "estimate" - Required',
            enum: ['estimate'],
          },
          is_active: {
            type: 'boolean',
            description: 'Whether the estimate is active - Required',
          },
          status: {
            type: 'number',
            description: 'Status code (1 = Draft, etc.) - Required',
          },
          related: {
            type: 'array',
            description: 'Array of related entities (jobs, contacts) - Required. Must have at least one entry.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Entity JNID - Required' },
                type: { type: 'string', description: 'Entity type (job, contact) - Required' },
              },
              required: ['id', 'type'],
            },
          },
          items: {
            type: 'array',
            description: 'Array of estimate items - Required. Must have at least one item.',
            items: {
              type: 'object',
              properties: {
                jnid: { type: 'string', description: 'Product/Service JNID - Required' },
                name: { type: 'string', description: 'Item name - Required' },
                description: { type: 'string', description: 'Item description' },
                uom: { type: 'string', description: 'Unit of measure (Items, SF, LF, etc.) - Required' },
                item_type: { type: 'string', description: 'Item type (material, labor, etc.) - Required' },
                quantity: { type: 'number', description: 'Quantity - Required' },
                price: { type: 'number', description: 'Unit price - Required' },
                cost: { type: 'number', description: 'Unit cost (optional)' },
                category: { type: 'string', description: 'Item category' },
                sku: { type: 'string', description: 'Item SKU' },
                color: { type: 'string', description: 'Item color' },
                photos: { type: 'array', description: 'Array of photo URLs or IDs' },
                tax_rate: { type: 'number', description: 'Tax rate' },
                tax_name: { type: 'string', description: 'Tax name' },
              },
              required: ['jnid', 'name', 'uom', 'item_type', 'quantity', 'price'],
            },
          },
          date_estimate: {
            type: 'number',
            description: 'Unix timestamp of estimate date',
          },
          date_created: {
            type: 'number',
            description: 'Unix timestamp of creation date (defaults to current time)',
          },
          date_updated: {
            type: 'number',
            description: 'Unix timestamp of last update (defaults to current time)',
          },
          external_id: {
            type: 'string',
            description: 'External system ID for integration',
          },
          number: {
            type: 'string',
            description: 'Estimate number (auto-generated if not provided)',
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
            description: 'Location ID (typically 1 for primary location)',
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
          sales_rep: {
            type: 'string',
            description: 'Sales representative user JNID',
          },
          sections: {
            type: 'array',
            description: 'Array of sections (for organization)',
          },
          template_id: {
            type: 'string',
            description: 'Template ID to use for estimate',
          },
          is_archived: {
            type: 'boolean',
            description: 'Whether the estimate is archived (default: false)',
          },
          esigned: {
            type: 'boolean',
            description: 'Whether the estimate is electronically signed (default: false)',
          },
          subtotal: {
            type: 'number',
            description: 'Subtotal amount (calculated if not provided)',
          },
          tax: {
            type: 'number',
            description: 'Tax amount',
          },
          total: {
            type: 'number',
            description: 'Total amount (calculated if not provided)',
          },
          cost: {
            type: 'number',
            description: 'Total cost (calculated if not provided)',
          },
          margin: {
            type: 'number',
            description: 'Profit margin (calculated if not provided)',
          },
        },
        required: ['type', 'is_active', 'status', 'related', 'items'],
      },
    };
  }

  async execute(input: CreateEstimateInput, context: ToolContext): Promise<any> {
    try {
      // Calculate totals from items if not provided
      const calculatedSubtotal = input.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const calculatedCost = input.items.reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0);
      const calculatedTax = input.tax || 0;
      const calculatedTotal = (input.total !== undefined) ? input.total : (calculatedSubtotal + calculatedTax);
      const calculatedMargin = (input.margin !== undefined) ? input.margin : (calculatedTotal - calculatedCost);

      // Build request body
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const requestBody: any = {
        // Required fields
        type: 'estimate',
        is_active: input.is_active,
        status: input.status,
        related: input.related,
        items: input.items.map(item => ({
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
        })),

        // Dates
        date_created: input.date_created || currentTimestamp,
        date_updated: input.date_updated || currentTimestamp,
        date_estimate: input.date_estimate || currentTimestamp,

        // Financial totals (use provided or calculated)
        subtotal: input.subtotal !== undefined ? input.subtotal : calculatedSubtotal,
        tax: input.tax !== undefined ? input.tax : calculatedTax,
        total: input.total !== undefined ? input.total : calculatedTotal,
        cost: input.cost !== undefined ? input.cost : calculatedCost,
        margin: input.margin !== undefined ? input.margin : calculatedMargin,

        // Optional fields with defaults
        is_archived: input.is_archived ?? false,
        esigned: input.esigned ?? false,
        external_id: input.external_id || null,
        number: input.number || null,
        internal_note: input.internal_note || null,
        note: input.note || null,
        terms: input.terms || null,
        template_id: input.template_id || null,
        sections: input.sections || [],
      };

      // Add location if provided
      if (input.location_id !== undefined) {
        requestBody.location = { id: input.location_id };
      }

      // Add optional fields if provided
      if (input.owners) {
        requestBody.owners = input.owners;
      }

      if (input.sales_rep) {
        requestBody.sales_rep = input.sales_rep;
      }

      // Call JobNimbus API v2
      const response = await this.client.post(
        context.apiKey,
        'v2/estimates',
        requestBody
      );

      return {
        success: true,
        message: 'Estimate created successfully',
        data: response.data,
        summary: {
          jnid: response.data.jnid,
          number: response.data.number,
          items_count: input.items.length,
          subtotal: calculatedSubtotal.toFixed(2),
          tax: calculatedTax.toFixed(2),
          total: calculatedTotal.toFixed(2),
          cost: calculatedCost.toFixed(2),
          profit: (calculatedTotal - calculatedCost).toFixed(2),
          margin_percent: calculatedTotal > 0
            ? ((calculatedTotal - calculatedCost) / calculatedTotal * 100).toFixed(2) + '%'
            : '0%',
          status: response.data.status_name || 'Created',
        },
        _metadata: {
          api_endpoint: 'POST /api1/v2/estimates',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create estimate',
        _metadata: {
          api_endpoint: 'POST /api1/v2/estimates',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export default new CreateEstimateTool();
