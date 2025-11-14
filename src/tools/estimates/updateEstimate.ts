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
      description: 'Update estimate',
      inputSchema: {
        type: 'object',
        properties: {
          jnid: {
            type: 'string',
            description: 'Estimate JNID',
          },
          type: {
            type: 'string',
            description: 'Type (must be "estimate")',
            enum: ['estimate'],
          },
          items: {
            type: 'array',
            description: 'Estimate items array',
            items: {
              type: 'object',
              properties: {
                jnid: { type: 'string', description: 'Product JNID' },
                name: { type: 'string', description: 'Name' },
                description: { type: 'string', description: 'Description' },
                uom: { type: 'string', description: 'Unit of measure' },
                item_type: { type: 'string', description: 'Item type' },
                quantity: { type: 'number', description: 'Quantity' },
                price: { type: 'number', description: 'Unit price' },
                cost: { type: 'number', description: 'Unit cost' },
                category: { type: 'string', description: 'Category' },
                sku: { type: 'string', description: 'SKU' },
                color: { type: 'string', description: 'Color' },
                photos: { type: 'array', description: 'Photos' },
                tax_rate: { type: 'number', description: 'Tax rate' },
                tax_name: { type: 'string', description: 'Tax name' },
              },
            },
          },
          date_estimate: {
            type: 'number',
            description: 'Estimate date (Unix)',
          },
          date_created: {
            type: 'number',
            description: 'Created date (Unix)',
          },
          date_updated: {
            type: 'number',
            description: 'Updated date (Unix)',
          },
          external_id: {
            type: 'string',
            description: 'External ID',
          },
          number: {
            type: 'string',
            description: 'Estimate number',
          },
          internal_note: {
            type: 'string',
            description: 'Internal note',
          },
          note: {
            type: 'string',
            description: 'Note',
          },
          terms: {
            type: 'string',
            description: 'Terms',
          },
          location_id: {
            type: 'number',
            description: 'Location ID',
          },
          owners: {
            type: 'array',
            description: 'Owners array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'JNID' },
              },
            },
          },
          related: {
            type: 'array',
            description: 'Related entities',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'JNID' },
                name: { type: 'string', description: 'Name' },
                number: { type: 'string', description: 'Number' },
                type: { type: 'string', description: 'Type' },
              },
            },
          },
          sales_rep: {
            type: 'string',
            description: 'Sales rep JNID',
          },
          sections: {
            type: 'array',
            description: 'Sections',
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
            description: 'Status name',
          },
          is_active: {
            type: 'boolean',
            description: 'Is active',
          },
          is_archived: {
            type: 'boolean',
            description: 'Is archived',
          },
          esigned: {
            type: 'boolean',
            description: 'E-signed',
          },
          subtotal: {
            type: 'number',
            description: 'Subtotal',
          },
          tax: {
            type: 'number',
            description: 'Tax',
          },
          total: {
            type: 'number',
            description: 'Total',
          },
          cost: {
            type: 'number',
            description: 'Cost',
          },
          margin: {
            type: 'number',
            description: 'Margin',
          },
        },
        required: ['jnid'],
      },
    };
  }

  async execute(input: UpdateEstimateInput, context: ToolContext): Promise<any> {
    // Check if using new handle-based parameters for response optimization
    const useHandleResponse = this.hasNewParams(input);

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

      const successData = {
        success: true,
        message: 'Estimate updated successfully',
        data: response.data,
        summary,
        _metadata: {
          api_endpoint: `PUT /api1/v2/estimates/${input.jnid}`,
          timestamp: new Date().toISOString(),
        },
      };

      // Use handle-based response if requested
      if (useHandleResponse) {
        const envelope = await this.wrapResponse([successData], input, context, {
          entity: 'estimate',
          maxRows: 1,
          pageInfo: {
            current_page: 1,
            total_pages: 1,
            has_more: false,
            total: 1,
          },
        });

        return {
          ...envelope,
          query_metadata: {
            operation: 'update',
            estimate_jnid: input.jnid,
            fields_updated: Object.keys(updateBody).length,
            updated_fields: Object.keys(updateBody),
            items_updated: !!input.items,
            items_count: input.items?.length || 0,
            data_freshness: 'real-time',
            api_endpoint: `PUT /api1/v2/estimates/${input.jnid}`,
          },
        };
      }

      // Fallback to legacy response
      return successData;
    } catch (error) {
      const errorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update estimate',
        jnid: input.jnid,
        _metadata: {
          api_endpoint: `PUT /api1/v2/estimates/${input.jnid}`,
          timestamp: new Date().toISOString(),
        },
      };

      // Use handle-based response if requested (even for errors)
      if (useHandleResponse) {
        const envelope = await this.wrapResponse([errorResponse], input, context, {
          entity: 'estimate',
          maxRows: 0,
          pageInfo: {
            current_page: 1,
            total_pages: 1,
            has_more: false,
            total: 0,
          },
        });

        return {
          ...envelope,
          query_metadata: {
            operation: 'update',
            estimate_jnid: input.jnid,
            error: true,
            error_message: error instanceof Error ? error.message : 'Failed to update estimate',
            data_freshness: 'real-time',
            api_endpoint: `PUT /api1/v2/estimates/${input.jnid}`,
          },
        };
      }

      // Fallback to legacy error response
      return errorResponse;
    }
  }
}

export default new UpdateEstimateTool();
