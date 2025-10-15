/**
 * Get Consolidated Financials Tool
 *
 * MULTI-SOURCE FINANCIAL AGGREGATION - Comprehensive financial view
 * Queries FOUR sources in parallel:
 * 1. /api1/invoices - Customer invoices
 * 2. /api1/credit_memos - Credit memos (deductions from invoiced amounts)
 * 3. /api1/payments - Payment records
 * 4. /api1/refunds - Refund records
 *
 * Provides NET financial calculations:
 * - net_invoiced = total_invoiced - total_credit_memos - total_refunds
 * - balance_due = net_invoiced - total_payments
 *
 * PHASE 3: Handle-based response system for token optimization
 * - Automatic response size detection and handle storage
 * - Verbosity levels: summary/compact/detailed/raw
 * - Field selection support
 * - Redis cache + handle storage integration
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext, BaseToolInput } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetConsolidatedFinancialsInput extends BaseToolInput {
  // Entity filtering
  job_id?: string;
  contact_id?: string;
  related_to?: string;

  // Date filtering
  date_from?: string;
  date_to?: string;

  // Pagination
  from?: number;
  size?: number;
  page_size?: number;

  // Response control (Phase 3: Handle-based system)
  verbosity?: 'summary' | 'compact' | 'detailed' | 'raw';
  fields?: string;

  // Financial record filtering
  include_invoices?: boolean;
  include_credit_memos?: boolean;
  include_payments?: boolean;
  include_refunds?: boolean;
}

interface FinancialRelated {
  id: string;
  type?: string;
  name?: string;
  number?: string;
}

interface FinancialPrimary {
  id: string;
  type?: string;
  number?: string;
  name?: string;
  email?: string;
}

/**
 * Generic financial record interface
 */
interface FinancialRecord {
  jnid: string;
  type: string;
  record_type_name?: string;
  customer?: string;

  // Amounts
  total?: number;
  amount?: number;

  // Dates
  date_created: number;
  date_updated?: number;
  date_payment?: number;

  // Relationships
  related?: FinancialRelated[];
  primary?: FinancialPrimary;

  // Status
  is_active?: boolean;
  is_archived?: boolean;

  // References
  invoice_id?: string;
  invoice_no?: string;
  reference?: string;

  // Sales
  sales_rep?: string;
  sales_rep_name?: string;

  // Creator
  created_by?: string;
  created_by_name?: string;

  [key: string]: any;
}

/**
 * Invoice-CreditMemo link tracking
 */
interface InvoiceCreditLink {
  invoice_id: string;
  invoice_number?: string;
  credit_memo_ids: string[];
  total_credits_applied: number;
  credit_memos: FinancialRecord[];
}

/**
 * Generate deterministic cache identifier
 * Format: {entity_id}:{date_from}:{date_to}:{from}:{size}:{page_size}:{verbosity}:{fields}:{include_flags}
 */
function generateCacheIdentifier(input: GetConsolidatedFinancialsInput): string {
  const entityId = input.job_id || input.contact_id || input.related_to || 'all';
  const dateFrom = input.date_from || 'null';
  const dateTo = input.date_to || 'null';
  const from = input.from || 0;
  const size = input.size || 100;
  const pageSize = input.page_size || 'null';
  const verbosity = input.verbosity || 'null';
  const fields = input.fields || 'null';

  const includeInvoices = input.include_invoices !== false ? '1' : '0';
  const includeCreditMemos = input.include_credit_memos !== false ? '1' : '0';
  const includePayments = input.include_payments !== false ? '1' : '0';
  const includeRefunds = input.include_refunds !== false ? '1' : '0';
  const includeFlags = `${includeInvoices}${includeCreditMemos}${includePayments}${includeRefunds}`;

  return `${entityId}:${dateFrom}:${dateTo}:${from}:${size}:${pageSize}:${verbosity}:${fields}:${includeFlags}`;
}

