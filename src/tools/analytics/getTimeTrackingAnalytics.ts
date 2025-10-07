/**
 * Get Time Tracking Analytics
 * Time spent analysis by activity type, billable vs non-billable hours, efficiency metrics, and time allocation recommendations
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface TimeMetrics {
  total_tracked_hours: number;
  billable_hours: number;
  non_billable_hours: number;
  billable_percentage: number;
  avg_hours_per_day: number;
  avg_hours_per_job: number;
  total_activities_tracked: number;
  efficiency_score: number;
}

interface ActivityTimeBreakdown {
  activity_type: string;
  total_hours: number;
  activity_count: number;
  avg_hours_per_activity: number;
  percentage_of_total: number;
  billability_status: 'Billable' | 'Non-Billable' | 'Mixed';
  priority_level: 'High' | 'Medium' | 'Low';
}

interface UserTimeTracking {
  user_name: string;
  user_id: string;
  total_hours: number;
  billable_hours: number;
  non_billable_hours: number;
  billable_percentage: number;
  activities_completed: number;
  jobs_worked: number;
  efficiency_rating: 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement';
  time_allocation_score: number;
  recommended_focus: string;
}

interface TimeAllocation {
  category: string;
  hours: number;
  percentage: number;
  target_percentage: number;
  variance: number;
  status: 'Over-allocated' | 'Optimal' | 'Under-allocated';
}

interface BillableAnalysis {
  job_id: string;
  job_name: string;
  customer_name: string;
  total_hours: number;
  billable_hours: number;
  non_billable_hours: number;
  billable_rate: number;
  estimated_value: number;
  actual_revenue: number;
  profitability: number;
  efficiency_rating: 'High' | 'Medium' | 'Low';
}

interface TimeOptimization {
  opportunity: string;
  impact_level: 'Critical' | 'High' | 'Medium' | 'Low';
  current_hours: number;
  potential_savings_hours: number;
  recommended_actions: string[];
  estimated_roi: string;
  priority: number;
}

export class GetTimeTrackingAnalyticsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_time_tracking_analytics',
      description: 'Time tracking analytics with billable vs non-billable hours, efficiency metrics, activity time breakdown, user productivity, and optimization recommendations',
      inputSchema: {
        type: 'object',
        properties: {
          days_back: {
            type: 'number',
            default: 30,
            description: 'Days of history to analyze (default: 30)',
          },
          include_user_breakdown: {
            type: 'boolean',
            default: true,
            description: 'Include per-user time tracking',
          },
          include_billable_analysis: {
            type: 'boolean',
            default: true,
            description: 'Include billable hours analysis',
          },
          billable_rate_per_hour: {
            type: 'number',
            default: 100,
            description: 'Billable rate per hour for estimates (default: $100)',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const daysBack = input.days_back || 30;
      const includeUserBreakdown = input.include_user_breakdown !== false;
      const includeBillableAnalysis = input.include_billable_analysis !== false;
      const billableRate = input.billable_rate_per_hour || 100;

      // Fetch data
      const [activitiesResponse, jobsResponse, usersResponse] = await Promise.all([
        this.client.get(context.apiKey, 'activities', { size: 100 }),
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'users', { size: 100 }),
      ]);

      const activities = activitiesResponse.data?.activity || [];
      const jobs = jobsResponse.data?.results || [];
      const users = usersResponse.data?.results || usersResponse.data?.users || [];

      const now = Date.now();
      const cutoffDate = now - (daysBack * 24 * 60 * 60 * 1000);

      // User map
      const userMap = new Map<string, any>();
      for (const user of users) {
        const userId = user.jnid || user.id;
        if (userId) userMap.set(userId, user);
      }

      // Calculate time from activities
      let totalHours = 0;
      let billableHours = 0;
      let nonBillableHours = 0;

      const activityTypeMap = new Map<string, { hours: number; count: number; billable: number }>();
      const userTimeMap = new Map<string, { hours: number; billable: number; activities: number; jobs: Set<string> }>();

      for (const activity of activities) {
        const createdDate = activity.date_created || activity.created_at || 0;
        if (createdDate < cutoffDate) continue;

        // Estimate hours based on activity duration or default
        const dateStart = activity.date_start || 0;
        const dateEnd = activity.date_end || 0;
        const estimatedHours = dateStart > 0 && dateEnd > 0 && dateEnd > dateStart
          ? (dateEnd - dateStart) / (1000 * 60 * 60)
          : 2; // Default 2 hours per activity

        totalHours += estimatedHours;

        // Billability (certain activity types are billable)
        const activityType = activity.type || activity.activity_type || 'General';
        const isBillable = this.isBillableActivity(activityType);

        if (isBillable) {
          billableHours += estimatedHours;
        } else {
          nonBillableHours += estimatedHours;
        }

        // Activity type breakdown
        if (!activityTypeMap.has(activityType)) {
          activityTypeMap.set(activityType, { hours: 0, count: 0, billable: 0 });
        }
        const typeData = activityTypeMap.get(activityType)!;
        typeData.hours += estimatedHours;
        typeData.count++;
        if (isBillable) typeData.billable += estimatedHours;

        // User time tracking
        const assigneeId = activity.assigned_to || activity.owner_id || '';
        if (assigneeId) {
          if (!userTimeMap.has(assigneeId)) {
            userTimeMap.set(assigneeId, { hours: 0, billable: 0, activities: 0, jobs: new Set() });
          }
          const userData = userTimeMap.get(assigneeId)!;
          userData.hours += estimatedHours;
          if (isBillable) userData.billable += estimatedHours;
          userData.activities++;

          // Track related jobs
          const related = activity.related || [];
          for (const rel of related) {
            if (rel.type === 'job' && rel.id) {
              userData.jobs.add(rel.id);
            }
          }
        }
      }

      // Time metrics
      const timeMetrics: TimeMetrics = {
        total_tracked_hours: totalHours,
        billable_hours: billableHours,
        non_billable_hours: nonBillableHours,
        billable_percentage: totalHours > 0 ? (billableHours / totalHours) * 100 : 0,
        avg_hours_per_day: daysBack > 0 ? totalHours / daysBack : 0,
        avg_hours_per_job: jobs.length > 0 ? totalHours / jobs.length : 0,
        total_activities_tracked: activities.length,
        efficiency_score: 0, // Will calculate below
      };

      // Efficiency score (0-100): higher billable % = higher efficiency
      timeMetrics.efficiency_score = Math.min(timeMetrics.billable_percentage * 1.2, 100);

      // Activity time breakdown
      const activityBreakdowns: ActivityTimeBreakdown[] = [];
      for (const [type, data] of activityTypeMap.entries()) {
        const billabilityStatus: 'Billable' | 'Non-Billable' | 'Mixed' =
          data.billable === data.hours ? 'Billable' :
          data.billable === 0 ? 'Non-Billable' : 'Mixed';

        const priorityLevel: 'High' | 'Medium' | 'Low' =
          data.hours > totalHours * 0.2 ? 'High' :
          data.hours > totalHours * 0.1 ? 'Medium' : 'Low';

        activityBreakdowns.push({
          activity_type: type,
          total_hours: data.hours,
          activity_count: data.count,
          avg_hours_per_activity: data.count > 0 ? data.hours / data.count : 0,
          percentage_of_total: totalHours > 0 ? (data.hours / totalHours) * 100 : 0,
          billability_status: billabilityStatus,
          priority_level: priorityLevel,
        });
      }

      activityBreakdowns.sort((a, b) => b.total_hours - a.total_hours);

      // User time tracking
      const userTimeTrackings: UserTimeTracking[] = [];
      if (includeUserBreakdown) {
        for (const [userId, data] of userTimeMap.entries()) {
          const user = userMap.get(userId);
          const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Unknown';

          const billablePercentage = data.hours > 0 ? (data.billable / data.hours) * 100 : 0;

          const efficiencyRating: 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement' =
            billablePercentage >= 80 ? 'Excellent' :
            billablePercentage >= 60 ? 'Good' :
            billablePercentage >= 40 ? 'Fair' : 'Needs Improvement';

          const timeAllocationScore = Math.min((billablePercentage / 100) * 100, 100);

          const recommendedFocus =
            billablePercentage < 50 ? 'Increase billable work ratio' :
            billablePercentage >= 80 ? 'Excellent billability - maintain current focus' :
            'Balance billable and strategic work';

          userTimeTrackings.push({
            user_name: userName,
            user_id: userId,
            total_hours: data.hours,
            billable_hours: data.billable,
            non_billable_hours: data.hours - data.billable,
            billable_percentage: billablePercentage,
            activities_completed: data.activities,
            jobs_worked: data.jobs.size,
            efficiency_rating: efficiencyRating,
            time_allocation_score: timeAllocationScore,
            recommended_focus: recommendedFocus,
          });
        }

        userTimeTrackings.sort((a, b) => b.total_hours - a.total_hours);
      }

      // Time allocation
      const timeAllocations: TimeAllocation[] = [
        {
          category: 'Billable Work',
          hours: billableHours,
          percentage: timeMetrics.billable_percentage,
          target_percentage: 75,
          variance: timeMetrics.billable_percentage - 75,
          status: timeMetrics.billable_percentage >= 75 ? 'Optimal' :
                  timeMetrics.billable_percentage >= 60 ? 'Under-allocated' : 'Under-allocated',
        },
        {
          category: 'Non-Billable Work',
          hours: nonBillableHours,
          percentage: 100 - timeMetrics.billable_percentage,
          target_percentage: 25,
          variance: (100 - timeMetrics.billable_percentage) - 25,
          status: (100 - timeMetrics.billable_percentage) <= 25 ? 'Optimal' :
                  (100 - timeMetrics.billable_percentage) <= 40 ? 'Over-allocated' : 'Over-allocated',
        },
      ];

      // Billable analysis by job
      const billableAnalyses: BillableAnalysis[] = [];
      if (includeBillableAnalysis) {
        const jobTimeMap = new Map<string, { billable: number; nonBillable: number; name: string; customer: string; revenue: number }>();

        for (const activity of activities) {
          const related = activity.related || [];
          const jobRel = related.find((r: any) => r.type === 'job');
          if (!jobRel || !jobRel.id) continue;

          const jobId = jobRel.id;
          const job = jobs.find((j: any) => (j.jnid || j.id) === jobId);
          if (!job) continue;

          const dateStart = activity.date_start || 0;
          const dateEnd = activity.date_end || 0;
          const estimatedHours = dateStart > 0 && dateEnd > 0 && dateEnd > dateStart
            ? (dateEnd - dateStart) / (1000 * 60 * 60)
            : 2;

          const activityType = activity.type || activity.activity_type || 'General';
          const isBillable = this.isBillableActivity(activityType);

          if (!jobTimeMap.has(jobId)) {
            const customerRel = (job.related || []).find((r: any) => r.type === 'contact');
            jobTimeMap.set(jobId, {
              billable: 0,
              nonBillable: 0,
              name: job.display_name || job.name || 'Unknown Job',
              customer: customerRel?.display_name || 'Unknown',
              revenue: parseFloat(job.total || job.value || 0),
            });
          }

          const jobData = jobTimeMap.get(jobId)!;
          if (isBillable) {
            jobData.billable += estimatedHours;
          } else {
            jobData.nonBillable += estimatedHours;
          }
        }

        for (const [jobId, data] of jobTimeMap.entries()) {
          const totalJobHours = data.billable + data.nonBillable;
          const billableRate = totalJobHours > 0 ? (data.billable / totalJobHours) * 100 : 0;
          const estimatedValue = data.billable * billableRate;
          const profitability = data.revenue > 0 ? ((data.revenue - estimatedValue) / data.revenue) * 100 : 0;

          const efficiencyRating: 'High' | 'Medium' | 'Low' =
            billableRate >= 75 ? 'High' :
            billableRate >= 50 ? 'Medium' : 'Low';

          billableAnalyses.push({
            job_id: jobId,
            job_name: data.name,
            customer_name: data.customer,
            total_hours: totalJobHours,
            billable_hours: data.billable,
            non_billable_hours: data.nonBillable,
            billable_rate: billableRate,
            estimated_value: estimatedValue,
            actual_revenue: data.revenue,
            profitability: profitability,
            efficiency_rating: efficiencyRating,
          });
        }

        billableAnalyses.sort((a, b) => b.total_hours - a.total_hours);
      }

      // Time optimizations
      const optimizations: TimeOptimization[] = [];

      // Low billable percentage
      if (timeMetrics.billable_percentage < 60) {
        optimizations.push({
          opportunity: 'Increase Billable Hours Ratio',
          impact_level: 'Critical',
          current_hours: billableHours,
          potential_savings_hours: nonBillableHours * 0.3,
          recommended_actions: [
            'Automate non-billable administrative tasks',
            'Delegate internal meetings to junior staff',
            'Track and minimize context switching',
          ],
          estimated_roi: `Increase revenue by $${((nonBillableHours * 0.3) * billableRate).toLocaleString()}/month`,
          priority: 1,
        });
      }

      // High non-billable activity
      const highNonBillable = activityBreakdowns.filter(a =>
        a.billability_status === 'Non-Billable' && a.percentage_of_total > 15
      );

      if (highNonBillable.length > 0) {
        optimizations.push({
          opportunity: 'Reduce Non-Billable Activity Time',
          impact_level: 'High',
          current_hours: highNonBillable.reduce((sum, a) => sum + a.total_hours, 0),
          potential_savings_hours: highNonBillable.reduce((sum, a) => sum + a.total_hours, 0) * 0.25,
          recommended_actions: [
            `Streamline ${highNonBillable[0].activity_type} processes`,
            'Implement templates and automation',
            'Set time limits for internal activities',
          ],
          estimated_roi: `Save ${(highNonBillable.reduce((sum, a) => sum + a.total_hours, 0) * 0.25).toFixed(1)} hours/month`,
          priority: 2,
        });
      }

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        analysis_period_days: daysBack,
        time_metrics: timeMetrics,
        activity_time_breakdown: activityBreakdowns,
        user_time_tracking: includeUserBreakdown ? userTimeTrackings : undefined,
        time_allocation: timeAllocations,
        billable_analysis: includeBillableAnalysis ? billableAnalyses.slice(0, 15) : undefined,
        time_optimizations: optimizations,
        key_insights: [
          `Total tracked: ${totalHours.toFixed(1)} hours`,
          `Billable: ${timeMetrics.billable_percentage.toFixed(1)}%`,
          `Efficiency score: ${timeMetrics.efficiency_score.toFixed(1)}/100`,
          `Avg ${timeMetrics.avg_hours_per_day.toFixed(1)} hours/day`,
        ],
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }

  private isBillableActivity(activityType: string): boolean {
    const billableTypes = [
      'job',
      'service',
      'consultation',
      'inspection',
      'installation',
      'repair',
      'estimate',
      'meeting',
    ];

    const typeLower = activityType.toLowerCase();
    return billableTypes.some(bt => typeLower.includes(bt));
  }
}
