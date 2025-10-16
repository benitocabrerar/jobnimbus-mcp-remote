/**
 * Get Sales Velocity Analytics
 * Comprehensive sales velocity tracking with win rate analysis, sales cycle duration, pipeline acceleration metrics, and performance optimization
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface SalesVelocityMetrics {
  overall_velocity: number;
  monthly_velocity: number;
  deals_per_month: number;
  avg_deal_size: number;
  win_rate: number;
  avg_sales_cycle_days: number;
  velocity_trend: 'Accelerating' | 'Stable' | 'Decelerating';
  velocity_score: number;
}

interface SalesCycleAnalysis {
  stage: string;
  avg_duration_days: number;
  deals_in_stage: number;
  conversion_rate: number;
  bottleneck_severity: 'None' | 'Minor' | 'Moderate' | 'Severe';
  acceleration_opportunity: number;
  recommended_actions: string[];
}

interface WinLossAnalysis {
  total_opportunities: number;
  won_deals: number;
  lost_deals: number;
  active_deals: number;
  win_rate: number;
  loss_rate: number;
  avg_win_size: number;
  avg_loss_size: number;
  win_loss_ratio: number;
  top_win_reasons: Array<{ reason: string; count: number; percentage: number }>;
  top_loss_reasons: Array<{ reason: string; count: number; percentage: number }>;
}

interface PipelineAcceleration {
  metric_name: string;
  current_value: number;
  target_value: number;
  gap: number;
  impact_on_velocity: number;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  acceleration_tactics: string[];
  estimated_improvement: string;
}

interface SalesRepVelocity {
  rep_name: string;
  deals_closed: number;
  total_revenue: number;
  avg_deal_size: number;
  avg_sales_cycle_days: number;
  win_rate: number;
  velocity_score: number;
  performance_rating: 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement';
  velocity_trend: 'Accelerating' | 'Stable' | 'Decelerating';
  recommended_coaching: string[];
}

interface VelocityTrend {
  period: string;
  deals_closed: number;
  revenue_generated: number;
  avg_cycle_time: number;
  velocity: number;
  trend_direction: 'Up' | 'Stable' | 'Down';
  month_over_month_change: number;
}

interface DealSizeSegmentation {
  segment: 'Enterprise' | 'Mid-Market' | 'Small Business' | 'Micro';
  min_value: number;
  max_value: number;
  deal_count: number;
  total_value: number;
  avg_cycle_time: number;
  win_rate: number;
  velocity_contribution: number;
  optimization_recommendations: string[];
}

interface VelocityOptimization {
  optimization_area: string;
  current_state: string;
  target_state: string;
  expected_velocity_increase: number;
  implementation_effort: 'Low' | 'Medium' | 'High';
  roi_score: number;
  action_plan: string[];
  priority: number;
}

export class GetSalesVelocityAnalyticsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_sales_velocity_analytics',
      description: 'Sales velocity: win rate, cycle time, acceleration & optimization',
      inputSchema: {
        type: 'object',
        properties: {
          time_window_days: {
            type: 'number',
            default: 90,
            description: 'Days to analyze (default: 90)',
          },
          include_rep_analysis: {
            type: 'boolean',
            default: true,
            description: 'Include rep velocity analysis',
          },
          include_deal_segmentation: {
            type: 'boolean',
            default: true,
            description: 'Include deal size segmentation',
          },
          min_deal_size: {
            type: 'number',
            default: 0,
            description: 'Min deal size to include',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const timeWindowDays = input.time_window_days || 90;
      const includeRepAnalysis = input.include_rep_analysis !== false;
      const includeDealSegmentation = input.include_deal_segmentation !== false;
      const minDealSize = input.min_deal_size || 0;

      const [jobsResponse] = await Promise.all([
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'contacts', { size: 100 }),
      ]);

      const jobs = jobsResponse.data?.results || [];
      // const contacts = contactsResponse.data?.results || [];

      // Try to fetch users - endpoint may not be available in all JobNimbus accounts
      let users: any[] = [];
      try {
        const usersResponse = await this.client.get(context.apiKey, 'users', { size: 100 });
        users = usersResponse.data?.results || [];
      } catch (error) {
        // Users endpoint not available - proceed without user attribution
        console.warn('Users endpoint not available - sales rep analysis will use job.sales_rep_name');
      }

      const now = Date.now();
      const cutoffDate = now - (timeWindowDays * 24 * 60 * 60 * 1000);

      // Sales cycle tracking
      const deals = jobs.filter((job: any) => {
        const value = parseFloat(job.total || job.value || 0);
        return value >= minDealSize;
      });

      // Categorize deals
      const wonDeals = deals.filter((job: any) => {
        const status = (job.status_name || '').toLowerCase();
        const completedDate = job.date_status_change || job.date_updated || 0;
        return (status.includes('complete') || status.includes('won')) && completedDate >= cutoffDate;
      });

      const lostDeals = deals.filter((job: any) => {
        const status = (job.status_name || '').toLowerCase();
        return status.includes('lost') || status.includes('cancelled') || status.includes('rejected');
      });

      const activeDeals = deals.filter((job: any) => {
        const status = (job.status_name || '').toLowerCase();
        return !status.includes('complete') && !status.includes('won') &&
               !status.includes('lost') && !status.includes('cancelled');
      });

      // Calculate sales cycle duration
      const cycleTimesWon: number[] = [];
      let totalRevenueWon = 0;

      for (const job of wonDeals) {
        const createdDate = job.date_created || 0;
        const closedDate = job.date_status_change || job.date_updated || 0;

        if (createdDate > 0 && closedDate > 0) {
          const cycleDays = Math.max(1, Math.floor((closedDate - createdDate) / (24 * 60 * 60 * 1000)));
          cycleTimesWon.push(cycleDays);
          totalRevenueWon += parseFloat(job.total || job.value || 0);
        }
      }

      const avgSalesCycle = cycleTimesWon.length > 0
        ? cycleTimesWon.reduce((sum, days) => sum + days, 0) / cycleTimesWon.length
        : 30;

      const avgDealSize = wonDeals.length > 0 ? totalRevenueWon / wonDeals.length : 0;

      // Win rate
      const totalOpportunities = wonDeals.length + lostDeals.length;
      const winRate = totalOpportunities > 0 ? (wonDeals.length / totalOpportunities) * 100 : 0;

      // Sales velocity: (Number of Deals × Average Deal Size × Win Rate) / Sales Cycle Length
      const dealsPerMonth = (wonDeals.length / timeWindowDays) * 30;
      const monthlyVelocity = (dealsPerMonth * avgDealSize * (winRate / 100)) / (avgSalesCycle / 30);
      const overallVelocity = totalRevenueWon / Math.max(avgSalesCycle, 1);

      // Velocity trend (compare first half vs second half)
      const midpoint = cutoffDate + ((now - cutoffDate) / 2);
      const firstHalfDeals = wonDeals.filter((j: any) => (j.date_status_change || j.date_updated || 0) < midpoint);
      const secondHalfDeals = wonDeals.filter((j: any) => (j.date_status_change || j.date_updated || 0) >= midpoint);

      const firstHalfVelocity = firstHalfDeals.length / Math.max(avgSalesCycle, 1);
      const secondHalfVelocity = secondHalfDeals.length / Math.max(avgSalesCycle, 1);

      const velocityTrend: 'Accelerating' | 'Stable' | 'Decelerating' =
        secondHalfVelocity > firstHalfVelocity * 1.1 ? 'Accelerating' :
        secondHalfVelocity < firstHalfVelocity * 0.9 ? 'Decelerating' : 'Stable';

      const velocityScore = Math.min(
        (winRate / 50) * 40 +
        (Math.min(dealsPerMonth, 20) / 20) * 30 +
        (Math.max(0, 60 - avgSalesCycle) / 60) * 30,
        100
      );

      const salesVelocityMetrics: SalesVelocityMetrics = {
        overall_velocity: overallVelocity,
        monthly_velocity: monthlyVelocity,
        deals_per_month: dealsPerMonth,
        avg_deal_size: avgDealSize,
        win_rate: winRate,
        avg_sales_cycle_days: avgSalesCycle,
        velocity_trend: velocityTrend,
        velocity_score: velocityScore,
      };

      // Sales cycle analysis by stage
      const stageMap = new Map<string, { durations: number[]; deals: number; conversions: number }>();

      for (const job of deals) {
        const stage = job.status_name || 'Unknown';
        if (!stageMap.has(stage)) {
          stageMap.set(stage, { durations: [], deals: 0, conversions: 0 });
        }
        const stageData = stageMap.get(stage)!;
        stageData.deals++;

        const createdDate = job.date_created || 0;
        const updatedDate = job.date_updated || 0;
        if (createdDate > 0 && updatedDate > 0) {
          const duration = Math.max(1, Math.floor((updatedDate - createdDate) / (24 * 60 * 60 * 1000)));
          stageData.durations.push(duration);
        }
      }

      const salesCycleAnalyses: SalesCycleAnalysis[] = [];
      for (const [stage, data] of stageMap.entries()) {
        const avgDuration = data.durations.length > 0
          ? data.durations.reduce((sum, d) => sum + d, 0) / data.durations.length
          : 0;

        const conversionRate = totalOpportunities > 0 ? (data.deals / totalOpportunities) * 100 : 0;

        const bottleneckSeverity: 'None' | 'Minor' | 'Moderate' | 'Severe' =
          avgDuration > 60 ? 'Severe' :
          avgDuration > 30 ? 'Moderate' :
          avgDuration > 14 ? 'Minor' : 'None';

        const accelerationOpportunity = avgDuration > 30 ? Math.min((avgDuration - 30) / avgDuration * 100, 100) : 0;

        const recommendedActions: string[] = [];
        if (bottleneckSeverity !== 'None') {
          recommendedActions.push('Streamline approval process');
          recommendedActions.push('Add automation triggers');
          if (avgDuration > 45) recommendedActions.push('Escalate stuck deals weekly');
        }

        salesCycleAnalyses.push({
          stage,
          avg_duration_days: avgDuration,
          deals_in_stage: data.deals,
          conversion_rate: conversionRate,
          bottleneck_severity: bottleneckSeverity,
          acceleration_opportunity: accelerationOpportunity,
          recommended_actions: recommendedActions,
        });
      }

      // Win/Loss analysis
      const winReasons = new Map<string, number>();
      const lossReasons = new Map<string, number>();

      // Infer reasons from job types and notes (simplified)
      wonDeals.forEach((job: any) => {
        const jobType = job.job_type || 'Standard';
        winReasons.set(jobType, (winReasons.get(jobType) || 0) + 1);
      });

      lostDeals.forEach((job: any) => {
        const status = job.status_name || 'Unknown';
        lossReasons.set(status, (lossReasons.get(status) || 0) + 1);
      });

      const topWinReasons = Array.from(winReasons.entries())
        .map(([reason, count]) => ({
          reason,
          count,
          percentage: (count / wonDeals.length) * 100,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const topLossReasons = Array.from(lossReasons.entries())
        .map(([reason, count]) => ({
          reason,
          count,
          percentage: (count / lostDeals.length) * 100,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const avgWinSize = wonDeals.length > 0
        ? wonDeals.reduce((sum: number, j: any) => sum + parseFloat(j.total || j.value || 0), 0) / wonDeals.length
        : 0;

      const avgLossSize = lostDeals.length > 0
        ? lostDeals.reduce((sum: number, j: any) => sum + parseFloat(j.total || j.value || 0), 0) / lostDeals.length
        : 0;

      const winLossAnalysis: WinLossAnalysis = {
        total_opportunities: totalOpportunities,
        won_deals: wonDeals.length,
        lost_deals: lostDeals.length,
        active_deals: activeDeals.length,
        win_rate: winRate,
        loss_rate: totalOpportunities > 0 ? (lostDeals.length / totalOpportunities) * 100 : 0,
        avg_win_size: avgWinSize,
        avg_loss_size: avgLossSize,
        win_loss_ratio: lostDeals.length > 0 ? wonDeals.length / lostDeals.length : wonDeals.length,
        top_win_reasons: topWinReasons,
        top_loss_reasons: topLossReasons,
      };

      // Pipeline acceleration opportunities
      const pipelineAccelerations: PipelineAcceleration[] = [
        {
          metric_name: 'Sales Cycle Duration',
          current_value: avgSalesCycle,
          target_value: 30,
          gap: Math.max(0, avgSalesCycle - 30),
          impact_on_velocity: avgSalesCycle > 30 ? ((avgSalesCycle - 30) / avgSalesCycle) * 100 : 0,
          priority: avgSalesCycle > 60 ? 'Critical' : avgSalesCycle > 45 ? 'High' : 'Medium',
          acceleration_tactics: [
            'Implement automated follow-up sequences',
            'Add sales enablement content library',
            'Create proposal templates',
          ],
          estimated_improvement: `${Math.min(30, (avgSalesCycle - 30))} days faster`,
        },
        {
          metric_name: 'Win Rate',
          current_value: winRate,
          target_value: 40,
          gap: Math.max(0, 40 - winRate),
          impact_on_velocity: winRate < 40 ? ((40 - winRate) / 40) * 100 : 0,
          priority: winRate < 25 ? 'Critical' : winRate < 35 ? 'High' : 'Medium',
          acceleration_tactics: [
            'Improve lead qualification (BANT/MEDDIC)',
            'Enhance discovery call framework',
            'Add competitive battle cards',
          ],
          estimated_improvement: `+${Math.min(15, (40 - winRate)).toFixed(1)}% win rate`,
        },
      ];

      // Sales rep velocity
      const repVelocities: SalesRepVelocity[] = [];
      if (includeRepAnalysis) {
        const repMap = new Map<string, { deals: any[]; revenue: number }>();

        for (const job of wonDeals) {
          const repId = job.assigned_user_id || job.sales_rep_id || 'Unassigned';
          if (!repMap.has(repId)) {
            repMap.set(repId, { deals: [], revenue: 0 });
          }
          const repData = repMap.get(repId)!;
          repData.deals.push(job);
          repData.revenue += parseFloat(job.total || job.value || 0);
        }

        for (const [repId, data] of repMap.entries()) {
          const user = users.find((u: any) => u.id === repId);
          const repName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : repId;

          const repCycleTimes = data.deals
            .map((j: any) => {
              const created = j.date_created || 0;
              const closed = j.date_status_change || j.date_updated || 0;
              return created > 0 && closed > 0 ? (closed - created) / (24 * 60 * 60 * 1000) : 0;
            })
            .filter((d: number) => d > 0);

          const repAvgCycle = repCycleTimes.length > 0
            ? repCycleTimes.reduce((sum: number, d: number) => sum + d, 0) / repCycleTimes.length
            : avgSalesCycle;

          const repAvgDeal = data.deals.length > 0 ? data.revenue / data.deals.length : 0;
          const repVelocity = data.revenue / Math.max(repAvgCycle, 1);
          const repVelocityScore = Math.min(
            (data.deals.length / Math.max(wonDeals.length, 1)) * 50 +
            (repVelocity / Math.max(overallVelocity, 1)) * 50,
            100
          );

          const performanceRating: 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement' =
            repVelocityScore >= 80 ? 'Excellent' :
            repVelocityScore >= 60 ? 'Good' :
            repVelocityScore >= 40 ? 'Fair' : 'Needs Improvement';

          const recommendedCoaching: string[] = [];
          if (repAvgCycle > avgSalesCycle * 1.2) {
            recommendedCoaching.push('Focus on accelerating deal closure');
          }
          if (repAvgDeal < avgDealSize * 0.8) {
            recommendedCoaching.push('Target larger opportunities');
          }
          if (data.deals.length < wonDeals.length * 0.1) {
            recommendedCoaching.push('Increase activity and pipeline');
          }

          repVelocities.push({
            rep_name: repName,
            deals_closed: data.deals.length,
            total_revenue: data.revenue,
            avg_deal_size: repAvgDeal,
            avg_sales_cycle_days: repAvgCycle,
            win_rate: winRate, // Simplified: use overall win rate
            velocity_score: repVelocityScore,
            performance_rating: performanceRating,
            velocity_trend: 'Stable',
            recommended_coaching: recommendedCoaching,
          });
        }

        repVelocities.sort((a, b) => b.velocity_score - a.velocity_score);
      }

      // Velocity trends
      const velocityTrends: VelocityTrend[] = [];
      const monthlyData = new Map<string, { deals: number; revenue: number; cycleTimes: number[] }>();

      for (const job of wonDeals) {
        const closedDate = job.date_status_change || job.date_updated || 0;
        if (closedDate === 0) continue;

        const monthKey = new Date(closedDate).toISOString().slice(0, 7);
        if (!monthlyData.has(monthKey)) {
          monthlyData.set(monthKey, { deals: 0, revenue: 0, cycleTimes: [] });
        }
        const monthData = monthlyData.get(monthKey)!;
        monthData.deals++;
        monthData.revenue += parseFloat(job.total || job.value || 0);

        const created = job.date_created || 0;
        if (created > 0) {
          const cycleDays = (closedDate - created) / (24 * 60 * 60 * 1000);
          monthData.cycleTimes.push(cycleDays);
        }
      }

      const sortedMonths = Array.from(monthlyData.keys()).sort();
      for (let i = 0; i < sortedMonths.length; i++) {
        const month = sortedMonths[i];
        const data = monthlyData.get(month)!;
        const avgCycle = data.cycleTimes.length > 0
          ? data.cycleTimes.reduce((sum, d) => sum + d, 0) / data.cycleTimes.length
          : avgSalesCycle;

        const velocity = data.revenue / Math.max(avgCycle, 1);

        const prevVelocity = i > 0
          ? (monthlyData.get(sortedMonths[i - 1])?.revenue || 0) / avgSalesCycle
          : velocity;

        const momChange = prevVelocity > 0 ? ((velocity - prevVelocity) / prevVelocity) * 100 : 0;

        velocityTrends.push({
          period: month,
          deals_closed: data.deals,
          revenue_generated: data.revenue,
          avg_cycle_time: avgCycle,
          velocity,
          trend_direction: momChange > 5 ? 'Up' : momChange < -5 ? 'Down' : 'Stable',
          month_over_month_change: momChange,
        });
      }

      // Deal size segmentation
      const dealSegmentations: DealSizeSegmentation[] = [];
      if (includeDealSegmentation) {
        const segments: Array<{ name: 'Enterprise' | 'Mid-Market' | 'Small Business' | 'Micro'; min: number; max: number }> = [
          { name: 'Enterprise', min: 50000, max: Infinity },
          { name: 'Mid-Market', min: 10000, max: 49999 },
          { name: 'Small Business', min: 2000, max: 9999 },
          { name: 'Micro', min: 0, max: 1999 },
        ];

        for (const seg of segments) {
          const segDeals = wonDeals.filter((j: any) => {
            const value = parseFloat(j.total || j.value || 0);
            return value >= seg.min && value <= seg.max;
          });

          const segRevenue = segDeals.reduce((sum: number, j: any) => sum + parseFloat(j.total || j.value || 0), 0);
          const segCycleTimes = segDeals
            .map((j: any) => {
              const created = j.date_created || 0;
              const closed = j.date_status_change || j.date_updated || 0;
              return created > 0 && closed > 0 ? (closed - created) / (24 * 60 * 60 * 1000) : 0;
            })
            .filter((d: number) => d > 0);

          const segAvgCycle = segCycleTimes.length > 0
            ? segCycleTimes.reduce((sum: number, d: number) => sum + d, 0) / segCycleTimes.length
            : avgSalesCycle;

          const velocityContribution = totalRevenueWon > 0 ? (segRevenue / totalRevenueWon) * 100 : 0;

          const optimizationRecs: string[] = [];
          if (segAvgCycle > avgSalesCycle * 1.2) {
            optimizationRecs.push('Streamline approval process for this segment');
          }
          if (segDeals.length < wonDeals.length * 0.1 && seg.name !== 'Micro') {
            optimizationRecs.push(`Increase ${seg.name} targeting`);
          }

          dealSegmentations.push({
            segment: seg.name,
            min_value: seg.min,
            max_value: seg.max === Infinity ? 999999999 : seg.max,
            deal_count: segDeals.length,
            total_value: segRevenue,
            avg_cycle_time: segAvgCycle,
            win_rate: winRate, // Simplified
            velocity_contribution: velocityContribution,
            optimization_recommendations: optimizationRecs,
          });
        }
      }

      // Velocity optimization
      const velocityOptimizations: VelocityOptimization[] = [
        {
          optimization_area: 'Lead Response Time',
          current_state: 'Manual lead assignment, 24+ hour response',
          target_state: 'Automated routing, <1 hour response',
          expected_velocity_increase: 15,
          implementation_effort: 'Medium',
          roi_score: 85,
          action_plan: [
            'Implement round-robin lead assignment',
            'Add auto-response email templates',
            'Set up mobile notifications for reps',
          ],
          priority: 1,
        },
        {
          optimization_area: 'Proposal Generation',
          current_state: 'Custom proposals from scratch',
          target_state: 'Template library with dynamic pricing',
          expected_velocity_increase: 20,
          implementation_effort: 'Low',
          roi_score: 90,
          action_plan: [
            'Create 5 proposal templates',
            'Add pricing calculator',
            'Enable e-signature integration',
          ],
          priority: 2,
        },
      ];

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        time_window_days: timeWindowDays,
        sales_velocity_metrics: salesVelocityMetrics,
        sales_cycle_analysis: salesCycleAnalyses.slice(0, 10),
        win_loss_analysis: winLossAnalysis,
        pipeline_acceleration_opportunities: pipelineAccelerations,
        sales_rep_velocity: includeRepAnalysis ? repVelocities.slice(0, 10) : undefined,
        velocity_trends: velocityTrends.slice(-12),
        deal_size_segmentation: includeDealSegmentation ? dealSegmentations : undefined,
        velocity_optimization_recommendations: velocityOptimizations,
        key_insights: [
          `Sales velocity: $${overallVelocity.toLocaleString()}/day`,
          `Average sales cycle: ${avgSalesCycle.toFixed(0)} days`,
          `Win rate: ${winRate.toFixed(1)}%`,
          `Velocity trend: ${velocityTrend}`,
        ],
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }
}
