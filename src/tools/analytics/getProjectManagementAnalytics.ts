/**
 * Get Project Management Analytics
 * Comprehensive project tracking with milestone analysis, timeline adherence, resource allocation, and risk assessment
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface ProjectMetrics {
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  delayed_projects: number;
  on_schedule_projects: number;
  avg_completion_rate: number;
  avg_project_duration_days: number;
  total_project_value: number;
  on_time_delivery_rate: number;
}

interface ProjectDetail {
  project_id: string;
  project_name: string;
  customer_name: string;
  status: string;
  start_date: string;
  scheduled_end_date: string;
  actual_end_date: string | null;
  duration_days: number;
  completion_percentage: number;
  timeline_status: 'On Schedule' | 'At Risk' | 'Delayed' | 'Completed On Time' | 'Completed Late';
  budget: number;
  actual_cost: number;
  budget_variance: number;
  assigned_team_size: number;
  milestones_completed: number;
  total_milestones: number;
  health_score: number;
  risk_level: 'Low' | 'Medium' | 'High' | 'Critical';
  recommended_action: string;
}

interface MilestoneAnalysis {
  milestone_type: string;
  total_milestones: number;
  completed_milestones: number;
  completion_rate: number;
  avg_completion_time_days: number;
  delayed_count: number;
  on_time_rate: number;
}

interface ResourceAllocation {
  resource_name: string;
  resource_id: string;
  assigned_projects: number;
  active_projects: number;
  completed_projects: number;
  on_time_delivery_rate: number;
  avg_project_health_score: number;
  capacity_utilization: number;
  performance_rating: 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement';
}

// interface TimelineAnalysis {
//   time_period: string;
//   projects_started: number;
//   projects_completed: number;
//   avg_duration_days: number;
//   on_time_percentage: number;
//   trend: 'Improving' | 'Stable' | 'Declining';
// }

interface RiskAssessment {
  risk_category: 'Schedule Risk' | 'Budget Risk' | 'Resource Risk' | 'Quality Risk';
  projects_at_risk: number;
  total_value_at_risk: number;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  mitigation_actions: string[];
  priority: number;
}

interface ProjectRecommendation {
  project_id: string;
  project_name: string;
  recommendation_type: 'Resource Adjustment' | 'Timeline Extension' | 'Budget Review' | 'Priority Change' | 'Risk Mitigation';
  urgency: 'Immediate' | 'High' | 'Medium' | 'Low';
  description: string;
  expected_impact: string;
}

export class GetProjectManagementAnalyticsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_project_management_analytics',
      description: 'Comprehensive project management analytics with milestone tracking, timeline adherence, resource allocation, budget monitoring, risk assessment, and optimization recommendations',
      inputSchema: {
        type: 'object',
        properties: {
          status_filter: {
            type: 'string',
            enum: ['active', 'completed', 'all'],
            default: 'active',
            description: 'Filter projects by status',
          },
          include_timeline_analysis: {
            type: 'boolean',
            default: true,
            description: 'Include timeline trend analysis',
          },
          include_resource_analysis: {
            type: 'boolean',
            default: true,
            description: 'Include resource allocation analysis',
          },
          health_threshold: {
            type: 'number',
            default: 70,
            description: 'Health score threshold for at-risk projects (default: 70)',
          },
          days_back: {
            type: 'number',
            default: 90,
            description: 'Days of history to analyze (default: 90)',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const statusFilter = input.status_filter || 'active';
      // const includeTimelineAnalysis = input.include_timeline_analysis !== false;
      const includeResourceAnalysis = input.include_resource_analysis !== false;
      const healthThreshold = input.health_threshold || 70;
      const daysBack = input.days_back || 90;

      // Fetch data
      const [jobsResponse, activitiesResponse, estimatesResponse, usersResponse] = await Promise.all([
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'activities', { size: 100 }),
        this.client.get(context.apiKey, 'estimates', { size: 100 }),
        this.client.get(context.apiKey, 'users', { size: 100 }),
      ]);

      const jobs = jobsResponse.data?.results || [];
      const activities = activitiesResponse.data?.activity || [];
      const estimates = estimatesResponse.data?.results || [];
      const users = usersResponse.data?.results || usersResponse.data?.users || [];

      const now = Date.now();
      const cutoffDate = now - (daysBack * 24 * 60 * 60 * 1000);

      // User map
      const userMap = new Map<string, any>();
      for (const user of users) {
        const userId = user.jnid || user.id;
        if (userId) userMap.set(userId, user);
      }

      // Build project tracking map
      const projectMap = new Map<string, {
        job: any;
        activities: any[];
        milestones: number;
        completedMilestones: number;
        teamMembers: Set<string>;
        estimate: any;
      }>();

      // Initialize projects (using jobs as projects)
      for (const job of jobs) {
        const jobId = job.jnid || job.id;
        if (!jobId) continue;

        const createdDate = job.date_created || job.created_at || 0;
        if (createdDate < cutoffDate) continue;

        projectMap.set(jobId, {
          job: job,
          activities: [],
          milestones: 0,
          completedMilestones: 0,
          teamMembers: new Set(),
          estimate: null,
        });
      }

      // Add activities to projects
      for (const activity of activities) {
        const related = activity.related || [];
        const jobRel = related.find((r: any) => r.type === 'job');
        if (!jobRel || !jobRel.id) continue;

        const jobId = jobRel.id;
        if (!projectMap.has(jobId)) continue;

        const project = projectMap.get(jobId)!;
        project.activities.push(activity);

        // Track milestones (tasks with specific types)
        const activityType = (activity.type || '').toLowerCase();
        if (activityType.includes('milestone') || activityType.includes('phase') || activityType.includes('review')) {
          project.milestones++;
          const status = (activity.status || '').toLowerCase();
          if (status.includes('complete') || status.includes('done')) {
            project.completedMilestones++;
          }
        }

        // Track team members
        const assigneeId = activity.assigned_to || activity.owner_id;
        if (assigneeId) {
          project.teamMembers.add(assigneeId);
        }
      }

      // Add estimates to projects
      for (const estimate of estimates) {
        const related = estimate.related || [];
        const jobRel = related.find((r: any) => r.type === 'job');
        if (!jobRel || !jobRel.id) continue;

        const jobId = jobRel.id;
        if (!projectMap.has(jobId)) {
          const project = projectMap.get(jobId);
          if (project) {
            project.estimate = estimate;
          }
        }
      }

      // Analyze projects
      const projectDetails: ProjectDetail[] = [];
      let totalCompleted = 0;
      let totalDelayed = 0;
      let totalOnSchedule = 0;
      let totalValue = 0;
      let completionDurations: number[] = [];

      for (const [jobId, project] of projectMap.entries()) {
        const job = project.job;
        const status = (job.status_name || '').toLowerCase();
        const isCompleted = status.includes('complete') || status.includes('won') || status.includes('closed');
        const isActive = !status.includes('cancelled') && !isCompleted;

        // Status filter
        if (statusFilter === 'active' && !isActive) continue;
        if (statusFilter === 'completed' && !isCompleted) continue;

        // Dates
        const startDate = job.date_start || job.date_created || 0;
        const scheduledEndDate = job.date_end || 0;
        const actualEndDate = job.date_status_change || job.date_updated || 0;

        // Duration
        const duration = isCompleted
          ? (actualEndDate - startDate) / (1000 * 60 * 60 * 24)
          : (now - startDate) / (1000 * 60 * 60 * 24);

        if (isCompleted && startDate > 0 && actualEndDate > 0) {
          completionDurations.push(duration);
          totalCompleted++;
        }

        // Timeline status
        let timelineStatus: 'On Schedule' | 'At Risk' | 'Delayed' | 'Completed On Time' | 'Completed Late';
        if (isCompleted) {
          if (scheduledEndDate > 0 && actualEndDate > scheduledEndDate) {
            timelineStatus = 'Completed Late';
            totalDelayed++;
          } else {
            timelineStatus = 'Completed On Time';
          }
        } else {
          if (scheduledEndDate > 0) {
            const daysUntilDeadline = (scheduledEndDate - now) / (1000 * 60 * 60 * 24);
            if (daysUntilDeadline < 0) {
              timelineStatus = 'Delayed';
              totalDelayed++;
            } else if (daysUntilDeadline < 7) {
              timelineStatus = 'At Risk';
            } else {
              timelineStatus = 'On Schedule';
              totalOnSchedule++;
            }
          } else {
            timelineStatus = 'On Schedule';
            totalOnSchedule++;
          }
        }

        // Budget
        const budget = project.estimate ? parseFloat(project.estimate.total || 0) : 0;
        const actualCost = parseFloat(job.total || job.value || 0);
        const budgetVariance = budget > 0 ? ((actualCost - budget) / budget) * 100 : 0;

        totalValue += actualCost;

        // Completion percentage
        const totalMilestones = Math.max(project.milestones, 1);
        const completionPercentage = (project.completedMilestones / totalMilestones) * 100;

        // Health score (0-100)
        let healthScore = 0;

        // Timeline component (40 points)
        if (timelineStatus === 'On Schedule' || timelineStatus === 'Completed On Time') {
          healthScore += 40;
        } else if (timelineStatus === 'At Risk') {
          healthScore += 25;
        } else if (timelineStatus === 'Delayed' || timelineStatus === 'Completed Late') {
          healthScore += 10;
        }

        // Budget component (30 points)
        if (budgetVariance <= 0) {
          healthScore += 30;
        } else if (budgetVariance <= 10) {
          healthScore += 20;
        } else if (budgetVariance <= 25) {
          healthScore += 10;
        }

        // Progress component (30 points)
        healthScore += Math.min(completionPercentage * 0.3, 30);

        // Risk level
        const riskLevel: 'Low' | 'Medium' | 'High' | 'Critical' =
          healthScore >= 80 ? 'Low' :
          healthScore >= 60 ? 'Medium' :
          healthScore >= 40 ? 'High' : 'Critical';

        // Recommended action
        const recommendedAction =
          riskLevel === 'Critical' ? 'Immediate intervention required - escalate to management' :
          riskLevel === 'High' ? 'Review resource allocation and timeline' :
          riskLevel === 'Medium' ? 'Monitor closely and adjust if needed' :
          'Continue current approach';

        // Customer name
        const customerRel = (job.related || []).find((r: any) => r.type === 'contact');
        const customerName = customerRel?.display_name || 'Unknown';

        projectDetails.push({
          project_id: jobId,
          project_name: job.display_name || job.name || 'Unnamed Project',
          customer_name: customerName,
          status: job.status_name || 'Unknown',
          start_date: startDate > 0 ? new Date(startDate).toISOString().split('T')[0] : 'N/A',
          scheduled_end_date: scheduledEndDate > 0 ? new Date(scheduledEndDate).toISOString().split('T')[0] : 'N/A',
          actual_end_date: isCompleted && actualEndDate > 0 ? new Date(actualEndDate).toISOString().split('T')[0] : null,
          duration_days: Math.round(duration),
          completion_percentage: Math.round(completionPercentage),
          timeline_status: timelineStatus,
          budget: budget,
          actual_cost: actualCost,
          budget_variance: budgetVariance,
          assigned_team_size: project.teamMembers.size,
          milestones_completed: project.completedMilestones,
          total_milestones: project.milestones,
          health_score: Math.round(healthScore),
          risk_level: riskLevel,
          recommended_action: recommendedAction,
        });
      }

      // Sort by health score (lowest first - most at risk)
      projectDetails.sort((a, b) => a.health_score - b.health_score);

      // Project metrics
      const activeProjects = projectDetails.filter(p => !['Completed On Time', 'Completed Late'].includes(p.timeline_status)).length;
      const avgCompletionRate = projectDetails.length > 0
        ? projectDetails.reduce((sum, p) => sum + p.completion_percentage, 0) / projectDetails.length
        : 0;
      const avgProjectDuration = completionDurations.length > 0
        ? completionDurations.reduce((sum, d) => sum + d, 0) / completionDurations.length
        : 0;
      const onTimeDeliveryRate = totalCompleted > 0
        ? ((totalCompleted - totalDelayed) / totalCompleted) * 100
        : 0;

      const projectMetrics: ProjectMetrics = {
        total_projects: projectDetails.length,
        active_projects: activeProjects,
        completed_projects: totalCompleted,
        delayed_projects: totalDelayed,
        on_schedule_projects: totalOnSchedule,
        avg_completion_rate: avgCompletionRate,
        avg_project_duration_days: avgProjectDuration,
        total_project_value: totalValue,
        on_time_delivery_rate: onTimeDeliveryRate,
      };

      // Milestone analysis
      const milestoneTypes = new Map<string, { total: number; completed: number; durations: number[] }>();
      for (const activity of activities) {
        const activityType = (activity.type || 'General').trim();
        const isMilestone = activityType.toLowerCase().includes('milestone') ||
                           activityType.toLowerCase().includes('phase') ||
                           activityType.toLowerCase().includes('review');

        if (!isMilestone) continue;

        if (!milestoneTypes.has(activityType)) {
          milestoneTypes.set(activityType, { total: 0, completed: 0, durations: [] });
        }

        const data = milestoneTypes.get(activityType)!;
        data.total++;

        const status = (activity.status || '').toLowerCase();
        if (status.includes('complete') || status.includes('done')) {
          data.completed++;

          const dateStart = activity.date_start || activity.date_created || 0;
          const dateEnd = activity.date_end || activity.date_updated || 0;
          if (dateStart > 0 && dateEnd > 0 && dateEnd > dateStart) {
            const duration = (dateEnd - dateStart) / (1000 * 60 * 60 * 24);
            data.durations.push(duration);
          }
        }
      }

      const milestoneAnalyses: MilestoneAnalysis[] = [];
      for (const [type, data] of milestoneTypes.entries()) {
        const completionRate = data.total > 0 ? (data.completed / data.total) * 100 : 0;
        const avgCompletionTime = data.durations.length > 0
          ? data.durations.reduce((sum, d) => sum + d, 0) / data.durations.length
          : 0;
        const delayedCount = data.total - data.completed;
        const onTimeRate = data.total > 0 ? (data.completed / data.total) * 100 : 0;

        milestoneAnalyses.push({
          milestone_type: type,
          total_milestones: data.total,
          completed_milestones: data.completed,
          completion_rate: completionRate,
          avg_completion_time_days: avgCompletionTime,
          delayed_count: delayedCount,
          on_time_rate: onTimeRate,
        });
      }

      milestoneAnalyses.sort((a, b) => b.total_milestones - a.total_milestones);

      // Resource allocation analysis
      const resourceAllocations: ResourceAllocation[] = [];
      if (includeResourceAnalysis) {
        const resourceMap = new Map<string, {
          projects: Set<string>;
          activeProjects: number;
          completedProjects: number;
          healthScores: number[];
          onTimeDeliveries: number;
          totalDeliveries: number;
        }>();

        for (const [jobId, project] of projectMap.entries()) {
          const projectDetail = projectDetails.find(p => p.project_id === jobId);
          if (!projectDetail) continue;

          for (const memberId of project.teamMembers) {
            if (!resourceMap.has(memberId)) {
              resourceMap.set(memberId, {
                projects: new Set(),
                activeProjects: 0,
                completedProjects: 0,
                healthScores: [],
                onTimeDeliveries: 0,
                totalDeliveries: 0,
              });
            }

            const resource = resourceMap.get(memberId)!;
            resource.projects.add(jobId);
            resource.healthScores.push(projectDetail.health_score);

            if (['Completed On Time', 'Completed Late'].includes(projectDetail.timeline_status)) {
              resource.completedProjects++;
              resource.totalDeliveries++;
              if (projectDetail.timeline_status === 'Completed On Time') {
                resource.onTimeDeliveries++;
              }
            } else {
              resource.activeProjects++;
            }
          }
        }

        for (const [userId, data] of resourceMap.entries()) {
          const user = userMap.get(userId);
          const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Unknown';

          const avgHealthScore = data.healthScores.length > 0
            ? data.healthScores.reduce((sum, s) => sum + s, 0) / data.healthScores.length
            : 0;

          const onTimeDeliveryRate = data.totalDeliveries > 0
            ? (data.onTimeDeliveries / data.totalDeliveries) * 100
            : 0;

          // Capacity utilization (assuming max 5 active projects)
          const capacityUtilization = Math.min((data.activeProjects / 5) * 100, 100);

          const performanceRating: 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement' =
            avgHealthScore >= 80 && onTimeDeliveryRate >= 90 ? 'Excellent' :
            avgHealthScore >= 70 && onTimeDeliveryRate >= 75 ? 'Good' :
            avgHealthScore >= 60 && onTimeDeliveryRate >= 60 ? 'Fair' : 'Needs Improvement';

          resourceAllocations.push({
            resource_name: userName,
            resource_id: userId,
            assigned_projects: data.projects.size,
            active_projects: data.activeProjects,
            completed_projects: data.completedProjects,
            on_time_delivery_rate: onTimeDeliveryRate,
            avg_project_health_score: avgHealthScore,
            capacity_utilization: capacityUtilization,
            performance_rating: performanceRating,
          });
        }

        resourceAllocations.sort((a, b) => b.avg_project_health_score - a.avg_project_health_score);
      }

      // Risk assessments
      const riskAssessments: RiskAssessment[] = [];

      // Schedule risk
      const scheduleRiskProjects = projectDetails.filter(p => ['At Risk', 'Delayed'].includes(p.timeline_status));
      if (scheduleRiskProjects.length > 0) {
        riskAssessments.push({
          risk_category: 'Schedule Risk',
          projects_at_risk: scheduleRiskProjects.length,
          total_value_at_risk: scheduleRiskProjects.reduce((sum, p) => sum + p.actual_cost, 0),
          severity: scheduleRiskProjects.length > 5 ? 'Critical' : scheduleRiskProjects.length > 3 ? 'High' : 'Medium',
          mitigation_actions: [
            'Reallocate resources to critical path tasks',
            'Extend deadlines for non-critical milestones',
            'Increase team size for delayed projects',
            'Implement daily stand-ups for at-risk projects',
          ],
          priority: 1,
        });
      }

      // Budget risk
      const budgetRiskProjects = projectDetails.filter(p => p.budget_variance > 10);
      if (budgetRiskProjects.length > 0) {
        riskAssessments.push({
          risk_category: 'Budget Risk',
          projects_at_risk: budgetRiskProjects.length,
          total_value_at_risk: budgetRiskProjects.reduce((sum, p) => sum + Math.abs(p.budget - p.actual_cost), 0),
          severity: budgetRiskProjects.length > 3 ? 'High' : 'Medium',
          mitigation_actions: [
            'Review and approve all change orders',
            'Implement stricter cost controls',
            'Negotiate with vendors for better rates',
            'Re-estimate remaining work',
          ],
          priority: 2,
        });
      }

      // Project recommendations
      const recommendations: ProjectRecommendation[] = [];
      for (const project of projectDetails.slice(0, 10)) { // Top 10 most at-risk
        if (project.health_score >= healthThreshold) continue;

        if (project.timeline_status === 'Delayed' || project.timeline_status === 'At Risk') {
          recommendations.push({
            project_id: project.project_id,
            project_name: project.project_name,
            recommendation_type: 'Resource Adjustment',
            urgency: project.timeline_status === 'Delayed' ? 'Immediate' : 'High',
            description: `Add ${Math.max(1, Math.ceil(project.assigned_team_size * 0.5))} additional team member(s)`,
            expected_impact: 'Reduce timeline by 20-30%',
          });
        }

        if (project.budget_variance > 25) {
          recommendations.push({
            project_id: project.project_id,
            project_name: project.project_name,
            recommendation_type: 'Budget Review',
            urgency: 'High',
            description: `Budget variance is ${project.budget_variance.toFixed(1)}% - review and adjust`,
            expected_impact: 'Prevent further cost overruns',
          });
        }
      }

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        analysis_period_days: daysBack,
        project_metrics: projectMetrics,
        project_details: projectDetails,
        milestone_analysis: milestoneAnalyses,
        resource_allocations: includeResourceAnalysis ? resourceAllocations : undefined,
        risk_assessments: riskAssessments,
        recommendations: recommendations,
        key_insights: [
          `${activeProjects} active project(s) being tracked`,
          `On-time delivery rate: ${onTimeDeliveryRate.toFixed(1)}%`,
          `${scheduleRiskProjects.length} project(s) at schedule risk`,
          `Average project health: ${projectDetails.length > 0 ? (projectDetails.reduce((sum, p) => sum + p.health_score, 0) / projectDetails.length).toFixed(1) : 0}/100`,
        ],
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }
}
