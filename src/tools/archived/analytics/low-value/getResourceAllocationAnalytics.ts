/**
 * Get Resource Allocation Analytics
 * Team resource distribution, capacity planning, utilization analysis, and optimization recommendations
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface ResourceMetrics {
  total_team_members: number;
  active_team_members: number;
  total_capacity_hours: number;
  allocated_hours: number;
  available_hours: number;
  utilization_rate: number;
  avg_workload_per_member: number;
}

interface TeamMemberAllocation {
  member_name: string;
  member_id: string;
  role: string;
  assigned_jobs: number;
  assigned_tasks: number;
  assigned_estimates: number;
  total_workload_score: number;
  capacity_utilization: number;
  utilization_status: 'Overloaded' | 'Optimal' | 'Underutilized' | 'Idle';
  available_capacity: number;
  recommended_action: string;
}

interface ResourceDistribution {
  resource_type: string;
  allocated_count: number;
  percentage: number;
  avg_value: number;
  priority_level: 'High' | 'Medium' | 'Low';
}

interface CapacityPlanning {
  time_period: 'Current Week' | 'Next Week' | 'Next Month' | 'Next Quarter';
  projected_demand: number;
  available_capacity: number;
  capacity_gap: number;
  gap_percentage: number;
  staffing_recommendation: string;
  hiring_priority: 'Urgent' | 'High' | 'Medium' | 'Low' | 'None';
}

interface SkillAllocation {
  skill_category: string;
  team_members_with_skill: number;
  jobs_requiring_skill: number;
  allocation_ratio: number;
  bottleneck_risk: 'High' | 'Medium' | 'Low' | 'None';
  recommended_training: string[];
}

interface OptimizationOpportunity {
  opportunity_type: string;
  impact_level: 'Critical' | 'High' | 'Medium' | 'Low';
  description: string;
  estimated_capacity_gain: number;
  implementation_effort: 'Easy' | 'Moderate' | 'Difficult';
  priority: number;
}

export class GetResourceAllocationAnalyticsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_resource_allocation_analytics',
      description: 'Team resource distribution analysis, capacity planning metrics, utilization tracking, skill allocation, and optimization recommendations',
      inputSchema: {
        type: 'object',
        properties: {
          include_capacity_planning: {
            type: 'boolean',
            default: true,
            description: 'Include capacity planning projections',
          },
          include_skill_analysis: {
            type: 'boolean',
            default: true,
            description: 'Include skill allocation analysis',
          },
          utilization_threshold: {
            type: 'number',
            default: 80,
            description: 'Utilization percentage threshold for overloaded status (default: 80)',
          },
          days_ahead: {
            type: 'number',
            default: 30,
            description: 'Days to project for capacity planning (default: 30)',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const includeCapacityPlanning = input.include_capacity_planning !== false;
      const includeSkillAnalysis = input.include_skill_analysis !== false;
      const utilizationThreshold = input.utilization_threshold || 80;
      const daysAhead = input.days_ahead || 30;

      // Fetch data
      const [jobsResponse, activitiesResponse, estimatesResponse] = await Promise.all([
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'activities', { size: 100 }),
        this.client.get(context.apiKey, 'estimates', { size: 100 }),
      ]);

      const jobs = jobsResponse.data?.results || [];
      const activities = activitiesResponse.data?.activity || [];
      const estimates = estimatesResponse.data?.results || [];

      // Try to fetch users - endpoint may not be available in all JobNimbus accounts
      let users: any[] = [];
      try {
        const usersResponse = await this.client.get(context.apiKey, 'users', { size: 100 });
        users = usersResponse.data?.results || usersResponse.data?.users || [];
      } catch (error) {
        // Users endpoint not available - proceed without user attribution
        console.warn('Users endpoint not available - resource allocation analysis will be limited');
      }

      const now = Date.now();
      const futureDate = now + (daysAhead * 24 * 60 * 60 * 1000);

      // Build user workload map
      const userWorkload = new Map<string, {
        name: string;
        role: string;
        jobs: number;
        tasks: number;
        estimates: number;
        activeJobs: number;
        pendingEstimates: number;
        upcomingActivities: number;
      }>();

      // Initialize user workload
      for (const user of users) {
        const userId = user.jnid || user.id;
        if (!userId) continue;

        const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown';
        const role = user.role || user.position || 'Team Member';

        userWorkload.set(userId, {
          name: userName,
          role: role,
          jobs: 0,
          tasks: 0,
          estimates: 0,
          activeJobs: 0,
          pendingEstimates: 0,
          upcomingActivities: 0,
        });
      }

      // Count jobs by assignee
      for (const job of jobs) {
        const assigneeId = job.assigned_to || job.owner_id || '';
        if (assigneeId && userWorkload.has(assigneeId)) {
          const workload = userWorkload.get(assigneeId)!;
          workload.jobs++;

          const statusLower = (job.status_name || '').toLowerCase();
          if (!statusLower.includes('complete') && !statusLower.includes('cancelled')) {
            workload.activeJobs++;
          }
        }
      }

      // Count activities (tasks) by assignee
      for (const activity of activities) {
        const assigneeId = activity.assigned_to || activity.owner_id || '';
        if (assigneeId && userWorkload.has(assigneeId)) {
          const workload = userWorkload.get(assigneeId)!;
          workload.tasks++;

          // Count upcoming activities
          const activityDate = activity.date_start || activity.date_created || 0;
          if (activityDate > now && activityDate <= futureDate) {
            workload.upcomingActivities++;
          }
        }
      }

      // Count estimates by assignee
      for (const estimate of estimates) {
        const assigneeId = estimate.assigned_to || estimate.owner_id || '';
        if (assigneeId && userWorkload.has(assigneeId)) {
          const workload = userWorkload.get(assigneeId)!;
          workload.estimates++;

          const statusLower = (estimate.status || '').toLowerCase();
          if (!statusLower.includes('approved') && !statusLower.includes('rejected')) {
            workload.pendingEstimates++;
          }
        }
      }

      // Calculate resource metrics
      const activeMembers = Array.from(userWorkload.values()).filter(w =>
        w.jobs > 0 || w.tasks > 0 || w.estimates > 0
      ).length;

      const totalWorkload = Array.from(userWorkload.values()).reduce((sum, w) =>
        sum + w.activeJobs + w.tasks + w.pendingEstimates
      , 0);

      // Assuming 40 hours/week per team member, 8 hours/day
      const totalCapacityHours = userWorkload.size * 40;
      const allocatedHours = totalWorkload * 8; // Estimate 8 hours per task/job
      const availableHours = Math.max(0, totalCapacityHours - allocatedHours);

      const resourceMetrics: ResourceMetrics = {
        total_team_members: userWorkload.size,
        active_team_members: activeMembers,
        total_capacity_hours: totalCapacityHours,
        allocated_hours: allocatedHours,
        available_hours: availableHours,
        utilization_rate: totalCapacityHours > 0 ? (allocatedHours / totalCapacityHours) * 100 : 0,
        avg_workload_per_member: userWorkload.size > 0 ? totalWorkload / userWorkload.size : 0,
      };

      // Team member allocations
      const teamAllocations: TeamMemberAllocation[] = [];

      for (const [userId, workload] of userWorkload.entries()) {
        // Workload score (weighted)
        const workloadScore = (workload.activeJobs * 10) + (workload.tasks * 3) + (workload.pendingEstimates * 5);

        // Capacity utilization (assuming 40 hours/week, max workload score ~400)
        const capacityUtilization = Math.min((workloadScore / 400) * 100, 100);

        // Utilization status
        const utilizationStatus: 'Overloaded' | 'Optimal' | 'Underutilized' | 'Idle' =
          capacityUtilization >= utilizationThreshold ? 'Overloaded' :
          capacityUtilization >= 50 ? 'Optimal' :
          capacityUtilization >= 20 ? 'Underutilized' : 'Idle';

        // Available capacity
        const availableCapacity = Math.max(0, 100 - capacityUtilization);

        // Recommended action
        const recommendedAction =
          utilizationStatus === 'Overloaded' ? 'Redistribute workload or hire additional support' :
          utilizationStatus === 'Optimal' ? 'Maintain current allocation' :
          utilizationStatus === 'Underutilized' ? 'Assign additional tasks or projects' :
          'Engage in training or strategic initiatives';

        teamAllocations.push({
          member_name: workload.name,
          member_id: userId,
          role: workload.role,
          assigned_jobs: workload.activeJobs,
          assigned_tasks: workload.tasks,
          assigned_estimates: workload.pendingEstimates,
          total_workload_score: workloadScore,
          capacity_utilization: capacityUtilization,
          utilization_status: utilizationStatus,
          available_capacity: availableCapacity,
          recommended_action: recommendedAction,
        });
      }

      // Sort by workload score descending
      teamAllocations.sort((a, b) => b.total_workload_score - a.total_workload_score);

      // Resource distribution
      const resourceDistribution: ResourceDistribution[] = [
        {
          resource_type: 'Active Jobs',
          allocated_count: jobs.filter((j: any) => {
            const status = (j.status_name || '').toLowerCase();
            return !status.includes('complete') && !status.includes('cancelled');
          }).length,
          percentage: 0,
          avg_value: 0,
          priority_level: 'High',
        },
        {
          resource_type: 'Pending Estimates',
          allocated_count: estimates.filter((e: any) => {
            const status = (e.status || '').toLowerCase();
            return !status.includes('approved') && !status.includes('rejected');
          }).length,
          percentage: 0,
          avg_value: 0,
          priority_level: 'Medium',
        },
        {
          resource_type: 'Tasks',
          allocated_count: activities.length,
          percentage: 0,
          avg_value: 0,
          priority_level: 'Medium',
        },
      ];

      const totalResources = resourceDistribution.reduce((sum, r) => sum + r.allocated_count, 0);
      for (const resource of resourceDistribution) {
        resource.percentage = totalResources > 0 ? (resource.allocated_count / totalResources) * 100 : 0;
      }

      // Capacity planning
      const capacityPlans: CapacityPlanning[] = [];
      if (includeCapacityPlanning) {
        // Current week projection
        const currentWeekDemand = totalWorkload;
        const currentWeekCapacity = (userWorkload.size * 40) / 8; // 40 hours/week ÷ 8 hours/task
        const currentWeekGap = currentWeekDemand - currentWeekCapacity;

        capacityPlans.push({
          time_period: 'Current Week',
          projected_demand: currentWeekDemand,
          available_capacity: currentWeekCapacity,
          capacity_gap: currentWeekGap,
          gap_percentage: currentWeekCapacity > 0 ? (currentWeekGap / currentWeekCapacity) * 100 : 0,
          staffing_recommendation: currentWeekGap > 0
            ? `Need ${Math.ceil(currentWeekGap / 5)} additional team member(s)`
            : 'Current staffing adequate',
          hiring_priority: currentWeekGap > currentWeekCapacity * 0.5 ? 'Urgent' :
                          currentWeekGap > currentWeekCapacity * 0.3 ? 'High' :
                          currentWeekGap > currentWeekCapacity * 0.1 ? 'Medium' :
                          currentWeekGap > 0 ? 'Low' : 'None',
        });

        // Next month projection (estimate 20% growth)
        const nextMonthDemand = currentWeekDemand * 1.2 * 4;
        const nextMonthCapacity = (userWorkload.size * 160) / 8; // 160 hours/month ÷ 8 hours/task
        const nextMonthGap = nextMonthDemand - nextMonthCapacity;

        capacityPlans.push({
          time_period: 'Next Month',
          projected_demand: nextMonthDemand,
          available_capacity: nextMonthCapacity,
          capacity_gap: nextMonthGap,
          gap_percentage: nextMonthCapacity > 0 ? (nextMonthGap / nextMonthCapacity) * 100 : 0,
          staffing_recommendation: nextMonthGap > 0
            ? `Plan to hire ${Math.ceil(nextMonthGap / 20)} team member(s) within 30 days`
            : 'Capacity sufficient for projected growth',
          hiring_priority: nextMonthGap > nextMonthCapacity * 0.5 ? 'Urgent' :
                          nextMonthGap > nextMonthCapacity * 0.3 ? 'High' :
                          nextMonthGap > nextMonthCapacity * 0.1 ? 'Medium' :
                          nextMonthGap > 0 ? 'Low' : 'None',
        });
      }

      // Skill allocation analysis
      const skillAllocations: SkillAllocation[] = [];
      if (includeSkillAnalysis) {
        // Infer skills from job types
        const skillMap = new Map<string, { members: Set<string>; jobs: number }>();

        for (const job of jobs) {
          const jobType = job.job_type || job.type || 'General';
          if (!skillMap.has(jobType)) {
            skillMap.set(jobType, { members: new Set(), jobs: 0 });
          }
          const skill = skillMap.get(jobType)!;
          skill.jobs++;

          const assigneeId = job.assigned_to || job.owner_id;
          if (assigneeId) {
            skill.members.add(assigneeId);
          }
        }

        for (const [skillCategory, data] of skillMap.entries()) {
          const allocationRatio = data.members.size > 0 ? data.jobs / data.members.size : 0;

          const bottleneckRisk: 'High' | 'Medium' | 'Low' | 'None' =
            data.members.size === 1 ? 'High' :
            data.members.size === 2 ? 'Medium' :
            allocationRatio > 10 ? 'Medium' : 'Low';

          const recommendedTraining: string[] = [];
          if (bottleneckRisk === 'High') {
            recommendedTraining.push('Cross-train team members urgently');
            recommendedTraining.push('Hire specialist for this skill');
          } else if (bottleneckRisk === 'Medium') {
            recommendedTraining.push('Consider cross-training to reduce risk');
          }

          skillAllocations.push({
            skill_category: skillCategory,
            team_members_with_skill: data.members.size,
            jobs_requiring_skill: data.jobs,
            allocation_ratio: allocationRatio,
            bottleneck_risk: bottleneckRisk,
            recommended_training: recommendedTraining,
          });
        }

        skillAllocations.sort((a, b) => b.allocation_ratio - a.allocation_ratio);
      }

      // Optimization opportunities
      const optimizations: OptimizationOpportunity[] = [];

      // Workload rebalancing opportunity
      const overloadedCount = teamAllocations.filter(t => t.utilization_status === 'Overloaded').length;
      const underutilizedCount = teamAllocations.filter(t => t.utilization_status === 'Underutilized' || t.utilization_status === 'Idle').length;

      if (overloadedCount > 0 && underutilizedCount > 0) {
        optimizations.push({
          opportunity_type: 'Workload Rebalancing',
          impact_level: overloadedCount > 3 ? 'Critical' : 'High',
          description: `${overloadedCount} overloaded team member(s) and ${underutilizedCount} underutilized member(s)`,
          estimated_capacity_gain: overloadedCount * 10,
          implementation_effort: 'Easy',
          priority: 1,
        });
      }

      // Skill bottleneck opportunity
      const highRiskSkills = skillAllocations.filter(s => s.bottleneck_risk === 'High');
      if (highRiskSkills.length > 0) {
        optimizations.push({
          opportunity_type: 'Skill Diversification',
          impact_level: 'High',
          description: `${highRiskSkills.length} skill(s) with single point of failure`,
          estimated_capacity_gain: 15,
          implementation_effort: 'Moderate',
          priority: 2,
        });
      }

      // Capacity expansion opportunity
      if (capacityPlans.length > 0 && capacityPlans[0].capacity_gap > 0) {
        optimizations.push({
          opportunity_type: 'Team Expansion',
          impact_level: capacityPlans[0].hiring_priority === 'Urgent' ? 'Critical' : 'Medium',
          description: `Capacity gap of ${capacityPlans[0].capacity_gap.toFixed(1)} tasks/week`,
          estimated_capacity_gain: Math.ceil(capacityPlans[0].capacity_gap / 5) * 100,
          implementation_effort: 'Difficult',
          priority: 3,
        });
      }

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        resource_metrics: resourceMetrics,
        team_allocations: teamAllocations,
        resource_distribution: resourceDistribution,
        capacity_planning: includeCapacityPlanning ? capacityPlans : undefined,
        skill_allocation: includeSkillAnalysis ? skillAllocations : undefined,
        optimization_opportunities: optimizations,
        key_insights: [
          `Team utilization: ${resourceMetrics.utilization_rate.toFixed(1)}%`,
          `${overloadedCount} overloaded, ${underutilizedCount} underutilized member(s)`,
          `Available capacity: ${resourceMetrics.available_hours.toFixed(0)} hours`,
          capacityPlans.length > 0 ? `Staffing priority: ${capacityPlans[0].hiring_priority}` : '',
        ].filter(Boolean),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }
}
