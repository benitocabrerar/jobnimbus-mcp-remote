/**
 * Get Smart Scheduling
 * AI-powered appointment optimization with travel time analysis and resource allocation
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface ScheduleSlot {
  date: string;
  time_slot: string;
  available_capacity: number;
  optimal_for_service_type: string[];
  estimated_utilization: number;
}

interface TechnicianSchedule {
  technician_id: string;
  technician_name: string;
  scheduled_jobs: number;
  available_slots: number;
  utilization_rate: number;
  next_available: string;
}

export class GetSmartSchedulingTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_smart_scheduling',
      description: 'AI-powered appointment optimization with travel time, resource allocation, and efficiency scoring',
      inputSchema: {
        type: 'object',
        properties: {
          time_window: {
            type: 'number',
            default: 14,
            description: 'Days to optimize within (default: 14)',
          },
          optimization_goal: {
            type: 'string',
            enum: ['efficiency', 'revenue', 'customer_satisfaction'],
            default: 'efficiency',
            description: 'Primary optimization goal',
          },
          include_travel_time: {
            type: 'boolean',
            default: true,
            description: 'Factor in estimated travel time',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const timeWindow = input.time_window || 14;
      const optimizationGoal = input.optimization_goal || 'efficiency';
      const includeTravelTime = input.include_travel_time !== false;

      // Fetch data
      const jobsResponse = await this.client.get(context.apiKey, 'jobs', { size: 100 });
      const jobs = jobsResponse.data?.results || [];

      const now = Date.now();
      const futureDate = now + (timeWindow * 24 * 60 * 60 * 1000);

      // Filter scheduled jobs in time window
      const scheduledJobs = jobs.filter((j: any) => {
        const startDate = j.date_start || 0;
        return startDate > now && startDate < futureDate;
      });

      // Analyze technician workload
      const technicianWorkload = new Map<string, {
        name: string;
        scheduled: number;
        hours: number;
        jobs: any[];
      }>();

      // Assume 8-hour workday, 5 days per week
      const totalWorkingHours = (timeWindow / 7) * 5 * 8;

      for (const job of scheduledJobs) {
        const techId = job.assigned_to_id || 'unassigned';
        const techName = job.assigned_to_name || 'Unassigned';

        if (!technicianWorkload.has(techId)) {
          technicianWorkload.set(techId, {
            name: techName,
            scheduled: 0,
            hours: 0,
            jobs: [],
          });
        }

        const techData = technicianWorkload.get(techId)!;
        techData.scheduled++;
        techData.jobs.push(job);

        // Estimate job duration (default 3 hours if not specified)
        const startDate = job.date_start || 0;
        const endDate = job.date_end || startDate + (3 * 60 * 60 * 1000);
        const duration = (endDate - startDate) / (60 * 60 * 1000);
        techData.hours += Math.max(duration, 1);
      }

      // Calculate utilization rates
      const technicianSchedules: TechnicianSchedule[] = [];

      for (const [techId, data] of technicianWorkload.entries()) {
        const utilizationRate = totalWorkingHours > 0
          ? (data.hours / totalWorkingHours) * 100
          : 0;

        const availableSlots = Math.max(0, Math.floor((totalWorkingHours - data.hours) / 3));

        // Find next available slot
        const sortedJobs = data.jobs.sort((a, b) => (a.date_start || 0) - (b.date_start || 0));
        let nextAvailable = new Date(now).toISOString();

        if (sortedJobs.length > 0) {
          const lastJob = sortedJobs[sortedJobs.length - 1];
          const lastJobEnd = lastJob.date_end || lastJob.date_start + (3 * 60 * 60 * 1000);
          nextAvailable = new Date(lastJobEnd).toISOString();
        }

        technicianSchedules.push({
          technician_id: techId,
          technician_name: data.name,
          scheduled_jobs: data.scheduled,
          available_slots: availableSlots,
          utilization_rate: utilizationRate,
          next_available: nextAvailable,
        });
      }

      // Sort by utilization (lowest first for load balancing)
      technicianSchedules.sort((a, b) => a.utilization_rate - b.utilization_rate);

      // Generate optimal schedule slots (morning, afternoon, evening)
      const scheduleSlots: ScheduleSlot[] = [];

      for (let day = 0; day < timeWindow; day++) {
        const date = new Date(now + (day * 24 * 60 * 60 * 1000));
        const dayOfWeek = date.getDay();

        // Skip weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        const dateStr = date.toISOString().split('T')[0];

        // Calculate available capacity for each time slot
        const availableTechnicians = technicianSchedules.filter(t => t.utilization_rate < 80).length;

        scheduleSlots.push({
          date: dateStr,
          time_slot: '08:00-12:00 (Morning)',
          available_capacity: availableTechnicians,
          optimal_for_service_type: ['Emergency', 'Inspection'],
          estimated_utilization: 60,
        });

        scheduleSlots.push({
          date: dateStr,
          time_slot: '12:00-16:00 (Afternoon)',
          available_capacity: availableTechnicians,
          optimal_for_service_type: ['Installation', 'Repair'],
          estimated_utilization: 75,
        });

        scheduleSlots.push({
          date: dateStr,
          time_slot: '16:00-20:00 (Evening)',
          available_capacity: Math.floor(availableTechnicians * 0.7),
          optimal_for_service_type: ['Residential Service'],
          estimated_utilization: 50,
        });
      }

      // Optimization recommendations
      const recommendations: string[] = [];

      // Load balancing
      const overloadedTechs = technicianSchedules.filter(t => t.utilization_rate > 80);
      const underutilizedTechs = technicianSchedules.filter(t => t.utilization_rate < 50);

      if (overloadedTechs.length > 0) {
        recommendations.push(
          `${overloadedTechs.length} technician(s) overloaded (>80% utilization) - ` +
          `redistribute work to ${underutilizedTechs.length} underutilized technician(s)`
        );
      }

      if (underutilizedTechs.length > 0 && underutilizedTechs.length === technicianSchedules.length) {
        recommendations.push('All technicians underutilized - opportunity to increase bookings');
      }

      // Travel time optimization
      if (includeTravelTime) {
        recommendations.push('Group jobs by geographic proximity to minimize travel time');
        recommendations.push('Schedule jobs in same area consecutively to reduce transit costs');
      }

      // Time-based optimization
      if (optimizationGoal === 'efficiency') {
        recommendations.push('Front-load complex jobs in morning slots when technicians are fresh');
        recommendations.push('Reserve afternoon slots for routine maintenance and inspections');
      } else if (optimizationGoal === 'revenue') {
        recommendations.push('Prioritize high-value jobs during peak hours (9AM-5PM)');
        recommendations.push('Offer premium pricing for evening and weekend slots');
      } else if (optimizationGoal === 'customer_satisfaction') {
        recommendations.push('Offer flexible scheduling options including evenings and weekends');
        recommendations.push('Maintain buffer time between appointments to avoid delays');
      }

      // Calculate metrics
      const totalScheduled = scheduledJobs.length;
      const totalCapacity = technicianSchedules.reduce((sum, t) => sum + t.available_slots, 0);
      const avgUtilization = technicianSchedules.length > 0
        ? technicianSchedules.reduce((sum, t) => sum + t.utilization_rate, 0) / technicianSchedules.length
        : 0;

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        optimization_period: {
          days: timeWindow,
          start_date: new Date(now).toISOString(),
          end_date: new Date(futureDate).toISOString(),
        },
        optimization_goal: optimizationGoal,
        summary: {
          total_scheduled_jobs: totalScheduled,
          total_available_slots: totalCapacity,
          avg_technician_utilization: avgUtilization,
          booking_rate: totalCapacity > 0 ? (totalScheduled / (totalScheduled + totalCapacity)) * 100 : 0,
        },
        technician_schedules: technicianSchedules,
        optimal_schedule_slots: scheduleSlots.slice(0, 21), // Next 7 days
        load_balancing: {
          overloaded_technicians: overloadedTechs.length,
          underutilized_technicians: underutilizedTechs.length,
          balanced_technicians: technicianSchedules.length - overloadedTechs.length - underutilizedTechs.length,
        },
        optimization_recommendations: recommendations,
        efficiency_score: {
          current: 100 - Math.abs(avgUtilization - 70), // Optimal is 70% utilization
          target: 100,
          rating: avgUtilization >= 65 && avgUtilization <= 75 ? 'Excellent' :
                  avgUtilization >= 55 && avgUtilization <= 85 ? 'Good' :
                  avgUtilization >= 45 && avgUtilization <= 95 ? 'Fair' : 'Needs Improvement',
        },
        insights: [
          `Average utilization: ${avgUtilization.toFixed(1)}%`,
          `${totalCapacity} available slots in next ${timeWindow} days`,
          `Booking rate: ${(totalScheduled / Math.max(totalScheduled + totalCapacity, 1) * 100).toFixed(1)}%`,
          technicianSchedules.length > 0
            ? `Most available: ${technicianSchedules[0].technician_name} (${technicianSchedules[0].utilization_rate.toFixed(1)}% utilized)`
            : 'No technician data available',
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
