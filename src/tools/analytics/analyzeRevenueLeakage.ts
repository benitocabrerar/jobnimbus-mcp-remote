/**
 * Analyze Revenue Leakage - Identify potential revenue leakage points
 * Detects lost opportunities, delayed conversions, and pipeline inefficiencies
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface LeakageSource {
  source: string;
  description: string;
  count: number;
  potential_revenue: number;
  percentage_of_total: number;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  time_frame: string;
}

interface ConversionDelay {
  job_id: string;
  job_number: string;
  customer_name: string;
  estimate_sent_date: string;
  days_pending: number;
  estimate_value: number;
  status: string;
  delay_category: 'Extreme' | 'High' | 'Medium';
}

interface LostOpportunity {
  job_id: string;
  job_number: string;
  customer_name: string;
  estimated_value: number;
  lost_date: string;
  reason?: string;
  days_in_pipeline: number;
}

export class AnalyzeRevenueLeakageTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'analyze_revenue_leakage',
      description: 'Revenue leakage: lost opportunities, delays, inefficiencies',
      inputSchema: {
        type: 'object',
        properties: {
          lookback_days: {
            type: 'number',
            default: 90,
            description: 'Days to analyze',
          },
          include_active: {
            type: 'boolean',
            default: true,
            description: 'Include active opportunities',
          },
          min_value_threshold: {
            type: 'number',
            default: 0,
            description: 'Min deal value',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    // Check if using new handle-based parameters for response optimization
    const useHandleResponse = this.hasNewParams(input);

    try {
      const lookbackDays = input.lookback_days || 90;
      const includeActive = input.include_active !== false;
      const minValueThreshold = input.min_value_threshold || 0;

      // Fetch comprehensive data
      const [jobsResponse, estimatesResponse, activitiesResponse] = await Promise.all([
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'estimates', { size: 100 }),
        this.client.get(context.apiKey, 'activities', { size: 100 }),
      ]);

      const jobs = jobsResponse.data?.results || [];
      const estimates = estimatesResponse.data?.results || [];
      const activities = activitiesResponse.data?.activity || activitiesResponse.data?.results || [];

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

      // Calculate time boundaries
      const now = Date.now();
      const lookbackStart = now - (lookbackDays * 24 * 60 * 60 * 1000);

      // Analyze leakage sources
      let totalLeakedRevenue = 0;
      const leakageSources = new Map<string, { count: number; revenue: number; jobs: any[] }>();
      const conversionDelays: ConversionDelay[] = [];
      const lostOpportunities: LostOpportunity[] = [];

      for (const job of jobs) {
        if (!job.jnid) continue;

        const jobDate = job.date_created || 0;
        if (jobDate < lookbackStart) continue;

        const jobEstimates = estimatesByJob.get(job.jnid) || [];
        const jobActivities = activitiesByJob.get(job.jnid) || [];
        const statusName = (job.status_name || '').toLowerCase();

        // Calculate job value
        let jobValue = 0;
        let hasApprovedEstimate = false;
        let oldestPendingEstimate: any = null;

        for (const estimate of jobEstimates) {
          const estimateValue = parseFloat(estimate.total || 0) || 0;
          if (estimateValue < minValueThreshold) continue;

          const estimateStatus = (estimate.status_name || '').toLowerCase();
          const isSigned = estimate.date_signed > 0;
          const isApproved = isSigned || estimateStatus === 'approved' || estimateStatus === 'signed';

          if (isApproved) {
            hasApprovedEstimate = true;
            jobValue = estimateValue;
          } else if (estimate.date_sent > 0) {
            // Pending estimate
            if (!oldestPendingEstimate || estimate.date_sent < oldestPendingEstimate.date_sent) {
              oldestPendingEstimate = estimate;
              jobValue = estimateValue;
            }
          }
        }

        // Identify leakage sources

        // 1. Lost/Cancelled Jobs
        if (
          statusName.includes('lost') ||
          statusName.includes('cancelled') ||
          statusName.includes('declined')
        ) {
          const daysInPipeline = Math.floor((now - jobDate) / (1000 * 60 * 60 * 24));

          lostOpportunities.push({
            job_id: job.jnid,
            job_number: job.number || 'Unknown',
            customer_name: job.display_name || job.first_name || 'Unknown',
            estimated_value: jobValue,
            lost_date: new Date(jobDate).toISOString(),
            reason: job.status_name,
            days_in_pipeline: daysInPipeline,
          });

          totalLeakedRevenue += jobValue;
          this.addToLeakageSource(leakageSources, 'Lost/Cancelled Jobs', jobValue, job);
        }

        // 2. Estimates Sent But Not Approved (Conversion Delays)
        else if (oldestPendingEstimate && includeActive) {
          const daysPending = Math.floor((now - oldestPendingEstimate.date_sent) / (1000 * 60 * 60 * 24));

          let delayCategory: 'Extreme' | 'High' | 'Medium';

          if (daysPending > 30) {
            delayCategory = 'Extreme';
          } else if (daysPending > 14) {
            delayCategory = 'High';
          } else {
            delayCategory = 'Medium';
          }

          conversionDelays.push({
            job_id: job.jnid,
            job_number: job.number || 'Unknown',
            customer_name: job.display_name || job.first_name || 'Unknown',
            estimate_sent_date: new Date(oldestPendingEstimate.date_sent).toISOString(),
            days_pending: daysPending,
            estimate_value: jobValue,
            status: job.status_name || 'Unknown',
            delay_category: delayCategory,
          });

          if (daysPending > 14) {
            totalLeakedRevenue += jobValue;
            this.addToLeakageSource(leakageSources, 'Delayed Conversions (>14 days)', jobValue, job);
          }
        }

        // 3. No Estimate Sent (Inactive Opportunities)
        else if (jobEstimates.length === 0 && !hasApprovedEstimate && includeActive) {
          const lastActivity = jobActivities.length > 0
            ? Math.max(...jobActivities.map(a => a.date_created || 0))
            : jobDate;
          const daysSinceActivity = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));

          if (daysSinceActivity > 7) {
            // Estimate conservative value based on team average
            const estimatedValue = 5000; // Could be calculated from team averages
            totalLeakedRevenue += estimatedValue * 0.3; // 30% probability
            this.addToLeakageSource(leakageSources, 'No Estimate Sent (Inactive)', estimatedValue * 0.3, job);
          }
        }

        // 4. Abandoned After Initial Contact
        else if (jobActivities.length <= 1 && !hasApprovedEstimate && includeActive) {
          const daysSinceCreation = Math.floor((now - jobDate) / (1000 * 60 * 60 * 24));
          if (daysSinceCreation > 3 && daysSinceCreation < 30) {
            const estimatedValue = 5000;
            totalLeakedRevenue += estimatedValue * 0.2; // 20% probability
            this.addToLeakageSource(leakageSources, 'Abandoned After Initial Contact', estimatedValue * 0.2, job);
          }
        }
      }

      // Build leakage sources array
      const leakageSourcesArray: LeakageSource[] = Array.from(leakageSources.entries())
        .map(([source, data]) => {
          const percentage = totalLeakedRevenue > 0 ? (data.revenue / totalLeakedRevenue) * 100 : 0;

          let severity: 'Critical' | 'High' | 'Medium' | 'Low';
          if (percentage > 40) severity = 'Critical';
          else if (percentage > 25) severity = 'High';
          else if (percentage > 10) severity = 'Medium';
          else severity = 'Low';

          return {
            source,
            description: this.getLeakageDescription(source),
            count: data.count,
            potential_revenue: data.revenue,
            percentage_of_total: percentage,
            severity,
            time_frame: `Last ${lookbackDays} days`,
          };
        })
        .sort((a, b) => b.potential_revenue - a.potential_revenue);

      // Sort delays by severity
      conversionDelays.sort((a, b) => b.days_pending - a.days_pending);

      // Sort lost opportunities by value
      lostOpportunities.sort((a, b) => b.estimated_value - a.estimated_value);

      // Build response data
      const responseData = {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        analysis_period: {
          lookback_days: lookbackDays,
          start_date: new Date(lookbackStart).toISOString(),
          end_date: new Date(now).toISOString(),
        },
        summary: {
          total_revenue_at_risk: totalLeakedRevenue,
          total_leakage_sources: leakageSources.size,
          lost_opportunities: lostOpportunities.length,
          delayed_conversions: conversionDelays.length,
          critical_issues: leakageSourcesArray.filter(s => s.severity === 'Critical').length,
          high_priority_issues: leakageSourcesArray.filter(s => s.severity === 'High').length,
        },
        leakage_sources: leakageSourcesArray,
        conversion_delays: conversionDelays.slice(0, 15),
        lost_opportunities: lostOpportunities.slice(0, 15),
        insights: this.generateInsights(leakageSourcesArray, conversionDelays, lostOpportunities),
        action_plan: this.generateActionPlan(leakageSourcesArray, conversionDelays, totalLeakedRevenue),
      };

      // Use handle-based response if requested
      if (useHandleResponse) {
        const envelope = await this.wrapResponse([responseData], input, context, {
          entity: 'revenue_leakage',
          maxRows: leakageSourcesArray.length + conversionDelays.length + lostOpportunities.length,
          pageInfo: {
            current_page: 1,
            total_pages: 1,
            has_more: false,
          },
        });

        return {
          ...envelope,
          query_metadata: {
            lookback_days: lookbackDays,
            total_revenue_at_risk: totalLeakedRevenue,
            critical_issues: leakageSourcesArray.filter(s => s.severity === 'Critical').length,
            lost_opportunities_count: lostOpportunities.length,
            data_freshness: 'real-time',
          },
        };
      }

      // Fallback to legacy response
      return responseData;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }

  private addToLeakageSource(
    sources: Map<string, { count: number; revenue: number; jobs: any[] }>,
    source: string,
    revenue: number,
    job: any
  ): void {
    if (!sources.has(source)) {
      sources.set(source, { count: 0, revenue: 0, jobs: [] });
    }
    const data = sources.get(source)!;
    data.count += 1;
    data.revenue += revenue;
    data.jobs.push(job);
  }

  private getLeakageDescription(source: string): string {
    const descriptions: Record<string, string> = {
      'Lost/Cancelled Jobs': 'Jobs that were lost or cancelled after initial engagement',
      'Delayed Conversions (>14 days)': 'Estimates pending approval for more than 2 weeks',
      'No Estimate Sent (Inactive)': 'Jobs with no estimate sent and no recent activity',
      'Abandoned After Initial Contact': 'Jobs with minimal follow-up after first contact',
    };
    return descriptions[source] || source;
  }

  private generateInsights(
    sources: LeakageSource[],
    delays: ConversionDelay[],
    lost: LostOpportunity[]
  ): string[] {
    const insights: string[] = [];

    // Primary leakage source
    if (sources.length > 0) {
      const primary = sources[0];
      insights.push(
        `${primary.source} is the primary leakage source (${primary.percentage_of_total.toFixed(1)}% of total at-risk revenue)`
      );
    }

    // Conversion efficiency
    const extremeDelays = delays.filter(d => d.delay_category === 'Extreme').length;
    if (extremeDelays > 0) {
      insights.push(
        `${extremeDelays} estimate(s) have been pending for >30 days - urgent follow-up needed`
      );
    }

    // Lost opportunity patterns
    if (lost.length > 0) {
      const avgDaysInPipeline = lost.reduce((sum, l) => sum + l.days_in_pipeline, 0) / lost.length;
      insights.push(
        `Average time in pipeline before loss: ${avgDaysInPipeline.toFixed(0)} days`
      );
    }

    // Revenue concentration
    const criticalSources = sources.filter(s => s.severity === 'Critical');
    if (criticalSources.length > 0) {
      insights.push(
        `${criticalSources.length} critical leakage source(s) identified requiring immediate attention`
      );
    }

    return insights;
  }

  private generateActionPlan(
    sources: LeakageSource[],
    delays: ConversionDelay[],
    totalAtRisk: number
  ): string[] {
    const actions: string[] = [];

    // Prioritized actions based on severity
    const criticalSources = sources.filter(s => s.severity === 'Critical');
    if (criticalSources.length > 0) {
      actions.push(
        `IMMEDIATE: Address ${criticalSources[0].source} - potential recovery of $${criticalSources[0].potential_revenue.toFixed(2)}`
      );
    }

    // Conversion delays
    const extremeDelays = delays.filter(d => d.delay_category === 'Extreme');
    if (extremeDelays.length > 0) {
      const delayValue = extremeDelays.reduce((sum, d) => sum + d.estimate_value, 0);
      actions.push(
        `URGENT: Follow up on ${extremeDelays.length} extremely delayed estimate(s) worth $${delayValue.toFixed(2)}`
      );
    }

    // Process improvements
    if (sources.some(s => s.source.includes('No Estimate Sent'))) {
      actions.push(
        'PROCESS: Implement automated reminders for jobs without estimates after 48 hours'
      );
    }

    if (sources.some(s => s.source.includes('Abandoned'))) {
      actions.push(
        'PROCESS: Strengthen initial follow-up protocols within 24 hours of contact'
      );
    }

    // Training needs
    const highDelayRate = delays.length > sources.reduce((sum, s) => sum + s.count, 0) * 0.3;
    if (highDelayRate) {
      actions.push(
        'TRAINING: Sales team needs training on faster estimate turnaround and follow-up'
      );
    }

    // Potential recovery
    if (totalAtRisk > 0) {
      actions.push(
        `GOAL: Recover 25-50% of at-risk revenue through targeted interventions ($${(totalAtRisk * 0.25).toFixed(2)} - $${(totalAtRisk * 0.5).toFixed(2)})`
      );
    }

    return actions;
  }
}
