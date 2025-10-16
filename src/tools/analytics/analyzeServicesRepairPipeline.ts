/**
 * Analyze Services & Repair Pipeline
 * Comprehensive analysis for service and repair businesses
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface ServiceMetric {
  metric_name: string;
  current_value: number;
  target_value: number;
  performance: 'excellent' | 'good' | 'needs_improvement' | 'critical';
  trend: 'improving' | 'stable' | 'declining';
}

export class AnalyzeServicesRepairPipelineTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'analyze_services_repair_pipeline',
      description: 'Services & repair pipeline: metrics, technician performance, predictions',
      inputSchema: {
        type: 'object',
        properties: {
          time_window_days: {
            type: 'number',
            default: 90,
            description: 'Days to analyze (default: 90)',
          },
          analysis_depth: {
            type: 'string',
            enum: ['quick', 'standard', 'deep', 'ultra'],
            default: 'ultra',
            description: 'Analysis depth',
          },
          include_predictions: {
            type: 'boolean',
            default: true,
            description: 'Include predictions',
          },
          include_recommendations: {
            type: 'boolean',
            default: true,
            description: 'Include recommendations',
          },
          technician_optimization: {
            type: 'boolean',
            default: true,
            description: 'Optimize technician',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const timeWindowDays = input.time_window_days || 90;
      const includePredict = input.include_predictions !== false;
      const includeRec = input.include_recommendations !== false;
      const techOptimization = input.technician_optimization !== false;

      // Fetch data
      const [jobsResponse, estimatesResponse, activitiesResponse] = await Promise.all([
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'estimates', { size: 100 }),
        this.client.get(context.apiKey, 'activities', { size: 100 }),
      ]);

      const jobs = jobsResponse.data?.results || [];
      const estimates = estimatesResponse.data?.results || [];
      const activities = activitiesResponse.data?.activity || activitiesResponse.data?.results || [];

      // Filter for Services & Repair jobs
      const serviceJobs = jobs.filter((j: any) => {
        const jobType = (j.job_type_name || '').toLowerCase();
        return jobType.includes('service') || jobType.includes('repair') ||
               jobType.includes('maintenance') || jobType.includes('emergency');
      });

      const now = Date.now();
      const cutoffDate = now - (timeWindowDays * 24 * 60 * 60 * 1000);

      // Build lookups
      const estimatesByJob = new Map<string, any[]>();
      for (const estimate of estimates) {
        const related = estimate.related || [];
        for (const rel of related) {
          if (rel.type === 'job' && rel.id) {
            if (!estimatesByJob.has(rel.id)) {
              estimatesByJob.set(rel.id, []);
            }
            estimatesByJob.get(rel.id)!.push(estimate);
          }
        }
      }

      const activitiesByJob = new Map<string, any[]>();
      for (const activity of activities) {
        const related = activity.related || [];
        for (const rel of related) {
          if (rel.type === 'job' && rel.id) {
            if (!activitiesByJob.has(rel.id)) {
              activitiesByJob.set(rel.id, []);
            }
            activitiesByJob.get(rel.id)!.push(activity);
          }
        }
      }

      // Analyze service metrics
      let totalRevenue = 0;
      let completedJobs = 0;
      let avgCompletionTime = 0;
      let totalCompletionTime = 0;
      let onTimeJobs = 0;
      let emergencyJobs = 0;
      let scheduledJobs = 0;

      const technicianPerformance = new Map<string, {
        jobs: number;
        revenue: number;
        avgTime: number;
        onTime: number;
      }>();

      const serviceTypeBreakdown = new Map<string, {
        count: number;
        revenue: number;
        avgTime: number;
      }>();

      for (const job of serviceJobs) {
        const jobDate = job.date_created || 0;
        if (jobDate < cutoffDate) continue;

        const statusName = (job.status_name || '').toLowerCase();
        const isCompleted = statusName.includes('complete') || statusName.includes('closed');

        // Calculate revenue
        const jobEstimates = estimatesByJob.get(job.jnid) || [];
        let jobRevenue = 0;
        for (const est of jobEstimates) {
          if (est.date_signed > 0 || est.status_name === 'approved') {
            jobRevenue += parseFloat(est.total || 0);
          }
        }

        totalRevenue += jobRevenue;

        if (isCompleted) {
          completedJobs++;

          // Calculate completion time
          const startDate = job.date_start || job.date_created || 0;
          const endDate = job.date_end || job.date_updated || now;
          if (startDate > 0 && endDate > startDate) {
            const completionDays = (endDate - startDate) / (24 * 60 * 60 * 1000);
            totalCompletionTime += completionDays;

            // Check if on time (< 7 days for service jobs)
            if (completionDays <= 7) {
              onTimeJobs++;
            }
          }
        }

        // Emergency vs scheduled
        const jobType = (job.job_type_name || '').toLowerCase();
        if (jobType.includes('emergency')) {
          emergencyJobs++;
        } else {
          scheduledJobs++;
        }

        // Technician performance
        const techId = job.assigned_to_id || 'unassigned';
        if (!technicianPerformance.has(techId)) {
          technicianPerformance.set(techId, {
            jobs: 0,
            revenue: 0,
            avgTime: 0,
            onTime: 0,
          });
        }
        const techData = technicianPerformance.get(techId)!;
        techData.jobs++;
        techData.revenue += jobRevenue;

        // Service type breakdown
        const serviceType = job.job_type_name || 'Unknown';
        if (!serviceTypeBreakdown.has(serviceType)) {
          serviceTypeBreakdown.set(serviceType, {
            count: 0,
            revenue: 0,
            avgTime: 0,
          });
        }
        const typeData = serviceTypeBreakdown.get(serviceType)!;
        typeData.count++;
        typeData.revenue += jobRevenue;
      }

      avgCompletionTime = completedJobs > 0 ? totalCompletionTime / completedJobs : 0;
      const onTimeRate = completedJobs > 0 ? (onTimeJobs / completedJobs) * 100 : 0;

      // Calculate key metrics
      const metrics: ServiceMetric[] = [
        {
          metric_name: 'Total Revenue',
          current_value: totalRevenue,
          target_value: totalRevenue * 1.2,
          performance: totalRevenue > 50000 ? 'excellent' : totalRevenue > 20000 ? 'good' : 'needs_improvement',
          trend: 'stable',
        },
        {
          metric_name: 'Average Completion Time (days)',
          current_value: avgCompletionTime,
          target_value: 5,
          performance: avgCompletionTime <= 5 ? 'excellent' : avgCompletionTime <= 7 ? 'good' : 'needs_improvement',
          trend: 'stable',
        },
        {
          metric_name: 'On-Time Completion Rate (%)',
          current_value: onTimeRate,
          target_value: 85,
          performance: onTimeRate >= 85 ? 'excellent' : onTimeRate >= 70 ? 'good' : 'needs_improvement',
          trend: 'stable',
        },
        {
          metric_name: 'Emergency Response Jobs',
          current_value: emergencyJobs,
          target_value: serviceJobs.length * 0.3,
          performance: emergencyJobs <= serviceJobs.length * 0.3 ? 'good' : 'needs_improvement',
          trend: 'stable',
        },
      ];

      // Technician efficiency
      const topTechnicians = Array.from(technicianPerformance.entries())
        .map(([id, data]) => ({
          technician_id: id,
          jobs_completed: data.jobs,
          total_revenue: data.revenue,
          avg_revenue_per_job: data.jobs > 0 ? data.revenue / data.jobs : 0,
          efficiency_score: data.jobs > 0 ? (data.revenue / data.jobs) / 1000 : 0,
        }))
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 10);

      // Service type analysis
      const serviceTypes = Array.from(serviceTypeBreakdown.entries())
        .map(([type, data]) => ({
          service_type: type,
          job_count: data.count,
          total_revenue: data.revenue,
          avg_revenue: data.count > 0 ? data.revenue / data.count : 0,
        }))
        .sort((a, b) => b.total_revenue - a.total_revenue);

      // Predictions
      let predictions = null;
      if (includePredict && completedJobs >= 3) {
        const avgJobValue = totalRevenue / completedJobs;
        const nextMonthJobs = Math.round(completedJobs * 1.1);

        predictions = {
          next_month_revenue: avgJobValue * nextMonthJobs,
          next_month_jobs: nextMonthJobs,
          expected_completion_time: avgCompletionTime,
          confidence: completedJobs >= 10 ? 'high' : completedJobs >= 5 ? 'medium' : 'low',
        };
      }

      // Recommendations
      const recommendations: string[] = [];
      if (includeRec) {
        if (onTimeRate < 70) {
          recommendations.push('CRITICAL: On-time completion rate below 70% - review scheduling and resource allocation');
        }
        if (avgCompletionTime > 7) {
          recommendations.push('Reduce average completion time - current average is ' + avgCompletionTime.toFixed(1) + ' days');
        }
        if (emergencyJobs > scheduledJobs) {
          recommendations.push('High emergency job ratio - implement preventive maintenance program to reduce emergencies');
        }
        if (topTechnicians.length > 0 && topTechnicians[0].jobs_completed > topTechnicians[topTechnicians.length - 1]?.jobs_completed * 2) {
          recommendations.push('Workload imbalance detected - redistribute jobs for better technician utilization');
        }
        if (totalRevenue < 50000) {
          recommendations.push('Increase service revenue through upselling maintenance plans and preventive services');
        }
      }

      // Optimization suggestions
      const optimizations: string[] = [];
      if (techOptimization) {
        if (emergencyJobs > 0) {
          optimizations.push('Dedicate 1-2 technicians for emergency response to improve response times');
        }
        optimizations.push('Implement scheduling buffer of 20% for unexpected delays');
        optimizations.push('Create service packages for recurring customers to increase predictability');
      }

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        analysis_period: {
          days: timeWindowDays,
          start_date: new Date(cutoffDate).toISOString(),
          end_date: new Date(now).toISOString(),
        },
        summary: {
          total_service_jobs: serviceJobs.length,
          completed_jobs: completedJobs,
          total_revenue: totalRevenue,
          avg_completion_time_days: avgCompletionTime,
          on_time_rate: onTimeRate,
          emergency_jobs: emergencyJobs,
          scheduled_jobs: scheduledJobs,
        },
        key_metrics: metrics,
        technician_performance: topTechnicians,
        service_type_breakdown: serviceTypes,
        predictions: predictions,
        recommendations: recommendations,
        optimization_suggestions: optimizations,
        insights: [
          `Average job value: $${(totalRevenue / Math.max(serviceJobs.length, 1)).toFixed(2)}`,
          `On-time completion: ${onTimeRate.toFixed(1)}%`,
          `Emergency vs Scheduled ratio: ${emergencyJobs}/${scheduledJobs}`,
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
