/**
 * Get Task Management Analytics
 * Comprehensive task analytics with priority tracking, assignment analysis, completion metrics, and productivity insights
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { RecordTypeNormalizer } from '../../utils/normalizers/recordTypeNormalizer.js';

interface TaskMetrics {
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
  avg_completion_time_hours: number;
  tasks_with_due_dates: number;
}

interface PriorityBreakdown {
  priority_level: string;
  task_count: number;
  completed_count: number;
  overdue_count: number;
  completion_rate: number;
  avg_age_days: number;
}

interface AssignmentAnalytics {
  assignee_name: string;
  assignee_id: string;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
  avg_completion_time_hours: number;
  productivity_score: number;
  workload_status: 'Overloaded' | 'Optimal' | 'Underutilized';
}

interface TaskTypeMetrics {
  task_type: string;
  count: number;
  completed: number;
  avg_completion_time_hours: number;
  completion_rate: number;
}

interface OverdueAnalysis {
  task_id: string;
  task_name: string;
  assignee: string;
  days_overdue: number;
  priority: string;
  created_date: string;
  due_date: string;
  urgency_score: number;
}

interface ProductivityTrends {
  period: string;
  tasks_created: number;
  tasks_completed: number;
  completion_rate: number;
  avg_completion_time_hours: number;
  trend: 'Improving' | 'Declining' | 'Stable';
}

export class GetTaskManagementAnalyticsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_task_management_analytics',
      description: 'Task analytics: priority, assignments, completion, overdue',
      inputSchema: {
        type: 'object',
        properties: {
          assignee_filter: {
            type: 'string',
            description: 'Filter by assignee name or ID',
          },
          priority_filter: {
            type: 'string',
            description: 'Filter by priority level',
          },
          include_overdue_analysis: {
            type: 'boolean',
            default: true,
            description: 'Include detailed overdue task analysis',
          },
          include_productivity_trends: {
            type: 'boolean',
            default: true,
            description: 'Include productivity trend analysis',
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
      const assigneeFilter = input.assignee_filter;
      const priorityFilter = input.priority_filter;
      const includeOverdue = input.include_overdue_analysis !== false;
      const includeProductivity = input.include_productivity_trends !== false;
      const daysBack = input.days_back || 30;

      // CRITICAL FIX: Fetch from tasks endpoint, not activities
      // This was causing zero results in analytics (Bug Report Issue #1)
      // NOTE: is_active filtering must be done client-side - JobNimbus API doesn't support this param
      const [tasksResponse] = await Promise.all([
        this.client.get(context.apiKey, 'tasks', {
          size: 500,  // Increased to capture more tasks
        }),
      ]);

      // Get raw tasks from correct endpoint
      const rawTasks = tasksResponse.data?.results || tasksResponse.data || [];

      // Try to fetch users - endpoint may not be available in all JobNimbus accounts
      let users: any[] = [];
      try {
        const usersResponse = await this.client.get(context.apiKey, 'users', { size: 100 });
        users = usersResponse.data?.results || usersResponse.data?.users || [];
      } catch (error) {
        // Users endpoint not available - proceed without user attribution
        console.warn('Users endpoint not available - task management analysis will be limited');
      }

      // Normalize all tasks with production defaults (Fixes Issues #3, #4, #5, #6)
      // Apply client-side filtering for is_active (API doesn't support this param)
      const tasks = rawTasks
        .filter((task: any) => task.is_active !== false)  // Only active tasks
        .map((task: any) => this.normalizeTask(task));

      const now = Date.now();
      const cutoffDate = now - (daysBack * 24 * 60 * 60 * 1000);

      // Build user lookup
      const userLookup = new Map<string, any>();
      for (const user of users) {
        if (user.jnid || user.id) {
          userLookup.set(user.jnid || user.id, user);
        }
      }

      // Overall task metrics
      const metrics: TaskMetrics = {
        total_tasks: 0,
        completed_tasks: 0,
        pending_tasks: 0,
        overdue_tasks: 0,
        completion_rate: 0,
        avg_completion_time_hours: 0,
        tasks_with_due_dates: 0,
      };

      const completionTimes: number[] = [];
      const priorityMap = new Map<string, {
        total: number;
        completed: number;
        overdue: number;
        ages: number[];
      }>();
      const assigneeMap = new Map<string, {
        name: string;
        total: number;
        completed: number;
        pending: number;
        overdue: number;
        completionTimes: number[];
      }>();
      const typeMap = new Map<string, {
        count: number;
        completed: number;
        completionTimes: number[];
      }>();
      const overdueTasks: OverdueAnalysis[] = [];

      // Process tasks
      for (const task of tasks) {
        // Apply filters
        if (assigneeFilter) {
          const assigneeId = task.assigned_to || task.assignee_id || '';
          const assigneeName = this.getAssigneeName(task, userLookup);
          if (!assigneeId.includes(assigneeFilter) && !assigneeName.toLowerCase().includes(assigneeFilter.toLowerCase())) {
            continue;
          }
        }

        const priority = this.getPriorityLabel(task.priority);
        if (priorityFilter && priority.toLowerCase() !== priorityFilter.toLowerCase()) {
          continue;
        }

        const createdDate = (task.date_created || task.created_at || 0) * 1000;  // Convert seconds to milliseconds
        if (createdDate < cutoffDate) continue;

        metrics.total_tasks++;

        // Completion status
        // BUG FIX 18102025-02: Check is_completed field AND status name strings
        const statusName = (task.status_name || task.status || '').toLowerCase();
        const isCompleted = task.is_completed === true ||
                           statusName.includes('complete') ||
                           statusName.includes('done') ||
                           statusName.includes('closed');

        if (isCompleted) {
          metrics.completed_tasks++;

          // Calculate completion time
          const completedDate = task.date_completed || task.date_updated || 0;
          if (completedDate > 0 && createdDate > 0) {
            const completionTime = (completedDate - createdDate) / (1000 * 60 * 60); // hours
            completionTimes.push(completionTime);
          }
        } else {
          metrics.pending_tasks++;
        }

        // Due date tracking
        const dueDate = task.date_end || task.due_date || 0;
        if (dueDate > 0) {
          metrics.tasks_with_due_dates++;

          // Check if overdue
          if (!isCompleted && dueDate < now) {
            metrics.overdue_tasks++;

            if (includeOverdue) {
              const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
              const urgencyScore = this.calculateUrgencyScore(priority, daysOverdue);

              overdueTasks.push({
                task_id: task.jnid || task.id || 'unknown',
                task_name: task.name || task.title || 'Unnamed Task',
                assignee: this.getAssigneeName(task, userLookup),
                days_overdue: daysOverdue,
                priority: priority,
                created_date: createdDate > 0 ? new Date(createdDate).toISOString() : 'Unknown',
                due_date: new Date(dueDate).toISOString(),
                urgency_score: urgencyScore,
              });
            }
          }
        }

        // Priority breakdown
        if (!priorityMap.has(priority)) {
          priorityMap.set(priority, { total: 0, completed: 0, overdue: 0, ages: [] });
        }
        const priorityData = priorityMap.get(priority)!;
        priorityData.total++;
        if (isCompleted) priorityData.completed++;
        if (!isCompleted && dueDate > 0 && dueDate < now) priorityData.overdue++;

        const ageHours = (now - createdDate) / (1000 * 60 * 60);
        priorityData.ages.push(ageHours / 24); // days

        // Assignee breakdown
        const assigneeId = task.assigned_to || task.assignee_id || 'unassigned';
        const assigneeName = assigneeId === 'unassigned' ? 'Unassigned' : this.getAssigneeName(task, userLookup);

        if (!assigneeMap.has(assigneeId)) {
          assigneeMap.set(assigneeId, {
            name: assigneeName,
            total: 0,
            completed: 0,
            pending: 0,
            overdue: 0,
            completionTimes: [],
          });
        }
        const assigneeData = assigneeMap.get(assigneeId)!;
        assigneeData.total++;
        if (isCompleted) {
          assigneeData.completed++;
          if (completionTimes.length > 0) {
            assigneeData.completionTimes.push(completionTimes[completionTimes.length - 1]);
          }
        } else {
          assigneeData.pending++;
          if (dueDate > 0 && dueDate < now) {
            assigneeData.overdue++;
          }
        }

        // Task type breakdown
        const taskType = task.activity_type || task.type || 'General';
        if (!typeMap.has(taskType)) {
          typeMap.set(taskType, { count: 0, completed: 0, completionTimes: [] });
        }
        const typeData = typeMap.get(taskType)!;
        typeData.count++;
        if (isCompleted) {
          typeData.completed++;
          if (completionTimes.length > 0) {
            typeData.completionTimes.push(completionTimes[completionTimes.length - 1]);
          }
        }
      }

      // Calculate metrics
      metrics.completion_rate = metrics.total_tasks > 0
        ? (metrics.completed_tasks / metrics.total_tasks) * 100
        : 0;

      metrics.avg_completion_time_hours = completionTimes.length > 0
        ? completionTimes.reduce((sum, t) => sum + t, 0) / completionTimes.length
        : 0;

      // Priority breakdown
      const priorityBreakdown: PriorityBreakdown[] = [];
      for (const [priority, data] of priorityMap.entries()) {
        priorityBreakdown.push({
          priority_level: priority,
          task_count: data.total,
          completed_count: data.completed,
          overdue_count: data.overdue,
          completion_rate: data.total > 0 ? (data.completed / data.total) * 100 : 0,
          avg_age_days: data.ages.length > 0
            ? data.ages.reduce((sum, age) => sum + age, 0) / data.ages.length
            : 0,
        });
      }
      priorityBreakdown.sort((a, b) => b.task_count - a.task_count);

      // Assignment analytics
      const assignmentAnalytics: AssignmentAnalytics[] = [];
      for (const [assigneeId, data] of assigneeMap.entries()) {
        const completionRate = data.total > 0 ? (data.completed / data.total) * 100 : 0;
        const avgCompletionTime = data.completionTimes.length > 0
          ? data.completionTimes.reduce((sum, t) => sum + t, 0) / data.completionTimes.length
          : 0;

        const productivityScore = this.calculateProductivityScore(
          completionRate,
          avgCompletionTime,
          data.overdue,
          data.total
        );

        const workloadStatus: 'Overloaded' | 'Optimal' | 'Underutilized' =
          data.pending >= 20 ? 'Overloaded' :
          data.pending >= 5 ? 'Optimal' : 'Underutilized';

        assignmentAnalytics.push({
          assignee_name: data.name,
          assignee_id: assigneeId,
          total_tasks: data.total,
          completed_tasks: data.completed,
          pending_tasks: data.pending,
          overdue_tasks: data.overdue,
          completion_rate: completionRate,
          avg_completion_time_hours: avgCompletionTime,
          productivity_score: productivityScore,
          workload_status: workloadStatus,
        });
      }
      assignmentAnalytics.sort((a, b) => b.productivity_score - a.productivity_score);

      // Task type metrics
      const taskTypeMetrics: TaskTypeMetrics[] = [];
      for (const [type, data] of typeMap.entries()) {
        taskTypeMetrics.push({
          task_type: type,
          count: data.count,
          completed: data.completed,
          avg_completion_time_hours: data.completionTimes.length > 0
            ? data.completionTimes.reduce((sum, t) => sum + t, 0) / data.completionTimes.length
            : 0,
          completion_rate: data.count > 0 ? (data.completed / data.count) * 100 : 0,
        });
      }
      taskTypeMetrics.sort((a, b) => b.count - a.count);

      // Sort overdue tasks by urgency
      overdueTasks.sort((a, b) => b.urgency_score - a.urgency_score);

      // Productivity trends (if requested)
      const productivityTrends: ProductivityTrends[] = [];
      if (includeProductivity) {
        // Weekly trends for the past 4 weeks
        for (let week = 0; week < 4; week++) {
          const weekStart = now - ((week + 1) * 7 * 24 * 60 * 60 * 1000);
          const weekEnd = now - (week * 7 * 24 * 60 * 60 * 1000);

          const weekTasks = tasks.filter((t: any) => {
            const created = t.date_created || t.created_at || 0;
            return created >= weekStart && created < weekEnd;
          });

          const weekCompleted = weekTasks.filter((t: any) => {
            const status = (t.status_name || t.status || '').toLowerCase();
            return status.includes('complete') || status.includes('done');
          });

          const weekCompletionTimes: number[] = [];
          for (const task of weekCompleted) {
            const created = task.date_created || task.created_at || 0;
            const completed = task.date_completed || task.date_updated || 0;
            if (created > 0 && completed > 0) {
              weekCompletionTimes.push((completed - created) / (1000 * 60 * 60));
            }
          }

          const completionRate = weekTasks.length > 0
            ? (weekCompleted.length / weekTasks.length) * 100
            : 0;

          const avgTime = weekCompletionTimes.length > 0
            ? weekCompletionTimes.reduce((sum, t) => sum + t, 0) / weekCompletionTimes.length
            : 0;

          productivityTrends.unshift({
            period: `Week ${4 - week}`,
            tasks_created: weekTasks.length,
            tasks_completed: weekCompleted.length,
            completion_rate: completionRate,
            avg_completion_time_hours: avgTime,
            trend: 'Stable', // Will be calculated after all weeks
          });
        }

        // Calculate trends
        for (let i = 1; i < productivityTrends.length; i++) {
          const current = productivityTrends[i];
          const previous = productivityTrends[i - 1];

          if (current.completion_rate > previous.completion_rate + 5) {
            current.trend = 'Improving';
          } else if (current.completion_rate < previous.completion_rate - 5) {
            current.trend = 'Declining';
          } else {
            current.trend = 'Stable';
          }
        }
      }

      // Generate recommendations
      const recommendations: string[] = [];

      if (metrics.overdue_tasks > metrics.total_tasks * 0.2) {
        recommendations.push(`🚨 High overdue rate (${((metrics.overdue_tasks / metrics.total_tasks) * 100).toFixed(1)}%) - review workload and priorities`);
      }

      if (metrics.completion_rate < 60) {
        recommendations.push(`⚠️ Low completion rate (${metrics.completion_rate.toFixed(1)}%) - consider task prioritization review`);
      }

      const overloadedAssignees = assignmentAnalytics.filter(a => a.workload_status === 'Overloaded').length;
      if (overloadedAssignees > 0) {
        recommendations.push(`👥 ${overloadedAssignees} team member(s) overloaded - redistribute tasks`);
      }

      const topPerformer = assignmentAnalytics[0];
      if (topPerformer && topPerformer.productivity_score >= 80) {
        recommendations.push(`🏆 Top performer: ${topPerformer.assignee_name} (${topPerformer.productivity_score}/100 productivity score)`);
      }

      if (metrics.avg_completion_time_hours > 72) {
        recommendations.push(`⏱️ High average completion time (${(metrics.avg_completion_time_hours / 24).toFixed(1)} days) - streamline workflows`);
      }

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        analysis_period_days: daysBack,
        summary: metrics,
        priority_breakdown: priorityBreakdown,
        assignment_analytics: assignmentAnalytics,
        task_type_metrics: taskTypeMetrics,
        overdue_analysis: includeOverdue ? {
          total_overdue: overdueTasks.length,
          critical_overdue: overdueTasks.filter(t => t.urgency_score >= 80).length,
          top_overdue_tasks: overdueTasks.slice(0, 10),
        } : undefined,
        productivity_trends: includeProductivity ? productivityTrends : undefined,
        recommendations: recommendations,
        key_insights: [
          `Overall completion rate: ${metrics.completion_rate.toFixed(1)}%`,
          `${metrics.overdue_tasks} task(s) overdue out of ${metrics.total_tasks} total`,
          `Average completion time: ${(metrics.avg_completion_time_hours / 24).toFixed(1)} days`,
          `${assignmentAnalytics.length} team member(s) tracked`,
        ],
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }

  /**
   * Convert numeric priority to string label
   * JobNimbus API returns priority as number 0-5
   */
  private getPriorityLabel(priorityValue: number | undefined): string {
    if (priorityValue === undefined || priorityValue === null) return 'Normal';

    // JobNimbus priority scale: 0 = Low, 1-2 = Normal, 3-4 = High, 5 = Critical
    if (priorityValue === 0) return 'Low';
    if (priorityValue >= 5) return 'Critical';
    if (priorityValue >= 3) return 'High';
    return 'Normal';
  }

  /**
   * Get assignee name from task and user lookup
   * BUG FIX 18102025-02: Added fallback to created_by_name and owners array
   */
  private getAssigneeName(task: any, userLookup: Map<string, any>): string {
    // Try assigned_to or assignee_id first
    let assigneeId = task.assigned_to || task.assignee_id;

    // BUG FIX: Fallback to owners array if no direct assignment
    if (!assigneeId && task.owners && Array.isArray(task.owners) && task.owners.length > 0) {
      assigneeId = task.owners[0].id;
    }

    // BUG FIX: Fallback to created_by as final resort before marking as Unassigned
    if (!assigneeId && task.created_by) {
      assigneeId = task.created_by;
      // Return created_by_name directly if available
      if (task.created_by_name) {
        return task.created_by_name;
      }
    }

    if (!assigneeId) return 'Unassigned';

    const user = userLookup.get(assigneeId);
    if (user) {
      return user.display_name || user.name || user.email || assigneeId;
    }

    return task.assignee_name || task.created_by_name || assigneeId;
  }

  /**
   * Calculate urgency score for overdue task
   */
  private calculateUrgencyScore(priority: string, daysOverdue: number): number {
    const priorityLower = priority.toLowerCase();
    let baseScore = 50;

    if (priorityLower.includes('high') || priorityLower.includes('urgent')) {
      baseScore = 80;
    } else if (priorityLower.includes('low')) {
      baseScore = 30;
    }

    // Add points for days overdue (max 20 points)
    const overduePoints = Math.min(daysOverdue * 2, 20);

    return Math.min(baseScore + overduePoints, 100);
  }

  /**
   * Calculate productivity score for assignee
   */
  private calculateProductivityScore(
    completionRate: number,
    avgCompletionTime: number,
    overdueCount: number,
    totalTasks: number
  ): number {
    let score = 0;

    // Completion rate (50 points)
    score += (completionRate / 100) * 50;

    // Speed (25 points) - faster is better
    const speedScore = avgCompletionTime > 0 ? Math.max(0, 25 - (avgCompletionTime / 10)) : 0;
    score += Math.min(speedScore, 25);

    // Quality (25 points) - fewer overdue is better
    const overdueRate = totalTasks > 0 ? (overdueCount / totalTasks) * 100 : 0;
    const qualityScore = Math.max(0, 25 - (overdueRate / 4));
    score += qualityScore;

    return Math.min(Math.round(score), 100);
  }

  /**
   * Normalize task data with production defaults
   * Fixes Issues #3, #4, #5, #6 from bug report
   */
  private normalizeTask(task: any): any {
    const now = Date.now() / 1000;

    // ULTRA FIX 18102025-03: Comprehensive date validation
    // Minimum valid date: 2020-01-01 00:00:00 UTC (timestamp: 1577836800)
    // Any date before this is considered corrupted data
    const MIN_VALID_TIMESTAMP = 1577836800;

    // FIX #4: Auto-calculate missing due dates (3 business days)
    // BUG FIX 18102025-02: Check for null, zero, OR any date before 2020
    // This catches corrupted timestamps like 1728000 (1970-01-21)
    const hasValidDateEnd = task.date_end &&
                           typeof task.date_end === 'number' &&
                           task.date_end >= MIN_VALID_TIMESTAMP;

    const hasValidDateStart = task.date_start &&
                             typeof task.date_start === 'number' &&
                             task.date_start >= MIN_VALID_TIMESTAMP;

    if (!hasValidDateEnd && hasValidDateStart) {
      task.date_end = this.addBusinessDays(task.date_start, 3);
      task._auto_due_date = true;
      task._date_fix_reason = task.date_end ? 'corrupted_old_timestamp' : 'missing_date';
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
