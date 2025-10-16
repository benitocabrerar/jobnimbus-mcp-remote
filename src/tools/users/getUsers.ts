/**
 * Get Users Tool
 * Retrieve system users/team members from JobNimbus
 * Note: JobNimbus doesn't have a /users endpoint, so we extract users from jobs and activities
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface GetUsersInput {
  include_full_details?: boolean;
}

interface UserInfo {
  user_id: string;
  name: string;
  email?: string;
  roles: string[];
  job_count: number;
  activity_count: number;
  first_seen: string;
  last_seen: string;
}

export class GetUsersTool extends BaseTool<GetUsersInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_users',
      description: 'Users: team members, extracted from jobs/activities, roles/statistics',
      inputSchema: {
        type: 'object',
        properties: {
          include_full_details: {
            type: 'boolean',
            description: 'Return full user details including statistics. Default: false (compact mode).',
          },
        },
      },
    };
  }

  async execute(input: GetUsersInput, context: ToolContext): Promise<any> {
    try {
      // Fetch jobs and activities to extract user information
      const [jobsResponse, activitiesResponse] = await Promise.all([
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'activities', { size: 100 }),
      ]);

      const jobs = jobsResponse.data?.results || [];
      const activities = activitiesResponse.data?.results || [];

      // Map to collect unique users
      const usersMap = new Map<string, UserInfo>();

      // Extract users from jobs
      for (const job of jobs) {
        // Sales rep
        if (job.sales_rep && job.sales_rep_name) {
          this.addOrUpdateUser(usersMap, job.sales_rep, job.sales_rep_name, 'Sales Rep', job.date_created, true, false);
        }

        // Created by
        if (job.created_by && job.created_by_name) {
          this.addOrUpdateUser(usersMap, job.created_by, job.created_by_name, 'Creator', job.date_created, true, false);
        }

        // Owners
        if (job.owners && Array.isArray(job.owners)) {
          for (const owner of job.owners) {
            if (owner.id) {
              this.addOrUpdateUser(usersMap, owner.id, owner.name || 'Unknown', 'Owner', job.date_created, true, false);
            }
          }
        }
      }

      // Extract users from activities
      for (const activity of activities) {
        // Created by
        if (activity.created_by && activity.created_by_name) {
          this.addOrUpdateUser(usersMap, activity.created_by, activity.created_by_name, 'Activity Creator', activity.date_created, false, true);
        }

        // Assigned to
        if (activity.assigned_to && activity.assigned_to_name) {
          this.addOrUpdateUser(usersMap, activity.assigned_to, activity.assigned_to_name, 'Assigned', activity.date_created, false, true);
        }
      }

      // Convert to array and sort by name
      const users = Array.from(usersMap.values()).sort((a, b) => a.name.localeCompare(b.name));

      // Format results based on detail level
      const results = input.include_full_details
        ? users
        : users.map(u => ({
            user_id: u.user_id,
            name: u.name,
            roles: u.roles,
          }));

      return {
        success: true,
        data_source: 'Extracted from Jobs and Activities (JobNimbus has no /users endpoint)',
        total_users: users.length,
        jobs_analyzed: jobs.length,
        activities_analyzed: activities.length,
        users: results,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }

  private addOrUpdateUser(
    usersMap: Map<string, UserInfo>,
    userId: string,
    userName: string,
    role: string,
    timestamp: number,
    isFromJob: boolean,
    isFromActivity: boolean
  ): void {
    if (!usersMap.has(userId)) {
      usersMap.set(userId, {
        user_id: userId,
        name: userName,
        roles: [role],
        job_count: isFromJob ? 1 : 0,
        activity_count: isFromActivity ? 1 : 0,
        first_seen: this.formatTimestamp(timestamp),
        last_seen: this.formatTimestamp(timestamp),
      });
    } else {
      const user = usersMap.get(userId)!;
      if (!user.roles.includes(role)) {
        user.roles.push(role);
      }
      if (isFromJob) user.job_count++;
      if (isFromActivity) user.activity_count++;

      // Update first/last seen
      const currentFirst = new Date(user.first_seen).getTime();
      const currentLast = new Date(user.last_seen).getTime();
      const newTime = timestamp * 1000;

      if (newTime < currentFirst) {
        user.first_seen = this.formatTimestamp(timestamp);
      }
      if (newTime > currentLast) {
        user.last_seen = this.formatTimestamp(timestamp);
      }
    }
  }

  private formatTimestamp(timestamp: number): string {
    if (!timestamp || timestamp === 0) return 'N/A';
    try {
      return new Date(timestamp * 1000).toISOString();
    } catch {
      return 'Invalid Date';
    }
  }
}
