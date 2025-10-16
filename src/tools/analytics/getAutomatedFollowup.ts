/**
 * Get Automated Followup - Smart follow-up scheduling and automation
 * Identifies jobs that need follow-up and provides recommendations
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface FollowupRecommendation {
  job_id: string;
  job_number: string;
  customer_name: string;
  status: string;
  last_activity_date: string | null;
  days_since_activity: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  recommended_action: string;
  recommended_timing: string;
}

export class GetAutomatedFollowupTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_automated_followup',
      description: 'Follow-up scheduling: priority-based automation, recommendations',
      inputSchema: {
        type: 'object',
        properties: {
          priority_level: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
            default: 'high',
            description: 'Filter by priority',
          },
          communication_preference: {
            type: 'string',
            enum: ['email', 'phone', 'text', 'auto'],
            default: 'auto',
            description: 'Communication method',
          },
          max_followups: {
            type: 'number',
            default: 5,
            description: 'Max followups (default: 5)',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const priorityLevel = (input.priority_level || 'high').toUpperCase();
      const maxFollowups = input.max_followups || 5;

      // Fetch jobs and activities
      const [jobsResponse, activitiesResponse] = await Promise.all([
        this.client.get(context.apiKey, 'jobs', { size: 50 }),
        this.client.get(context.apiKey, 'activities', { size: 100 }),
      ]);

      const jobs = jobsResponse.data?.results || [];
      const activities = activitiesResponse.data?.activity || activitiesResponse.data?.results || [];

      // Build activity timeline per job
      const lastActivityByJob = new Map<string, any>();

      for (const activity of activities) {
        const related = activity.related || [];
        for (const rel of related) {
          if (rel.type === 'job' && rel.id) {
            const jobId = rel.id;
            const activityDate = activity.date_created || 0;

            if (!lastActivityByJob.has(jobId) || activityDate > lastActivityByJob.get(jobId).date) {
              lastActivityByJob.set(jobId, {
                date: activityDate,
                type: activity.record_type_name || 'Unknown',
              });
            }
          }
        }
      }

      // Analyze jobs for follow-up needs
      const followupRecommendations: FollowupRecommendation[] = [];
      const now = Date.now();

      for (const job of jobs) {
        if (!job.jnid) continue;

        const statusName = (job.status_name || '').toLowerCase();

        // Skip completed or lost jobs
        if (
          statusName.includes('complete') ||
          statusName.includes('won') ||
          statusName.includes('sold') ||
          statusName.includes('lost') ||
          statusName.includes('cancelled') ||
          statusName.includes('declined')
        ) {
          continue;
        }

        const lastActivity = lastActivityByJob.get(job.jnid);
        const lastActivityDate = lastActivity ? lastActivity.date : job.date_created || 0;
        const daysSinceActivity = Math.floor((now - lastActivityDate) / (1000 * 60 * 60 * 24));

        // Determine priority based on days since activity and status
        let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
        let recommendedAction = 'Check in with customer';
        let recommendedTiming = 'Within 1 week';

        if (daysSinceActivity > 14) {
          priority = 'HIGH';
          recommendedAction = 'Urgent: Re-engage customer - extended period of inactivity';
          recommendedTiming = 'Within 24 hours';
        } else if (daysSinceActivity > 7) {
          priority = 'MEDIUM';
          recommendedAction = 'Follow up on pending items';
          recommendedTiming = 'Within 48 hours';
        } else if (daysSinceActivity > 3) {
          priority = 'LOW';
          recommendedAction = 'Routine check-in';
          recommendedTiming = 'Within 3-5 days';
        } else {
          // Recent activity - skip unless in critical status
          if (
            statusName.includes('pending') ||
            statusName.includes('waiting') ||
            statusName.includes('approval')
          ) {
            priority = 'MEDIUM';
            recommendedAction = 'Monitor pending approval status';
            recommendedTiming = 'Within 2-3 days';
          } else {
            continue; // Skip - recent activity and not critical
          }
        }

        // Filter by priority level if specified
        if (priorityLevel !== 'ALL' && priority !== priorityLevel) {
          continue;
        }

        followupRecommendations.push({
          job_id: job.jnid,
          job_number: job.number || 'Unknown',
          customer_name: job.display_name || job.first_name || 'Unknown Customer',
          status: job.status_name || 'Unknown',
          last_activity_date: lastActivityDate > 0 ? new Date(lastActivityDate).toISOString() : null,
          days_since_activity: daysSinceActivity,
          priority,
          recommended_action: recommendedAction,
          recommended_timing: recommendedTiming,
        });
      }

      // Sort by priority and days since activity
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      followupRecommendations.sort((a, b) => {
        if (a.priority !== b.priority) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return b.days_since_activity - a.days_since_activity;
      });

      // Apply max followups limit
      const limitedRecommendations = followupRecommendations.slice(0, maxFollowups);

      // Calculate summary stats
      const priorityCounts = {
        HIGH: followupRecommendations.filter((r) => r.priority === 'HIGH').length,
        MEDIUM: followupRecommendations.filter((r) => r.priority === 'MEDIUM').length,
        LOW: followupRecommendations.filter((r) => r.priority === 'LOW').length,
      };

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        filter_applied: {
          priority_level: priorityLevel,
          max_results: maxFollowups,
        },
        summary: {
          total_followups_needed: followupRecommendations.length,
          by_priority: priorityCounts,
          urgent_followups: priorityCounts.HIGH,
          showing: limitedRecommendations.length,
        },
        followup_recommendations: limitedRecommendations,
        automation_tips: [
          'Set up automated reminders for jobs with no activity after 7 days',
          'Use email templates for routine check-ins to save time',
          'Track customer response rates to optimize follow-up timing',
          'Prioritize high-value jobs for immediate follow-up',
          'Consider phone calls for jobs inactive 14+ days',
        ],
        next_steps: this.generateNextSteps(priorityCounts),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }

  private generateNextSteps(priorityCounts: { HIGH: number; MEDIUM: number; LOW: number }): string[] {
    const steps: string[] = [];

    if (priorityCounts.HIGH > 0) {
      steps.push(`Address ${priorityCounts.HIGH} HIGH priority follow-ups within 24 hours`);
    }

    if (priorityCounts.MEDIUM > 0) {
      steps.push(`Schedule ${priorityCounts.MEDIUM} MEDIUM priority follow-ups this week`);
    }

    if (priorityCounts.LOW > 0) {
      steps.push(`Plan ${priorityCounts.LOW} LOW priority check-ins for next week`);
    }

    if (steps.length === 0) {
      steps.push('All jobs have recent activity - no immediate follow-ups needed');
    } else {
      steps.push('Set calendar reminders for all follow-ups');
      steps.push('Prepare customer-specific talking points before contacting');
    }

    return steps;
  }
}
