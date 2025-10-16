/**
 * Get Payments Tool - Retrieve all payments from JobNimbus
 * Based on official JobNimbus API documentation
 *
 * Endpoint: GET /api1/payments
 *
 * Note: This endpoint uses API v1 (not v2 like most other endpoints)
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetPaymentsInput {
  size?: number;
  from?: number;
  include_full_details?: boolean;
}

interface PaymentInvoice {
  amount: number;
  created_by: string;
  date_created: number;
  invoice_id: string;
  invoice_no: string;
  is_active: boolean;
  jnid: string;
}

interface PaymentRelated {
  email: string | null;
  id: string;
  name: string;
  number: string;
  subject: string | null;
  type: string;
}

interface PaymentPrimary {
  email: string | null;
  id: string;
  name: string;
  number: string;
  subject: string | null;
  type: string;
}

interface PaymentOwner {
  id: string;
}

interface PaymentLocation {
  id: number;
}

/**
 * Complete Payment interface matching JobNimbus API v1
 * Based on actual API response structure
 */
interface Payment {
  // Core identifiers
  jnid: string;
  type: string;
  customer: string;

  // Payment information
  total: number;
  credit: number;
  reference: string | null;
  method_id: number;
  transaction_id: string | null;
  external_record_id: string | null;

  // Dates
  date_created: number;
  date_updated: number;
  date_payment: number;

  // Status
  is_active: boolean;
  is_archived: boolean;

  // Related invoices and estimates
  invoices: PaymentInvoice[];
  estimates: any[];

  // Relationships
  primary: PaymentPrimary;
  related: PaymentRelated[];
  owners: PaymentOwner[];
  location: PaymentLocation;

  // Sales
  sales_rep: string;
  sales_rep_name: string;

  // Metadata
  created_by: string;
  created_by_name: string;
  created_by_processor: string | null;

  // Payment processing
  PaymentSource: any | null;
  card: any | null;
  globalPayPayment: any | null;
  wepay_payment_status: string | null;
  chargeback_id: string | null;
  refund_id: string | null;
  refunded_amount: number | null;
  surcharge: number | null;
  merged: any | null;

  // Allow additional fields
  [key: string]: any;
}

export class GetPaymentsTool extends BaseTool<GetPaymentsInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_payments',
      description: 'Payments: retrieve, pagination, compact/full modes',
      inputSchema: {
        type: 'object',
        properties: {
          size: {
            type: 'number',
            description: 'Number of payments to retrieve per page (default: 15, max: 100)',
          },
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
          },
          include_full_details: {
            type: 'boolean',
            description: 'Return full payment details. Default: false (compact mode with only essential fields). Set to true for complete payment objects.',
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

  async execute(input: GetPaymentsInput, context: ToolContext): Promise<any> {
    const size = Math.min(input.size || 15, 100);
    const from = input.from || 0;
    const includeFullDetails = input.include_full_details ?? false;

    // Build cache key based on parameters and mode
    const cacheKey = `${from}_${size}_${includeFullDetails ? 'full' : 'compact'}`;

    // Wrap with cache layer
    return await withCache(
      {
        entity: CACHE_PREFIXES.PAYMENTS,
        operation: CACHE_PREFIXES.LIST,
        identifier: cacheKey,
      instance: context.instance,
      },
      getTTL('PAYMENTS_LIST'),
      async () => {
        try {
          // Call JobNimbus API v1 (note: uses api1, not v2)
          const response = await this.client.get(
            context.apiKey,
            `payments?from=${from}&size=${size}`
          );

          const payments: Payment[] = response.data.results || [];
          const totalCount = response.data.count || 0;

          // Process payments based on mode
          const processedPayments = payments.map((payment) => {
            if (includeFullDetails) {
              // Full details mode - return complete payment object with formatted dates
              return {
                // Core identifiers
                jnid: payment.jnid,
                type: payment.type,
                customer: payment.customer,

                // Payment information
                total: payment.total,
                credit: payment.credit || 0,
                reference: payment.reference || null,
                method_id: payment.method_id,
                transaction_id: payment.transaction_id || null,
                external_record_id: payment.external_record_id || null,

                // Dates - both ISO 8601 and Unix timestamps
                date_created: this.formatDate(payment.date_created),
                date_created_unix: payment.date_created,
                date_updated: this.formatDate(payment.date_updated),
                date_updated_unix: payment.date_updated,
                date_payment: this.formatDate(payment.date_payment),
                date_payment_unix: payment.date_payment,

                // Status
                is_active: payment.is_active ?? true,
                is_archived: payment.is_archived ?? false,

                // Related invoices and estimates
                invoices: payment.invoices || [],
                invoices_count: payment.invoices?.length || 0,
                estimates: payment.estimates || [],
                estimates_count: payment.estimates?.length || 0,

                // Relationships
                primary: payment.primary,
                related: payment.related || [],
                related_count: payment.related?.length || 0,
                owners: payment.owners || [],
                owners_count: payment.owners?.length || 0,
                location: payment.location,
                location_id: payment.location?.id,

                // Sales
                sales_rep: payment.sales_rep,
                sales_rep_name: payment.sales_rep_name,

                // Metadata
                created_by: payment.created_by,
                created_by_name: payment.created_by_name,
                created_by_processor: payment.created_by_processor || null,

                // Payment processing
                PaymentSource: payment.PaymentSource || null,
                card: payment.card || null,
                globalPayPayment: payment.globalPayPayment || null,
                wepay_payment_status: payment.wepay_payment_status || null,
                chargeback_id: payment.chargeback_id || null,
                refund_id: payment.refund_id || null,
                refunded_amount: payment.refunded_amount || null,
                surcharge: payment.surcharge || null,
                merged: payment.merged || null,
              };
            } else {
              // Compact mode - return only essential fields
              return {
                jnid: payment.jnid,
                total: payment.total,
                reference: payment.reference || null,
                date_payment: this.formatDate(payment.date_payment),
                method_id: payment.method_id,
                primary: payment.primary,
                invoices_count: payment.invoices?.length || 0,
                sales_rep_name: payment.sales_rep_name,
                is_active: payment.is_active ?? true,
              };
            }
          });

          // Calculate statistics
          const activeCount = payments.filter((p) => p.is_active !== false).length;
          const archivedCount = payments.filter((p) => p.is_archived === true).length;
          const totalAmount = payments.reduce((sum, p) => sum + (p.total || 0), 0);

          return {
            success: true,
            data: {
              payments: processedPayments,
              pagination: {
                from,
                size,
                returned_count: payments.length,
                total_count: totalCount,
                has_more: from + payments.length < totalCount,
              },
              statistics: {
                active_count: activeCount,
                archived_count: archivedCount,
                total_amount: totalAmount.toFixed(2),
                average_payment: payments.length > 0 ? (totalAmount / payments.length).toFixed(2) : '0.00',
              },
              _metadata: {
                api_endpoint: 'GET /api1/payments',
                mode: includeFullDetails ? 'full_details' : 'compact',
                cached: false,
                timestamp: new Date().toISOString(),
              },
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to retrieve payments',
            _metadata: {
              api_endpoint: 'GET /api1/payments',
              timestamp: new Date().toISOString(),
            },
          };
        }
      }
    );
  }
}

export default new GetPaymentsTool();
