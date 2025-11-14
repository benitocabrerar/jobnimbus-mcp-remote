/**
 * Get Sales Rep Performance - Detailed analytics per sales representative
 * Replicates Python implementation from mcp_server_consolidated_final.py
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { validate_conversion_real } from '../../utils/conversionValidation.js';

interface SalesRepPerformance {
  rep_id: string;
  name: string;
  jobs_count: number;
  total_value: number;
  avg_value: number;
  conversion_rate: number;
  conversion_verified: boolean; // True if conversion backed by financial data
  won_jobs: number;
  lost_jobs: number;
  pending_jobs: number;
  estimates_sent: number;
  estimates_approved: number;
}

export class GetSalesRepPerformanceTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_sales_rep_performance',
      description: 'Sales rep performance & financial metrics',
      inputSchema: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            description: 'Analysis period',
            default: 'current_month',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    // Check if using new handle-based parameters for response optimization
    const useHandleResponse = this.hasNewParams(input);

    try {
      // Fetch jobs and estimates from JobNimbus API
      const [jobsResponse, estimatesResponse] = await Promise.all([
        this.client.get(context.apiKey, 'jobs', { size: 20 }),
        this.client.get(context.apiKey, 'estimates', { size: 15 }),
      ]);

      const jobs = jobsResponse.data?.results || [];
      const estimates = estimatesResponse.data?.results || [];

      // Build lookup maps
      const jobLookup = new Map();
      for (const job of jobs) {
        if (job.jnid) {
          jobLookup.set(job.jnid, job);
        }
      }

      // Map estimates to jobs
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

      // Calculate performance by rep
      const repPerformance = new Map<string, SalesRepPerformance>();

      for (const job of jobs) {
        if (!job.jnid) continue;

        const salesRep = job.sales_rep || job.assigned_to || job.created_by || 'Unknown';
        const salesRepName = job.sales_rep_name || 'Unknown';

        if (!repPerformance.has(salesRep)) {
          repPerformance.set(salesRep, {
            rep_id: salesRep,
            name: salesRepName,
            jobs_count: 0,
            total_value: 0,
            avg_value: 0,
            conversion_rate: 0,
            conversion_verified: false,
            won_jobs: 0,
            lost_jobs: 0,
            pending_jobs: 0,
            estimates_sent: 0,
            estimates_approved: 0,
          });
        }

        const rep = repPerformance.get(salesRep)!;
        rep.jobs_count += 1;

        // Categorize job status
        const statusName = (job.status_name || '').toLowerCase();
        if (
          statusName.includes('complete') ||
          statusName.includes('won') ||
          statusName.includes('sold') ||
          statusName.includes('approved')
        ) {
          rep.won_jobs += 1;
        } else if (
          statusName.includes('lost') ||
          statusName.includes('cancelled') ||
          statusName.includes('declined')
        ) {
          rep.lost_jobs += 1;
        } else {
          rep.pending_jobs += 1;
        }

        // Process job estimates
        const jobEstimates = estimatesByJob.get(job.jnid) || [];
        let jobEstimateValue = 0;

        for (const estimate of jobEstimates) {
          rep.estimates_sent += 1;
          const estimateTotal = parseFloat(estimate.total || 0) || 0;
          jobEstimateValue += estimateTotal;

          // Check if estimate is approved
          const estimateStatus = (estimate.status_name || '').toLowerCase();
          if (
            estimate.date_signed > 0 ||
            estimateStatus === 'approved' ||
            estimateStatus === 'signed'
          ) {
            rep.estimates_approved += 1;
          }
        }

        rep.total_value += jobEstimateValue;
      }

      // Calculate averages and conversion rates
      for (const rep of repPerformance.values()) {
        if (rep.jobs_count > 0) {
          rep.avg_value = rep.total_value / rep.jobs_count;

          // FIXED: Validate financial data exists before counting conversion
          // Prevents false positives where jobs are marked "won" but have no revenue
          const validation = validate_conversion_real(rep.total_value, rep.estimates_approved);
          const totalDecisions = rep.won_jobs + rep.lost_jobs;

          if (totalDecisions > 0 && validation.hasFinancialData) {
            rep.conversion_rate = rep.won_jobs / totalDecisions;
          } else {
            rep.conversion_rate = 0.0;  // No financial data = no valid conversion
          }

          rep.conversion_verified = validation.hasFinancialData;
        }
      }

      // Sort by total value
      const sortedReps = Array.from(repPerformance.values()).sort(
        (a, b) => b.total_value - a.total_value
      );

      // Calculate team summary
      let totalJobs = 0;
      let totalValue = 0;
      let totalEstimates = 0;
      let totalApproved = 0;

      for (const rep of repPerformance.values()) {
        totalJobs += rep.jobs_count;
        totalValue += rep.total_value;
        totalEstimates += rep.estimates_sent;
        totalApproved += rep.estimates_approved;
      }

      // Build response data
      const responseData = {
        data_source: 'Live JobNimbus API data with FIXED matching logic',
        analysis_timestamp: new Date().toISOString(),
        total_sales_reps: repPerformance.size,
        team_summary: {
          total_jobs: totalJobs,
          total_pipeline_value: totalValue,
          total_estimates_sent: totalEstimates,
          total_estimates_approved: totalApproved,
          team_conversion_rate: totalEstimates > 0 ? totalApproved / totalEstimates : 0,
          average_deal_size: totalJobs > 0 ? totalValue / totalJobs : 0,
        },
        performance_by_rep: sortedReps.slice(0, 15),
        fix_status: 'APPLIED - Job-estimate matching corrected',
      };

      // Use handle-based response if requested
      if (useHandleResponse) {
        const envelope = await this.wrapResponse([responseData], input, context, {
          entity: 'sales_rep_performance',
          maxRows: sortedReps.length,
          pageInfo: {
            current_page: 1,
            total_pages: 1,
            has_more: false,
          },
        });

        return {
          ...envelope,
          query_metadata: {
            total_reps: repPerformance.size,
            total_jobs: totalJobs,
            total_value: totalValue,
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
}
