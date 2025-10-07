/**
 * Get Communication Analytics
 * Comprehensive communication tracking with call/email/text analysis, response times, engagement metrics, and outreach effectiveness
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface CommunicationMetrics {
  total_communications: number;
  calls: number;
  emails: number;
  texts: number;
  meetings: number;
  avg_response_time_hours: number;
  communication_rate_per_day: number;
  active_communication_threads: number;
}

interface CommunicationType {
  type: string;
  count: number;
  percentage: number;
  avg_duration_minutes: number;
  success_rate: number;
  follow_up_rate: number;
}

interface UserCommunicationStats {
  user_id: string;
  user_name: string;
  total_outreach: number;
  calls_made: number;
  emails_sent: number;
  texts_sent: number;
  avg_response_time_hours: number;
  engagement_score: number;
  conversion_rate: number;
  top_performer: boolean;
}

interface TimeBasedAnalysis {
  hour_of_day: number;
  communication_count: number;
  success_rate: number;
  effectiveness_score: number;
}

interface OutreachEffectiveness {
  channel: string;
  total_outreach: number;
  responses_received: number;
  response_rate: number;
  leads_converted: number;
  conversion_rate: number;
  roi_score: number;
}

export class GetCommunicationAnalyticsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_communication_analytics',
      description: 'Comprehensive communication tracking with call/email/text analysis, response times, engagement metrics, time-based patterns, and outreach effectiveness scoring',
      inputSchema: {
        type: 'object',
        properties: {
          user_filter: {
            type: 'string',
            description: 'Filter by specific user name or ID',
          },
          communication_type: {
            type: 'string',
            enum: ['call', 'email', 'text', 'meeting', 'all'],
            default: 'all',
            description: 'Filter by communication type',
          },
          include_time_analysis: {
            type: 'boolean',
            default: true,
            description: 'Include time-of-day effectiveness analysis',
          },
          include_user_stats: {
            type: 'boolean',
            default: true,
            description: 'Include per-user communication statistics',
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
      const commType = input.communication_type || 'all';
      const includeTimeAnalysis = input.include_time_analysis !== false;
      const includeUserStats = input.include_user_stats !== false;
      const daysBack = input.days_back || 30;

      // Fetch data
      const [activitiesResponse, jobsResponse] = await Promise.all([
        this.client.get(context.apiKey, 'activities', { size: 100 }),
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
      ]);

      const activities = activitiesResponse.data?.activity || [];
      const jobs = jobsResponse.data?.results || [];

      // Try to fetch users - endpoint may not be available in all JobNimbus accounts
      let users: any[] = [];
      try {
        const usersResponse = await this.client.get(context.apiKey, 'users', { size: 100 });
        users = usersResponse.data?.results || usersResponse.data?.users || [];
      } catch (error) {
        // Users endpoint not available - proceed without user attribution
        console.warn('Users endpoint not available - communication analytics will be limited');
      }

      const now = Date.now();
      const cutoffDate = now - (daysBack * 24 * 60 * 60 * 1000);

      // Build user lookup
      const userLookup = new Map<string, any>();
      for (const user of users) {
        if (user.jnid || user.id) {
          userLookup.set(user.jnid || user.id, user);
        }
      }

      // Build contact and job conversion maps
      const contactConversions = new Set<string>();
      const jobConversions = new Set<string>();

      for (const job of jobs) {
        const statusLower = (job.status_name || '').toLowerCase();
        if (statusLower.includes('complete') || statusLower.includes('won')) {
          const related = job.related || [];
          for (const rel of related) {
            if (rel.type === 'contact' && rel.id) {
              contactConversions.add(rel.id);
            }
          }
          if (job.jnid) jobConversions.add(job.jnid);
        }
      }

      // Filter communication activities
      const communications = activities.filter((act: any) => {
        const createdDate = act.date_created || act.created_at || 0;
        if (createdDate < cutoffDate) return false;

        const activityType = (act.activity_type || act.type || '').toLowerCase();

        if (commType !== 'all') {
          return activityType.includes(commType.toLowerCase());
        }

        return activityType.includes('call') ||
               activityType.includes('email') ||
               activityType.includes('text') ||
               activityType.includes('sms') ||
               activityType.includes('message') ||
               activityType.includes('meeting');
      });

      // Overall metrics
      const metrics: CommunicationMetrics = {
        total_communications: communications.length,
        calls: 0,
        emails: 0,
        texts: 0,
        meetings: 0,
        avg_response_time_hours: 0,
        communication_rate_per_day: communications.length / daysBack,
        active_communication_threads: 0,
      };

      const responseTimes: number[] = [];
      const typeMap = new Map<string, {
        count: number;
        durations: number[];
        success: number;
        followUps: number;
      }>();
      const hourlyMap = new Map<number, { count: number; success: number }>();
      const userStatsMap = new Map<string, {
        user: any;
        outreach: number;
        calls: number;
        emails: number;
        texts: number;
        responseTimes: number[];
        conversions: number;
      }>();
      const channelEffectiveness = new Map<string, {
        outreach: number;
        responses: number;
        conversions: number;
      }>();

      // Process communications
      for (const comm of communications) {
        const activityType = (comm.activity_type || comm.type || '').toLowerCase();
        const createdDate = comm.date_created || comm.created_at || 0;

        // Count by type
        if (activityType.includes('call')) metrics.calls++;
        else if (activityType.includes('email')) metrics.emails++;
        else if (activityType.includes('text') || activityType.includes('sms')) metrics.texts++;
        else if (activityType.includes('meeting')) metrics.meetings++;

        // Type distribution
        const simplifiedType = this.simplifyType(activityType);
        if (!typeMap.has(simplifiedType)) {
          typeMap.set(simplifiedType, { count: 0, durations: [], success: 0, followUps: 0 });
        }
        const typeData = typeMap.get(simplifiedType)!;
        typeData.count++;

        // Duration tracking
        const duration = comm.duration || comm.duration_minutes || 0;
        if (duration > 0) typeData.durations.push(duration);

        // Success tracking (if completed or has outcome)
        const statusLower = (comm.status_name || comm.status || '').toLowerCase();
        if (statusLower.includes('complete') || statusLower.includes('success')) {
          typeData.success++;
        }

        // Follow-up tracking
        if (comm.follow_up || comm.requires_follow_up) {
          typeData.followUps++;
        }

        // Response time
        const completedDate = comm.date_completed || comm.date_updated || 0;
        if (completedDate > 0 && createdDate > 0) {
          const responseTime = (completedDate - createdDate) / (1000 * 60 * 60); // hours
          responseTimes.push(responseTime);
        }

        // Hourly analysis
        if (includeTimeAnalysis && createdDate > 0) {
          const hour = new Date(createdDate).getHours();
          if (!hourlyMap.has(hour)) {
            hourlyMap.set(hour, { count: 0, success: 0 });
          }
          const hourData = hourlyMap.get(hour)!;
          hourData.count++;
          if (statusLower.includes('complete') || statusLower.includes('success')) {
            hourData.success++;
          }
        }

        // User stats
        if (includeUserStats) {
          const userId = comm.created_by || comm.user_id || 'unknown';
          const user = userLookup.get(userId);

          // Apply user filter
          if (userFilter) {
            const userName = user?.display_name || user?.name || '';
            if (!userName.toLowerCase().includes(userFilter.toLowerCase()) && userId !== userFilter) {
              continue;
            }
          }

          if (!userStatsMap.has(userId)) {
            userStatsMap.set(userId, {
              user: user || { display_name: 'Unknown', email: userId },
              outreach: 0,
              calls: 0,
              emails: 0,
              texts: 0,
              responseTimes: [],
              conversions: 0,
            });
          }
          const userStats = userStatsMap.get(userId)!;
          userStats.outreach++;

          if (activityType.includes('call')) userStats.calls++;
          else if (activityType.includes('email')) userStats.emails++;
          else if (activityType.includes('text') || activityType.includes('sms')) userStats.texts++;

          if (completedDate > 0 && createdDate > 0) {
            userStats.responseTimes.push((completedDate - createdDate) / (1000 * 60 * 60));
          }

          // Check for conversions
          const related = comm.related || [];
          for (const rel of related) {
            if (rel.type === 'contact' && rel.id && contactConversions.has(rel.id)) {
              userStats.conversions++;
            }
            if (rel.type === 'job' && rel.id && jobConversions.has(rel.id)) {
              userStats.conversions++;
            }
          }
        }

        // Channel effectiveness
        if (!channelEffectiveness.has(simplifiedType)) {
          channelEffectiveness.set(simplifiedType, { outreach: 0, responses: 0, conversions: 0 });
        }
        const channelData = channelEffectiveness.get(simplifiedType)!;
        channelData.outreach++;
        if (statusLower.includes('complete') || statusLower.includes('response')) {
          channelData.responses++;
        }

        const related = comm.related || [];
        for (const rel of related) {
          if ((rel.type === 'contact' && rel.id && contactConversions.has(rel.id)) ||
              (rel.type === 'job' && rel.id && jobConversions.has(rel.id))) {
            channelData.conversions++;
            break;
          }
        }
      }

      // Calculate metrics
      metrics.avg_response_time_hours = responseTimes.length > 0
        ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
        : 0;

      // Communication type distribution
      const communicationTypes: CommunicationType[] = [];
      for (const [type, data] of typeMap.entries()) {
        communicationTypes.push({
          type: type,
          count: data.count,
          percentage: (data.count / communications.length) * 100,
          avg_duration_minutes: data.durations.length > 0
            ? data.durations.reduce((sum, d) => sum + d, 0) / data.durations.length
            : 0,
          success_rate: data.count > 0 ? (data.success / data.count) * 100 : 0,
          follow_up_rate: data.count > 0 ? (data.followUps / data.count) * 100 : 0,
        });
      }
      communicationTypes.sort((a, b) => b.count - a.count);

      // User communication stats
      const userCommunicationStats: UserCommunicationStats[] = [];
      for (const [userId, stats] of userStatsMap.entries()) {
        const avgResponseTime = stats.responseTimes.length > 0
          ? stats.responseTimes.reduce((sum, t) => sum + t, 0) / stats.responseTimes.length
          : 0;

        const engagementScore = this.calculateEngagementScore(
          stats.outreach,
          stats.calls,
          stats.emails,
          avgResponseTime
        );

        const conversionRate = stats.outreach > 0 ? (stats.conversions / stats.outreach) * 100 : 0;

        userCommunicationStats.push({
          user_id: userId,
          user_name: stats.user.display_name || stats.user.name || 'Unknown',
          total_outreach: stats.outreach,
          calls_made: stats.calls,
          emails_sent: stats.emails,
          texts_sent: stats.texts,
          avg_response_time_hours: avgResponseTime,
          engagement_score: engagementScore,
          conversion_rate: conversionRate,
          top_performer: false, // Will be set later
        });
      }

      // Sort by engagement score and mark top performers
      userCommunicationStats.sort((a, b) => b.engagement_score - a.engagement_score);
      if (userCommunicationStats.length > 0) {
        userCommunicationStats[0].top_performer = true;
      }

      // Time-based analysis
      const timeBasedAnalysis: TimeBasedAnalysis[] = [];
      if (includeTimeAnalysis) {
        for (let hour = 0; hour < 24; hour++) {
          const hourData = hourlyMap.get(hour) || { count: 0, success: 0 };
          const successRate = hourData.count > 0 ? (hourData.success / hourData.count) * 100 : 0;
          const effectivenessScore = this.calculateEffectivenessScore(hourData.count, successRate);

          timeBasedAnalysis.push({
            hour_of_day: hour,
            communication_count: hourData.count,
            success_rate: successRate,
            effectiveness_score: effectivenessScore,
          });
        }
      }

      // Outreach effectiveness
      const outreachEffectiveness: OutreachEffectiveness[] = [];
      for (const [channel, data] of channelEffectiveness.entries()) {
        const responseRate = data.outreach > 0 ? (data.responses / data.outreach) * 100 : 0;
        const conversionRate = data.outreach > 0 ? (data.conversions / data.outreach) * 100 : 0;
        const roiScore = this.calculateROIScore(responseRate, conversionRate);

        outreachEffectiveness.push({
          channel: channel,
          total_outreach: data.outreach,
          responses_received: data.responses,
          response_rate: responseRate,
          leads_converted: data.conversions,
          conversion_rate: conversionRate,
          roi_score: roiScore,
        });
      }
      outreachEffectiveness.sort((a, b) => b.roi_score - a.roi_score);

      // Recommendations
      const recommendations: string[] = [];

      if (metrics.avg_response_time_hours > 24) {
        recommendations.push(`⏱️ High average response time (${metrics.avg_response_time_hours.toFixed(1)}h) - improve responsiveness`);
      }

      const topChannel = outreachEffectiveness[0];
      if (topChannel && topChannel.roi_score >= 70) {
        recommendations.push(`🏆 ${topChannel.channel} is most effective channel (${topChannel.roi_score}/100 ROI score)`);
      }

      const topPerformer = userCommunicationStats[0];
      if (topPerformer) {
        recommendations.push(`👤 Top communicator: ${topPerformer.user_name} (${topPerformer.engagement_score}/100 engagement)`);
      }

      const bestHours = timeBasedAnalysis
        .sort((a, b) => b.effectiveness_score - a.effectiveness_score)
        .slice(0, 3)
        .map(t => `${t.hour_of_day}:00`);
      if (bestHours.length > 0) {
        recommendations.push(`🕐 Most effective hours: ${bestHours.join(', ')}`);
      }

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        analysis_period_days: daysBack,
        summary: metrics,
        communication_types: communicationTypes,
        user_communication_stats: includeUserStats ? userCommunicationStats : undefined,
        time_based_analysis: includeTimeAnalysis ? timeBasedAnalysis : undefined,
        outreach_effectiveness: outreachEffectiveness,
        recommendations: recommendations,
        key_insights: [
          `${metrics.total_communications} communications tracked`,
          `Average response time: ${metrics.avg_response_time_hours.toFixed(1)} hours`,
          `Most used channel: ${communicationTypes[0]?.type || 'N/A'}`,
          `${Math.round(metrics.communication_rate_per_day)} communications per day`,
        ],
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }

  private simplifyType(type: string): string {
    if (type.includes('call')) return 'Call';
    if (type.includes('email')) return 'Email';
    if (type.includes('text') || type.includes('sms')) return 'Text/SMS';
    if (type.includes('meeting')) return 'Meeting';
    return 'Other';
  }

  private calculateEngagementScore(outreach: number, calls: number, emails: number, avgResponseTime: number): number {
    let score = 0;

    // Volume (40 points)
    score += Math.min((outreach / 50) * 40, 40);

    // Diversity (30 points)
    const diversity = [calls > 0, emails > 0].filter(Boolean).length;
    score += (diversity / 2) * 30;

    // Responsiveness (30 points)
    const responsivenessScore = avgResponseTime > 0 ? Math.max(0, 30 - (avgResponseTime / 2)) : 15;
    score += Math.min(responsivenessScore, 30);

    return Math.min(Math.round(score), 100);
  }

  private calculateEffectivenessScore(count: number, successRate: number): number {
    const volumeScore = Math.min((count / 10) * 50, 50);
    const qualityScore = (successRate / 100) * 50;
    return Math.round(volumeScore + qualityScore);
  }

  private calculateROIScore(responseRate: number, conversionRate: number): number {
    return Math.round((responseRate * 0.4) + (conversionRate * 0.6));
  }
}
