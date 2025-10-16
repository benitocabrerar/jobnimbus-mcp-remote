/**
 * Get Margin Analysis - Profit margin analysis by job type and sales rep
 * Analyzes pricing efficiency and identifies high/low margin opportunities
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface MarginByJobType {
  job_type: string;
  total_jobs: number;
  total_revenue: number;
  avg_job_value: number;
  estimated_cost?: number;
  estimated_margin?: number;
  high_value_jobs: number;
  low_value_jobs: number;
  pricing_consistency: 'High' | 'Medium' | 'Low';
}

interface MarginByRep {
  rep_id: string;
  rep_name: string;
  total_revenue: number;
  avg_deal_size: number;
  job_count: number;
  high_value_deals: number;
  pricing_efficiency: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  vs_team_avg: number; // Percentage difference from team average
}

interface PricingInsight {
  category: string;
  insight: string;
  impact: 'High' | 'Medium' | 'Low';
  recommendation: string;
}

export class GetMarginAnalysisTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_margin_analysis',
      description: 'Profit margin: by job type and sales rep, pricing insights',
      inputSchema: {
        type: 'object',
        properties: {
          min_job_count: {
            type: 'number',
            default: 3,
            description: 'Min jobs for analysis',
          },
          focus_area: {
            type: 'string',
            enum: ['job_type', 'sales_rep', 'all'],
            default: 'all',
            description: 'Analysis focus area',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const minJobCount = input.min_job_count || 3;
      const focusArea = input.focus_area || 'all';

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
            const jobId = rel.id;
            if (!estimatesByJob.has(jobId)) {
              estimatesByJob.set(jobId, []);
            }
            estimatesByJob.get(jobId)!.push(estimate);
          }
        }
      }

      // Analyze margins by job type
      const marginByType = new Map<string, {
        revenue: number[];
        count: number;
        highValue: number;
        lowValue: number;
      }>();

      const marginByRep = new Map<string, {
        revenue: number[];
        count: number;
        name: string;
        highValue: number;
      }>();

      let totalRevenue = 0;
      let totalJobs = 0;
      const allJobValues: number[] = [];

      for (const job of jobs) {
        if (!job.jnid) continue;

        const jobEstimates = estimatesByJob.get(job.jnid) || [];
        let jobRevenue = 0;

        // Calculate job revenue from approved estimates
        for (const estimate of jobEstimates) {
          const statusName = (estimate.status_name || '').toLowerCase();
          const isSigned = estimate.date_signed > 0;
          const isApproved = isSigned || statusName === 'approved' || statusName === 'signed';

          if (isApproved) {
            jobRevenue += parseFloat(estimate.total || 0) || 0;
          }
        }

        if (jobRevenue > 0) {
          totalRevenue += jobRevenue;
          totalJobs += 1;
          allJobValues.push(jobRevenue);

          // By job type
          const jobType = job.record_type_name || 'Unknown';
          if (!marginByType.has(jobType)) {
            marginByType.set(jobType, { revenue: [], count: 0, highValue: 0, lowValue: 0 });
          }
          const typeStats = marginByType.get(jobType)!;
          typeStats.revenue.push(jobRevenue);
          typeStats.count += 1;

          // By sales rep
          const repId = job.sales_rep || job.assigned_to || job.created_by || 'Unknown';
          const repName = job.sales_rep_name || 'Unknown';
          if (!marginByRep.has(repId)) {
            marginByRep.set(repId, { revenue: [], count: 0, name: repName, highValue: 0 });
          }
          const repStats = marginByRep.get(repId)!;
          repStats.revenue.push(jobRevenue);
          repStats.count += 1;
        }
      }

      // Calculate pricing benchmarks
      const teamAvgDeal = totalJobs > 0 ? totalRevenue / totalJobs : 0;
      const sortedValues = [...allJobValues].sort((a, b) => a - b);
      const medianValue = sortedValues.length > 0
        ? sortedValues[Math.floor(sortedValues.length / 2)]
        : 0;
      const p75Value = sortedValues.length > 0
        ? sortedValues[Math.floor(sortedValues.length * 0.75)]
        : 0;
      const p25Value = sortedValues.length > 0
        ? sortedValues[Math.floor(sortedValues.length * 0.25)]
        : 0;

      // Build margin by type analysis
      const marginByTypeArray: MarginByJobType[] = Array.from(marginByType.entries())
        .filter(([_, stats]) => stats.count >= minJobCount)
        .map(([type, stats]) => {
          const avgValue = stats.revenue.reduce((a, b) => a + b, 0) / stats.count;
          const stdDev = this.calculateStdDev(stats.revenue, avgValue);
          const consistency: 'High' | 'Medium' | 'Low' = stdDev / avgValue < 0.3 ? 'High' : stdDev / avgValue < 0.6 ? 'Medium' : 'Low';

          // Count high/low value jobs
          stats.highValue = stats.revenue.filter(v => v > p75Value).length;
          stats.lowValue = stats.revenue.filter(v => v < p25Value).length;

          return {
            job_type: type,
            total_jobs: stats.count,
            total_revenue: stats.revenue.reduce((a, b) => a + b, 0),
            avg_job_value: avgValue,
            high_value_jobs: stats.highValue,
            low_value_jobs: stats.lowValue,
            pricing_consistency: consistency,
          };
        })
        .sort((a, b) => b.avg_job_value - a.avg_job_value);

      // Build margin by rep analysis
      const marginByRepArray: MarginByRep[] = Array.from(marginByRep.entries())
        .filter(([_, stats]) => stats.count >= minJobCount)
        .map(([repId, stats]) => {
          const avgDeal = stats.revenue.reduce((a, b) => a + b, 0) / stats.count;
          const totalRev = stats.revenue.reduce((a, b) => a + b, 0);
          stats.highValue = stats.revenue.filter(v => v > p75Value).length;

          // Determine pricing efficiency
          const vsTeamAvg = teamAvgDeal > 0 ? ((avgDeal - teamAvgDeal) / teamAvgDeal) * 100 : 0;
          let efficiency: 'Excellent' | 'Good' | 'Fair' | 'Poor';
          if (vsTeamAvg > 20) efficiency = 'Excellent';
          else if (vsTeamAvg > 0) efficiency = 'Good';
          else if (vsTeamAvg > -20) efficiency = 'Fair';
          else efficiency = 'Poor';

          return {
            rep_id: repId,
            rep_name: stats.name,
            total_revenue: totalRev,
            avg_deal_size: avgDeal,
            job_count: stats.count,
            high_value_deals: stats.highValue,
            pricing_efficiency: efficiency,
            vs_team_avg: vsTeamAvg,
          };
        })
        .sort((a, b) => b.avg_deal_size - a.avg_deal_size);

      // Generate pricing insights
      const insights = this.generatePricingInsights(
        marginByTypeArray,
        marginByRepArray,
        teamAvgDeal,
        medianValue
      );

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        filters: {
          min_job_count: minJobCount,
          focus_area: focusArea,
        },
        summary: {
          total_jobs_analyzed: totalJobs,
          total_revenue: totalRevenue,
          team_avg_deal_size: teamAvgDeal,
          median_deal_size: medianValue,
          pricing_spread: {
            p25: p25Value,
            p50: medianValue,
            p75: p75Value,
          },
        },
        margin_by_job_type: focusArea === 'all' || focusArea === 'job_type' ? marginByTypeArray : [],
        margin_by_sales_rep: focusArea === 'all' || focusArea === 'sales_rep' ? marginByRepArray.slice(0, 10) : [],
        pricing_insights: insights,
        recommendations: this.generateRecommendations(marginByTypeArray, marginByRepArray, insights),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }

  private calculateStdDev(values: number[], mean: number): number {
    if (values.length === 0) return 0;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private generatePricingInsights(
    byType: MarginByJobType[],
    byRep: MarginByRep[],
    _teamAvg: number,
    _median: number
  ): PricingInsight[] {
    const insights: PricingInsight[] = [];

    // High-margin job types
    if (byType.length > 0) {
      const topType = byType[0];
      insights.push({
        category: 'Job Type Performance',
        insight: `${topType.job_type} has highest average value at $${topType.avg_job_value.toFixed(2)}`,
        impact: 'High',
        recommendation: `Focus on acquiring more ${topType.job_type} jobs to maximize revenue`,
      });
    }

    // Pricing consistency issues
    const lowConsistency = byType.filter(t => t.pricing_consistency === 'Low');
    if (lowConsistency.length > 0) {
      insights.push({
        category: 'Pricing Consistency',
        insight: `${lowConsistency.length} job type(s) show low pricing consistency`,
        impact: 'Medium',
        recommendation: 'Standardize pricing guidelines to reduce variability',
      });
    }

    // Top performers
    const excellentReps = byRep.filter(r => r.pricing_efficiency === 'Excellent');
    if (excellentReps.length > 0) {
      insights.push({
        category: 'Sales Performance',
        insight: `${excellentReps.length} rep(s) achieving >20% above team average`,
        impact: 'High',
        recommendation: 'Study pricing strategies of top performers and share best practices',
      });
    }

    // Underperformers
    const poorReps = byRep.filter(r => r.pricing_efficiency === 'Poor');
    if (poorReps.length > 0) {
      insights.push({
        category: 'Sales Improvement',
        insight: `${poorReps.length} rep(s) pricing significantly below team average`,
        impact: 'High',
        recommendation: 'Provide pricing training and value communication coaching',
      });
    }

    // High-value concentration
    const highValueReps = byRep.filter(r => r.high_value_deals / r.job_count > 0.3);
    if (highValueReps.length > 0) {
      insights.push({
        category: 'Premium Positioning',
        insight: `${highValueReps.length} rep(s) consistently closing high-value deals`,
        impact: 'Medium',
        recommendation: 'Assign premium prospects to these representatives',
      });
    }

    return insights;
  }

  private generateRecommendations(
    byType: MarginByJobType[],
    byRep: MarginByRep[],
    insights: PricingInsight[]
  ): string[] {
    const recommendations: string[] = [];

    // Strategic recommendations
    if (byType.length > 0) {
      const topTypes = byType.slice(0, 3);
      recommendations.push(
        `Prioritize ${topTypes.map(t => t.job_type).join(', ')} for highest revenue potential`
      );
    }

    if (byRep.length > 0) {
      const avgEfficiency = byRep.reduce((sum, r) => sum + r.vs_team_avg, 0) / byRep.length;
      if (avgEfficiency < -5) {
        recommendations.push('Overall pricing is below potential - review pricing strategy and value proposition');
      }
    }

    // Operational recommendations
    const highImpactInsights = insights.filter(i => i.impact === 'High');
    if (highImpactInsights.length > 0) {
      recommendations.push('Address high-impact pricing insights to maximize profitability');
    }

    const lowConsistency = byType.filter(t => t.pricing_consistency === 'Low').length;
    if (lowConsistency > byType.length * 0.3) {
      recommendations.push('Implement standardized pricing tools to improve consistency');
    }

    if (recommendations.length === 0) {
      recommendations.push('Margin analysis shows healthy pricing - maintain current strategies');
    }

    return recommendations;
  }
}
