/**
 * Get Product Tool - Get specific product by JNID
 * Based on official JobNimbus API documentation
 *
 * Endpoint: GET /api1/v2/products/<jnid>
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetProductInput {
  jnid: string;
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
 * Based on official JobNimbus API documentation for GET /api1/v2/products/<jnid>
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

export class GetProductTool extends BaseTool<GetProductInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_product',
      description: 'Products: retrieve by JNID, pricing/UOM, item type, tax settings, suppliers',
      inputSchema: {
        type: 'object',
        properties: {
          jnid: {
            type: 'string',
            description: 'Product JNID (unique identifier) - Required',
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

  async execute(input: GetProductInput, context: ToolContext): Promise<any> {
    // Wrap with cache layer
    return await withCache(
      {
        entity: 'products',
        operation: CACHE_PREFIXES.GET,
        identifier: input.jnid,
      },
      getTTL('PRODUCT_DETAIL'),
      async () => {
        try {
          // Call JobNimbus API v2
          const response = await this.client.get(
            context.apiKey,
            `v2/products/${input.jnid}`
          );

          const product: Product = response.data;

          // Format response with all fields explicitly mapped
          return {
            success: true,
            data: {
              // Core identifiers
              jnid: product.jnid,
              type: product.type,
              customer: product.customer,

              // Product information
              name: product.name,
              description: product.description || null,
              external_id: product.external_id || null,

              // Configuration
              location_id: product.location_id,
              is_active: product.is_active ?? true,
              tax_exempt: product.tax_exempt ?? false,
              item_type: product.item_type,

              // Suppliers
              suppliers: product.suppliers || [],
              suppliers_count: product.suppliers?.length || 0,

              // Pricing (Units of Measure)
              uoms: product.uoms || [],
              uoms_count: product.uoms?.length || 0,

              // Metadata
              created_by: product.created_by,
              date_created: this.formatDate(product.date_created),
              date_created_unix: product.date_created,
              date_updated: this.formatDate(product.date_updated),
              date_updated_unix: product.date_updated,

              _metadata: {
                api_endpoint: 'GET /api1/v2/products/<jnid>',
                field_coverage: 'complete',
                cached: false,
                timestamp: new Date().toISOString(),
              },
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to retrieve product',
            jnid: input.jnid,
            _metadata: {
              api_endpoint: 'GET /api1/v2/products/<jnid>',
              timestamp: new Date().toISOString(),
            },
          };
        }
      }
    );
  }
}

export default new GetProductTool();
