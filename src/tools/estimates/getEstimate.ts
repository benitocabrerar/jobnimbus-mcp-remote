/**
 * Get Estimate Tool - Get specific estimate by JNID
 * Based on official JobNimbus API documentation
 *
 * Endpoint: GET /api1/v2/estimates/<jnid>
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetEstimateInput {
  jnid: string;
}

interface EstimateItem {
  jnid: string;
  name: string;
  description: string;
  uom: string;
  item_type: string;
  quantity: number;
  price: number;
  cost: number;
  amount: number;
  sku?: string | null;
  color?: string | null;
  category?: string | null;
  photos?: any[];
  tax_rate?: number;
  tax_name?: string | null;
  tax_couch_id?: string | null;
  labor?: {
    price: number;
    cost: number;
    amount: number;
    tax_rate?: number;
    tax_name?: string | null;
    quickbooksId?: string | null;
  };
  quickbooksId?: string | null;
  showGroupTotal?: string | null;
  addMarkup?: string | null;
  preSurchargePrice?: string | null;
}

interface EstimateRelated {
  id: string;
  name: string;
  number: string;
  type: string;
  email?: string | null;
  subject?: string | null;
}

interface EstimateOwner {
  id: string;
}

interface EstimateLocation {
  id: number;
}

/**
 * Complete Estimate interface matching JobNimbus API v2
 * Based on official JobNimbus API documentation for GET /api1/v2/estimates/<jnid>
 */
interface Estimate {
  // Core identifiers
  jnid: string;
  type: string;
  customer: string;
  guid?: string;
  recid?: number;

  // Estimate information
  number: string;
  attachment_id?: string;
  external_id?: string | null;
  template_id?: string;
  internal_note?: string;
  note?: string;
  terms?: string | null;

  // Status
  is_active: boolean;
  is_archived: boolean;
  esigned: boolean;
  status: number;
  status_name: string;
  signature_status?: string;
  source?: string;

  // Dates
  date_created?: number;
  date_updated?: number;
  date_estimate?: number;
  date_status_change?: number;
  date_signed?: number;
  date_sign_requested?: number;

  // Financial
  subtotal: number;
  tax: number;
  total: number;
  cost: number;
  margin: number;

  // Items
  items: EstimateItem[];

  // Location and ownership
  location: EstimateLocation;
  owners: EstimateOwner[];
  sales_rep: string;
  sales_rep_name: string;

  // Related entities
  related: EstimateRelated[];

  // Other
  sections: any[];
  merged?: any | null;
  class_id?: string | null;
  class_name?: string | null;
  supplier?: any | null;
  version?: string | null;
  duplicate_from_id?: string | null;

  // Metadata
  created_by?: string;
  created_by_name?: string;
  payments?: any[];

  // Allow additional fields from API
  [key: string]: any;
}

export class GetEstimateTool extends BaseTool<GetEstimateInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_estimate',
      description: 'Get estimate by JNID',
      inputSchema: {
        type: 'object',
        properties: {
          jnid: {
            type: 'string',
            description: 'Estimate JNID',
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

  async execute(input: GetEstimateInput, context: ToolContext): Promise<any> {
    // Wrap with cache layer
    return await withCache(
      {
        entity: CACHE_PREFIXES.ESTIMATES,
        operation: CACHE_PREFIXES.GET,
        identifier: input.jnid,
      },
      getTTL('ESTIMATE_DETAIL'),
      async () => {
        try {
          // Call JobNimbus API v2
          const response = await this.client.get(
            context.apiKey,
            `v2/estimates/${input.jnid}`
          );

          const estimate: Estimate = response.data;

          // Format response with all fields explicitly mapped
          return {
            success: true,
            data: {
              // Core identifiers
              jnid: estimate.jnid,
              type: estimate.type,
              customer: estimate.customer,
              guid: estimate.guid || null,
              recid: estimate.recid || null,

              // Estimate information
              number: estimate.number,
              attachment_id: estimate.attachment_id || null,
              external_id: estimate.external_id || null,
              template_id: estimate.template_id || null,
              internal_note: estimate.internal_note || null,
              note: estimate.note || null,
              terms: estimate.terms || null,

              // Status
              is_active: estimate.is_active ?? true,
              is_archived: estimate.is_archived ?? false,
              esigned: estimate.esigned ?? false,
              status: estimate.status,
              status_name: estimate.status_name,
              signature_status: estimate.signature_status || null,
              source: estimate.source || null,

              // Dates - both ISO 8601 and Unix timestamps
              date_created: this.formatDate(estimate.date_created || 0),
              date_created_unix: estimate.date_created,
              date_updated: this.formatDate(estimate.date_updated || 0),
              date_updated_unix: estimate.date_updated,
              date_estimate: this.formatDate(estimate.date_estimate || 0),
              date_estimate_unix: estimate.date_estimate,
              date_status_change: this.formatDate(estimate.date_status_change || 0),
              date_status_change_unix: estimate.date_status_change,
              date_signed: this.formatDate(estimate.date_signed || 0),
              date_signed_unix: estimate.date_signed,
              date_sign_requested: this.formatDate(estimate.date_sign_requested || 0),
              date_sign_requested_unix: estimate.date_sign_requested,

              // Financial
              subtotal: estimate.subtotal || 0,
              tax: estimate.tax || 0,
              total: estimate.total || 0,
              cost: estimate.cost || 0,
              margin: estimate.margin || 0,

              // Calculated profit margin percentage
              profit_margin_percent: estimate.total && estimate.cost
                ? ((estimate.total - estimate.cost) / estimate.total * 100).toFixed(2) + '%'
                : null,

              // Items with counts
              items: estimate.items || [],
              items_count: estimate.items?.length || 0,

              // Location and ownership
              location: estimate.location,
              location_id: estimate.location?.id,
              owners: estimate.owners || [],
              owners_count: estimate.owners?.length || 0,
              sales_rep: estimate.sales_rep,
              sales_rep_name: estimate.sales_rep_name,

              // Related entities
              related: estimate.related || [],
              related_count: estimate.related?.length || 0,

              // Sections and other
              sections: estimate.sections || [],
              sections_count: estimate.sections?.length || 0,
              merged: estimate.merged || null,
              class_id: estimate.class_id || null,
              class_name: estimate.class_name || null,
              supplier: estimate.supplier || null,
              version: estimate.version || null,
              duplicate_from_id: estimate.duplicate_from_id || null,

              // Metadata
              created_by: estimate.created_by || null,
              created_by_name: estimate.created_by_name || null,
              payments: estimate.payments || [],

              _metadata: {
                api_endpoint: 'GET /api1/v2/estimates/<jnid>',
                field_coverage: 'complete',
                cached: false,
                timestamp: new Date().toISOString(),
              },
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to retrieve estimate',
            jnid: input.jnid,
            _metadata: {
              api_endpoint: 'GET /api1/v2/estimates/<jnid>',
              timestamp: new Date().toISOString(),
            },
          };
        }
      }
    );
  }
}

export default new GetEstimateTool();
