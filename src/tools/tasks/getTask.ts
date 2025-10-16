/**
 * Get Task Tool
 * Retrieve a specific task by JNID from JobNimbus
 *
 * Endpoint: GET /api1/tasks/<jnid>
 * Based on JobNimbus API Documentation
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetTaskInput {
  jnid: string;
}

interface TaskOwner {
  id: string;
}

interface TaskRelated {
  id: string;
  name?: string;
  number?: string;
  type?: string;
}

interface TaskLocation {
  id: number;
}

interface Task {
  jnid: string;
  recid: number;
  number: string;
  type: string;

  // Metadata
  created_by: string;
  created_by_name: string;
  date_created: number;
  date_updated: number;
  is_active: boolean;
  is_archived: boolean;

  // Task Details
  title: string;
  description?: string;
  record_type: number;
  record_type_name: string;
  priority: number;

  // Time & Scheduling
  date_start: number;
  date_end: number;
  date_sort?: number | null;
  all_day: boolean;
  all_day_start_date?: string;
  all_day_end_date?: string;

  // Time Tracking
  actual_time: number;
  estimated_time: number;

  // Status
  is_completed: boolean;
  hide_from_calendarview: boolean;
  hide_from_tasklist: boolean;

  // Relationships
  customer?: string;
  primary?: any;
  owners: TaskOwner[];
  subcontractors: any[];
  related: TaskRelated[];
  location: TaskLocation;

  // Additional
  tags: any[];
  rules?: any[];
  external_id?: string | null;
}

export class GetTaskTool extends BaseTool<GetTaskInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_task',
      description: 'Tasks: retrieve by JNID, complete details, time tracking, relationships',
      inputSchema: {
        type: 'object',
        properties: {
          jnid: {
            type: 'string',
            description: 'Task JNID (unique identifier) - Required',
          },
        },
        required: ['jnid'],
      },
    };
  }

  async execute(input: GetTaskInput, context: ToolContext): Promise<any> {
    // Wrap with cache layer
    return await withCache(
      {
        entity: CACHE_PREFIXES.TASKS,
        operation: CACHE_PREFIXES.GET,
        identifier: input.jnid,
      instance: context.instance,
      },
      getTTL('TASKS_DETAIL'),
      async () => {
        try {
          // Call JobNimbus API
          const response = await this.client.get(
            context.apiKey,
            `tasks/${input.jnid}`
          );

          const task: Task = response.data;

          // Format dates
          const formatDate = (timestamp: number) => {
            if (!timestamp || timestamp === 0) return null;
            return new Date(timestamp * 1000).toISOString();
          };

          return {
            success: true,
            data: {
              // Identifiers
              jnid: task.jnid,
              recid: task.recid,
              number: task.number,
              type: task.type,

              // Task Information
              title: task.title,
              description: task.description || '',
              record_type: task.record_type,
              record_type_name: task.record_type_name,
              priority: task.priority,

              // Dates & Scheduling
              date_start: formatDate(task.date_start),
              date_start_unix: task.date_start,
              date_end: formatDate(task.date_end),
              date_end_unix: task.date_end,
              all_day: task.all_day,
              all_day_start_date: task.all_day_start_date || null,
              all_day_end_date: task.all_day_end_date || null,

              // Time Tracking
              actual_time_hours: task.actual_time,
              estimated_time_hours: task.estimated_time,
              time_variance: task.actual_time - task.estimated_time,
              time_completion_percentage:
                task.estimated_time > 0
                  ? ((task.actual_time / task.estimated_time) * 100).toFixed(1)
                  : 'N/A',

              // Status
              is_completed: task.is_completed,
              is_active: task.is_active,
              is_archived: task.is_archived,
              hide_from_calendarview: task.hide_from_calendarview,
              hide_from_tasklist: task.hide_from_tasklist,

              // Ownership & Relationships
              customer_id: task.customer || null,
              owners: task.owners,
              owners_count: task.owners.length,
              subcontractors: task.subcontractors,
              subcontractors_count: task.subcontractors.length,
              related_entities: task.related,
              related_count: task.related.length,
              location: task.location,

              // Metadata
              created_by: task.created_by,
              created_by_name: task.created_by_name,
              date_created: formatDate(task.date_created),
              date_created_unix: task.date_created,
              date_updated: formatDate(task.date_updated),
              date_updated_unix: task.date_updated,

              // Additional
              tags: task.tags,
              tags_count: task.tags.length,
              external_id: task.external_id || null,
              primary: task.primary || null,
              rules: task.rules || [],
              date_sort: task.date_sort || null,

              _metadata: {
                api_endpoint: 'GET /api1/tasks/<jnid>',
                cached: false,
                timestamp: new Date().toISOString(),
              },
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to retrieve task',
            jnid: input.jnid,
            _metadata: {
              api_endpoint: 'GET /api1/tasks/<jnid>',
              timestamp: new Date().toISOString(),
            },
          };
        }
      }
    );
  }
}
