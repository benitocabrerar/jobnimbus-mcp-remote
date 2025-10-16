/**
 * Get Activities Analytics
 * Comprehensive activity tracking and performance analysis with productivity metrics and follow-up optimization
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface ActivityMetrics {
  total_activities: number;
  completed_activities: number;
  pending_activities: number;
  overdue_activities: number;
  completion_rate: number;
  avg_completion_time_days: number;
}

interface ActivityTypeBreakdown {
  activity_type: string;
  count: number;
  percentage: number;
  completed: number;
  pending: number;
  avg_completion_days: number;
  effectiveness_score: number;
}

interface UserProductivity {
  user_id: string;
  user_name: string;
  total_activities: number;
  completed_count: number;
  completion_rate: number;
  avg_response_time_hours: number;
  productivity_score: number;
  productivity_rating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
}

interface FollowUpAnalysis {
  total_follow_ups_needed: number;
  overdue_follow_ups: number;
  upcoming_follow_ups_7days: number;
  avg_follow_up_gap_days: number;
  follow_up_completion_rate: number;
}

export class GetActivitiesAnalyticsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_activities_analytics',
      description: 'Activity tracking: completion rates, user productivity, follow-up analysis',
      inputSchema: {
        type: 'object',
        properties: {
          time_period_days: {
            type: 'number',
            default: 30,
            description: 'Time period (days, default: 30)',
          },
          include_user_breakdown: {
            type: 'boolean',
            default: true,
            description: 'Include user breakdown',
          },
          include_follow_up_analysis: {
            type: 'boolean',
            default: true,
            description: 'Include follow-up analysis',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const timePeriodDays = input.time_period_days || 30;
      const includeUserBreakdown = input.include_user_breakdown !== false;
      const includeFollowUp = input.include_follow_up_analysis !== false;

      // Fetch activities
      const activitiesResponse = await this.client.get(context.apiKey, 'activities', { size: 100 });
      const activities = activitiesResponse.data?.activity || activitiesResponse.data?.results || [];

      const now = Date.now();
      const cutoffDate = now - (timePeriodDays * 24 * 60 * 60 * 1000);

      // Filter activities by time period
      const filteredActivities = activities.filter((a: any) => {
        const createdDate = a.date_created || 0;
        return createdDate >= cutoffDate;
      });

      // Calculate overall metrics
      let totalActivities = 0;
      let completedActivities = 0;
      let pendingActivities = 0;
      let overdueActivities = 0;
      let totalCompletionTime = 0;
      let completionCount = 0;

      // Activity type breakdown
      const typeMap = new Map<string, {
        count: number;
        completed: number;
        pending: number;
        totalCompletionTime: number;
        completedCount: number;
        linkedToJobs: number;
      }>();

      // User productivity
      const userMap = new Map<string, {
        name: string;
        totalActivities: number;
        completed: number;
        totalResponseTime: number;
        responseCount: number;
      }>();

      // Follow-up tracking
      let totalFollowUps = 0;
      let overdueFollowUps = 0;
      let upcomingFollowUps = 0;
      const followUpGaps: number[] = [];

      const sevenDaysFromNow = now + (7 * 24 * 60 * 60 * 1000);

      for (const activity of filteredActivities) {
        totalActivities++;

        const activityType = activity.type || activity.activity_type || 'Unknown';
        const isCompleted = activity.status?.toLowerCase() === 'completed' ||
                          activity.date_end > 0 ||
                          (activity.date_updated > 0 && activity.date_updated > activity.date_start);

        const userId = activity.assigned_to_id || activity.created_by || 'unassigned';
        const userName = activity.assigned_to_name || activity.created_by_name || 'Unassigned';

        if (isCompleted) {
          completedActivities++;

          // Calculate completion time
          const startDate = activity.date_created || activity.date_start || 0;
          const endDate = activity.date_end || activity.date_updated || now;
          if (startDate > 0 && endDate > startDate) {
            const completionDays = (endDate - startDate) / (24 * 60 * 60 * 1000);
            totalCompletionTime += completionDays;
            completionCount++;
          }
        } else {
          pendingActivities++;

          // Check if overdue
          const dueDate = activity.date_end || activity.date_start || 0;
          if (dueDate > 0 && dueDate < now) {
            overdueActivities++;
          }
        }

        // Activity type breakdown
        if (!typeMap.has(activityType)) {
          typeMap.set(activityType, {
            count: 0,
            completed: 0,
            pending: 0,
            totalCompletionTime: 0,
            completedCount: 0,
            linkedToJobs: 0,
          });
        }

        const typeData = typeMap.get(activityType)!;
        typeData.count++;

        if (isCompleted) {
          typeData.completed++;
          const startDate = activity.date_created || activity.date_start || 0;
          const endDate = activity.date_end || activity.date_updated || now;
          if (startDate > 0 && endDate > startDate) {
            const days = (endDate - startDate) / (24 * 60 * 60 * 1000);
            typeData.totalCompletionTime += days;
            typeData.completedCount++;
          }
        } else {
          typeData.pending++;
        }

        if (activity.related && Array.isArray(activity.related)) {
          const hasJob = activity.related.some((r: any) => r.type === 'job');
          if (hasJob) typeData.linkedToJobs++;
        }

        // User productivity
        if (includeUserBreakdown) {
          if (!userMap.has(userId)) {
            userMap.set(userId, {
              name: userName,
              totalActivities: 0,
              completed: 0,
              totalResponseTime: 0,
              responseCount: 0,
            });
          }

          const userData = userMap.get(userId)!;
          userData.totalActivities++;

          if (isCompleted) {
            userData.completed++;

            // Response time
            const createdDate = activity.date_created || 0;
            const completedDate = activity.date_end || activity.date_updated || 0;
            if (createdDate > 0 && completedDate > createdDate) {
              const responseHours = (completedDate - createdDate) / (60 * 60 * 1000);
              userData.totalResponseTime += responseHours;
              userData.responseCount++;
            }
          }
        }

        // Follow-up analysis
        if (includeFollowUp && activityType.toLowerCase().includes('follow')) {
          totalFollowUps++;

          const followUpDate = activity.date_start || 0;
          if (followUpDate > 0) {
            if (followUpDate < now && !isCompleted) {
              overdueFollowUps++;
            } else if (followUpDate >= now && followUpDate <= sevenDaysFromNow) {
              upcomingFollowUps++;
            }

            // Calculate gap from previous activity
            const createdDate = activity.date_created || 0;
            if (createdDate > 0 && followUpDate > createdDate) {
              const gapDays = (followUpDate - createdDate) / (24 * 60 * 60 * 1000);
              followUpGaps.push(gapDays);
            }
          }
        }
      }

      // Build metrics
      const completionRate = totalActivities > 0
        ? (completedActivities / totalActivities) * 100
        : 0;

      const avgCompletionTime = completionCount > 0
        ? totalCompletionTime / completionCount
        : 0;

      const metrics: ActivityMetrics = {
        total_activities: totalActivities,
        completed_activities: completedActivities,
        pending_activities: pendingActivities,
        overdue_activities: overdueActivities,
        completion_rate: completionRate,
        avg_completion_time_days: avgCompletionTime,
      };

      // Activity type breakdown
      const activityTypeBreakdown: ActivityTypeBreakdown[] = Array.from(typeMap.entries())
        .map(([type, data]) => {
          const avgCompDays = data.completedCount > 0
            ? data.totalCompletionTime / data.completedCount
            : 0;

          // Effectiveness score (0-100)
          const completionRate = data.count > 0 ? (data.completed / data.count) * 100 : 0;
          const linkageRate = data.count > 0 ? (data.linkedToJobs / data.count) * 100 : 0;
          const effectivenessScore = (completionRate * 0.6) + (linkageRate * 0.4);

          return {
            activity_type: type,
            count: data.count,
            percentage: (data.count / totalActivities) * 100,
            completed: data.completed,
            pending: data.pending,
            avg_completion_days: avgCompDays,
            effectiveness_score: effectivenessScore,
          };
        })
        .sort((a, b) => b.count - a.count);

      // User productivity
      const userProductivity: UserProductivity[] = [];
      if (includeUserBreakdown) {
        for (const [userId, data] of userMap.entries()) {
          const userCompletionRate = data.totalActivities > 0
            ? (data.completed / data.totalActivities) * 100
            : 0;

          const avgResponseTime = data.responseCount > 0
            ? data.totalResponseTime / data.responseCount
            : 0;

          // Productivity score (0-100)
          const volumeScore = Math.min((data.totalActivities / 20) * 30, 30); // Max 30 points
          const completionScore = (userCompletionRate / 100) * 50; // Max 50 points
          const speedScore = avgResponseTime < 24 ? 20 : avgResponseTime < 72 ? 10 : 0; // Max 20 points
          const productivityScore = volumeScore + completionScore + speedScore;

          const productivityRating: 'Excellent' | 'Good' | 'Fair' | 'Poor' =
            productivityScore >= 80 ? 'Excellent' :
            productivityScore >= 60 ? 'Good' :
            productivityScore >= 40 ? 'Fair' : 'Poor';

          userProductivity.push({
            user_id: userId,
            user_name: data.name,
            total_activities: data.totalActivities,
            completed_count: data.completed,
            completion_rate: userCompletionRate,
            avg_response_time_hours: avgResponseTime,
            productivity_score: productivityScore,
            productivity_rating: productivityRating,
          });
        }

        userProductivity.sort((a, b) => b.productivity_score - a.productivity_score);
      }

      // Follow-up analysis
      let followUpAnalysis: FollowUpAnalysis | null = null;
      if (includeFollowUp) {
        const avgFollowUpGap = followUpGaps.length > 0
          ? followUpGaps.reduce((sum, gap) => sum + gap, 0) / followUpGaps.length
          : 0;

        const followUpCompletionRate = totalFollowUps > 0
          ? ((totalFollowUps - overdueFollowUps) / totalFollowUps) * 100
          : 0;

        followUpAnalysis = {
          total_follow_ups_needed: totalFollowUps,
          overdue_follow_ups: overdueFollowUps,
          upcoming_follow_ups_7days: upcomingFollowUps,
          avg_follow_up_gap_days: avgFollowUpGap,
          follow_up_completion_rate: followUpCompletionRate,
        };
      }

      // Generate recommendations
      const recommendations: string[] = [];

      if (completionRate < 70) {
        recommendations.push(`⚠️ Low completion rate (${completionRate.toFixed(1)}%) - review workload and prioritization`);
      }

      if (overdueActivities > totalActivities * 0.2) {
        recommendations.push(`🚨 ${overdueActivities} overdue activities (${(overdueActivities/totalActivities*100).toFixed(1)}%) - immediate action needed`);
      }

      if (followUpAnalysis && followUpAnalysis.overdue_follow_ups > 0) {
        recommendations.push(`📞 ${followUpAnalysis.overdue_follow_ups} overdue follow-ups - risk of lost opportunities`);
      }

      const topUser = userProductivity.length > 0 ? userProductivity[0] : null;
      if (topUser) {
        recommendations.push(`🏆 Top performer: ${topUser.user_name} with ${topUser.productivity_score.toFixed(0)} productivity score`);
      }

      if (avgCompletionTime > 7) {
        recommendations.push(`⏱️ Long completion times (${avgCompletionTime.toFixed(1)} days avg) - streamline processes`);
      }

      const mostEffectiveType = activityTypeBreakdown.length > 0
        ? activityTypeBreakdown.reduce((max, type) => type.effectiveness_score > max.effectiveness_score ? type : max)
        : null;

      if (mostEffectiveType) {
        recommendations.push(`✅ Most effective: ${mostEffectiveType.activity_type} with ${mostEffectiveType.effectiveness_score.toFixed(1)} effectiveness score`);
      }

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        time_period: {
          days: timePeriodDays,
          start_date: new Date(cutoffDate).toISOString(),
          end_date: new Date(now).toISOString(),
        },
        overall_metrics: metrics,
        activity_type_breakdown: activityTypeBreakdown,
        user_productivity: includeUserBreakdown ? userProductivity : undefined,
        follow_up_analysis: followUpAnalysis,
        recommendations: recommendations,
        key_insights: [
          `${completedActivities} of ${totalActivities} activities completed (${completionRate.toFixed(1)}%)`,
          `${overdueActivities} activities overdue requiring immediate attention`,
          `Average completion time: ${avgCompletionTime.toFixed(1)} days`,
          userProductivity.length > 0 ? `${userProductivity.length} team members tracked` : 'No user data available',
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
