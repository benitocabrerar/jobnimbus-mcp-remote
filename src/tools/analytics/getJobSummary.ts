/**
 * Get Job Summary
 * Comprehensive job analytics dashboard with KPIs, performance metrics, and trend analysis
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface JobKPI {
  total_jobs: number;
  active_jobs: number;
  completed_jobs: number;
  cancelled_jobs: number;
  total_revenue: number;
  pending_revenue: number;
  avg_job_value: number;
  completion_rate: number;
}

interface StatusBreakdown {
  status_name: string;
  count: number;
  percentage: number;
  total_value: number;
  avg_value: number;
  avg_age_days: number;
}

interface JobTypeMetrics {
  job_type: string;
  count: number;
  revenue: number;
  avg_value: number;
  completion_rate: number;
  avg_cycle_time_days: number;
}

export class GetJobSummaryTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_job_summary',
      description: 'Comprehensive job analytics dashboard with KPIs, performance metrics, status breakdowns, and trend analysis',
      inputSchema: {
        type: 'object',
        properties: {
          time_period_days: {
            type: 'number',
            default: 90,
            description: 'Time period for analysis in days (default: 90)',
          },
          include_trends: {
            type: 'boolean',
            default: true,
            description: 'Include trend analysis',
          },
          group_by_type: {
            type: 'boolean',
            default: true,
            description: 'Group metrics by job type',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const timePeriodDays = input.time_period_days || 90;
      const includeTrends = input.include_trends !== false;
      const groupByType = input.group_by_type !== false;

      // Fetch data
      const [jobsResponse, estimatesResponse] = await Promise.all([
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'estimates', { size: 100 }),
      ]);

      const jobs = jobsResponse.data?.results || [];
      const estimates = estimatesResponse.data?.results || [];

      // Build estimate lookup
      const estimatesByJob = new Map<string, any[]>();
      for (const estimate of estimates) {
        const related = estimate.related || [];
        for (const rel of related) {
          if (rel.type === 'job' && rel.id) {
            if (!estimatesByJob.has(rel.id)) {
              estimatesByJob.set(rel.id, []);
            }
            estimatesByJob.get(rel.id)!.push(estimate);
          }
        }
      }

      const now = Date.now();
      const cutoffDate = now - (timePeriodDays * 24 * 60 * 60 * 1000);

      // Filter jobs by time period
      const filteredJobs = jobs.filter((j: any) => {
        const createdDate = j.date_created || 0;
        return createdDate >= cutoffDate;
      });

      // Calculate KPIs
      let totalJobs = 0;
      let activeJobs = 0;
      let completedJobs = 0;
      let cancelledJobs = 0;
      let totalRevenue = 0;
      let pendingRevenue = 0;

      // Status breakdown
      const statusMap = new Map<string, {
        count: number;
        totalValue: number;
        totalAge: number;
      }>();

      // Job type metrics
      const jobTypeMap = new Map<string, {
        count: number;
        revenue: number;
        completed: number;
        totalCycleTime: number;
      }>();

      for (const job of filteredJobs) {
        totalJobs++;

        const statusName = job.status_name || 'Unknown';
        const jobType = job.job_type_name || 'Unspecified';
        const isComplete = statusName.toLowerCase().includes('complete') ||
                          statusName.toLowerCase().includes('won') ||
                          statusName.toLowerCase().includes('sold');
        const isCancelled = statusName.toLowerCase().includes('cancel') ||
                           statusName.toLowerCase().includes('lost');

        // Count by status
        if (isComplete) {
          completedJobs++;
        } else if (isCancelled) {
          cancelledJobs++;
        } else {
          activeJobs++;
        }

        // Calculate job value
        let jobValue = 0;
        const jobEstimates = estimatesByJob.get(job.jnid) || [];
        for (const est of jobEstimates) {
          const estValue = parseFloat(est.total || 0);
          jobValue += estValue;

          if (est.date_signed > 0 || est.status_name === 'approved') {
            totalRevenue += estValue;
          } else {
            pendingRevenue += estValue;
          }
        }

        // Status breakdown
        if (!statusMap.has(statusName)) {
          statusMap.set(statusName, { count: 0, totalValue: 0, totalAge: 0 });
        }
        const statusData = statusMap.get(statusName)!;
        statusData.count++;
        statusData.totalValue += jobValue;

        const createdDate = job.date_created || now;
        const ageInDays = (now - createdDate) / (24 * 60 * 60 * 1000);
        statusData.totalAge += ageInDays;

        // Job type metrics
        if (groupByType) {
          if (!jobTypeMap.has(jobType)) {
            jobTypeMap.set(jobType, {
              count: 0,
              revenue: 0,
              completed: 0,
              totalCycleTime: 0,
            });
          }
          const typeData = jobTypeMap.get(jobType)!;
          typeData.count++;
          typeData.revenue += jobValue;

          if (isComplete) {
            typeData.completed++;
            const cycleTime = job.date_updated && job.date_created
              ? (job.date_updated - job.date_created) / (24 * 60 * 60 * 1000)
              : 0;
            typeData.totalCycleTime += cycleTime;
          }
        }
      }

      // Build KPI summary
      const avgJobValue = totalJobs > 0 ? (totalRevenue + pendingRevenue) / totalJobs : 0;
      const completionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

      const kpis: JobKPI = {
        total_jobs: totalJobs,
        active_jobs: activeJobs,
        completed_jobs: completedJobs,
        cancelled_jobs: cancelledJobs,
        total_revenue: totalRevenue,
        pending_revenue: pendingRevenue,
        avg_job_value: avgJobValue,
        completion_rate: completionRate,
      };

      // Status breakdown
      const statusBreakdown: StatusBreakdown[] = Array.from(statusMap.entries())
        .map(([statusName, data]) => ({
          status_name: statusName,
          count: data.count,
          percentage: (data.count / totalJobs) * 100,
          total_value: data.totalValue,
          avg_value: data.count > 0 ? data.totalValue / data.count : 0,
          avg_age_days: data.count > 0 ? data.totalAge / data.count : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // Job type metrics
      const jobTypeMetrics: JobTypeMetrics[] = Array.from(jobTypeMap.entries())
        .map(([jobType, data]) => ({
          job_type: jobType,
          count: data.count,
          revenue: data.revenue,
          avg_value: data.count > 0 ? data.revenue / data.count : 0,
          completion_rate: data.count > 0 ? (data.completed / data.count) * 100 : 0,
          avg_cycle_time_days: data.completed > 0 ? data.totalCycleTime / data.completed : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      // Trend analysis
      let trends = null;
      if (includeTrends && filteredJobs.length >= 10) {
        // Split into two halves
        const midpoint = Math.floor(filteredJobs.length / 2);
        const firstHalf = filteredJobs.slice(0, midpoint);
        const secondHalf = filteredJobs.slice(midpoint);

        const firstHalfRevenue = firstHalf.reduce((sum: number, j: any) => {
          const jobEsts = estimatesByJob.get(j.jnid) || [];
          return sum + jobEsts.reduce((s, e) => s + parseFloat(e.total || 0), 0);
        }, 0);

        const secondHalfRevenue = secondHalf.reduce((sum: number, j: any) => {
          const jobEsts = estimatesByJob.get(j.jnid) || [];
          return sum + jobEsts.reduce((s, e) => s + parseFloat(e.total || 0), 0);
        }, 0);

        const revenueGrowth = firstHalfRevenue > 0
          ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100
          : 0;

        const firstHalfCompleted = firstHalf.filter((j: any) => {
          const status = (j.status_name || '').toLowerCase();
          return status.includes('complete') || status.includes('won');
        }).length;

        const secondHalfCompleted = secondHalf.filter((j: any) => {
          const status = (j.status_name || '').toLowerCase();
          return status.includes('complete') || status.includes('won');
        }).length;

        const firstHalfCompletionRate = firstHalf.length > 0
          ? (firstHalfCompleted / firstHalf.length) * 100
          : 0;
        const secondHalfCompletionRate = secondHalf.length > 0
          ? (secondHalfCompleted / secondHalf.length) * 100
          : 0;

        trends = {
          revenue_trend: revenueGrowth > 5 ? 'Growing' : revenueGrowth < -5 ? 'Declining' : 'Stable',
          revenue_growth_rate: revenueGrowth,
          completion_rate_trend: secondHalfCompletionRate > firstHalfCompletionRate ? 'Improving' :
                                secondHalfCompletionRate < firstHalfCompletionRate ? 'Declining' : 'Stable',
          volume_trend: secondHalf.length > firstHalf.length ? 'Increasing' :
                       secondHalf.length < firstHalf.length ? 'Decreasing' : 'Stable',
        };
      }

      // Key insights
      const insights: string[] = [];

      if (completionRate < 50) {
        insights.push(`⚠️ LOW completion rate at ${completionRate.toFixed(1)}% - review sales process`);
      } else if (completionRate > 75) {
        insights.push(`✅ EXCELLENT completion rate at ${completionRate.toFixed(1)}%`);
      }

      if (pendingRevenue > totalRevenue) {
        insights.push(`💰 Large pipeline: $${pendingRevenue.toFixed(2)} pending vs $${totalRevenue.toFixed(2)} closed`);
      }

      const avgCycleTime = jobTypeMetrics.length > 0
        ? jobTypeMetrics.reduce((sum, jt) => sum + jt.avg_cycle_time_days, 0) / jobTypeMetrics.length
        : 0;
      if (avgCycleTime > 30) {
        insights.push(`⏱️ Long sales cycle: ${avgCycleTime.toFixed(1)} days average - consider acceleration strategies`);
      }

      const topJobType = jobTypeMetrics.length > 0 ? jobTypeMetrics[0] : null;
      if (topJobType) {
        insights.push(`🏆 Top performer: ${topJobType.job_type} with $${topJobType.revenue.toFixed(2)} revenue`);
      }

      if (trends && trends.revenue_trend === 'Declining') {
        insights.push(`📉 Revenue declining at ${trends.revenue_growth_rate.toFixed(1)}% - immediate action needed`);
      } else if (trends && trends.revenue_trend === 'Growing') {
        insights.push(`📈 Revenue growing at ${trends.revenue_growth_rate.toFixed(1)}% - continue momentum`);
      }

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        time_period: {
          days: timePeriodDays,
          start_date: new Date(cutoffDate).toISOString(),
          end_date: new Date(now).toISOString(),
        },
        kpis: kpis,
        status_breakdown: statusBreakdown,
        job_type_metrics: groupByType ? jobTypeMetrics : undefined,
        trends: trends,
        key_insights: insights,
        performance_rating: {
          completion_rate: completionRate >= 75 ? 'Excellent' : completionRate >= 50 ? 'Good' : completionRate >= 25 ? 'Fair' : 'Poor',
          revenue_health: pendingRevenue > totalRevenue * 0.5 ? 'Healthy Pipeline' : 'Pipeline Needs Attention',
          overall: completionRate >= 60 && pendingRevenue > totalRevenue * 0.3 ? 'Strong' : 'Needs Improvement',
        },
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }
}
