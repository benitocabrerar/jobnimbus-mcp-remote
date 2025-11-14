/**
 * Get Work Orders Tool - Retrieve all work orders from JobNimbus
 * Based on official JobNimbus API documentation (WorkOrders.txt)
 *
 * Endpoint: GET /api1/v2/workorders
 *
 * Query Parameters:
 * - from: Starting index for pagination (default: 0)
 * - size: Number of results to return (default: 1000, max: 10000)
 *
 * Response structure: API v2 returns {count, results} structure
 *
 * Integrated with Redis cache system for performance optimization
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetWorkOrdersInput {
  from?: number;
  size?: number;
  include_full_details?: boolean;
}

interface WorkOrderRelated {
  id: string;
  name: string;
  number: string;
  type: string;
}

interface WorkOrderOwner {
  id: string;
}

interface WorkOrderLocation {
  id: number;
}

/**
 * Complete WorkOrder interface matching JobNimbus API
 * Based on official JobNimbus API documentation for GET /api1/v2/workorders
 */
interface WorkOrder {
  // Core identifiers
  jnid: string;
  type: string;
  customer: string;

  // Order information
  number?: string;
  name?: string;
  description?: string;
  external_id?: string | null;

  // Status
  is_active: boolean;
  is_archived: boolean;
  status?: number;
  status_name?: string;

  // Location and ownership
  location: WorkOrderLocation;
  owners: WorkOrderOwner[];
  sales_rep?: string;

  // Related entities
  related: WorkOrderRelated[];

  // Financials (if applicable)
  total?: number;

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
function generateCacheIdentifier(input: GetWorkOrdersInput): string {
  const from = input.from || 0;
  const size = input.size || 1000;
  const fullDetails = input.include_full_details ? 'full' : 'compact';
  return `${from}:${size}:${fullDetails}`;
}

export class GetWorkOrdersTool extends BaseTool<GetWorkOrdersInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_work_orders',
      description: 'WorkOrders: retrieve, pagination, compact/full modes, status/owners',
      inputSchema: {
        type: 'object',
        properties: {
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
          },
          size: {
            type: 'number',
            description: 'Number of work orders to retrieve (default: 1000, max: 10000)',
          },
          include_full_details: {
            type: 'boolean',
            description: 'Return full work order details. Default: false (compact mode with only essential fields). Set to true for complete work order objects.',
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

  async execute(input: GetWorkOrdersInput, context: ToolContext): Promise<any> {
    const fromIndex = input.from || 0;
    const fetchSize = Math.min(input.size || 100, 1000); // OPTIMIZED: reduced default from 1000 to 100, max from 10000 to 1000
    const includeFullDetails = input.include_full_details || false;

    // Generate cache identifier
    const cacheIdentifier = generateCacheIdentifier(input);

    // Wrap with cache layer
    return await withCache(
      {
        entity: CACHE_PREFIXES.WORK_ORDERS,
        operation: CACHE_PREFIXES.LIST,
        identifier: cacheIdentifier,
      instance: context.instance,
      },
      getTTL('WORK_ORDERS_LIST'),
      async () => {
        try {
          // Call JobNimbus API v2
          const response = await this.client.get(
            context.apiKey,
            'v2/workorders',
            {
              from: fromIndex,
              size: fetchSize,
            }
          );

          // Extract work orders from response
          // API v2 returns {count, results} structure
          let allOrders: WorkOrder[] = response.data.results || response.data || [];
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

          // Build response based on detail level
          if (includeFullDetails) {
            // Full details mode - return complete work order objects
            return {
              total_count: totalCount,
              returned_count: allOrders.length,
              from: fromIndex,
              size: fetchSize,
              active_count: activeCount,
              archived_count: archivedCount,
              statuses: Object.fromEntries(statusMap),
              work_orders: allOrders.map((order) => ({
                jnid: order.jnid,
                type: order.type,
                customer: order.customer,
                number: order.number || null,
                name: order.name || null,
                description: order.description || null,
                external_id: order.external_id || null,
                is_active: order.is_active ?? true,
                is_archived: order.is_archived ?? false,
                status: order.status,
                status_name: order.status_name,
                location: order.location,
                location_id: order.location?.id,
                owners: order.owners || [],
                owners_count: order.owners?.length || 0,
                sales_rep: order.sales_rep || null,
                related: order.related || [],
                related_count: order.related?.length || 0,
                total: order.total || 0,
                created_by: order.created_by || null,
                date_created: this.formatDate(order.date_created || 0),
                date_updated: this.formatDate(order.date_updated || 0),
                // Include any additional fields from API
                ...Object.keys(order).reduce((acc, key) => {
                  if (!['jnid', 'type', 'customer', 'number', 'name', 'description', 'external_id',
                        'is_active', 'is_archived', 'status', 'status_name', 'location',
                        'owners', 'sales_rep', 'related', 'total', 'created_by',
                        'date_created', 'date_updated'].includes(key)) {
                    acc[key] = order[key];
                  }
                  return acc;
                }, {} as Record<string, any>),
              })),
              _metadata: {
                field_coverage: 'complete',
                api_endpoint: 'GET /api1/v2/workorders',
                note: 'Full details mode. Use include_full_details: false for compact mode to reduce token usage.',
              },
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
              statuses: Object.fromEntries(statusMap),
              work_orders: allOrders.map((order) => ({
                jnid: order.jnid,
                number: order.number || null,
                name: order.name || null,
                status_name: order.status_name || 'Unknown',
                is_active: order.is_active ?? true,
                is_archived: order.is_archived ?? false,
                owners_count: order.owners?.length || 0,
                related_count: order.related?.length || 0,
                total: order.total || 0,
                date_created: this.formatDate(order.date_created || 0),
              })),
              _metadata: {
                field_coverage: 'compact',
                api_endpoint: 'GET /api1/v2/workorders',
                note: 'Compact mode (default). Set include_full_details: true for complete work order objects. Use get_work_order for individual order details.',
              },
            };
          }
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : 'Failed to fetch work orders',
            status: 'error',
            from: fromIndex,
            size: fetchSize,
            note: 'Error querying /v2/workorders endpoint',
          };
        }
      }
    );
  }
}

export default new GetWorkOrdersTool();
