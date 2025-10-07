/**
 * Get User Productivity Analytics
 * Comprehensive team and individual productivity analysis with activity metrics, performance scoring, collaboration patterns, and workload optimization
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface UserProductivityMetrics {
  user_id: string;
  user_name: string;
  user_email: string;
  role: string;
  total_activities: number;
  jobs_created: number;
  contacts_created: number;
  estimates_created: number;
  tasks_completed: number;
  avg_response_time_hours: number;
  productivity_score: number;
  efficiency_rating: 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement';
  workload_balance: number;
  collaboration_score: number;
}

interface TeamMetrics {
  total_team_members: number;
  active_members: number;
  inactive_members: number;
  avg_productivity_score: number;
  total_team_activities: number;
  avg_activities_per_member: number;
  top_performer_id: string;
  top_performer_name: string;
}

interface ActivityPatterns {
  user_id: string;
  peak_activity_hours: string[];
  most_common_activity_type: string;
  activity_distribution: Record<string, number>;
  weekly_pattern: {
    day: string;
    activity_count: number;
  }[];
}

interface CollaborationMetrics {
  user_id: string;
  unique_contacts_engaged: number;
  jobs_collaborated: number;
  team_interactions: number;
  collaboration_rate: number;
}

interface PerformanceComparison {
  metric: string;
  team_average: number;
  top_performer_value: number;
  bottom_performer_value: number;
  performance_gap: number;
}

interface WorkloadDistribution {
  user_id: string;
  user_name: string;
  active_jobs: number;
  pending_tasks: number;
  open_estimates: number;
  total_workload: number;
  capacity_utilization: number;
  workload_status: 'Overloaded' | 'Optimal' | 'Underutilized';
}

export class GetUserProductivityAnalyticsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_user_productivity_analytics',
      description: 'Comprehensive team and individual productivity analysis with activity metrics, performance scoring, collaboration patterns, and workload optimization recommendations',
      inputSchema: {
        type: 'object',
        properties: {
          user_filter: {
            type: 'string',
            description: 'Filter by specific user name or email',
          },
          include_activity_patterns: {
            type: 'boolean',
            default: true,
            description: 'Include detailed activity pattern analysis',
          },
          include_collaboration_metrics: {
            type: 'boolean',
            default: true,
            description: 'Include collaboration and team interaction analysis',
          },
          include_workload_analysis: {
            type: 'boolean',
            default: true,
            description: 'Include workload distribution and capacity analysis',
          },
          days_back: {
            type: 'number',
            default: 30,
            description: 'Days of history to analyze (default: 30)',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const userFilter = input.user_filter;
      const includePatterns = input.include_activity_patterns !== false;
      const includeCollaboration = input.include_collaboration_metrics !== false;
      const includeWorkload = input.include_workload_analysis !== false;
      const daysBack = input.days_back || 30;

      // Fetch data
      const [usersResponse, activitiesResponse, jobsResponse, contactsResponse, estimatesResponse] = await Promise.all([
        this.client.get(context.apiKey, 'users', { size: 100 }),
        this.client.get(context.apiKey, 'activities', { size: 100 }),
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'contacts', { size: 100 }),
        this.client.get(context.apiKey, 'estimates', { size: 100 }),
      ]);

      const users = usersResponse.data?.results || usersResponse.data?.users || [];
      const activities = activitiesResponse.data?.activity || [];
      const jobs = jobsResponse.data?.results || [];
      const contacts = contactsResponse.data?.results || [];
      const estimates = estimatesResponse.data?.results || [];

      const now = Date.now();
      const cutoffDate = now - (daysBack * 24 * 60 * 60 * 1000);

      // Build user metrics map
      const userMetricsMap = new Map<string, {
        user: any;
        activities: any[];
        jobsCreated: number;
        contactsCreated: number;
        estimatesCreated: number;
        tasksCompleted: number;
        responseTimes: number[];
        contactsEngaged: Set<string>;
        jobsCollaborated: Set<string>;
        activityTypes: Map<string, number>;
        hourlyActivity: Map<number, number>;
        dailyActivity: Map<string, number>;
      }>();

      // Initialize user metrics
      for (const user of users) {
        const userId = user.jnid || user.id || user.email;
        if (!userId) continue;

        // Apply user filter
        if (userFilter) {
          const userName = user.display_name || user.name || '';
          const userEmail = user.email || '';
          if (!userName.toLowerCase().includes(userFilter.toLowerCase()) &&
              !userEmail.toLowerCase().includes(userFilter.toLowerCase())) {
            continue;
          }
        }

        userMetricsMap.set(userId, {
          user: user,
          activities: [],
          jobsCreated: 0,
          contactsCreated: 0,
          estimatesCreated: 0,
          tasksCompleted: 0,
          responseTimes: [],
          contactsEngaged: new Set(),
          jobsCollaborated: new Set(),
          activityTypes: new Map(),
          hourlyActivity: new Map(),
          dailyActivity: new Map(),
        });
      }

      // Process activities
      for (const activity of activities) {
        const createdDate = activity.date_created || activity.created_at || 0;
        if (createdDate < cutoffDate) continue;

        const userId = activity.created_by || activity.user_id || '';
        if (!userId || !userMetricsMap.has(userId)) continue;

        const metrics = userMetricsMap.get(userId)!;
        metrics.activities.push(activity);

        // Activity type distribution
        const activityType = activity.activity_type || activity.type || 'General';
        metrics.activityTypes.set(activityType, (metrics.activityTypes.get(activityType) || 0) + 1);

        // Task completion
        if (activityType.toLowerCase().includes('task')) {
          const status = (activity.status_name || activity.status || '').toLowerCase();
          if (status.includes('complete') || status.includes('done')) {
            metrics.tasksCompleted++;

            // Response time
            const completedDate = activity.date_completed || activity.date_updated || 0;
            if (completedDate > 0 && createdDate > 0) {
              metrics.responseTimes.push((completedDate - createdDate) / (1000 * 60 * 60));
            }
          }
        }

        // Hourly pattern
        const hour = new Date(createdDate).getHours();
        metrics.hourlyActivity.set(hour, (metrics.hourlyActivity.get(hour) || 0) + 1);

        // Daily pattern
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(createdDate).getDay()];
        metrics.dailyActivity.set(dayName, (metrics.dailyActivity.get(dayName) || 0) + 1);

        // Collaboration tracking
        const related = activity.related || [];
        for (const rel of related) {
          if (rel.type === 'contact' && rel.id) {
            metrics.contactsEngaged.add(rel.id);
          }
          if (rel.type === 'job' && rel.id) {
            metrics.jobsCollaborated.add(rel.id);
          }
        }
      }

      // Process jobs
      for (const job of jobs) {
        const createdBy = job.created_by || job.owner || '';
        if (!createdBy || !userMetricsMap.has(createdBy)) continue;

        const createdDate = job.date_created || 0;
        if (createdDate >= cutoffDate) {
          userMetricsMap.get(createdBy)!.jobsCreated++;
        }
      }

      // Process contacts
      for (const contact of contacts) {
        const createdBy = contact.created_by || '';
        if (!createdBy || !userMetricsMap.has(createdBy)) continue;

        const createdDate = contact.date_created || 0;
        if (createdDate >= cutoffDate) {
          userMetricsMap.get(createdBy)!.contactsCreated++;
        }
      }

      // Process estimates
      for (const estimate of estimates) {
        const createdBy = estimate.created_by || estimate.sales_rep || '';
        if (!createdBy || !userMetricsMap.has(createdBy)) continue;

        const createdDate = estimate.date_created || 0;
        if (createdDate >= cutoffDate) {
          userMetricsMap.get(createdBy)!.estimatesCreated++;
        }
      }

      // Calculate user productivity metrics
      const userProductivityMetrics: UserProductivityMetrics[] = [];
      const activityPatterns: ActivityPatterns[] = [];
      const collaborationMetrics: CollaborationMetrics[] = [];
      const workloadDistribution: WorkloadDistribution[] = [];

      for (const [userId, metrics] of userMetricsMap.entries()) {
        const user = metrics.user;
        const totalActivities = metrics.activities.length;

        // Skip inactive users
        if (totalActivities === 0) continue;

        const avgResponseTime = metrics.responseTimes.length > 0
          ? metrics.responseTimes.reduce((sum, t) => sum + t, 0) / metrics.responseTimes.length
          : 0;

        // Calculate productivity score
        const productivityScore = this.calculateProductivityScore(
          metrics.jobsCreated,
          metrics.contactsCreated,
          metrics.estimatesCreated,
          metrics.tasksCompleted,
          totalActivities,
          avgResponseTime
        );

        const efficiencyRating: 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement' =
          productivityScore >= 80 ? 'Excellent' :
          productivityScore >= 60 ? 'Good' :
          productivityScore >= 40 ? 'Fair' : 'Needs Improvement';

        // Workload balance (0-100, where 50 is perfectly balanced)
        const workloadBalance = this.calculateWorkloadBalance(metrics.jobsCreated, totalActivities);

        // Collaboration score
        const collaborationScore = this.calculateCollaborationScore(
          metrics.contactsEngaged.size,
          metrics.jobsCollaborated.size,
          totalActivities
        );

        userProductivityMetrics.push({
          user_id: userId,
          user_name: user.display_name || user.name || 'Unknown',
          user_email: user.email || '',
          role: user.role || user.job_title || 'Team Member',
          total_activities: totalActivities,
          jobs_created: metrics.jobsCreated,
          contacts_created: metrics.contactsCreated,
          estimates_created: metrics.estimatesCreated,
          tasks_completed: metrics.tasksCompleted,
          avg_response_time_hours: avgResponseTime,
          productivity_score: productivityScore,
          efficiency_rating: efficiencyRating,
          workload_balance: workloadBalance,
          collaboration_score: collaborationScore,
        });

        // Activity patterns
        if (includePatterns) {
          const peakHours = Array.from(metrics.hourlyActivity.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([hour]) => `${hour}:00-${hour + 1}:00`);

          const mostCommonType = Array.from(metrics.activityTypes.entries())
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

          const activityDistribution: Record<string, number> = {};
          for (const [type, count] of metrics.activityTypes.entries()) {
            activityDistribution[type] = count;
          }

          const weeklyPattern = Array.from(metrics.dailyActivity.entries())
            .map(([day, count]) => ({ day, activity_count: count }));

          activityPatterns.push({
            user_id: userId,
            peak_activity_hours: peakHours,
            most_common_activity_type: mostCommonType,
            activity_distribution: activityDistribution,
            weekly_pattern: weeklyPattern,
          });
        }

        // Collaboration metrics
        if (includeCollaboration) {
          collaborationMetrics.push({
            user_id: userId,
            unique_contacts_engaged: metrics.contactsEngaged.size,
            jobs_collaborated: metrics.jobsCollaborated.size,
            team_interactions: totalActivities,
            collaboration_rate: totalActivities > 0
              ? ((metrics.contactsEngaged.size + metrics.jobsCollaborated.size) / totalActivities) * 100
              : 0,
          });
        }

        // Workload distribution
        if (includeWorkload) {
          // Estimate active jobs (jobs created in period)
          const activeJobs = metrics.jobsCreated;
          const pendingTasks = totalActivities - metrics.tasksCompleted;
          const openEstimates = metrics.estimatesCreated;
          const totalWorkload = activeJobs + pendingTasks + openEstimates;

          const capacityUtilization = Math.min((totalWorkload / 30) * 100, 100); // 30 items = 100% capacity

          const workloadStatus: 'Overloaded' | 'Optimal' | 'Underutilized' =
            capacityUtilization >= 90 ? 'Overloaded' :
            capacityUtilization >= 50 ? 'Optimal' : 'Underutilized';

          workloadDistribution.push({
            user_id: userId,
            user_name: user.display_name || user.name || 'Unknown',
            active_jobs: activeJobs,
            pending_tasks: pendingTasks,
            open_estimates: openEstimates,
            total_workload: totalWorkload,
            capacity_utilization: capacityUtilization,
            workload_status: workloadStatus,
          });
        }
      }

      // Sort by productivity score
      userProductivityMetrics.sort((a, b) => b.productivity_score - a.productivity_score);

      // Team metrics
      const teamMetrics: TeamMetrics = {
        total_team_members: userMetricsMap.size,
        active_members: userProductivityMetrics.length,
        inactive_members: userMetricsMap.size - userProductivityMetrics.length,
        avg_productivity_score: userProductivityMetrics.length > 0
          ? userProductivityMetrics.reduce((sum, u) => sum + u.productivity_score, 0) / userProductivityMetrics.length
          : 0,
        total_team_activities: userProductivityMetrics.reduce((sum, u) => sum + u.total_activities, 0),
        avg_activities_per_member: userProductivityMetrics.length > 0
          ? userProductivityMetrics.reduce((sum, u) => sum + u.total_activities, 0) / userProductivityMetrics.length
          : 0,
        top_performer_id: userProductivityMetrics[0]?.user_id || '',
        top_performer_name: userProductivityMetrics[0]?.user_name || 'N/A',
      };

      // Performance comparison
      const performanceComparison: PerformanceComparison[] = [
        {
          metric: 'Productivity Score',
          team_average: teamMetrics.avg_productivity_score,
          top_performer_value: userProductivityMetrics[0]?.productivity_score || 0,
          bottom_performer_value: userProductivityMetrics[userProductivityMetrics.length - 1]?.productivity_score || 0,
          performance_gap: (userProductivityMetrics[0]?.productivity_score || 0) -
                          (userProductivityMetrics[userProductivityMetrics.length - 1]?.productivity_score || 0),
        },
        {
          metric: 'Total Activities',
          team_average: teamMetrics.avg_activities_per_member,
          top_performer_value: Math.max(...userProductivityMetrics.map(u => u.total_activities), 0),
          bottom_performer_value: Math.min(...userProductivityMetrics.map(u => u.total_activities), 0),
          performance_gap: Math.max(...userProductivityMetrics.map(u => u.total_activities), 0) -
                          Math.min(...userProductivityMetrics.map(u => u.total_activities), 0),
        },
      ];

      // Recommendations
      const recommendations: string[] = [];

      if (teamMetrics.avg_productivity_score < 60) {
        recommendations.push(`⚠️ Team average productivity score is low (${teamMetrics.avg_productivity_score.toFixed(1)}/100) - review workflows and processes`);
      }

      const overloadedUsers = workloadDistribution.filter(w => w.workload_status === 'Overloaded').length;
      if (overloadedUsers > 0) {
        recommendations.push(`🚨 ${overloadedUsers} team member(s) overloaded - redistribute workload`);
      }

      const underutilizedUsers = workloadDistribution.filter(w => w.workload_status === 'Underutilized').length;
      if (underutilizedUsers > 0) {
        recommendations.push(`📊 ${underutilizedUsers} team member(s) underutilized - optimize task assignments`);
      }

      if (userProductivityMetrics[0] && userProductivityMetrics[0].productivity_score >= 80) {
        recommendations.push(`🏆 Top performer: ${userProductivityMetrics[0].user_name} (${userProductivityMetrics[0].productivity_score}/100)`);
      }

      const lowCollaborators = collaborationMetrics.filter(c => c.collaboration_rate < 30).length;
      if (lowCollaborators > 0) {
        recommendations.push(`🤝 ${lowCollaborators} team member(s) with low collaboration - encourage team interaction`);
      }

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        analysis_period_days: daysBack,
        team_metrics: teamMetrics,
        user_productivity_metrics: userProductivityMetrics,
        activity_patterns: includePatterns ? activityPatterns : undefined,
        collaboration_metrics: includeCollaboration ? collaborationMetrics : undefined,
        workload_distribution: includeWorkload ? workloadDistribution : undefined,
        performance_comparison: performanceComparison,
        recommendations: recommendations,
        key_insights: [
          `Team average productivity: ${teamMetrics.avg_productivity_score.toFixed(1)}/100`,
          `${teamMetrics.active_members} active members, ${teamMetrics.inactive_members} inactive`,
          `Top performer: ${teamMetrics.top_performer_name}`,
          `Average ${teamMetrics.avg_activities_per_member.toFixed(0)} activities per member`,
        ],
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }

  /**
   * Calculate productivity score
   */
  private calculateProductivityScore(
    jobsCreated: number,
    contactsCreated: number,
    estimatesCreated: number,
    tasksCompleted: number,
    totalActivities: number,
    avgResponseTime: number
  ): number {
    let score = 0;

    // Volume (40 points)
    const volumeScore = Math.min(
      (jobsCreated * 3 + contactsCreated * 2 + estimatesCreated * 4 + tasksCompleted * 2) / 2,
      40
    );
    score += volumeScore;

    // Activity frequency (30 points)
    const activityScore = Math.min(totalActivities * 0.5, 30);
    score += activityScore;

    // Efficiency (30 points) - faster response time is better
    const efficiencyScore = avgResponseTime > 0
      ? Math.max(0, 30 - (avgResponseTime / 10))
      : 15; // Default if no data
    score += Math.min(efficiencyScore, 30);

    return Math.min(Math.round(score), 100);
  }

  /**
   * Calculate workload balance
   */
  private calculateWorkloadBalance(jobsCreated: number, totalActivities: number): number {
    if (totalActivities === 0) return 0;

    const jobRatio = jobsCreated / totalActivities;
    const idealRatio = 0.3; // 30% of activities should be job creation

    const deviation = Math.abs(jobRatio - idealRatio);
    const balance = Math.max(0, 100 - (deviation * 200));

    return Math.round(balance);
  }

  /**
   * Calculate collaboration score
   */
  private calculateCollaborationScore(
    contactsEngaged: number,
    jobsCollaborated: number,
    totalActivities: number
  ): number {
    if (totalActivities === 0) return 0;

    const collaborationRatio = (contactsEngaged + jobsCollaborated) / totalActivities;
    const score = Math.min(collaborationRatio * 100, 100);

    return Math.round(score);
  }
}
