/**
 * Get Material Orders Tool - Retrieve all material orders from JobNimbus
 * Based on official JobNimbus API documentation
 *
 * Endpoint: GET /api1/v2/materialorders
 *
 * Response structure: API v2 returns {count, results} structure
 *
 * Integrated with Redis cache system for performance optimization
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetMaterialOrdersInput {
  from?: number;
  size?: number;
  include_full_details?: boolean;
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
 * Complete MaterialOrder interface matching JobNimbus API
 * Based on official JobNimbus API documentation for GET /api1/v2/materialorders
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

/**
 * Generate deterministic cache identifier from input parameters
 */
function generateCacheIdentifier(input: GetMaterialOrdersInput): string {
  const from = input.from || 0;
  const size = input.size || 100;
  const fullDetails = input.include_full_details ? 'full' : 'compact';
  return `${from}:${size}:${fullDetails}`;
}

export class GetMaterialOrdersTool extends BaseTool<GetMaterialOrdersInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_material_orders',
      description: 'MaterialOrders: listing, status/totals, pagination, compact/full modes',
      inputSchema: {
        type: 'object',
        properties: {
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
          },
          size: {
            type: 'number',
            description: 'Number of material orders to retrieve (default: 100, max: 500)',
          },
          include_full_details: {
            type: 'boolean',
            description: 'Return full material order details. Default: false (compact mode with only essential fields). Set to true for complete material order objects.',
          },
        },
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

  async execute(input: GetMaterialOrdersInput, context: ToolContext): Promise<any> {
    const fromIndex = input.from || 0;
    const fetchSize = Math.min(input.size || 100, 100); // OPTIMIZED: reduced max from 500 to 100 for token optimization
    const includeFullDetails = input.include_full_details || false;

    // Generate cache identifier
    const cacheIdentifier = generateCacheIdentifier(input);

    // Wrap with cache layer
    return await withCache(
      {
        entity: 'materialorders',
        operation: CACHE_PREFIXES.LIST,
        identifier: cacheIdentifier,
      instance: context.instance,
      },
      getTTL('MATERIAL_ORDERS_LIST'),
      async () => {
        try {
          // Call JobNimbus API v2
          const response = await this.client.get(
            context.apiKey,
            'v2/materialorders',
            {
              from: fromIndex,
              size: fetchSize,
            }
          );

          // Extract material orders from response
          // API v2 returns {count, results} structure
          let allOrders: MaterialOrder[] = response.data.results || response.data || [];
          if (!Array.isArray(allOrders)) {
            allOrders = [];
          }

          // Get total count from API response
          const totalCount = response.data.count || allOrders.length;

          // Sort by date_created (newest first)
          allOrders.sort((a, b) => {
            const dateA = a.date_created || 0;
            const dateB = b.date_created || 0;
            return dateB - dateA;
          });

          // Analyze statuses
          const statusMap = new Map<string, number>();
          for (const order of allOrders) {
            const statusName = order.status_name || 'Unknown';
            statusMap.set(statusName, (statusMap.get(statusName) || 0) + 1);
          }

          // Count active vs archived
          const activeCount = allOrders.filter((o) => o.is_active).length;
          const archivedCount = allOrders.filter((o) => o.is_archived).length;

          // Count esigned
          const esignedCount = allOrders.filter((o) => o.esigned).length;

          // Calculate total financials
          const totalCost = allOrders.reduce((sum, o) => sum + (o.total_line_item_cost || 0), 0);
          const totalPrice = allOrders.reduce((sum, o) => sum + (o.total_line_item_price || 0), 0);

          // Build response based on detail level
          if (includeFullDetails) {
            // Full details mode - return complete material order objects
            return {
              total_count: totalCount,
              returned_count: allOrders.length,
              from: fromIndex,
              size: fetchSize,
              active_count: activeCount,
              archived_count: archivedCount,
              esigned_count: esignedCount,
              statuses: Object.fromEntries(statusMap),
              financial_summary: {
                total_cost: totalCost.toFixed(2),
                total_price: totalPrice.toFixed(2),
                total_profit: (totalPrice - totalCost).toFixed(2),
                avg_margin: totalPrice > 0
                  ? ((totalPrice - totalCost) / totalPrice * 100).toFixed(2) + '%'
                  : '0%',
              },
              material_orders: allOrders.map((order) => ({
                jnid: order.jnid,
                type: order.type,
                customer: order.customer,
                customer_note: order.customer_note || null,
                internal_note: order.internal_note || null,
                external_id: order.external_id || null,
                is_active: order.is_active ?? true,
                is_archived: order.is_archived ?? false,
                esigned: order.esigned ?? false,
                status: order.status,
                status_name: order.status_name,
                items: order.items || [],
                items_count: order.items?.length || 0,
                location: order.location,
                location_id: order.location?.id,
                owners: order.owners || [],
                owners_count: order.owners?.length || 0,
                sales_rep: order.sales_rep,
                related: order.related || [],
                related_count: order.related?.length || 0,
                sections: order.sections || [],
                total_line_item_cost: order.total_line_item_cost || 0,
                total_line_item_price: order.total_line_item_price || 0,
                merged: order.merged || null,
                created_by: order.created_by || null,
                date_created: this.formatDate(order.date_created || 0),
                date_updated: this.formatDate(order.date_updated || 0),
              })),
              _note: 'Full details mode. Use include_full_details: false for compact mode to reduce token usage.',
            };
          } else {
            // Compact mode - return only essential fields
            return {
              total_count: totalCount,
              returned_count: allOrders.length,
              from: fromIndex,
              size: fetchSize,
              active_count: activeCount,
              archived_count: archivedCount,
              esigned_count: esignedCount,
              statuses: Object.fromEntries(statusMap),
              financial_summary: {
                total_cost: totalCost.toFixed(2),
                total_price: totalPrice.toFixed(2),
                total_profit: (totalPrice - totalCost).toFixed(2),
                avg_margin: totalPrice > 0
                  ? ((totalPrice - totalCost) / totalPrice * 100).toFixed(2) + '%'
                  : '0%',
              },
              material_orders: allOrders.map((order) => ({
                jnid: order.jnid,
                status_name: order.status_name,
                is_active: order.is_active ?? true,
                is_archived: order.is_archived ?? false,
                esigned: order.esigned ?? false,
                items_count: order.items?.length || 0,
                total_cost: order.total_line_item_cost || 0,
                total_price: order.total_line_item_price || 0,
                profit_margin: order.total_line_item_price && order.total_line_item_cost
                  ? ((order.total_line_item_price - order.total_line_item_cost) / order.total_line_item_price * 100).toFixed(2) + '%'
                  : '0%',
                owners_count: order.owners?.length || 0,
                related_count: order.related?.length || 0,
                date_created: this.formatDate(order.date_created || 0),
              })),
              _note: 'Compact mode (default). Set include_full_details: true for complete material order objects. Use get_material_order for individual order details.',
            };
          }
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : 'Failed to fetch material orders',
            status: 'error',
            from: fromIndex,
            size: fetchSize,
            note: 'Error querying /v2/materialorders endpoint',
          };
        }
      }
    );
  }
}

export default new GetMaterialOrdersTool();
