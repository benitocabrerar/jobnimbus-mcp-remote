/**
 * Get Tasks By Owner Tool
 * Groups tasks by assignee/owner with comprehensive metrics
 *
 * Fixes Issue #2 from bug report: "get_tasks_by_owner not found"
 * Provides aggregated output: { owner_name, task_count, overdue_count, avg_completion_time }
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';
import { RecordTypeNormalizer } from '../../utils/normalizers/recordTypeNormalizer.js';

interface GetTasksByOwnerInput {
  include_unassigned?: boolean;
  include_completed?: boolean;
  days_back?: number;
  priority_filter?: number;
  include_summary?: boolean;
}

interface OwnerTaskGroup {
  owner_id: string;
  owner_name: string;
  total_tasks: number;
  active_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  high_priority_tasks: number;
  avg_completion_time_hours: number;
  avg_days_until_due: number | null;
  tasks: Array<{
    jnid: string;
    number: string;
    title: string;
    record_type: string;
    priority: number;
    date_start: string | null;
    date_end: string | null;
    is_completed: boolean;
    is_overdue: boolean;
    days_until_due: number | null;
    auto_due_date: boolean;
  }>;
}

export class GetTasksByOwnerTool extends BaseTool<GetTasksByOwnerInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_tasks_by_owner',
      description: 'Get tasks grouped by owner/assignee with aggregated metrics',
      inputSchema: {
        type: 'object',
        properties: {
          include_unassigned: {
            type: 'boolean',
            default: true,
            description: 'Include unassigned tasks (tasks without owners)',
          },
          include_completed: {
            type: 'boolean',
            default: false,
            description: 'Include completed tasks in results',
          },
          days_back: {
            type: 'number',
            default: 30,
            description: 'Days of history to include (default: 30)',
          },
          priority_filter: {
            type: 'number',
            description: 'Filter by minimum priority level (0-5)',
          },
          include_summary: {
            type: 'boolean',
            default: true,
            description: 'Include summary statistics in response',
          },
        },
      },
    };
  }

  async execute(input: GetTasksByOwnerInput, context: ToolContext): Promise<any> {
    const includeUnassigned = input.include_unassigned !== false;
    const includeCompleted = input.include_completed === true;
    const daysBack = input.days_back || 30;
    const includeSummary = input.include_summary !== false;

    // Build cache key
    const cacheKey = {
      entity: CACHE_PREFIXES.TASKS,
      operation: 'by_owner',
      identifier: JSON.stringify({
        include_unassigned: includeUnassigned,
        include_completed: includeCompleted,
        days_back: daysBack,
        priority_filter: input.priority_filter,
      }),
      instance: context.instance,
    };

    return await withCache(
      cacheKey,
      getTTL('TASKS_LIST'),
      async () => {
        // Fetch all active tasks
        const tasksResult = await this.client.get(context.apiKey, 'tasks', {
          size: 500,  // Get more tasks for grouping
          is_active: true,
        });

        const rawTasks = tasksResult.data?.results || tasksResult.data || [];
        const now = Date.now();
        const cutoffDate = now - (daysBack * 24 * 60 * 60 * 1000);

        // Group tasks by owner
        const ownerGroups = new Map<string, OwnerTaskGroup>();

        for (const rawTask of rawTasks) {
          // Normalize task first (applies fixes #3, #4, #5, #6)
          const task = this.normalizeTask(rawTask);

          // Apply filters
          const createdTimestamp = (task.date_created || 0) * 1000;
          if (createdTimestamp < cutoffDate) continue;

          if (!includeCompleted && task.is_completed) continue;
          if (input.priority_filter && task.priority < input.priority_filter) continue;

          // Determine owner(s)
          const ownerIds = task.owners?.map((o: any) => o.id) || [];

          if (ownerIds.length === 0) {
            if (!includeUnassigned) continue;
            ownerIds.push('unassigned');
          }

          for (const ownerId of ownerIds) {
            if (!ownerGroups.has(ownerId)) {
              // Get owner name
              let ownerName = 'Unassigned';
              if (ownerId !== 'unassigned') {
                const ownerObj = task.owners?.find((o: any) => o.id === ownerId);
                ownerName = ownerObj?.name || task.created_by_name || ownerId;
              }

              ownerGroups.set(ownerId, {
                owner_id: ownerId,
                owner_name: ownerName,
                total_tasks: 0,
                active_tasks: 0,
                completed_tasks: 0,
                overdue_tasks: 0,
                high_priority_tasks: 0,
                avg_completion_time_hours: 0,
                avg_days_until_due: null,
                tasks: [],
              });
            }

            const group = ownerGroups.get(ownerId)!;

            // Calculate due date (use normalized date_end with auto-fallback)
            const dueDate = task.date_end;
            const isOverdue = !task.is_completed && dueDate && dueDate < now / 1000;
            const daysUntilDue = dueDate ?
              Math.floor((dueDate * 1000 - now) / (24 * 60 * 60 * 1000)) : null;

            // Update metrics
            group.total_tasks++;
            if (!task.is_completed) group.active_tasks++;
            if (task.is_completed) group.completed_tasks++;
            if (isOverdue) group.overdue_tasks++;
            if (task.priority >= 4) group.high_priority_tasks++;

            // Add task to group
            group.tasks.push({
              jnid: task.jnid,
              number: task.number,
              title: task.title || 'Untitled',
              record_type: task.record_type_normalized || task.record_type_name || 'Task',
              priority: task.priority || 0,
              date_start: task.date_start ?
                new Date(task.date_start * 1000).toISOString().split('T')[0] : null,
              date_end: dueDate ?
                new Date(dueDate * 1000).toISOString().split('T')[0] : null,
              is_completed: task.is_completed || false,
              is_overdue: isOverdue,
              days_until_due: daysUntilDue,
              auto_due_date: task._auto_due_date || false,
            });
          }
        }

        // Calculate averages for each group
        for (const [ownerId, group] of ownerGroups.entries()) {
          // Average days until due (for non-completed tasks)
          const activeDueDays = group.tasks
            .filter(t => !t.is_completed && t.days_until_due !== null)
            .map(t => t.days_until_due as number);

          if (activeDueDays.length > 0) {
            group.avg_days_until_due =
              Math.round(activeDueDays.reduce((sum, d) => sum + d, 0) / activeDueDays.length);
          }

          // Average completion time (for completed tasks)
          const completedTasks = rawTasks.filter((t: any) => {
            const owners = t.owners?.map((o: any) => o.id) || [];
            return (owners.includes(ownerId) || (ownerId === 'unassigned' && owners.length === 0)) &&
                   t.is_completed &&
                   t.date_created && t.date_completed;
          });

          if (completedTasks.length > 0) {
            const completionTimes = completedTasks.map((t: any) =>
              (t.date_completed - t.date_created) / 3600  // Convert to hours
            );
            group.avg_completion_time_hours =
              Math.round(completionTimes.reduce((sum: number, t: number) => sum + t, 0) / completionTimes.length);
          }
        }

        // Convert to array and sort by active tasks (descending)
        const results = Array.from(ownerGroups.values())
          .sort((a, b) => b.active_tasks - a.active_tasks);

        // Build summary statistics
        const summary = includeSummary ? {
          total_owners: results.length,
          total_tasks: results.reduce((sum, g) => sum + g.total_tasks, 0),
          total_active: results.reduce((sum, g) => sum + g.active_tasks, 0),
          total_completed: results.reduce((sum, g) => sum + g.completed_tasks, 0),
          total_overdue: results.reduce((sum, g) => sum + g.overdue_tasks, 0),
          avg_tasks_per_owner: results.length > 0 ?
            Math.round(results.reduce((sum, g) => sum + g.total_tasks, 0) / results.length) : 0,
          most_loaded_owner: results[0]?.owner_name || 'None',
          most_loaded_owner_tasks: results[0]?.active_tasks || 0,
        } : undefined;

        return {
          _code_version: 'v1.0-fix-2025-01-18',
          _fixes_applied: [
            'Issue #2: New get_tasks_by_owner function',
            'Issue #3: Record type normalization',
            'Issue #4: Auto-due date fallback',
            'Issue #5: Default time values',
            'Issue #6: Auto-link validation',
          ],
          owner_count: results.length,
          summary,
          groups: results,
          _metadata: {
            api_endpoint: 'GET /api1/tasks',
            grouped_by: 'owner',
            filters_applied: {
              include_unassigned: includeUnassigned,
              include_completed: includeCompleted,
              days_back: daysBack,
              priority_filter: input.priority_filter || 'none',
            },
            timestamp: new Date().toISOString(),
          },
        };
      }
    );
  }

  /**
   * Normalize task data with production defaults
   * Fixes Issues #3, #4, #5, #6 from bug report
   */
  private normalizeTask(task: any): any {
    const now = Date.now() / 1000;

    // FIX #4: Auto-calculate missing due dates (3 business days)
    // ULTRA FIX 18102025-04: Comprehensive date validation with date_created fallback
    // Minimum valid date: 2020-01-01 00:00:00 UTC (timestamp: 1577836800)
    // This catches ALL corrupted dates including:
    // - Zero epoch (1970-01-01)
    // - Small non-zero timestamps (e.g., 1728000 = 1970-01-21)
    // - Any date before 2020
    // LOGIC FIX: Fallback to date_created when BOTH date_start AND date_end are corrupted
    const MIN_VALID_TIMESTAMP = 1577836800;

    const hasValidDateEnd = task.date_end &&
                           typeof task.date_end === 'number' &&
                           task.date_end >= MIN_VALID_TIMESTAMP;

    const hasValidDateStart = task.date_start &&
                             typeof task.date_start === 'number' &&
                             task.date_start >= MIN_VALID_TIMESTAMP;

    const hasValidDateCreated = task.date_created &&
                               typeof task.date_created === 'number' &&
                               task.date_created >= MIN_VALID_TIMESTAMP;

    // Fix corrupted date_end
    if (!hasValidDateEnd) {
      // Prefer valid date_start, fallback to date_created, last resort: now
      const baseDate = hasValidDateStart ? task.date_start :
                      hasValidDateCreated ? task.date_created :
                      now;

      task.date_end = this.addBusinessDays(baseDate, 3);
      task._auto_due_date = true;
      task._date_fix_reason = hasValidDateStart ? 'corrupted_date_end_only' :
                              hasValidDateCreated ? 'both_dates_corrupted_used_created' :
                              'all_dates_invalid_used_now';
    }

    // FIX #5: Default time values (1 hour estimated)
    if (!task.estimated_time || task.estimated_time === 0) {
      task.estimated_time = 3600;  // 1 hour in seconds
      task._default_estimate = true;
    }

    if (!task.actual_time) {
      task.actual_time = 0;
    }

    // FIX #3: Normalize record type classification
    const recordTypeNorm = RecordTypeNormalizer.normalize(task.record_type_name);
    task.record_type_normalized = recordTypeNorm.normalized;
    task.record_type_original = recordTypeNorm.original;
    task._record_type_valid = recordTypeNorm.is_valid;

    // Boost priority based on normalized type
    task.task_priority = Math.max(task.priority || 0, recordTypeNorm.priority);

    // FIX #6: Validate and fix relationships
    if (!task.related || !Array.isArray(task.related)) {
      task.related = [];
    }

    if (!task.owners || !Array.isArray(task.owners)) {
      task.owners = [];
      // Fallback: use created_by if no owners
      if (task.created_by) {
        task.owners.push({
          id: task.created_by,
          name: task.created_by_name || task.created_by,
        });
        task._owner_fallback = true;
      }
    }

    // Auto-link to job if task description contains job reference
    if (task.related.length === 0 && task.description) {
      const jobMatch = task.description.match(/#(\d+)|job[:\s]+(\d+)/i);
      if (jobMatch) {
        const jobNumber = jobMatch[1] || jobMatch[2];
        task.related.push({
          id: `job_${jobNumber}`,
          type: 'job',
          number: jobNumber,
          _auto_linked: true,
        });
      }
    }

    // BUG FIX 18102025-02: Normalize completion status from both is_completed field and status strings
    if (task.is_completed !== true) {
      const statusName = (task.status_name || task.status || '').toLowerCase();
      task.is_completed = statusName.includes('complete') ||
                         statusName.includes('done') ||
                         statusName.includes('closed');
    }

    return task;
  }

  /**
   * Add business days to a timestamp (skips weekends)
   * Used for automatic due date calculation
   */
  private addBusinessDays(startTimestamp: number, days: number): number {
    const date = new Date(startTimestamp * 1000);
    let addedDays = 0;

    while (addedDays < days) {
      date.setDate(date.getDate() + 1);
      const dayOfWeek = date.getDay();
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        addedDays++;
      }
    }

    return Math.floor(date.getTime() / 1000);
  }
}
