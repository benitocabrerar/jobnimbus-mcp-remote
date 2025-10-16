/**
 * Create Task Type Tool - Create new task type
 * Based on official JobNimbus API documentation
 *
 * Endpoint: POST /api1/account/tasktype
 *
 * Note: The token used must have an access profile level with access to the account settings page.
 * If task type already exists, the API will return the existing task type.
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface CreateTaskTypeInput {
  TypeName: string;
  IsActive?: boolean;
  HideFromCalendarView?: boolean;
  HideFromTaskList?: boolean;
  DefaultName?: string;
}

export class CreateTaskTypeTool extends BaseTool<CreateTaskTypeInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'create_task_type',
      description: 'Account: create task type, calendar/list visibility, default naming',
      inputSchema: {
        type: 'object',
        properties: {
          TypeName: {
            type: 'string',
            description: 'Task type name - Required (e.g., "Task", "Follow-up", "Inspection")',
          },
          IsActive: {
            type: 'boolean',
            description: 'Whether task type is active (default: true)',
          },
          HideFromCalendarView: {
            type: 'boolean',
            description: 'Whether to hide from calendar view (default: false)',
          },
          HideFromTaskList: {
            type: 'boolean',
            description: 'Whether to hide from task list (default: false)',
          },
          DefaultName: {
            type: 'string',
            description: 'Default name for tasks of this type (default: same as TypeName)',
          },
        },
        required: ['TypeName'],
      },
    };
  }

  async execute(input: CreateTaskTypeInput, context: ToolContext): Promise<any> {
    try {
      // Build request body
      const requestBody: any = {
        TypeName: input.TypeName,
        IsActive: input.IsActive ?? true,
        HideFromCalendarView: input.HideFromCalendarView ?? false,
        HideFromTaskList: input.HideFromTaskList ?? false,
      };

      // Add DefaultName if provided
      if (input.DefaultName) {
        requestBody.DefaultName = input.DefaultName;
      }

      // Call JobNimbus API
      const response = await this.client.post(
        context.apiKey,
        'account/tasktype',
        requestBody
      );

      return {
        success: true,
        message: 'Task type created successfully',
        data: response.data,
        summary: {
          task_type_id: response.data.TaskTypeId,
          type_name: input.TypeName,
          default_name: response.data.DefaultName,
          is_active: response.data.IsActive,
          hide_from_calendar: response.data.HideFromCalendarView,
          hide_from_task_list: response.data.HideFromTaskList,
        },
        _metadata: {
          api_endpoint: 'POST /api1/account/tasktype',
          note: 'If task type already exists, returns existing type',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create task type',
        _metadata: {
          api_endpoint: 'POST /api1/account/tasktype',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export default new CreateTaskTypeTool();
