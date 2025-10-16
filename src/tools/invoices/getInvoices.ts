/**
 * Get Invoices Tool
 * Retrieve invoices from JobNimbus /invoices endpoint
 *
 * VERIFIED WORKING - This endpoint exists and returns invoice data
 * Integrated with Redis cache system for performance optimization
 *
 * ENHANCED: Now supports optional consolidation with credit memos, payments, and refunds
 * When include_consolidated=true, returns comprehensive financial data with NET calculations
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext, BaseToolInput } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';
import { GetConsolidatedFinancialsTool } from '../financials/getConsolidatedFinancials.js';

interface GetInvoicesInput extends BaseToolInput {
  from?: number;
  size?: number;
  page_size?: number;
  filter?: string;
  sort_field?: string;
  sort_direction?: 'asc' | 'desc';
  actor?: string;

  // NEW: Consolidation support
  include_consolidated?: boolean;
  job_id?: string;
  contact_id?: string;
}

/**
 * Generate deterministic cache identifier from input parameters
 * UPDATED: Include consolidation parameters to prevent cache collisions
 */
function generateCacheIdentifier(input: GetInvoicesInput): string {
  const from = input.from || 0;
  const size = input.size || 50;
  const pageSize = input.page_size || 'null';
  const filter = input.filter || 'null';
  const sortField = input.sort_field || 'date_created';
  const sortDirection = input.sort_direction || 'desc';
  const actor = input.actor || 'null';
  const consolidated = input.include_consolidated ? 'consolidated' : 'invoices_only';
  const jobId = input.job_id || 'null';
  const contactId = input.contact_id || 'null';
  const verbosity = input.verbosity || 'null';

  return `${from}:${size}:${pageSize}:${filter}:${sortField}:${sortDirection}:${actor}:${consolidated}:${jobId}:${contactId}:${verbosity}`;
}

export class GetInvoicesTool extends BaseTool<GetInvoicesInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_invoices',
      description: 'Invoices: retrieve, consolidation mode, NET calculations, handle-based responses',
      inputSchema: {
        type: 'object',
        properties: {
          // NEW: Consolidation mode
          include_consolidated: {
            type: 'boolean',
            description: 'Enable financial consolidation mode. When true, queries invoices, credit_memos, payments, and refunds in parallel and calculates NET amounts. Returns comprehensive financial summary with invoice-credit reference links. Default: false (invoices only).',
          },
          job_id: {
            type: 'string',
            description: 'Filter by job JNID or number. Works in both standard and consolidated modes.',
          },
          contact_id: {
            type: 'string',
            description: 'Filter by contact JNID. Works in both standard and consolidated modes.',
          },

          // Phase 3: Handle-based response control
          verbosity: {
            type: 'string',
            description: 'Response detail level: "summary", "compact" (DEFAULT), "detailed", "raw". Only applies in consolidated mode.',
            enum: ['summary', 'compact', 'detailed', 'raw'],
          },
          fields: {
            type: 'string',
            description: 'Comma-separated field names to return. Only applies in consolidated mode.',
          },
          page_size: {
            type: 'number',
            description: 'Number of records per page (default: 20, max: 100). Replaces "size" in consolidated mode.',
          },

          // Legacy parameters (work in standard mode)
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
          },
          size: {
            type: 'number',
            description: 'Number of records to retrieve (default: 50, max: 1000). In consolidated mode, use page_size instead.',
          },
          filter: {
            type: 'string',
            description: 'URL-encoded JSON filter using Elasticsearch syntax. Only works in standard (non-consolidated) mode. Example: {"must":[{"term":{"related.id":"job123"}}]}',
          },
          sort_field: {
            type: 'string',
            description: 'Field to sort by (default: date_created). Standard mode only.',
          },
          sort_direction: {
            type: 'string',
            description: 'Sort direction: asc or desc (default: desc). Standard mode only.',
            enum: ['asc', 'desc'],
          },
          actor: {
            type: 'string',
            description: 'Optional: User ID to act as for permission-based filtering. Standard mode only.',
          },
        },
      },
    };
  }

  async execute(input: GetInvoicesInput, context: ToolContext): Promise<any> {
    // CONSOLIDATION MODE: Use GetConsolidatedFinancialsTool for comprehensive financial data
    if (input.include_consolidated) {
      const consolidatedTool = new GetConsolidatedFinancialsTool();

      // Map parameters to consolidated tool format
      const consolidatedInput: any = {
        // Entity filtering
        job_id: input.job_id,
        contact_id: input.contact_id,

        // Pagination (prefer page_size over size)
        from: input.from,
        page_size: input.page_size || input.size,

        // Phase 3 parameters
        verbosity: input.verbosity,
        fields: input.fields,

        // Record type selection (all types by default for complete financial picture)
        include_invoices: true,
        include_credit_memos: true,
        include_payments: true,
        include_refunds: true,
      };

      // Execute consolidated financials tool
      return await consolidatedTool.execute(consolidatedInput, context);
    }

    // STANDARD MODE: Original invoices-only behavior (backward compatibility)
    const cacheIdentifier = generateCacheIdentifier(input);

    return await withCache(
      {
        entity: CACHE_PREFIXES.INVOICES,
        operation: CACHE_PREFIXES.LIST,
        identifier: cacheIdentifier,
      },
      getTTL('INVOICES_LIST'),
      async () => {
        const params: any = {
          from: input.from || 0,
          size: Math.min(input.size || 50, 1000),
        };

        // Build Elasticsearch filter from job_id or contact_id if provided
        // Only if explicit filter not already provided (explicit filter takes precedence)
        if (!input.filter && (input.job_id || input.contact_id)) {
          const entityId = input.job_id || input.contact_id;
          params.filter = JSON.stringify({
            must: [
              {
                term: {
                  'related.id': entityId,
                },
              },
            ],
          });
        } else if (input.filter) {
          params.filter = input.filter;
        }

        if (input.sort_field) params.sort_field = input.sort_field;
        if (input.sort_direction) params.sort_direction = input.sort_direction;
        if (input.actor) params.actor = input.actor;

        const result = await this.client.get(context.apiKey, 'invoices', params);

        return {
          count: result.data?.results?.length || 0,
          from: params.from,
          size: params.size,
          filter_applied: !!input.filter,
          sort_by: input.sort_field || 'date_created',
          sort_direction: input.sort_direction || 'desc',
          results: result.data?.results || result.data || [],
          _mode: 'invoices_only',
          _note: 'Use include_consolidated=true for comprehensive financial data with NET calculations, credit memos, payments, and refunds',
        };
      }
    );
  }
}
