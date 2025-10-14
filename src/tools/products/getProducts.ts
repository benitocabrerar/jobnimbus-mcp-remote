/**
 * Get Products Tool - Retrieve all products from JobNimbus
 * Based on official JobNimbus API documentation
 *
 * Endpoint: GET /api1/v2/products
 *
 * Response structure: Array of product objects
 *
 * Integrated with Redis cache system for performance optimization
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetProductsInput {
  from?: number;
  size?: number;
  include_full_details?: boolean;
}

interface ProductUomMaterial {
  cost: number;
  price: number;
}

interface ProductUomLabor {
  cost: number;
  price: number;
}

interface ProductUom {
  uom: string;
  material?: ProductUomMaterial;
  labor?: ProductUomLabor;
}

/**
 * Complete Product interface matching JobNimbus API
 * Based on official JobNimbus API documentation for GET /api1/v2/products
 */
interface Product {
  // Core identifiers
  jnid: string;
  type: string;
  customer: string;

  // Product information
  name: string;
  description?: string;
  external_id?: string;

  // Configuration
  location_id: number;
  is_active: boolean;
  tax_exempt: boolean;
  item_type: string;

  // Suppliers
  suppliers: any[];

  // Pricing (Units of Measure)
  uoms: ProductUom[];

  // Metadata
  created_by: string;
  date_created: number;
  date_updated: number;

  // Allow additional fields from API
  [key: string]: any;
}

/**
 * Generate deterministic cache identifier from input parameters
 */
function generateCacheIdentifier(input: GetProductsInput): string {
  const from = input.from || 0;
  const size = input.size || 100;
  const fullDetails = input.include_full_details ? 'full' : 'compact';
  return `${from}:${size}:${fullDetails}`;
}

export class GetProductsTool extends BaseTool<GetProductsInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_products',
      description: 'Retrieve all products from JobNimbus catalog. Returns product list with name, pricing (material/labor cost and price), item type, tax settings, and metadata. Supports pagination and compact/full detail modes for token optimization. Use compact mode (default) for listings, full mode for detailed analysis.',
      inputSchema: {
        type: 'object',
        properties: {
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
          },
          size: {
            type: 'number',
            description: 'Number of products to retrieve (default: 100, max: 500)',
          },
          include_full_details: {
            type: 'boolean',
            description: 'Return full product details. Default: false (compact mode with only essential fields). Set to true for complete product objects.',
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

  async execute(input: GetProductsInput, context: ToolContext): Promise<any> {
    const fromIndex = input.from || 0;
    const fetchSize = Math.min(input.size || 100, 500);
    const includeFullDetails = input.include_full_details || false;

    // Generate cache identifier
    const cacheIdentifier = generateCacheIdentifier(input);

    // Wrap with cache layer
    return await withCache(
      {
        entity: 'products',
        operation: CACHE_PREFIXES.LIST,
        identifier: cacheIdentifier,
      },
      getTTL('PRODUCTS_LIST'),
      async () => {
        try {
          // Call JobNimbus API v2
          const response = await this.client.get(
            context.apiKey,
            'v2/products',
            {
              from: fromIndex,
              size: fetchSize,
            }
          );

          // Extract products from response
          let allProducts: Product[] = response.data || [];
          if (!Array.isArray(allProducts)) {
            allProducts = [];
          }

          // Sort by name alphabetically
          allProducts.sort((a, b) => {
            const nameA = a.name?.toLowerCase() || '';
            const nameB = b.name?.toLowerCase() || '';
            return nameA.localeCompare(nameB);
          });

          // Analyze item types
          const itemTypeMap = new Map<string, number>();
          for (const product of allProducts) {
            const itemType = product.item_type || 'unknown';
            itemTypeMap.set(itemType, (itemTypeMap.get(itemType) || 0) + 1);
          }

          // Count active vs inactive
          const activeCount = allProducts.filter((p) => p.is_active).length;
          const inactiveCount = allProducts.length - activeCount;

          // Count tax exempt
          const taxExemptCount = allProducts.filter((p) => p.tax_exempt).length;

          // Build response based on detail level
          if (includeFullDetails) {
            // Full details mode - return complete product objects
            return {
              count: allProducts.length,
              from: fromIndex,
              size: fetchSize,
              active_count: activeCount,
              inactive_count: inactiveCount,
              tax_exempt_count: taxExemptCount,
              item_types: Object.fromEntries(itemTypeMap),
              products: allProducts.map((product) => ({
                jnid: product.jnid,
                type: product.type,
                customer: product.customer,
                name: product.name,
                description: product.description || null,
                external_id: product.external_id || null,
                location_id: product.location_id,
                is_active: product.is_active ?? true,
                tax_exempt: product.tax_exempt ?? false,
                item_type: product.item_type,
                suppliers: product.suppliers || [],
                uoms: product.uoms || [],
                created_by: product.created_by,
                date_created: this.formatDate(product.date_created),
                date_updated: this.formatDate(product.date_updated),
              })),
              _note: 'Full details mode. Use include_full_details: false for compact mode to reduce token usage.',
            };
          } else {
            // Compact mode - return only essential fields
            return {
              count: allProducts.length,
              from: fromIndex,
              size: fetchSize,
              active_count: activeCount,
              inactive_count: inactiveCount,
              tax_exempt_count: taxExemptCount,
              item_types: Object.fromEntries(itemTypeMap),
              products: allProducts.map((product) => ({
                jnid: product.jnid,
                name: product.name,
                item_type: product.item_type,
                is_active: product.is_active ?? true,
                tax_exempt: product.tax_exempt ?? false,
                uoms_count: product.uoms?.length || 0,
                date_created: this.formatDate(product.date_created),
              })),
              _note: 'Compact mode (default). Set include_full_details: true for complete product objects. Use get_product for individual product details.',
            };
          }
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : 'Failed to fetch products',
            status: 'error',
            from: fromIndex,
            size: fetchSize,
            note: 'Error querying /v2/products endpoint',
          };
        }
      }
    );
  }
}

export default new GetProductsTool();
