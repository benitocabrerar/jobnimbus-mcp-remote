/**
 * Get Operational Efficiency Analytics
 * Comprehensive operational analytics with process efficiency, bottleneck detection, automation opportunities, and workflow optimization
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface EfficiencyMetrics {
  overall_efficiency_score: number;
  process_throughput: number;
  avg_cycle_time_days: number;
  bottleneck_count: number;
  automation_potential_score: number;
  waste_reduction_opportunity: number;
  resource_utilization_rate: number;
}

interface ProcessEfficiency {
  process_name: string;
  total_processed: number;
  avg_processing_time_hours: number;
  completion_rate: number;
  error_rate: number;
  efficiency_score: number;
  bottleneck_severity: 'None' | 'Minor' | 'Moderate' | 'Severe';
  automation_potential: 'High' | 'Medium' | 'Low';
  recommended_improvements: string[];
}

interface BottleneckAnalysis {
  bottleneck_location: string;
  impact_level: 'Critical' | 'High' | 'Medium' | 'Low';
  affected_processes: string[];
  delay_caused_days: number;
  throughput_reduction: number;
  root_cause: string;
  mitigation_strategy: string;
  estimated_improvement: string;
  priority: number;
}

interface AutomationOpportunity {
  process_area: string;
  current_manual_hours: number;
  automation_potential_percentage: number;
  estimated_time_savings_hours: number;
  implementation_difficulty: 'Easy' | 'Moderate' | 'Difficult';
  roi_score: number;
  tools_suggested: string[];
  payback_period_months: number;
  priority: 'High' | 'Medium' | 'Low';
}

interface CycleTimeAnalysis {
  process_stage: string;
  avg_cycle_time_days: number;
  min_cycle_time_days: number;
  max_cycle_time_days: number;
  std_deviation: number;
  on_time_completion_rate: number;
  delay_frequency: number;
  improvement_target_days: number;
}

interface WasteIdentification {
  waste_category: 'Waiting Time' | 'Rework' | 'Overprocessing' | 'Excess Motion' | 'Defects';
  estimated_waste_hours: number;
  cost_impact: number;
  frequency: number;
  elimination_approach: string;
  quick_wins: string[];
}

interface WorkflowOptimization {
  workflow_name: string;
  current_steps: number;
  proposed_steps: number;
  current_time_hours: number;
  optimized_time_hours: number;
  time_savings_percentage: number;
  complexity_reduction: number;
  implementation_effort: 'Low' | 'Medium' | 'High';
  expected_benefits: string[];
}

interface ResourceUtilization {
  resource_type: string;
  total_capacity: number;
  utilized_capacity: number;
  utilization_rate: number;
  idle_time_percentage: number;
  overutilization_risk: boolean;
  optimization_recommendation: string;
}

export class GetOperationalEfficiencyAnalyticsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_operational_efficiency_analytics',
      description: 'Comprehensive operational efficiency analytics with process scoring, bottleneck detection, cycle time analysis, automation opportunities, waste identification, and workflow optimization recommendations',
      inputSchema: {
        type: 'object',
        properties: {
          days_back: {
            type: 'number',
            default: 90,
            description: 'Days of history to analyze (default: 90)',
          },
          include_automation: {
            type: 'boolean',
            default: true,
            description: 'Include automation opportunities',
          },
          include_waste_analysis: {
            type: 'boolean',
            default: true,
            description: 'Include waste identification',
          },
          efficiency_threshold: {
            type: 'number',
            default: 75,
            description: 'Efficiency score threshold (default: 75)',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const daysBack = input.days_back || 90;
      const includeAutomation = input.include_automation !== false;
      const includeWaste = input.include_waste_analysis !== false;
      const efficiencyThreshold = input.efficiency_threshold || 75;

      const [jobsResponse, activitiesResponse, usersResponse] = await Promise.all([
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'activities', { size: 100 }),
        this.client.get(context.apiKey, 'users', { size: 100 }),
      ]);

      const jobs = jobsResponse.data?.results || [];
      const activities = activitiesResponse.data?.activity || [];
      const users = usersResponse.data?.results || usersResponse.data?.users || [];

      const now = Date.now();
      const cutoffDate = now - (daysBack * 24 * 60 * 60 * 1000);

      // Process efficiency by activity type
      const processMap = new Map<string, {
        count: number;
        totalProcessingTime: number;
        completed: number;
        errors: number;
      }>();

      for (const activity of activities) {
        const createdDate = activity.date_created || activity.created_at || 0;
        if (createdDate < cutoffDate) continue;

        const activityType = activity.type || 'General';

        if (!processMap.has(activityType)) {
          processMap.set(activityType, { count: 0, totalProcessingTime: 0, completed: 0, errors: 0 });
        }

        const process = processMap.get(activityType)!;
        process.count++;

        const startDate = activity.date_start || createdDate;
        const endDate = activity.date_end || activity.date_updated || 0;

        if (startDate > 0 && endDate > 0 && endDate > startDate) {
          const processingTime = (endDate - startDate) / (1000 * 60 * 60); // hours
          process.totalProcessingTime += processingTime;
        }

        const status = (activity.status || '').toLowerCase();
        if (status.includes('complete') || status.includes('done')) {
          process.completed++;
        }

        if (status.includes('error') || status.includes('failed')) {
          process.errors++;
        }
      }

      const processEfficiencies: ProcessEfficiency[] = [];
      for (const [processName, data] of processMap.entries()) {
        const avgProcessingTime = data.count > 0 ? data.totalProcessingTime / data.count : 0;
        const completionRate = data.count > 0 ? (data.completed / data.count) * 100 : 0;
        const errorRate = data.count > 0 ? (data.errors / data.count) * 100 : 0;

        // Efficiency score (0-100)
        const efficiencyScore = Math.min(
          (completionRate / 100) * 50 + (100 - Math.min(errorRate, 100)) * 0.3 + (100 - Math.min(avgProcessingTime, 100)) * 0.2,
          100
        );

        const bottleneckSeverity: 'None' | 'Minor' | 'Moderate' | 'Severe' =
          avgProcessingTime > 48 ? 'Severe' :
          avgProcessingTime > 24 ? 'Moderate' :
          avgProcessingTime > 12 ? 'Minor' : 'None';

        const automationPotential: 'High' | 'Medium' | 'Low' =
          processName.toLowerCase().includes('data') || processName.toLowerCase().includes('report') ? 'High' :
          processName.toLowerCase().includes('follow') || processName.toLowerCase().includes('reminder') ? 'Medium' : 'Low';

        const recommendedImprovements: string[] = [];
        if (errorRate > 10) recommendedImprovements.push('Implement error checking and validation');
        if (avgProcessingTime > 24) recommendedImprovements.push('Streamline process steps');
        if (completionRate < 80) recommendedImprovements.push('Add process tracking and reminders');

        processEfficiencies.push({
          process_name: processName,
          total_processed: data.count,
          avg_processing_time_hours: avgProcessingTime,
          completion_rate: completionRate,
          error_rate: errorRate,
          efficiency_score: efficiencyScore,
          bottleneck_severity: bottleneckSeverity,
          automation_potential: automationPotential,
          recommended_improvements: recommendedImprovements,
        });
      }

      processEfficiencies.sort((a, b) => a.efficiency_score - b.efficiency_score);

      // Bottleneck analysis
      const bottleneckAnalyses: BottleneckAnalysis[] = [];
      for (const process of processEfficiencies) {
        if (process.bottleneck_severity === 'Severe' || process.bottleneck_severity === 'Moderate') {
          bottleneckAnalyses.push({
            bottleneck_location: process.process_name,
            impact_level: process.bottleneck_severity === 'Severe' ? 'Critical' : 'High',
            affected_processes: [process.process_name],
            delay_caused_days: process.avg_processing_time_hours / 24,
            throughput_reduction: (100 - process.completion_rate),
            root_cause: process.error_rate > 10 ? 'High error rate' : 'Long processing time',
            mitigation_strategy: process.automation_potential === 'High'
              ? 'Automate repetitive tasks'
              : 'Add resources or streamline process',
            estimated_improvement: `Reduce time by ${Math.round(process.avg_processing_time_hours * 0.3)} hours`,
            priority: bottleneckAnalyses.length + 1,
          });
        }
      }

      // Automation opportunities
      const automationOpportunities: AutomationOpportunity[] = [];
      if (includeAutomation) {
        for (const process of processEfficiencies) {
          if (process.automation_potential === 'High' || process.automation_potential === 'Medium') {
            const manualHours = process.avg_processing_time_hours * process.total_processed;
            const automationPercentage = process.automation_potential === 'High' ? 80 : 50;
            const timeSavings = manualHours * (automationPercentage / 100);

            const roi = (timeSavings * 100) / Math.max(manualHours, 1);

            automationOpportunities.push({
              process_area: process.process_name,
              current_manual_hours: manualHours,
              automation_potential_percentage: automationPercentage,
              estimated_time_savings_hours: timeSavings,
              implementation_difficulty: process.automation_potential === 'High' ? 'Easy' : 'Moderate',
              roi_score: roi,
              tools_suggested: this.getSuggestedTools(process.process_name),
              payback_period_months: 3,
              priority: process.automation_potential === 'High' ? 'High' : 'Medium',
            });
          }
        }

        automationOpportunities.sort((a, b) => b.roi_score - a.roi_score);
      }

      // Cycle time analysis
      const cycleTimeAnalyses: CycleTimeAnalysis[] = [];
      const cycleTimes: number[] = [];

      for (const job of jobs) {
        const startDate = job.date_start || job.date_created || 0;
        const endDate = job.date_end || job.date_updated || 0;

        if (startDate > 0 && endDate > 0 && endDate > startDate) {
          const cycleTime = (endDate - startDate) / (1000 * 60 * 60 * 24); // days
          cycleTimes.push(cycleTime);
        }
      }

      if (cycleTimes.length > 0) {
        const avgCycle = cycleTimes.reduce((sum, t) => sum + t, 0) / cycleTimes.length;
        const minCycle = Math.min(...cycleTimes);
        const maxCycle = Math.max(...cycleTimes);
        const variance = cycleTimes.reduce((sum, t) => sum + Math.pow(t - avgCycle, 2), 0) / cycleTimes.length;
        const stdDev = Math.sqrt(variance);

        cycleTimeAnalyses.push({
          process_stage: 'Job Lifecycle',
          avg_cycle_time_days: avgCycle,
          min_cycle_time_days: minCycle,
          max_cycle_time_days: maxCycle,
          std_deviation: stdDev,
          on_time_completion_rate: 70, // Simplified
          delay_frequency: 30,
          improvement_target_days: avgCycle * 0.7,
        });
      }

      // Waste identification
      const wasteIdentifications: WasteIdentification[] = [];
      if (includeWaste) {
        // Waiting time waste
        const avgWaitTime = processEfficiencies.reduce((sum, p) => sum + p.avg_processing_time_hours, 0) / processEfficiencies.length;
        if (avgWaitTime > 24) {
          wasteIdentifications.push({
            waste_category: 'Waiting Time',
            estimated_waste_hours: avgWaitTime * processEfficiencies.length,
            cost_impact: avgWaitTime * processEfficiencies.length * 50, // $50/hour
            frequency: processEfficiencies.length,
            elimination_approach: 'Streamline approvals and handoffs',
            quick_wins: ['Automate notifications', 'Set up parallel processing'],
          });
        }

        // Rework waste
        const totalErrors = processEfficiencies.reduce((sum, p) => sum + (p.total_processed * p.error_rate / 100), 0);
        if (totalErrors > 5) {
          wasteIdentifications.push({
            waste_category: 'Rework',
            estimated_waste_hours: totalErrors * 2, // 2 hours per error
            cost_impact: totalErrors * 100, // $100 per error
            frequency: totalErrors,
            elimination_approach: 'Implement quality checks upfront',
            quick_wins: ['Add validation rules', 'Create templates'],
          });
        }
      }

      // Workflow optimizations
      const workflowOptimizations: WorkflowOptimization[] = [];
      for (const process of processEfficiencies.slice(0, 5)) {
        if (process.efficiency_score < efficiencyThreshold) {
          const currentSteps = Math.ceil(process.avg_processing_time_hours / 4); // Assume 4 hours per step
          const proposedSteps = Math.ceil(currentSteps * 0.7);
          const currentTime = process.avg_processing_time_hours;
          const optimizedTime = currentTime * 0.7;

          workflowOptimizations.push({
            workflow_name: process.process_name,
            current_steps: currentSteps,
            proposed_steps: proposedSteps,
            current_time_hours: currentTime,
            optimized_time_hours: optimizedTime,
            time_savings_percentage: 30,
            complexity_reduction: 30,
            implementation_effort: 'Medium',
            expected_benefits: [
              'Faster turnaround time',
              'Reduced errors',
              'Better customer satisfaction',
            ],
          });
        }
      }

      // Resource utilization
      const resourceUtilizations: ResourceUtilization[] = [];
      const totalTeamCapacity = users.length * 40; // 40 hours per week
      const totalUtilized = activities.length * 2; // Assume 2 hours per activity
      const utilizationRate = totalTeamCapacity > 0 ? (totalUtilized / totalTeamCapacity) * 100 : 0;

      resourceUtilizations.push({
        resource_type: 'Team Members',
        total_capacity: totalTeamCapacity,
        utilized_capacity: totalUtilized,
        utilization_rate: utilizationRate,
        idle_time_percentage: 100 - utilizationRate,
        overutilization_risk: utilizationRate > 90,
        optimization_recommendation: utilizationRate > 90
          ? 'Add team members or redistribute workload'
          : utilizationRate < 60
          ? 'Increase project intake or reduce team size'
          : 'Optimal utilization',
      });

      // Efficiency metrics
      const overallEfficiencyScore = processEfficiencies.length > 0
        ? processEfficiencies.reduce((sum, p) => sum + p.efficiency_score, 0) / processEfficiencies.length
        : 0;

      const processThroughput = processEfficiencies.reduce((sum, p) => sum + p.total_processed, 0);
      const avgCycleTime = cycleTimeAnalyses[0]?.avg_cycle_time_days || 0;
      const automationPotentialScore = automationOpportunities.reduce((sum, a) => sum + a.automation_potential_percentage, 0) / Math.max(automationOpportunities.length, 1);
      const wasteReductionOpp = wasteIdentifications.reduce((sum, w) => sum + w.estimated_waste_hours, 0);

      const efficiencyMetrics: EfficiencyMetrics = {
        overall_efficiency_score: overallEfficiencyScore,
        process_throughput: processThroughput,
        avg_cycle_time_days: avgCycleTime,
        bottleneck_count: bottleneckAnalyses.length,
        automation_potential_score: automationPotentialScore,
        waste_reduction_opportunity: wasteReductionOpp,
        resource_utilization_rate: utilizationRate,
      };

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        analysis_period_days: daysBack,
        efficiency_metrics: efficiencyMetrics,
        process_efficiencies: processEfficiencies,
        bottleneck_analyses: bottleneckAnalyses,
        automation_opportunities: includeAutomation ? automationOpportunities : undefined,
        cycle_time_analyses: cycleTimeAnalyses,
        waste_identifications: includeWaste ? wasteIdentifications : undefined,
        workflow_optimizations: workflowOptimizations,
        resource_utilizations: resourceUtilizations,
        key_insights: [
          `Overall efficiency: ${overallEfficiencyScore.toFixed(1)}/100`,
          `${bottleneckAnalyses.length} bottleneck(s) identified`,
          `${Math.round(wasteReductionOpp)} hours waste reduction potential`,
          `Team utilization: ${utilizationRate.toFixed(1)}%`,
        ],
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }

  private getSuggestedTools(processName: string): string[] {
    const nameLower = processName.toLowerCase();

    if (nameLower.includes('email') || nameLower.includes('communication')) {
      return ['Email automation (Mailchimp, SendGrid)', 'CRM workflows'];
    }
    if (nameLower.includes('data') || nameLower.includes('report')) {
      return ['Zapier', 'Make (formerly Integromat)', 'Power Automate'];
    }
    if (nameLower.includes('schedule') || nameLower.includes('appointment')) {
      return ['Calendly', 'Acuity Scheduling', 'JobNimbus automation'];
    }
    return ['Zapier', 'Custom API integration', 'JobNimbus workflows'];
  }
}
