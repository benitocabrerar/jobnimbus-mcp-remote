/**
 * Get Tasks Tool
 * Optimized for small responses to prevent Claude Desktop saturation
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface GetTasksInput {
  from?: number;
  size?: number;
  include_full_details?: boolean;
}

interface Task {
  jnid?: string;
  name?: string;
  description?: string;
  status?: string;
  due_date?: number;
  assigned_to?: string;
  [key: string]: any;
}

interface CompactTask {
  jnid: string;
  name: string;
  status: string;
  assigned_to?: string;
  due_date?: string;
  description_preview?: string;
}

export class GetTasksTool extends BaseTool<GetTasksInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_tasks',
      description: 'Retrieve tasks from JobNimbus with pagination (optimized for small responses)',
      inputSchema: {
        type: 'object',
        properties: {
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
          },
          size: {
            type: 'number',
            description: 'Number of records to retrieve (default: 10, max: 50). Use small values to prevent response saturation.',
          },
          include_full_details: {
            type: 'boolean',
            description: 'Return full task details. Default: false (compact mode - RECOMMENDED). Only use for small queries (< 10 results).',
          },
        },
      },
    };
  }

  /**
   * Compact task to essential fields
   */
  private compactTask(task: Task): CompactTask {
    const description = task.description || task.note || '';
    const descriptionPreview = description.length > 80
      ? description.substring(0, 80) + '...'
      : description;

    return {
      jnid: task.jnid || '',
      name: task.name || task.subject || 'Unnamed Task',
      status: task.status_name || task.status || 'Unknown',
      assigned_to: task.assigned_to_name || task.assigned_to,
      due_date: task.date_end ? this.formatTimestamp(task.date_end) : undefined,
      description_preview: descriptionPreview || undefined,
    };
  }

  /**
   * Format Unix timestamp to readable date
   */
  private formatTimestamp(timestamp: number): string {
    if (!timestamp || timestamp === 0) return 'N/A';
    try {
      return new Date(timestamp * 1000).toISOString().split('T')[0];
    } catch {
      return 'Invalid Date';
    }
  }

  async execute(input: GetTasksInput, context: ToolContext): Promise<any> {
    const fromIndex = input.from || 0;
    // OPTIMIZED: Default 10, max 50 (reduced from 50/100)
    const requestedSize = Math.min(input.size || 10, 50);

    // Fetch tasks from JobNimbus API
    const params: any = {
      from: fromIndex,
      size: requestedSize,
    };

    const result = await this.client.get(context.apiKey, 'tasks', params);
    const tasks: Task[] = result.data?.results || result.data || [];

    // OPTIMIZED: Force compact mode if more than 10 results
    const forceCompact = tasks.length > 10;
    const useCompactMode = !input.include_full_details || forceCompact;

    const resultTasks = useCompactMode
      ? tasks.map(task => this.compactTask(task))
      : tasks;

    return {
      _code_version: 'v1.0-optimized-2025-10-10',
      count: tasks.length,
      from: fromIndex,
      size: requestedSize,
      has_more: tasks.length === requestedSize,
      compact_mode: useCompactMode,
      compact_mode_forced: forceCompact,
      results: resultTasks,
    };
  }
}
