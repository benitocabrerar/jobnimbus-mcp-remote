/**
 * Get Performance Metrics - Comprehensive performance metrics dashboard
 * Provides real-time business metrics
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

export class GetPerformanceMetricsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_performance_metrics',
      description: 'Performance metrics: dashboard, conversion rates, pipeline health',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    };
  }

  async execute(_input: any, context: ToolContext): Promise<any> {
    try {
      // Fetch data from JobNimbus API
      const [jobsResponse, estimatesResponse, activitiesResponse] = await Promise.all([
        this.client.get(context.apiKey, 'jobs', { size: 50 }),
        this.client.get(context.apiKey, 'estimates', { size: 50 }),
        this.client.get(context.apiKey, 'activities', { size: 50 }),
      ]);

      const jobs = jobsResponse.data?.results || [];
      const estimates = estimatesResponse.data?.results || [];
      const activities = activitiesResponse.data?.activity || activitiesResponse.data?.results || [];

      // Calculate job metrics
      const totalJobs = jobs.length;
      let activeJobs = 0;
      let completedJobs = 0;
      let lostJobs = 0;

      for (const job of jobs) {
        const statusName = (job.status_name || '').toLowerCase();
        if (
          statusName.includes('complete') ||
          statusName.includes('won') ||
          statusName.includes('sold')
        ) {
          completedJobs += 1;
        } else if (
          statusName.includes('lost') ||
          statusName.includes('cancelled') ||
          statusName.includes('declined')
        ) {
          lostJobs += 1;
        } else {
          activeJobs += 1;
        }
      }

      // Calculate estimate metrics
      const totalEstimates = estimates.length;
      let approvedEstimates = 0;
      let pendingEstimates = 0;
      let totalEstimateValue = 0;

      for (const estimate of estimates) {
        const estimateTotal = parseFloat(estimate.total || 0) || 0;
        totalEstimateValue += estimateTotal;

        const statusName = (estimate.status_name || '').toLowerCase();
        if (
          estimate.date_signed > 0 ||
          statusName === 'approved' ||
          statusName === 'signed'
        ) {
          approvedEstimates += 1;
        } else {
          pendingEstimates += 1;
        }
      }

      // Calculate activity metrics
      const totalActivities = activities.length;
      const activityTypes = new Map<string, number>();

      for (const activity of activities) {
        const type = activity.record_type_name || 'Unknown';
        activityTypes.set(type, (activityTypes.get(type) || 0) + 1);
      }

      // Calculate conversion metrics
      const conversionRate =
        totalJobs > 0 ? ((completedJobs / totalJobs) * 100).toFixed(2) : '0.00';
      const estimateApprovalRate =
        totalEstimates > 0 ? ((approvedEstimates / totalEstimates) * 100).toFixed(2) : '0.00';
      const averageEstimateValue =
        totalEstimates > 0 ? (totalEstimateValue / totalEstimates).toFixed(2) : '0.00';

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        metrics: {
          jobs: {
            total: totalJobs,
            active: activeJobs,
            completed: completedJobs,
            lost: lostJobs,
            completion_rate: `${conversionRate}%`,
          },
          estimates: {
            total: totalEstimates,
            approved: approvedEstimates,
            pending: pendingEstimates,
            total_value: `$${totalEstimateValue.toFixed(2)}`,
            average_value: `$${averageEstimateValue}`,
            approval_rate: `${estimateApprovalRate}%`,
          },
          activities: {
            total: totalActivities,
            by_type: Object.fromEntries(activityTypes),
            average_per_day: (totalActivities / 30).toFixed(1),
          },
        },
        insights: {
          pipeline_health:
            activeJobs > completedJobs ? 'Growing' : activeJobs < completedJobs ? 'Declining' : 'Stable',
          estimate_performance:
            parseFloat(estimateApprovalRate) > 20 ? 'Good' : 'Needs Improvement',
          activity_level: totalActivities > 50 ? 'High' : totalActivities > 20 ? 'Medium' : 'Low',
        },
        recommendations: this.generateRecommendations(
          activeJobs,
          completedJobs,
          parseFloat(estimateApprovalRate),
          totalActivities
        ),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }

  private generateRecommendations(
    activeJobs: number,
    completedJobs: number,
    approvalRate: number,
    activities: number
  ): string[] {
    const recommendations: string[] = [];

    if (activeJobs < completedJobs) {
      recommendations.push('Focus on lead generation - active pipeline is declining');
    }

    if (approvalRate < 20) {
      recommendations.push('Improve estimate approval rate - current rate is below 20%');
      recommendations.push('Review pricing strategy and value proposition');
    }

    if (activities < 20) {
      recommendations.push('Increase sales activity - current activity level is low');
    }

    if (activeJobs > completedJobs * 3) {
      recommendations.push('Focus on converting active leads - large active pipeline');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is healthy - maintain current strategies');
    }

    return recommendations;
  }
}