export class GetConsolidatedFinancialsTool extends BaseTool<GetConsolidatedFinancialsInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_consolidated_financials',
      description: 'MULTI-SOURCE financial aggregation with NET amount calculations. Queries invoices, credit_memos, payments, and refunds in parallel. Calculates net_invoiced (invoiced - credits - refunds) and balance_due (net - payments). Tracks invoice-credit_memo reference links. IMPORTANT: By default returns compact summary with result_handle for full data retrieval. Large responses (>25 KB) automatically stored in Redis with 15-min TTL - use fetch_by_handle to retrieve. Supports entity filtering (job_id, contact_id), date filtering, and automatic deduplication.',
      inputSchema: {
        type: 'object',
        properties: {
          // NEW: Handle-based response control
          verbosity: {
            type: 'string',
            description: 'Response detail level: "summary" (5 fields, max 5 records), "compact" (15 fields, max 20 records - DEFAULT), "detailed" (50 fields, max 50 records), "raw" (all fields). Compact mode prevents chat saturation.',
            enum: ['summary', 'compact', 'detailed', 'raw'],
          },
          fields: {
            type: 'string',
            description: 'Comma-separated field names to return. Example: "jnid,total,type,date_created,sales_rep_name". Overrides verbosity-based field selection.',
          },
          page_size: {
            type: 'number',
            description: 'Number of records per page (default: 20, max: 100). Replaces "size" parameter.',
          },

          // Entity filtering
          job_id: {
            type: 'string',
            description: 'Filter financial records by job number (e.g., "1820") or internal JNID. Both formats work automatically.',
          },
          contact_id: {
            type: 'string',
            description: 'Filter financial records by contact ID',
          },
          related_to: {
            type: 'string',
            description: 'Filter by any related entity ID (job, contact, estimate, etc.)',
          },

          // Date filtering
          date_from: {
            type: 'string',
            description: 'Start date filter for date_created (YYYY-MM-DD format)',
          },
          date_to: {
            type: 'string',
            description: 'End date filter for date_created (YYYY-MM-DD format)',
          },

          // Legacy pagination
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0). NOTE: Prefer page_size for large datasets.',
          },
          size: {
            type: 'number',
            description: 'Number of records to fetch per source (default: 100, max: 500). DEPRECATED: Use page_size instead.',
          },

          // Financial record type filtering
          include_invoices: {
            type: 'boolean',
            description: 'Include invoices in results (default: true)',
          },
          include_credit_memos: {
            type: 'boolean',
            description: 'Include credit memos in results (default: true)',
          },
          include_payments: {
            type: 'boolean',
            description: 'Include payments in results (default: true)',
          },
          include_refunds: {
            type: 'boolean',
            description: 'Include refunds in results (default: true)',
          },
        },
      },
    };
  }

  /**
   * Convert YYYY-MM-DD string to Unix timestamp
   */
  private dateStringToUnix(dateStr: string, isStartOfDay: boolean = true): number {
    const date = new Date(dateStr + 'T00:00:00Z');
    if (isStartOfDay) {
      return Math.floor(date.getTime() / 1000);
    } else {
      // End of day (23:59:59)
      return Math.floor(date.getTime() / 1000) + 86399;
    }
  }

  /**
   * Filter records by related entity ID (client-side filtering)
   */
  private filterByRelatedEntity(records: FinancialRecord[], entityId: string): FinancialRecord[] {
    return records.filter((record) => {
      // Check if entityId is in related array
      const inRelated = record.related?.some((rel) => rel.id === entityId);

      // Check if entityId is the primary
      const isPrimary = record.primary?.id === entityId;

      return inRelated || isPrimary;
    });
  }

  /**
   * Filter records by date_created
   */
  private filterByDate(records: FinancialRecord[], dateFrom?: string, dateTo?: string): FinancialRecord[] {
    let filtered = records;

    if (dateFrom) {
      const fromTs = this.dateStringToUnix(dateFrom, true);
      filtered = filtered.filter((r) => (r.date_created || 0) >= fromTs);
    }

    if (dateTo) {
      const toTs = this.dateStringToUnix(dateTo, false);
      filtered = filtered.filter((r) => (r.date_created || 0) <= toTs);
    }

    return filtered;
  }

  /**
   * Extract amount from financial record
   */
  private getRecordAmount(record: FinancialRecord): number {
    return record.total || record.amount || 0;
  }

  /**
   * Build invoice-credit memo reference links
   */
  private buildInvoiceCreditLinks(
    invoices: FinancialRecord[],
    creditMemos: FinancialRecord[]
  ): InvoiceCreditLink[] {
    const links: InvoiceCreditLink[] = [];

    for (const invoice of invoices) {
      // Find credit memos that reference this invoice
      const relatedCredits = creditMemos.filter((cm) => {
        // Check if credit memo has invoice_id field matching this invoice
        if (cm.invoice_id === invoice.jnid) return true;

        // Check if invoice is in related array
        const hasInvoiceInRelated = cm.related?.some(
          (rel) => rel.id === invoice.jnid && rel.type === 'invoice'
        );
        return hasInvoiceInRelated;
      });

      if (relatedCredits.length > 0) {
        const totalCredits = relatedCredits.reduce(
          (sum, cm) => sum + this.getRecordAmount(cm),
          0
        );

        links.push({
          invoice_id: invoice.jnid,
          invoice_number: invoice.number || invoice.invoice_no,
          credit_memo_ids: relatedCredits.map((cm) => cm.jnid),
          total_credits_applied: totalCredits,
          credit_memos: relatedCredits,
        });
      }
    }

    return links;
  }

  async execute(input: GetConsolidatedFinancialsInput, context: ToolContext): Promise<any> {
    // Determine page size - prefer page_size (new) over size (legacy)
    const pageSize = input.page_size || input.size || 100;
    const fromIndex = input.from || 0;
    const fetchSize = Math.min(pageSize, 500);

    // Generate cache identifier
    const cacheIdentifier = generateCacheIdentifier(input);

    // Wrap with cache layer (Redis cache integration)
    return await withCache(
      {
        entity: CACHE_PREFIXES.INVOICES,
        operation: CACHE_PREFIXES.LIST,
        identifier: cacheIdentifier,
      },
      getTTL('INVOICES_LIST'),
      async () => {
        try {
          // Determine entity ID for filtering
          const entityId = input.job_id || input.contact_id || input.related_to;

          // Build Elasticsearch filters for each source endpoint
          const buildFilter = (fieldPath: string) => {
            if (!entityId) return undefined;
            return JSON.stringify({
              must: [
                {
                  term: {
                    [fieldPath]: entityId,
                  },
                },
              ],
            });
          };

          // Determine which record types to query
          const includeInvoices = input.include_invoices !== false;
          const includeCreditMemos = input.include_credit_memos !== false;
          const includePayments = input.include_payments !== false;
          const includeRefunds = input.include_refunds !== false;

          const invoicesFilter = buildFilter('related.id');
          const creditMemosFilter = buildFilter('related.id');
          const paymentsFilter = buildFilter('related.id');
          const refundsFilter = buildFilter('related.id');

          // Execute parallel queries to all financial endpoints
          const queries: Promise<any>[] = [];

          if (includeInvoices) {
            queries.push(
              this.client
                .get(context.apiKey, 'invoices', {
                  filter: invoicesFilter,
                  size: fetchSize,
                })
                .catch((err) => ({ data: [], error: err, source: 'invoices' }))
            );
          }

          if (includeCreditMemos) {
            queries.push(
              this.client
                .get(context.apiKey, 'credit_memos', {
                  filter: creditMemosFilter,
                  size: fetchSize,
                })
                .catch((err) => ({ data: [], error: err, source: 'credit_memos' }))
            );
          }

          if (includePayments) {
            queries.push(
              this.client
                .get(context.apiKey, 'payments', {
                  filter: paymentsFilter,
                  size: fetchSize,
                })
                .catch((err) => ({ data: [], error: err, source: 'payments' }))
            );
          }

          if (includeRefunds) {
            queries.push(
              this.client
                .get(context.apiKey, 'refunds', {
                  filter: refundsFilter,
                  size: fetchSize,
                })
                .catch((err) => ({ data: [], error: err, source: 'refunds' }))
            );
          }

          const responses = await Promise.all(queries);

          // Extract arrays from each response
          let invoicesArray: FinancialRecord[] = [];
          let creditMemosArray: FinancialRecord[] = [];
          let paymentsArray: FinancialRecord[] = [];
          let refundsArray: FinancialRecord[] = [];

          let queryIndex = 0;
          if (includeInvoices) {
            const invoicesResponse = responses[queryIndex++];
            invoicesArray = invoicesResponse.data?.results || invoicesResponse.data || [];
          }
          if (includeCreditMemos) {
            const creditMemosResponse = responses[queryIndex++];
            creditMemosArray = creditMemosResponse.data?.results || creditMemosResponse.data || [];
          }
          if (includePayments) {
            const paymentsResponse = responses[queryIndex++];
            paymentsArray = paymentsResponse.data?.results || paymentsResponse.data || [];
          }
          if (includeRefunds) {
            const refundsResponse = responses[queryIndex++];
            refundsArray = refundsResponse.data?.results || refundsResponse.data || [];
          }

          // Track source counts for metadata
          const sourceCounts = {
            invoices: Array.isArray(invoicesArray) ? invoicesArray.length : 0,
            credit_memos: Array.isArray(creditMemosArray) ? creditMemosArray.length : 0,
            payments: Array.isArray(paymentsArray) ? paymentsArray.length : 0,
            refunds: Array.isArray(refundsArray) ? refundsArray.length : 0,
          };

          // Combine all sources
          let allRecords: FinancialRecord[] = [
            ...(Array.isArray(invoicesArray) ? invoicesArray : []),
            ...(Array.isArray(creditMemosArray) ? creditMemosArray : []),
            ...(Array.isArray(paymentsArray) ? paymentsArray : []),
            ...(Array.isArray(refundsArray) ? refundsArray : []),
          ];

          // Deduplicate by jnid
          const seenIds = new Set<string>();
          const deduplicatedRecords: FinancialRecord[] = [];

          for (const record of allRecords) {
            const recordId = record.jnid || record.id || `${record.type}_${record.date_created}`;

            if (!seenIds.has(recordId)) {
              seenIds.add(recordId);
              deduplicatedRecords.push(record);
            }
          }

          allRecords = deduplicatedRecords;
          const totalFromAPI = allRecords.length;

          // Apply date filtering if provided
          if (input.date_from || input.date_to) {
            allRecords = this.filterByDate(allRecords, input.date_from, input.date_to);
          }

          // Sort by date_created descending (newest first)
          allRecords.sort((a, b) => {
            const dateA = a.date_created || 0;
            const dateB = b.date_created || 0;
            return dateB - dateA;
          });

          // Calculate financial totals
          const totalInvoiced = invoicesArray.reduce(
            (sum, inv) => sum + this.getRecordAmount(inv),
            0
          );
          let totalCreditMemos = creditMemosArray.reduce(
            (sum, cm) => sum + this.getRecordAmount(cm),
            0
          );
          const totalPayments = paymentsArray.reduce(
            (sum, p) => sum + this.getRecordAmount(p),
            0
          );
          let totalRefunds = refundsArray.reduce(
            (sum, r) => sum + this.getRecordAmount(r),
            0
          );

          // NET CALCULATIONS (as requested by user)
          let netInvoiced = totalInvoiced - totalCreditMemos - totalRefunds;
          let balanceDue = netInvoiced - totalPayments;

          // YAML FALLBACK: Check for FILE-based vendor costs when RECORDS show $0
          let usedYamlFallback = false;
          if (entityId && totalCreditMemos === 0 && totalRefunds === 0) {
            try {
              // Query /files endpoint for this job
              const filesResponse = await this.client.get(context.apiKey, 'files', {
                filter: JSON.stringify({
                  must: [{ term: { 'related.id': entityId } }]
                }),
                size: 500
              });

              const files = filesResponse.data?.files || filesResponse.data?.results || [];

              // Regex patterns for vendor invoices
              const chargePattern = /retail - invoice[a-z]* - .* - ([0-9.]+)\.(pdf|png)/i;
              const returnPattern = /retail - invoicereturns - .* - \(-([0-9.]+)\)\.(pdf|png)/i;

              let vendorCharges = 0;
              let vendorReturns = 0;

              for (const file of files) {
                const filename = file.filename || '';

                // Check for charge invoices
                const chargeMatch = filename.match(chargePattern);
                if (chargeMatch) {
                  vendorCharges += parseFloat(chargeMatch[1]) || 0;
                  continue;
                }

                // Check for return invoices
                const returnMatch = filename.match(returnPattern);
                if (returnMatch) {
                  vendorReturns += parseFloat(returnMatch[1]) || 0;
                }
              }

              // Apply vendor costs as negative adjustments
              if (vendorCharges > 0 || vendorReturns > 0) {
                totalCreditMemos += vendorCharges;
                totalRefunds -= vendorReturns; // Returns are negative, so subtract
                netInvoiced = totalInvoiced - totalCreditMemos - totalRefunds;
                balanceDue = netInvoiced - totalPayments;
                usedYamlFallback = true;
              }
            } catch (error) {
              // Gracefully handle fallback errors - continue with RECORDS-only data
              console.error('YAML fallback error:', error);
            }
          }

          // Build invoice-credit memo reference links
          const invoiceCreditLinks = this.buildInvoiceCreditLinks(invoicesArray, creditMemosArray);

          // Apply pagination to consolidated records
          const paginatedRecords = allRecords.slice(fromIndex, fromIndex + fetchSize);

          // Build page info
          const pageInfo = {
            has_more: totalFromAPI > fromIndex + paginatedRecords.length,
            total: allRecords.length,
            current_page: Math.floor(fromIndex / pageSize) + 1,
            total_pages: Math.ceil(allRecords.length / pageSize),
          };

          // Prepare consolidated response data
          const consolidatedData = {
            // Financial summary
            financial_summary: {
              total_invoiced: totalInvoiced.toFixed(2),
              total_credit_memos: totalCreditMemos.toFixed(2),
              total_refunds: totalRefunds.toFixed(2),
              total_payments: totalPayments.toFixed(2),
              net_invoiced: netInvoiced.toFixed(2),
              balance_due: balanceDue.toFixed(2),
              used_yaml_fallback: usedYamlFallback,
            },

            // Record counts by type
            record_counts: sourceCounts,

            // Invoice-credit memo links
            invoice_credit_links: invoiceCreditLinks,

            // All financial records (paginated)
            records: paginatedRecords,

            // Separate arrays by type (for convenience)
            by_type: {
              invoices: invoicesArray,
              credit_memos: creditMemosArray,
              payments: paymentsArray,
              refunds: refundsArray,
            },
          };

          // Check if using new handle-based parameters
          if (this.hasNewParams(input)) {
            // NEW BEHAVIOR: Use handle-based response system
            // ResponseBuilder expects the raw data array
            const envelope = await this.wrapResponse(paginatedRecords, input, context, {
              entity: 'financial_records',
              maxRows: pageSize,
              pageInfo,
            });

            // Add consolidated financials-specific metadata
            return {
              ...envelope,
              financial_summary: consolidatedData.financial_summary,
              record_counts: consolidatedData.record_counts,
              invoice_credit_links: consolidatedData.invoice_credit_links,
              query_metadata: {
                count: paginatedRecords.length,
                total_from_api: totalFromAPI,
                total_after_filtering: allRecords.length,
                from: fromIndex,
                page_size: pageSize,
                sources_queried: {
                  ...sourceCounts,
                  total_before_deduplication:
                    sourceCounts.invoices +
                    sourceCounts.credit_memos +
                    sourceCounts.payments +
                    sourceCounts.refunds,
                  total_after_deduplication: totalFromAPI,
                  duplicates_removed:
                    sourceCounts.invoices +
                    sourceCounts.credit_memos +
                    sourceCounts.payments +
                    sourceCounts.refunds -
                    totalFromAPI,
                },
                filter_applied: {
                  entity_id: entityId,
                  job_id: input.job_id,
                  contact_id: input.contact_id,
                  related_to: input.related_to,
                  date_from: input.date_from,
                  date_to: input.date_to,
                },
              },
            };
          } else {
            // LEGACY BEHAVIOR: Return complete consolidated data
            return {
              success: true,
              ...consolidatedData,
              count: paginatedRecords.length,
              total_from_api: totalFromAPI,
              total_after_filtering: allRecords.length,
              from: fromIndex,
              size: fetchSize,
              sources_queried: {
                ...sourceCounts,
                total_before_deduplication:
                  sourceCounts.invoices +
                  sourceCounts.credit_memos +
                  sourceCounts.payments +
                  sourceCounts.refunds,
                total_after_deduplication: totalFromAPI,
                duplicates_removed:
                  sourceCounts.invoices +
                  sourceCounts.credit_memos +
                  sourceCounts.payments +
                  sourceCounts.refunds -
                  totalFromAPI,
              },
              filter_applied: {
                entity_id: entityId,
                job_id: input.job_id,
                contact_id: input.contact_id,
                related_to: input.related_to,
                date_from: input.date_from,
                date_to: input.date_to,
              },
              has_more: pageInfo.has_more,
              _note:
                'MULTI-SOURCE FINANCIAL AGGREGATION: Queries /invoices, /credit_memos, /payments, and /refunds endpoints in parallel. Calculates NET amounts (invoiced - credits - refunds) and balance_due (net - payments). Tracks invoice-credit_memo reference links. Automatically deduplicates across sources. Accepts job NUMBER or internal JNID - both work.',
            };
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch consolidated financials',
            status: 'error',
            filter_applied: {
              job_id: input.job_id,
              contact_id: input.contact_id,
              related_to: input.related_to,
            },
            note: 'Error querying financial endpoints',
          };
        }
      }
    );
  }
}
