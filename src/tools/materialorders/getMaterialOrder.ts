/**
 * Get Material Order Tool - Get specific material order by JNID
 * Based on official JobNimbus API documentation
 *
 * Endpoint: GET /api1/v2/materialorders/<jnid>
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetMaterialOrderInput {
  jnid: string;
}

interface MaterialOrderItem {
  jnid: string;
  name: string;
  description: string;
  category: string;
  sku: string;
  uom: string;
  quantity: number;
  cost: number;
  price: number;
  color?: string | null;
  photos: any[];
}

interface MaterialOrderRelated {
  id: string;
  name: string;
  number: string;
  type: string;
}

interface MaterialOrderOwner {
  id: string;
}

interface MaterialOrderLocation {
  id: number;
}

/**
 * Complete MaterialOrder interface matching JobNimbus API v2
 * Based on official JobNimbus API documentation for GET /api1/v2/materialorders/<jnid>
 */
interface MaterialOrder {
  // Core identifiers
  jnid: string;
  type: string;
  customer: string;

  // Order information
  customer_note?: string | null;
  internal_note?: string | null;
  external_id?: string | null;

  // Status
  is_active: boolean;
  is_archived: boolean;
  esigned: boolean;
  status: number;
  status_name: string;

  // Items
  items: MaterialOrderItem[];

  // Location and ownership
  location: MaterialOrderLocation;
  owners: MaterialOrderOwner[];
  sales_rep: string;

  // Related entities
  related: MaterialOrderRelated[];

  // Sections and financials
  sections: any[];
  total_line_item_cost: number;
  total_line_item_price: number;
  merged: any | null;

  // Metadata
  created_by?: string;
  date_created?: number;
  date_updated?: number;

  // Allow additional fields from API
  [key: string]: any;
}

export class GetMaterialOrderTool extends BaseTool<GetMaterialOrderInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_material_order',
      description: 'MaterialOrders: retrieve by JNID, items/pricing, status, owners/related',
      inputSchema: {
        type: 'object',
        properties: {
          jnid: {
            type: 'string',
            description: 'Material Order JNID (unique identifier) - Required',
          },
        },
        required: ['jnid'],
      },
    };
  }

  /**
   * Format Unix timestamp to ISO 8601
   */
  private formatDate(timestamp: number): string | null {
    if (!timestamp || timestamp === 0) return null;
    return new Date(timestamp * 1000).toISOString();
  }

  async execute(input: GetMaterialOrderInput, context: ToolContext): Promise<any> {
    // Wrap with cache layer
    return await withCache(
      {
        entity: 'materialorders',
        operation: CACHE_PREFIXES.GET,
        identifier: input.jnid,
      },
      getTTL('MATERIAL_ORDER_DETAIL'),
      async () => {
        try {
          // Call JobNimbus API v2
          const response = await this.client.get(
            context.apiKey,
            `v2/materialorders/${input.jnid}`
          );

          const order: MaterialOrder = response.data;

          // Format response with all fields explicitly mapped
          return {
            success: true,
            data: {
              // Core identifiers
              jnid: order.jnid,
              type: order.type,
              customer: order.customer,

              // Order information
              customer_note: order.customer_note || null,
              internal_note: order.internal_note || null,
              external_id: order.external_id || null,

              // Status
              is_active: order.is_active ?? true,
              is_archived: order.is_archived ?? false,
              esigned: order.esigned ?? false,
              status: order.status,
              status_name: order.status_name,

              // Items with counts
              items: order.items || [],
              items_count: order.items?.length || 0,

              // Location and ownership
              location: order.location,
              location_id: order.location?.id,
              owners: order.owners || [],
              owners_count: order.owners?.length || 0,
              sales_rep: order.sales_rep,

              // Related entities
              related: order.related || [],
              related_count: order.related?.length || 0,

              // Sections and financials
              sections: order.sections || [],
              sections_count: order.sections?.length || 0,
              total_line_item_cost: order.total_line_item_cost || 0,
              total_line_item_price: order.total_line_item_price || 0,
              merged: order.merged || null,

              // Calculated profit margin
              profit_margin: order.total_line_item_price && order.total_line_item_cost
                ? ((order.total_line_item_price - order.total_line_item_cost) / order.total_line_item_price * 100).toFixed(2) + '%'
                : null,

              // Metadata
              created_by: order.created_by || null,
              date_created: this.formatDate(order.date_created || 0),
              date_created_unix: order.date_created,
              date_updated: this.formatDate(order.date_updated || 0),
              date_updated_unix: order.date_updated,

              _metadata: {
                api_endpoint: 'GET /api1/v2/materialorders/<jnid>',
                field_coverage: 'complete',
                cached: false,
                timestamp: new Date().toISOString(),
              },
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to retrieve material order',
            jnid: input.jnid,
            _metadata: {
              api_endpoint: 'GET /api1/v2/materialorders/<jnid>',
              timestamp: new Date().toISOString(),
            },
          };
        }
      }
    );
  }
}

export default new GetMaterialOrderTool();
