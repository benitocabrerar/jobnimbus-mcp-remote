/**
 * Get Calendar Activities
 * Fetches activities and formats them as calendar events
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { getCurrentDate } from '../../utils/dateHelpers.js';

interface CalendarActivitiesInput {
  from?: number;
  size?: number;
  date_from?: string;
  date_to?: string;
}

interface CalendarActivitiesOutput {
  success: boolean;
  total_activities: number;
  calendar_events: Array<{
    id: string;
    title: string;
    description: string;
    start_date: string;
    end_date: string;
    all_day: boolean;
    type: string;
    related_to: string;
    created_by: string;
  }>;
  summary: {
    upcoming_events: number;
    past_events: number;
    all_day_events: number;
  };
}

export class GetCalendarActivities extends BaseTool<CalendarActivitiesInput, CalendarActivitiesOutput> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_calendar_activities',
      description: 'Get calendar activities and scheduling (formatted from activities data)',
      inputSchema: {
        type: 'object',
        properties: {
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
          },
          size: {
            type: 'number',
            description: 'Number of records to retrieve (default: 50, max: 100)',
          },
          date_from: {
            type: 'string',
            description: 'Start date filter (YYYY-MM-DD format)',
          },
          date_to: {
            type: 'string',
            description: 'End date filter (YYYY-MM-DD format)',
          },
        },
      },
    };
  }

  async execute(input: CalendarActivitiesInput, context: ToolContext): Promise<CalendarActivitiesOutput> {
    // Use current date as default if no date filters provided
    const currentDate = getCurrentDate();
    const dateFrom = input.date_from || currentDate;
    const dateTo = input.date_to || currentDate;

    // Fetch activities from JobNimbus API
    const params = {
      from: input.from || 0,
      size: input.size || 50,
      date_from: dateFrom,
      date_to: dateTo,
    };

    const response = await this.client.get(context.apiKey, 'activities', params);
    const activities = response.data?.activity || [];

    // Transform activities into calendar events
    const now = new Date().toISOString();
    const calendarEvents = activities
      .filter((activity: any) => activity.date_start || activity.date_created)
      .map((activity: any) => {
        // Convert Unix timestamp to ISO string
        const startDate = activity.date_start
          ? new Date(activity.date_start * 1000).toISOString()
          : new Date(activity.date_created * 1000).toISOString();

        const endDate = activity.date_end
          ? new Date(activity.date_end * 1000).toISOString()
          : startDate;

        return {
          id: activity.jnid || activity.recid?.toString() || '',
          title: activity.name || activity.subject || 'Untitled Activity',
          description: activity.description || activity.notes || '',
          start_date: startDate,
          end_date: endDate,
          all_day: activity.all_day || false,
          type: activity.record_type_name || 'activity',
          related_to: activity.related?.[0]?.name || activity.customer || '',
          created_by: activity.created_by_name || 'Unknown',
        };
      });

    // Sort by start date
    calendarEvents.sort((a: any, b: any) =>
      new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );

    // Calculate summary stats
    const upcomingEvents = calendarEvents.filter((event: any) => event.start_date >= now).length;
    const pastEvents = calendarEvents.filter((event: any) => event.start_date < now).length;
    const allDayEvents = calendarEvents.filter((event: any) => event.all_day).length;

    return {
      success: true,
      total_activities: calendarEvents.length,
      calendar_events: calendarEvents,
      summary: {
        upcoming_events: upcomingEvents,
        past_events: pastEvents,
        all_day_events: allDayEvents,
      },
    };
  }
}
