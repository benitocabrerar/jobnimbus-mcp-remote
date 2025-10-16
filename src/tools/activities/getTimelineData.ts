/**
 * Get Timeline Data
 * Fetches activities and creates a timeline visualization
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { getCurrentMonth } from '../../utils/dateHelpers.js';

interface TimelineDataInput {
  from?: number;
  size?: number;
  date_from?: string;
  date_to?: string;
  group_by?: 'day' | 'week' | 'month';
}

interface TimelineEvent {
  date: string;
  count: number;
  events: Array<{
    id: string;
    title: string;
    type: string;
    timestamp: string;
  }>;
}

interface TimelineDataOutput {
  success: boolean;
  total_events: number;
  timeline: TimelineEvent[];
  summary: {
    date_range: {
      start: string;
      end: string;
    };
    most_active_day: string;
    average_events_per_period: number;
    by_type: Record<string, number>;
    by_user: Record<string, number>;
  };
}

export class GetTimelineData extends BaseTool<TimelineDataInput, TimelineDataOutput> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_timeline_data',
      description: 'Get timeline data',
      inputSchema: {
        type: 'object',
        properties: {
          from: {
            type: 'number',
            description: 'Start index (default: 0)',
          },
          size: {
            type: 'number',
            description: 'Records (default: 100, max: 100)',
          },
          date_from: {
            type: 'string',
            description: 'Start date (YYYY-MM-DD)',
          },
          date_to: {
            type: 'string',
            description: 'End date (YYYY-MM-DD)',
          },
          group_by: {
            type: 'string',
            enum: ['day', 'week', 'month'],
            description: 'Group by (default: day)',
          },
        },
      },
    };
  }

  async execute(input: TimelineDataInput, context: ToolContext): Promise<TimelineDataOutput> {
    // Use current month as default if no date filters provided
    const currentMonth = getCurrentMonth();
    const dateFrom = input.date_from || currentMonth.date_from;
    const dateTo = input.date_to || currentMonth.date_to;

    // Fetch activities from JobNimbus API
    const params = {
      from: input.from || 0,
      size: input.size || 100,
      date_from: dateFrom,
      date_to: dateTo,
    };

    const response = await this.client.get(context.apiKey, 'activities', params);
    const activities = response.data?.results || [];

    const groupBy = input.group_by || 'day';

    // Group activities by date
    const timelineMap = new Map<string, any[]>();
    const byType: Record<string, number> = {};
    const byUser: Record<string, number> = {};

    activities.forEach((activity: any) => {
      const timestamp = activity.date_created || activity.date_start;
      if (!timestamp) return;

      const date = new Date(timestamp * 1000);
      const dateKey = this.getDateKey(date, groupBy);

      if (!timelineMap.has(dateKey)) {
        timelineMap.set(dateKey, []);
      }

      const event = {
        id: activity.jnid || activity.recid?.toString() || '',
        title: activity.name || activity.subject || 'Untitled',
        type: activity.record_type_name || 'activity',
        timestamp: date.toISOString(),
      };

      timelineMap.get(dateKey)!.push(event);

      // Count by type
      const type = activity.record_type_name || 'unknown';
      byType[type] = (byType[type] || 0) + 1;

      // Count by user
      const user = activity.created_by_name || 'Unknown';
      byUser[user] = (byUser[user] || 0) + 1;
    });

    // Convert map to sorted timeline array
    const timeline: TimelineEvent[] = Array.from(timelineMap.entries())
      .map(([date, events]) => ({
        date,
        count: events.length,
        events: events.sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ),
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Find most active day
    const mostActiveDay =
      timeline.length > 0
        ? timeline.reduce((max, curr) => (curr.count > max.count ? curr : max)).date
        : '';

    // Calculate date range
    const dates = timeline.map(t => new Date(t.date).getTime());
    const startDate = dates.length > 0 ? new Date(Math.min(...dates)).toISOString() : '';
    const endDate = dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : '';

    // Calculate average
    const averageEventsPerPeriod = timeline.length > 0 ? activities.length / timeline.length : 0;

    return {
      success: true,
      total_events: activities.length,
      timeline,
      summary: {
        date_range: {
          start: startDate,
          end: endDate,
        },
        most_active_day: mostActiveDay,
        average_events_per_period: Math.round(averageEventsPerPeriod * 100) / 100,
        by_type: byType,
        by_user: byUser,
      },
    };
  }

  private getDateKey(date: Date, groupBy: 'day' | 'week' | 'month'): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    switch (groupBy) {
      case 'day':
        return `${year}-${month}-${day}`;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(
          2,
          '0'
        )}-${String(weekStart.getDate()).padStart(2, '0')}`;
      case 'month':
        return `${year}-${month}`;
      default:
        return `${year}-${month}-${day}`;
    }
  }
}
