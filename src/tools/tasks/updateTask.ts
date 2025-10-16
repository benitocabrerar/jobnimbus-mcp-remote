/**
 * Update Task Tool
 * Update or delete a task in JobNimbus
 *
 * Endpoint: PUT /api1/tasks/<jnid>
 * Based on JobNimbus API Documentation
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface UpdateTaskInput {
  jnid: string;

  // Core Fields
  title?: string;
  description?: string;
  priority?: number;
  record_type?: number;

  // Scheduling
  date_start?: number;
  date_end?: number;
  all_day?: boolean;

  // Time Tracking
  actual_time?: number;
  estimated_time?: number;

  // Status
  is_completed?: boolean;
  is_active?: boolean;
  is_archived?: boolean;
  hide_from_calendarview?: boolean;
  hide_from_tasklist?: boolean;

  // Relationships
  owners?: Array<{ id: string }>;
  related?: Array<{ id: string; type?: string }>;
  tags?: any[];

  // Special flag for deletion
  mark_as_deleted?: boolean;
}

export class UpdateTaskTool extends BaseTool<UpdateTaskInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'update_task',
      description: 'Tasks: update, soft delete, dates, priority, owners, time tracking',
      inputSchema: {
        type: 'object',
        properties: {
          jnid: {
            type: 'string',
            description: 'Task JNID (unique identifier) - Required',
          },
          title: {
            type: 'string',
            description: 'Task title',
          },
          description: {
            type: 'string',
            description: 'Task description',
          },
          priority: {
            type: 'number',
            description: 'Task priority (0-5, where 0 is lowest)',
          },
          record_type: {
            type: 'number',
            description: 'Task record type ID',
          },
          date_start: {
            type: 'number',
            description: 'Start date (Unix timestamp in seconds)',
          },
          date_end: {
            type: 'number',
            description: 'End date (Unix timestamp in seconds)',
          },
          all_day: {
            type: 'boolean',
            description: 'Whether this is an all-day task',
          },
          actual_time: {
            type: 'number',
            description: 'Actual time spent (in hours)',
          },
          estimated_time: {
            type: 'number',
            description: 'Estimated time required (in hours)',
          },
          is_completed: {
            type: 'boolean',
            description: 'Mark task as completed',
          },
          is_active: {
            type: 'boolean',
            description: 'Set to false to soft-delete the task',
          },
          is_archived: {
            type: 'boolean',
            description: 'Archive the task',
          },
          hide_from_calendarview: {
            type: 'boolean',
            description: 'Hide task from calendar view',
          },
          hide_from_tasklist: {
            type: 'boolean',
            description: 'Hide task from task list',
          },
          owners: {
            type: 'array',
            description: 'Array of owner objects with id field: [{"id": "user_jnid"}]',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'User JNID',
                },
              },
              required: ['id'],
            },
          },
          related: {
            type: 'array',
            description: 'Array of related entity objects: [{"id": "entity_jnid", "type": "job"}]',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Entity JNID',
                },
                type: {
                  type: 'string',
                  description: 'Entity type (job, contact, etc.)',
                },
              },
              required: ['id'],
            },
          },
          tags: {
            type: 'array',
            description: 'Array of tags',
            items: {
              type: 'object',
            },
          },
          mark_as_deleted: {
            type: 'boolean',
            description: 'Set to true to soft-delete the task (sets is_active: false)',
          },
        },
        required: ['jnid'],
      },
    };
  }

  async execute(input: UpdateTaskInput, context: ToolContext): Promise<any> {
    try {
      // Build update payload
      const updatePayload: any = {};

      // Handle deletion flag
      if (input.mark_as_deleted) {
        updatePayload.is_active = false;
      }

      // Copy all provided fields to payload
      if (input.title !== undefined) updatePayload.title = input.title;
      if (input.description !== undefined) updatePayload.description = input.description;
      if (input.priority !== undefined) updatePayload.priority = input.priority;
      if (input.record_type !== undefined) updatePayload.record_type = input.record_type;

      if (input.date_start !== undefined) updatePayload.date_start = input.date_start;
      if (input.date_end !== undefined) updatePayload.date_end = input.date_end;
      if (input.all_day !== undefined) updatePayload.all_day = input.all_day;

      if (input.actual_time !== undefined) updatePayload.actual_time = input.actual_time;
      if (input.estimated_time !== undefined) updatePayload.estimated_time = input.estimated_time;

      if (input.is_completed !== undefined) updatePayload.is_completed = input.is_completed;
      if (input.is_active !== undefined) updatePayload.is_active = input.is_active;
      if (input.is_archived !== undefined) updatePayload.is_archived = input.is_archived;
      if (input.hide_from_calendarview !== undefined) updatePayload.hide_from_calendarview = input.hide_from_calendarview;
      if (input.hide_from_tasklist !== undefined) updatePayload.hide_from_tasklist = input.hide_from_tasklist;

      if (input.owners !== undefined) updatePayload.owners = input.owners;
      if (input.related !== undefined) updatePayload.related = input.related;
      if (input.tags !== undefined) updatePayload.tags = input.tags;

      // Check if we have anything to update
      if (Object.keys(updatePayload).length === 0) {
        return {
          success: false,
          error: 'No fields provided for update',
          jnid: input.jnid,
        };
      }

      // Call JobNimbus API
      const response = await this.client.put(
        context.apiKey,
        `tasks/${input.jnid}`,
        updatePayload
      );

      return {
        success: true,
        data: {
          jnid: input.jnid,
          updated_fields: Object.keys(updatePayload),
          fields_updated_count: Object.keys(updatePayload).length,
          was_deleted: updatePayload.is_active === false,
          response: response.data,
          _metadata: {
            api_endpoint: 'PUT /api1/tasks/<jnid>',
            payload_sent: updatePayload,
            timestamp: new Date().toISOString(),
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update task',
        jnid: input.jnid,
        _metadata: {
          api_endpoint: 'PUT /api1/tasks/<jnid>',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}
