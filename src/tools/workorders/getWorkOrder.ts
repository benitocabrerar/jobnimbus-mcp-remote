/**
 * Get Work Order Tool - Retrieve a specific work order by JNID
 * Based on official JobNimbus API documentation (WorkOrders.txt)
 *
 * Endpoint: GET /api1/v2/workorders/<jnid>
 *
 * Parameters:
 * - jnid: Work Order identifier (required)
 *
 * Returns complete work order details including status, owners, related entities,
 * financials, and metadata.
 *
 * Integrated with Redis cache system for performance optimization
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetWorkOrderInput {
  jnid: string;
}

interface WorkOrderRelated {
  id: string;
  name: string;
  number: string;
  type: string;
}

interface WorkOrderOwner {
  id: string;
  name?: string;
}

interface WorkOrderLocation {
  id: number;
  name?: string;
  parent_id?: number;
}

/**
 * Complete WorkOrder interface matching JobNimbus API
 * Based on official JobNimbus API documentation for GET /api1/v2/workorders/<jnid>
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
  sales_rep_name?: string;

  // Related entities
  related: WorkOrderRelated[];

  // Financials (if applicable)
  total?: number;

  // Metadata
  created_by?: string;
  created_by_name?: string;
  date_created?: number;
  date_updated?: number;

  // Allow additional fields from API
  [key: string]: any;
}

export class GetWorkOrderTool extends BaseTool<GetWorkOrderInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_work_order',
      description: 'WorkOrders: retrieve by JNID, complete details, status/owners/financials',
      inputSchema: {
        type: 'object',
        properties: {
          jnid: {
            type: 'string',
            description: 'Work Order JNID (required)',
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

  /**
   * Process work order and return complete structured response
   */
  private processWorkOrder(order: WorkOrder): any {
    return {
      // Core identifiers
      jnid: order.jnid,
      type: order.type,
      customer: order.customer,

      // Order information
      number: order.number || null,
      name: order.name || null,
      description: order.description || null,
      external_id: order.external_id || null,

      // Status
      is_active: order.is_active ?? true,
      is_archived: order.is_archived ?? false,
      status: order.status || null,
      status_name: order.status_name || null,

      // Location
      location: order.location || null,
      location_id: order.location?.id || null,
      location_name: order.location?.name || null,

      // Ownership
      owners: order.owners || [],
      owners_count: order.owners?.length || 0,
      sales_rep: order.sales_rep || null,
      sales_rep_name: order.sales_rep_name || null,

      // Related entities
      related: order.related || [],
      related_count: order.related?.length || 0,

      // Financials
      total: order.total || 0,

      // Metadata
      created_by: order.created_by || null,
      created_by_name: order.created_by_name || null,
      date_created: this.formatDate(order.date_created || 0),
      date_updated: this.formatDate(order.date_updated || 0),
      date_created_unix: order.date_created || null,
      date_updated_unix: order.date_updated || null,

      // Include any additional fields from API
      ...Object.keys(order).reduce((acc, key) => {
        if (!['jnid', 'type', 'customer', 'number', 'name', 'description', 'external_id',
              'is_active', 'is_archived', 'status', 'status_name', 'location',
              'owners', 'sales_rep', 'sales_rep_name', 'related', 'total',
              'created_by', 'created_by_name', 'date_created', 'date_updated'].includes(key)) {
          acc[key] = order[key];
        }
        return acc;
      }, {} as Record<string, any>),
    };
  }

  async execute(input: GetWorkOrderInput, context: ToolContext): Promise<any> {
    const { jnid } = input;

    if (!jnid) {
      return {
        error: 'Missing required parameter: jnid',
        status: 'error',
        note: 'Work Order JNID is required',
      };
    }

    // Wrap with cache layer
    return await withCache(
      {
        entity: CACHE_PREFIXES.WORK_ORDERS,
        operation: CACHE_PREFIXES.DETAIL,
        identifier: jnid,
      },
      getTTL('WORK_ORDER_DETAIL'),
      async () => {
        try {
          // Call JobNimbus API v2
          const response = await this.client.get(
            context.apiKey,
            `v2/workorders/${jnid}`,
            {}
          );

          // Extract work order from response
          const order: WorkOrder = response.data;

          if (!order || !order.jnid) {
            return {
              error: 'Work order not found',
              status: 'not_found',
              jnid: jnid,
              note: 'The specified work order does not exist or you do not have permission to access it',
            };
          }

          // Process and return complete work order
          const processedOrder = this.processWorkOrder(order);

          return {
            work_order: processedOrder,
            _metadata: {
              field_coverage: 'complete',
              api_endpoint: `GET /api1/v2/workorders/${jnid}`,
              note: 'Complete work order details with all fields from JobNimbus API',
            },
          };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : 'Failed to fetch work order',
            status: 'error',
            jnid: jnid,
            note: `Error querying /v2/workorders/${jnid} endpoint`,
          };
        }
      }
    );
  }
}

export default new GetWorkOrderTool();
