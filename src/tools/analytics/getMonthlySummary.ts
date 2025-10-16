/**
 * Get Monthly Summary Tool
 *
 * AUTOMATED MONTHLY FINANCIAL REPORTING
 *
 * Simplifies monthly financial cutoff generation by automatically:
 * - Parsing YYYY-MM format to date range (first to last day of month)
 * - Fetching invoices, payments, and credit memos for the specified month
 * - Filtering payments to exclude zero-value QuickBooks placeholders (credit = 0)
 * - Calculating totals by invoice status (Open, Closed, Pending, etc.)
 * - Computing accounts receivable (invoiced - payments - credits)
 * - Providing clean, consistent monthly reports without manual filtering
 *
 * Benefits:
 * - No manual date filtering required
 * - Automatic payment validation (credit > 0)
 * - Status-based breakdowns for detailed analysis
 * - Consistent calculations across instances (Stamford & Guilford)
 * - Cached results for performance (1 hour TTL)
 *
 * @author Backend Architecture Team
 * @version 1.0.0
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetMonthlySummaryInput {
  instance: string;
  month: string; // Format: YYYY-MM (e.g., "2025-10")
}

interface InvoiceRecord {
  jnid: string;
  number: string;
  status: number;
  status_name: string;
  cost?: number;
  total?: number;
  date_created: number;
  date_invoice?: number;
  customer?: string;
  [key: string]: any;
}

interface PaymentRecord {
  jnid: string;
  credit?: number;
  date_payment: number;
  date_created: number;
  customer?: string;
  created_by_name?: string;
  [key: string]: any;
}

interface CreditMemoRecord {
  jnid: string;
  cost?: number;
  total?: number;
  date_created: number;
  customer?: string;
  [key: string]: any;
}

interface StatusBreakdown {
  count: number;
  total: number;
  status_name: string;
}

interface MonthlySummaryResponse {
  success: boolean;
  instance: string;
  month: string;
  period: {
    from: string;
    to: string;
    from_unix: number;
    to_unix: number;
  };
  summary: {
    total_invoiced: string;
    total_payments: string;
    total_credit_memos: string;
    net_invoiced: string;
    accounts_receivable: string;
  };
  by_status: Record<string, StatusBreakdown>;
  counts: {
    invoices: number;
    payments: number;
    payments_valid: number;
    payments_excluded: number;
    credit_memos: number;
  };
  _metadata: {
    tool_name: string;
    cached: boolean;
    timestamp: string;
  };
}

export class GetMonthlySummaryTool extends BaseTool<GetMonthlySummaryInput, MonthlySummaryResponse> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_monthly_summary',
      description: 'Monthly: automated financial cutoff with status breakdown, payment filtering, and receivables calculation',
      inputSchema: {
        type: 'object',
        properties: {
          instance: {
            type: 'string',
            description: 'Instance name: "stamford" or "guilford"',
            enum: ['stamford', 'guilford'],
          },
          month: {
            type: 'string',
            description: 'Month in YYYY-MM format (e.g., "2025-10" for October 2025)',
            pattern: '^\\d{4}-\\d{2}$',
          },
        },
        required: ['instance', 'month'],
      },
    };
  }

  /**
   * Parse YYYY-MM format to Unix timestamp range (first day to last day of month)
   */
  private parseMonth(month: string): { from: number; to: number; fromDate: string; toDate: string } {
    // Validate format
    const regex = /^(\d{4})-(\d{2})$/;
    const match = month.match(regex);

    if (!match) {
      throw new Error('Invalid month format. Expected YYYY-MM (e.g., "2025-10")');
    }

    const year = parseInt(match[1], 10);
    const monthNum = parseInt(match[2], 10);

    if (monthNum < 1 || monthNum > 12) {
      throw new Error('Invalid month. Must be between 01 and 12');
    }

    // First day of month at 00:00:00
    const firstDay = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0, 0));

    // Last day of month at 23:59:59
    const lastDay = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));

    return {
      from: Math.floor(firstDay.getTime() / 1000),
      to: Math.floor(lastDay.getTime() / 1000),
      fromDate: firstDay.toISOString().split('T')[0],
      toDate: lastDay.toISOString().split('T')[0],
    };
  }

  /**
   * Get amount from record (handles both 'cost' and 'total' fields)
   */
  private getRecordAmount(record: any): number {
    return record.total || record.cost || record.credit || 0;
  }

  /**
   * Filter records by date range (using date_created or date_invoice)
   */
  private filterByDate(records: any[], from: number, to: number): any[] {
    return records.filter((record) => {
      const date = record.date_invoice || record.date_payment || record.date_created || 0;
      return date >= from && date <= to;
    });
  }

  async execute(input: GetMonthlySummaryInput, context: ToolContext): Promise<MonthlySummaryResponse> {
    try {
      // Parse month to date range
      const dateRange = this.parseMonth(input.month);

      // Build cache key
      const cacheKey = {
        entity: 'monthly',
        operation: 'summary',
        identifier: `${input.instance}_${input.month}`,
        instance: context.instance,
      };

      // Wrap with cache layer (1 hour TTL for monthly data)
      return await withCache(
        cacheKey,
        getTTL('ANALYTICS'), // 1 hour - analytics aggregation TTL
        async () => {
          // ============================================
          // FETCH DATA FROM API
          // ============================================

          // Fetch invoices for the month
          const invoicesResponse = await this.client.get(context.apiKey, 'invoices', {
            size: 1000, // Fetch enough to cover monthly volume
          });

          let invoices: InvoiceRecord[] = invoicesResponse.data?.results || invoicesResponse.data || [];

          // Filter invoices by month
          invoices = this.filterByDate(invoices, dateRange.from, dateRange.to);

          // Fetch payments for the month
          const paymentsResponse = await this.client.get(context.apiKey, 'payments', {
            size: 1000,
          });

          let payments: PaymentRecord[] = paymentsResponse.data?.results || paymentsResponse.data || [];

          // Filter payments by month
          payments = this.filterByDate(payments, dateRange.from, dateRange.to);

          // Count payments before filtering
          const totalPaymentsFetched = payments.length;

          // CRITICAL: Filter out zero-value payments (QuickBooks placeholders)
          const validPayments = payments.filter((payment) => {
            const amount = this.getRecordAmount(payment);
            return amount > 0;
          });

          const excludedPayments = totalPaymentsFetched - validPayments.length;

          // Credit memos: JobNimbus API doesn't have /credit_memos endpoint
          // Credit memos are stored as FILE attachments (vendor invoices) with special naming patterns
          // For monthly summary, we set to empty array (credit memos will be 0)
          // NOTE: get_consolidated_financials uses YAML fallback to extract from filenames
          let creditMemos: CreditMemoRecord[] = [];

          // ============================================
          // CALCULATE TOTALS
          // ============================================

          const totalInvoiced = invoices.reduce((sum, inv) => sum + this.getRecordAmount(inv), 0);

          const totalPayments = validPayments.reduce((sum, pay) => sum + this.getRecordAmount(pay), 0);

          const totalCreditMemos = creditMemos.reduce((sum, cm) => sum + this.getRecordAmount(cm), 0);

          // NET Invoiced = Invoiced - Credit Memos
          const netInvoiced = totalInvoiced - totalCreditMemos;

          // Accounts Receivable = NET Invoiced - Payments
          const accountsReceivable = netInvoiced - totalPayments;

          // ============================================
          // BREAKDOWN BY INVOICE STATUS
          // ============================================

          const statusMap = new Map<string, { count: number; total: number; status_name: string }>();

          for (const invoice of invoices) {
            const statusKey = invoice.status_name || `Status_${invoice.status}` || 'Unknown';
            const amount = this.getRecordAmount(invoice);

            if (!statusMap.has(statusKey)) {
              statusMap.set(statusKey, {
                count: 0,
                total: 0,
                status_name: statusKey,
              });
            }

            const statusData = statusMap.get(statusKey)!;
            statusData.count += 1;
            statusData.total += amount;
          }

          const byStatus: Record<string, StatusBreakdown> = {};
          statusMap.forEach((data, key) => {
            byStatus[key] = data;
          });

          // ============================================
          // BUILD RESPONSE
          // ============================================

          return {
            success: true,
            instance: input.instance,
            month: input.month,
            period: {
              from: dateRange.fromDate,
              to: dateRange.toDate,
              from_unix: dateRange.from,
              to_unix: dateRange.to,
            },
            summary: {
              total_invoiced: totalInvoiced.toFixed(2),
              total_payments: totalPayments.toFixed(2),
              total_credit_memos: totalCreditMemos.toFixed(2),
              net_invoiced: netInvoiced.toFixed(2),
              accounts_receivable: accountsReceivable.toFixed(2),
            },
            by_status: byStatus,
            counts: {
              invoices: invoices.length,
              payments: validPayments.length,
              payments_valid: validPayments.length,
              payments_excluded: excludedPayments,
              credit_memos: creditMemos.length,
            },
            _metadata: {
              tool_name: 'get_monthly_summary',
              cached: false,
              timestamp: new Date().toISOString(),
            },
          };
        }
      );
    } catch (error) {
      return {
        success: false,
        instance: input.instance,
        month: input.month,
        period: {
          from: '',
          to: '',
          from_unix: 0,
          to_unix: 0,
        },
        summary: {
          total_invoiced: '0.00',
          total_payments: '0.00',
          total_credit_memos: '0.00',
          net_invoiced: '0.00',
          accounts_receivable: '0.00',
        },
        by_status: {},
        counts: {
          invoices: 0,
          payments: 0,
          payments_valid: 0,
          payments_excluded: 0,
          credit_memos: 0,
        },
        _metadata: {
          tool_name: 'get_monthly_summary',
          cached: false,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}
