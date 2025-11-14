/**
 * Get Revenue Report - Comprehensive revenue reporting and analysis
 * Provides detailed revenue breakdown by period, job type, and sales rep
 *
 * ENHANCED: Now uses actual invoiced amounts with NET calculations by default
 * Revenue = Invoiced - Credit Memos - Refunds (NET invoiced)
 * Supports toggle to legacy estimate-based reporting for comparison
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { GetConsolidatedFinancialsTool } from '../financials/getConsolidatedFinancials.js';

interface RevenueByPeriod {
  period: string;
  total_revenue: number;
  job_count: number;
  avg_revenue: number;
  approved_estimates: number;
  pending_estimates: number;
}

interface RevenueByType {
  job_type: string;
  total_revenue: number;
  job_count: number;
  avg_revenue: number;
  percentage_of_total: number;
}

interface RevenueByRep {
  rep_id: string;
  rep_name: string;
  total_revenue: number;
  job_count: number;
  avg_deal_size: number;
  percentage_of_total: number;
}

export class GetRevenueReportTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_revenue_report',
      description: 'Revenue reporting: NET invoiced, estimates, period analysis, rep breakdown',
      inputSchema: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['current_month', 'last_month', 'current_quarter', 'last_quarter', 'ytd', 'all_time'],
            default: 'current_month',
            description: 'Time period for analysis',
          },
          use_invoiced_amounts: {
            type: 'boolean',
            default: true,
            description: 'Use NET invoiced amounts (true) or estimates (false). Default: true.',
          },
          include_pending: {
            type: 'boolean',
            default: false,
            description: 'Include pending estimates/invoices in projections',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    // Check if using new handle-based parameters for response optimization
    const useHandleResponse = this.hasNewParams(input);

    try {
      const period = input.period || 'current_month';
      const includePending = input.include_pending || false;
      const useInvoicedAmounts = input.use_invoiced_amounts !== false; // Default: true

      // Calculate period boundaries
      const now = new Date();
      const periodStart = this.getPeriodStart(period, now);

      // Initialize consolidated financials tool for invoice-based mode
      const consolidatedTool = useInvoicedAmounts ? new GetConsolidatedFinancialsTool() : null;

      // OPTIMIZATION (Week 2-3): Query Delegation Pattern
      // Filter jobs by period at server-side instead of fetching all
      // Reduces token usage by 90-95% by delegating filtering to JobNimbus API
      const queryFilter = periodStart ? JSON.stringify({
        must: [{
          range: {
            date_created: {
              gte: Math.floor(periodStart.getTime() / 1000) // Unix timestamp in seconds
            }
          }
        }]
      }) : undefined;

      const jobsResponse = await this.client.get(context.apiKey, 'jobs', {
        size: 50, // OPTIMIZED: Reduced from 100 for token efficiency
        filter: queryFilter,
        fields: ['jnid', 'number', 'date_created', 'record_type_name', 'sales_rep'], // JSONB Field Projection
      });
      const jobs = jobsResponse.data?.results || [];

      // Analyze revenue
      let totalRevenue = 0;
      let approvedRevenue = 0;
      let pendingRevenue = 0;
      let approvedCount = 0;
      let pendingCount = 0;

      const revenueByType = new Map<string, { revenue: number; count: number }>();
      const revenueByRep = new Map<string, { revenue: number; count: number; name: string }>();
      const monthlyRevenue = new Map<string, { revenue: number; count: number }>();

      // MODE 1: INVOICE-BASED REVENUE (uses actual invoiced amounts with NET calculations)
      if (useInvoicedAmounts && consolidatedTool) {
        for (const job of jobs) {
          if (!job.jnid) continue;

          const jobDate = job.date_created || 0;
          if (periodStart && jobDate < periodStart.getTime()) continue;

          try {
            // Query consolidated financials for this job
            const financialsResponse = await consolidatedTool.execute(
              {
                job_id: job.jnid,
                verbosity: 'compact',
                page_size: 100,
                include_invoices: true,
                include_credit_memos: true,
                include_payments: false, // Don't need payments for revenue calculation
                include_refunds: true,
              },
              context
            );

            // Extract NET invoiced amount (invoiced - credit_memos - refunds)
            const netInvoiced = financialsResponse.summary?.net_invoiced || 0;
            const totalInvoiced = financialsResponse.summary?.total_invoiced || 0;
            const hasPendingInvoices = financialsResponse.summary?.invoice_count === 0 && includePending;

            let jobRevenue = netInvoiced;
            let jobHasRevenue = netInvoiced > 0;

            // If including pending and no invoices yet, check for estimates
            if (hasPendingInvoices && includePending) {
              // For pending, we still need to query estimates as fallback
              const estimatesResponse = await this.client.get(context.apiKey, 'estimates', {
                filter: JSON.stringify({
                  must: [{ term: { 'related.id': job.jnid } }],
                }),
              });
              const jobEstimates = estimatesResponse.data?.results || [];

              for (const estimate of jobEstimates) {
                const estimateValue = parseFloat(estimate.total || 0) || 0;
                const statusName = (estimate.status_name || '').toLowerCase();
                const isPending = statusName === 'pending' || statusName === 'draft';

                if (isPending) {
                  pendingRevenue += estimateValue;
                  pendingCount += 1;
                }
              }
            }

            if (jobHasRevenue) {
              totalRevenue += jobRevenue;
              approvedRevenue += jobRevenue;
              approvedCount += 1;

              // By job type
              const jobType = job.record_type_name || 'Unknown';
              if (!revenueByType.has(jobType)) {
                revenueByType.set(jobType, { revenue: 0, count: 0 });
              }
              const typeStats = revenueByType.get(jobType)!;
              typeStats.revenue += jobRevenue;
              typeStats.count += 1;

              // By sales rep
              const repId = job.sales_rep || job.assigned_to || job.created_by || 'Unknown';
              const repName = job.sales_rep_name || 'Unknown';
              if (!revenueByRep.has(repId)) {
                revenueByRep.set(repId, { revenue: 0, count: 0, name: repName });
              }
              const repStats = revenueByRep.get(repId)!;
              repStats.revenue += jobRevenue;
              repStats.count += 1;

              // By month
              const monthKey = new Date(jobDate).toISOString().substring(0, 7); // YYYY-MM
              if (!monthlyRevenue.has(monthKey)) {
                monthlyRevenue.set(monthKey, { revenue: 0, count: 0 });
              }
              const monthStats = monthlyRevenue.get(monthKey)!;
              monthStats.revenue += jobRevenue;
              monthStats.count += 1;
            }
          } catch (error) {
            // Gracefully handle errors for individual jobs
            console.error(`Error fetching financials for job ${job.jnid}:`, error);
          }
        }
      } else {
        // MODE 2: ESTIMATE-BASED REVENUE (legacy behavior for backward compatibility)
        const estimatesResponse = await this.client.get(context.apiKey, 'estimates', { size: 100 });
        const estimates = estimatesResponse.data?.results || [];

        // Build estimate lookup by job
        const estimatesByJob = new Map<string, any[]>();
        for (const estimate of estimates) {
          const related = estimate.related || [];
          for (const rel of related) {
            if (rel.type === 'job' && rel.id) {
              const jobId = rel.id;
              if (!estimatesByJob.has(jobId)) {
                estimatesByJob.set(jobId, []);
              }
              estimatesByJob.get(jobId)!.push(estimate);
            }
          }
        }

        for (const job of jobs) {
          if (!job.jnid) continue;

          const jobDate = job.date_created || 0;
          if (periodStart && jobDate < periodStart.getTime()) continue;

          const jobEstimates = estimatesByJob.get(job.jnid) || [];
          let jobRevenue = 0;
          let jobApproved = false;

          for (const estimate of jobEstimates) {
            const estimateValue = parseFloat(estimate.total || 0) || 0;
            const statusName = (estimate.status_name || '').toLowerCase();
            const isSigned = estimate.date_signed > 0;
            const isApproved = isSigned || statusName === 'approved' || statusName === 'signed';

            if (isApproved) {
              jobRevenue += estimateValue;
              approvedRevenue += estimateValue;
              jobApproved = true;
            } else if (includePending) {
              pendingRevenue += estimateValue;
              pendingCount += 1;
            }
          }

          if (jobRevenue > 0 || (includePending && jobEstimates.length > 0)) {
            totalRevenue += jobRevenue;
            if (jobApproved) approvedCount += 1;

            // By job type
            const jobType = job.record_type_name || 'Unknown';
            if (!revenueByType.has(jobType)) {
              revenueByType.set(jobType, { revenue: 0, count: 0 });
            }
            const typeStats = revenueByType.get(jobType)!;
            typeStats.revenue += jobRevenue;
            typeStats.count += 1;

            // By sales rep
            const repId = job.sales_rep || job.assigned_to || job.created_by || 'Unknown';
            const repName = job.sales_rep_name || 'Unknown';
            if (!revenueByRep.has(repId)) {
              revenueByRep.set(repId, { revenue: 0, count: 0, name: repName });
            }
            const repStats = revenueByRep.get(repId)!;
            repStats.revenue += jobRevenue;
            repStats.count += 1;

            // By month
            const monthKey = new Date(jobDate).toISOString().substring(0, 7); // YYYY-MM
            if (!monthlyRevenue.has(monthKey)) {
              monthlyRevenue.set(monthKey, { revenue: 0, count: 0 });
            }
            const monthStats = monthlyRevenue.get(monthKey)!;
            monthStats.revenue += jobRevenue;
            monthStats.count += 1;
          }
        }
      }

      // Build revenue by type array
      const revenueByTypeArray: RevenueByType[] = Array.from(revenueByType.entries())
        .map(([type, stats]) => ({
          job_type: type,
          total_revenue: stats.revenue,
          job_count: stats.count,
          avg_revenue: stats.count > 0 ? stats.revenue / stats.count : 0,
          percentage_of_total: totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0,
        }))
        .sort((a, b) => b.total_revenue - a.total_revenue);

      // Build revenue by rep array
      const revenueByRepArray: RevenueByRep[] = Array.from(revenueByRep.entries())
        .map(([repId, stats]) => ({
          rep_id: repId,
          rep_name: stats.name,
          total_revenue: stats.revenue,
          job_count: stats.count,
          avg_deal_size: stats.count > 0 ? stats.revenue / stats.count : 0,
          percentage_of_total: totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0,
        }))
        .sort((a, b) => b.total_revenue - a.total_revenue);

      // Build monthly trend
      const monthlyTrend: RevenueByPeriod[] = Array.from(monthlyRevenue.entries())
        .map(([month, stats]) => ({
          period: month,
          total_revenue: stats.revenue,
          job_count: stats.count,
          avg_revenue: stats.count > 0 ? stats.revenue / stats.count : 0,
          approved_estimates: stats.count,
          pending_estimates: 0,
        }))
        .sort((a, b) => a.period.localeCompare(b.period));

      // Build response data
      const responseData = {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        period: {
          selected: period,
          start_date: periodStart?.toISOString() || null,
          end_date: now.toISOString(),
        },
        summary: {
          total_revenue: totalRevenue,
          approved_revenue: approvedRevenue,
          pending_revenue: pendingRevenue,
          total_jobs: approvedCount,
          pending_estimates: pendingCount,
          average_deal_size: approvedCount > 0 ? totalRevenue / approvedCount : 0,
          projected_total: includePending ? totalRevenue + pendingRevenue : totalRevenue,
        },
        revenue_by_job_type: revenueByTypeArray,
        revenue_by_sales_rep: revenueByRepArray.slice(0, 10),
        monthly_trend: monthlyTrend,
        insights: this.generateInsights(
          totalRevenue,
          approvedCount,
          revenueByTypeArray,
          revenueByRepArray,
          monthlyTrend
        ),
        recommendations: this.generateRecommendations(
          totalRevenue,
          pendingRevenue,
          approvedCount,
          pendingCount
        ),
      };

      // Use handle-based response if requested
      if (useHandleResponse) {
        const envelope = await this.wrapResponse([responseData], input, context, {
          entity: 'revenue_report',
          maxRows: revenueByTypeArray.length + revenueByRepArray.length + monthlyTrend.length,
          pageInfo: {
            current_page: 1,
            total_pages: 1,
            has_more: false,
          },
        });

        return {
          ...envelope,
          query_metadata: {
            period,
            total_revenue: totalRevenue,
            approved_count: approvedCount,
            pending_count: pendingCount,
            data_source: useInvoicedAmounts ? 'invoices' : 'estimates',
            data_freshness: 'real-time',
          },
        };
      }

      // Fallback to legacy response
      return responseData;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }

  private getPeriodStart(period: string, now: Date): Date | null {
    const year = now.getFullYear();
    const month = now.getMonth();
    const quarter = Math.floor(month / 3);

    switch (period) {
      case 'current_month':
        return new Date(year, month, 1);
      case 'last_month':
        return new Date(year, month - 1, 1);
      case 'current_quarter':
        return new Date(year, quarter * 3, 1);
      case 'last_quarter':
        return new Date(year, (quarter - 1) * 3, 1);
      case 'ytd':
        return new Date(year, 0, 1);
      case 'all_time':
        return null;
      default:
        return new Date(year, month, 1);
    }
  }

  private generateInsights(
    totalRevenue: number,
    jobCount: number,
    byType: RevenueByType[],
    byRep: RevenueByRep[],
    trend: RevenueByPeriod[]
  ): string[] {
    const insights: string[] = [];

    // Revenue concentration
    if (byType.length > 0) {
      const topType = byType[0];
      insights.push(
        `${topType.job_type} is the top revenue generator (${topType.percentage_of_total.toFixed(1)}% of total)`
      );
    }

    // Top performer
    if (byRep.length > 0) {
      const topRep = byRep[0];
      insights.push(
        `${topRep.rep_name} leads in revenue with $${topRep.total_revenue.toFixed(2)} (${topRep.percentage_of_total.toFixed(1)}%)`
      );
    }

    // Trend analysis
    if (trend.length >= 2) {
      const current = trend[trend.length - 1];
      const previous = trend[trend.length - 2];
      const growth = ((current.total_revenue - previous.total_revenue) / previous.total_revenue) * 100;

      if (Math.abs(growth) > 5) {
        insights.push(
          `Revenue ${growth > 0 ? 'increased' : 'decreased'} by ${Math.abs(growth).toFixed(1)}% vs previous period`
        );
      }
    }

    // Average deal size
    const avgDeal = jobCount > 0 ? totalRevenue / jobCount : 0;
    insights.push(`Average deal size: $${avgDeal.toFixed(2)} across ${jobCount} jobs`);

    return insights;
  }

  private generateRecommendations(
    approvedRevenue: number,
    pendingRevenue: number,
    approvedCount: number,
    pendingCount: number
  ): string[] {
    const recommendations: string[] = [];

    // Pending opportunities
    if (pendingRevenue > approvedRevenue * 0.2) {
      recommendations.push(
        `Focus on converting ${pendingCount} pending estimates worth $${pendingRevenue.toFixed(2)}`
      );
    }

    // Low volume warning
    if (approvedCount < 10) {
      recommendations.push('Low job volume - increase lead generation and sales activities');
    }

    // High pending ratio
    const totalEstimates = approvedCount + pendingCount;
    if (totalEstimates > 0 && pendingCount / totalEstimates > 0.5) {
      recommendations.push('High pending estimate ratio - review pricing and follow-up processes');
    }

    if (recommendations.length === 0) {
      recommendations.push('Revenue performance is healthy - maintain current sales strategies');
    }

    return recommendations;
  }
}
