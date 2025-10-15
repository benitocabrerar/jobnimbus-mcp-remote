/**
 * Get Conversion Funnel Analytics
 * Multi-stage sales funnel analysis with conversion tracking, drop-off identification, and optimization recommendations
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface FunnelStage {
  stage_name: string;
  stage_number: number;
  total_count: number;
  conversion_to_next: number;
  conversion_rate: number;
  drop_off_count: number;
  drop_off_rate: number;
  avg_time_in_stage_days: number;
  velocity_score: number;
}

interface FunnelMetrics {
  total_leads: number;
  total_contacts: number;
  total_estimates: number;
  total_jobs: number;
  total_won: number;
  overall_conversion_rate: number;
  avg_funnel_time_days: number;
  total_revenue: number;
  avg_deal_value: number;
}

interface StageVelocity {
  stage: string;
  avg_days: number;
  median_days: number;
  fastest_days: number;
  slowest_days: number;
  velocity_rating: 'Excellent' | 'Good' | 'Fair' | 'Slow';
}

interface DropOffAnalysis {
  stage: string;
  drop_off_count: number;
  drop_off_percentage: number;
  primary_reason: string;
  secondary_reasons: string[];
  recovery_potential: number;
  recommended_action: string;
}

interface RepPerformance {
  rep_name: string;
  rep_id: string;
  leads_handled: number;
  conversions: number;
  conversion_rate: number;
  avg_funnel_time: number;
  total_revenue: number;
  performance_rating: 'Top Performer' | 'Above Average' | 'Average' | 'Below Average';
}

interface FunnelOptimization {
  bottleneck_stage: string;
  impact_level: 'Critical' | 'High' | 'Medium' | 'Low';
  recommendation: string;
  estimated_improvement: string;
  priority: number;
}

export class GetConversionFunnelAnalyticsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_conversion_funnel_analytics',
      description: 'Multi-stage sales funnel analysis with conversion tracking, drop-off point identification, stage velocity metrics, and funnel optimization recommendations',
      inputSchema: {
        type: 'object',
        properties: {
          days_back: {
            type: 'number',
            default: 90,
            description: 'Days of history to analyze (default: 90)',
          },
          sales_rep_filter: {
            type: 'string',
            description: 'Filter by sales rep ID',
          },
          include_velocity: {
            type: 'boolean',
            default: true,
            description: 'Include stage velocity analysis',
          },
          include_rep_comparison: {
            type: 'boolean',
            default: true,
            description: 'Include sales rep performance comparison',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const daysBack = input.days_back || 90;
      const salesRepFilter = input.sales_rep_filter;
      const includeVelocity = input.include_velocity !== false;
      const includeRepComparison = input.include_rep_comparison !== false;

      // Fetch data
      const [contactsResponse, estimatesResponse, jobsResponse] = await Promise.all([
        this.client.get(context.apiKey, 'contacts', { size: 100 }),
        this.client.get(context.apiKey, 'estimates', { size: 100 }),
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
      ]);

      const contacts = contactsResponse.data?.results || [];
      const estimates = estimatesResponse.data?.results || [];
      const jobs = jobsResponse.data?.results || [];

      // Try to fetch users - endpoint may not be available in all JobNimbus accounts
      let users: any[] = [];
      try {
        const usersResponse = await this.client.get(context.apiKey, 'users', { size: 100 });
        users = usersResponse.data?.results || usersResponse.data?.users || [];
      } catch (error) {
        // Users endpoint not available - proceed without user attribution
        console.warn('Users endpoint not available - conversion funnel analysis will be limited');
      }

      const now = Date.now();
      const cutoffDate = now - (daysBack * 24 * 60 * 60 * 1000);

      // Build funnel tracking map: contact_id -> funnel data
      const funnelTracking = new Map<string, {
        contactDate: number;
        estimateDate: number;
        jobDate: number;
        wonDate: number;
        currentStage: string;
        repId: string;
        repName: string;
        totalValue: number;
        isWon: boolean;
      }>();

      // User map
      const userMap = new Map<string, any>();
      for (const user of users) {
        const userId = user.jnid || user.id;
        if (userId) userMap.set(userId, user);
      }

      // Stage 1: Contacts (Lead stage)
      for (const contact of contacts) {
        const contactId = contact.jnid || contact.id;
        if (!contactId) continue;

        const createdDate = contact.date_created || contact.created_at || 0;
        if (createdDate < cutoffDate) continue;

        const ownerId = contact.owner_id || contact.assigned_to || '';
        const owner = userMap.get(ownerId);
        const repName = owner ? `${owner.first_name || ''} ${owner.last_name || ''}`.trim() : 'Unassigned';

        funnelTracking.set(contactId, {
          contactDate: createdDate,
          estimateDate: 0,
          jobDate: 0,
          wonDate: 0,
          currentStage: 'Contact',
          repId: ownerId,
          repName: repName,
          totalValue: 0,
          isWon: false,
        });
      }

      // Stage 2: Estimates
      for (const estimate of estimates) {
        const related = estimate.related || [];
        const contactRel = related.find((r: any) => r.type === 'contact');
        if (!contactRel || !contactRel.id) continue;

        const contactId = contactRel.id;
        const sentDate = estimate.date_sent || estimate.date_created || 0;

        if (funnelTracking.has(contactId)) {
          const data = funnelTracking.get(contactId)!;
          if (sentDate > data.estimateDate) {
            data.estimateDate = sentDate;
            data.currentStage = 'Estimate';
            data.totalValue = parseFloat(estimate.total || 0);
          }
        } else {
          // Estimate without contact (orphaned)
          const ownerId = estimate.owner_id || '';
          const owner = userMap.get(ownerId);
          const repName = owner ? `${owner.first_name || ''} ${owner.last_name || ''}`.trim() : 'Unassigned';

          funnelTracking.set(contactId, {
            contactDate: sentDate,
            estimateDate: sentDate,
            jobDate: 0,
            wonDate: 0,
            currentStage: 'Estimate',
            repId: ownerId,
            repName: repName,
            totalValue: parseFloat(estimate.total || 0),
            isWon: false,
          });
        }
      }

      // Stage 3: Jobs
      for (const job of jobs) {
        const related = job.related || [];
        const contactRel = related.find((r: any) => r.type === 'contact');
        if (!contactRel || !contactRel.id) continue;

        const contactId = contactRel.id;
        const jobDate = job.date_created || job.created_at || 0;
        const statusLower = (job.status_name || '').toLowerCase();
        const isWon = statusLower.includes('complete') || statusLower.includes('won');
        const wonDate = isWon ? (job.date_status_change || jobDate) : 0;

        if (funnelTracking.has(contactId)) {
          const data = funnelTracking.get(contactId)!;
          if (jobDate > data.jobDate) {
            data.jobDate = jobDate;
            data.currentStage = isWon ? 'Won' : 'Job';
            data.isWon = isWon;
            data.wonDate = wonDate;
          }
        }
      }

      // Filter by sales rep if specified
      let filteredFunnel = Array.from(funnelTracking.values());
      if (salesRepFilter) {
        filteredFunnel = filteredFunnel.filter(f => f.repId === salesRepFilter);
      }

      // Calculate funnel stages
      const contactStage = filteredFunnel.filter(f => f.contactDate > 0);
      const estimateStage = filteredFunnel.filter(f => f.estimateDate > 0);
      const jobStage = filteredFunnel.filter(f => f.jobDate > 0);
      const wonStage = filteredFunnel.filter(f => f.isWon);

      // Funnel metrics
      const funnelMetrics: FunnelMetrics = {
        total_leads: contactStage.length,
        total_contacts: contactStage.length,
        total_estimates: estimateStage.length,
        total_jobs: jobStage.length,
        total_won: wonStage.length,
        overall_conversion_rate: contactStage.length > 0
          ? (wonStage.length / contactStage.length) * 100
          : 0,
        avg_funnel_time_days: 0,
        total_revenue: wonStage.reduce((sum, f) => sum + f.totalValue, 0),
        avg_deal_value: wonStage.length > 0
          ? wonStage.reduce((sum, f) => sum + f.totalValue, 0) / wonStage.length
          : 0,
      };

      // Average funnel time (contact to won)
      const funnelTimes = wonStage
        .filter(f => f.contactDate > 0 && f.wonDate > 0)
        .map(f => (f.wonDate - f.contactDate) / (1000 * 60 * 60 * 24));
      funnelMetrics.avg_funnel_time_days = funnelTimes.length > 0
        ? funnelTimes.reduce((sum, t) => sum + t, 0) / funnelTimes.length
        : 0;

      // Funnel stages
      const stages: FunnelStage[] = [
        {
          stage_name: 'Contact/Lead',
          stage_number: 1,
          total_count: contactStage.length,
          conversion_to_next: estimateStage.length,
          conversion_rate: contactStage.length > 0 ? (estimateStage.length / contactStage.length) * 100 : 0,
          drop_off_count: contactStage.length - estimateStage.length,
          drop_off_rate: contactStage.length > 0 ? ((contactStage.length - estimateStage.length) / contactStage.length) * 100 : 0,
          avg_time_in_stage_days: 0,
          velocity_score: 0,
        },
        {
          stage_name: 'Estimate/Proposal',
          stage_number: 2,
          total_count: estimateStage.length,
          conversion_to_next: jobStage.length,
          conversion_rate: estimateStage.length > 0 ? (jobStage.length / estimateStage.length) * 100 : 0,
          drop_off_count: estimateStage.length - jobStage.length,
          drop_off_rate: estimateStage.length > 0 ? ((estimateStage.length - jobStage.length) / estimateStage.length) * 100 : 0,
          avg_time_in_stage_days: 0,
          velocity_score: 0,
        },
        {
          stage_name: 'Job/Opportunity',
          stage_number: 3,
          total_count: jobStage.length,
          conversion_to_next: wonStage.length,
          conversion_rate: jobStage.length > 0 ? (wonStage.length / jobStage.length) * 100 : 0,
          drop_off_count: jobStage.length - wonStage.length,
          drop_off_rate: jobStage.length > 0 ? ((jobStage.length - wonStage.length) / jobStage.length) * 100 : 0,
          avg_time_in_stage_days: 0,
          velocity_score: 0,
        },
        {
          stage_name: 'Won/Closed',
          stage_number: 4,
          total_count: wonStage.length,
          conversion_to_next: 0,
          conversion_rate: 100,
          drop_off_count: 0,
          drop_off_rate: 0,
          avg_time_in_stage_days: 0,
          velocity_score: 100,
        },
      ];

      // Stage velocity analysis
      const stageVelocities: StageVelocity[] = [];
      if (includeVelocity) {
        // Contact to Estimate velocity
        const contactToEstimateTimes = filteredFunnel
          .filter(f => f.contactDate > 0 && f.estimateDate > 0)
          .map(f => (f.estimateDate - f.contactDate) / (1000 * 60 * 60 * 24));

        if (contactToEstimateTimes.length > 0) {
          stageVelocities.push(this.calculateVelocity('Contact → Estimate', contactToEstimateTimes));
          stages[0].avg_time_in_stage_days = contactToEstimateTimes.reduce((sum, t) => sum + t, 0) / contactToEstimateTimes.length;
          stages[0].velocity_score = this.getVelocityScore(stages[0].avg_time_in_stage_days, 7);
        }

        // Estimate to Job velocity
        const estimateToJobTimes = filteredFunnel
          .filter(f => f.estimateDate > 0 && f.jobDate > 0)
          .map(f => (f.jobDate - f.estimateDate) / (1000 * 60 * 60 * 24));

        if (estimateToJobTimes.length > 0) {
          stageVelocities.push(this.calculateVelocity('Estimate → Job', estimateToJobTimes));
          stages[1].avg_time_in_stage_days = estimateToJobTimes.reduce((sum, t) => sum + t, 0) / estimateToJobTimes.length;
          stages[1].velocity_score = this.getVelocityScore(stages[1].avg_time_in_stage_days, 14);
        }

        // Job to Won velocity
        const jobToWonTimes = filteredFunnel
          .filter(f => f.jobDate > 0 && f.wonDate > 0)
          .map(f => (f.wonDate - f.jobDate) / (1000 * 60 * 60 * 24));

        if (jobToWonTimes.length > 0) {
          stageVelocities.push(this.calculateVelocity('Job → Won', jobToWonTimes));
          stages[2].avg_time_in_stage_days = jobToWonTimes.reduce((sum, t) => sum + t, 0) / jobToWonTimes.length;
          stages[2].velocity_score = this.getVelocityScore(stages[2].avg_time_in_stage_days, 30);
        }
      }

      // Drop-off analysis
      const dropOffAnalysis: DropOffAnalysis[] = [
        {
          stage: 'Contact → Estimate',
          drop_off_count: stages[0].drop_off_count,
          drop_off_percentage: stages[0].drop_off_rate,
          primary_reason: 'Lack of follow-up or engagement',
          secondary_reasons: ['Unqualified lead', 'Lost to competitor', 'Budget constraints'],
          recovery_potential: stages[0].drop_off_rate > 50 ? 60 : 40,
          recommended_action: stages[0].drop_off_rate > 50
            ? 'Critical: Implement automated follow-up sequence'
            : 'Schedule regular follow-up calls',
        },
        {
          stage: 'Estimate → Job',
          drop_off_count: stages[1].drop_off_count,
          drop_off_percentage: stages[1].drop_off_rate,
          primary_reason: 'Pricing concerns or competitive quotes',
          secondary_reasons: ['Timeline delays', 'Scope changes', 'Decision maker not engaged'],
          recovery_potential: stages[1].drop_off_rate > 40 ? 50 : 30,
          recommended_action: stages[1].drop_off_rate > 40
            ? 'High priority: Review pricing strategy and value proposition'
            : 'Follow up on pending estimates',
        },
        {
          stage: 'Job → Won',
          drop_off_count: stages[2].drop_off_count,
          drop_off_percentage: stages[2].drop_off_rate,
          primary_reason: 'Project cancellation or postponement',
          secondary_reasons: ['Customer satisfaction issues', 'Payment problems', 'Scope disputes'],
          recovery_potential: stages[2].drop_off_rate > 30 ? 40 : 20,
          recommended_action: stages[2].drop_off_rate > 30
            ? 'Medium priority: Improve project management and communication'
            : 'Monitor job status closely',
        },
      ];

      // Sales rep performance comparison
      const repPerformances: RepPerformance[] = [];
      if (includeRepComparison) {
        const repMap = new Map<string, {
          leads: number;
          conversions: number;
          revenue: number;
          funnelTimes: number[];
        }>();

        for (const funnel of filteredFunnel) {
          const repId = funnel.repId || 'unassigned';
          if (!repMap.has(repId)) {
            repMap.set(repId, { leads: 0, conversions: 0, revenue: 0, funnelTimes: [] });
          }
          const repData = repMap.get(repId)!;
          repData.leads++;
          if (funnel.isWon) {
            repData.conversions++;
            repData.revenue += funnel.totalValue;
            if (funnel.contactDate > 0 && funnel.wonDate > 0) {
              repData.funnelTimes.push((funnel.wonDate - funnel.contactDate) / (1000 * 60 * 60 * 24));
            }
          }
        }

        for (const [repId, data] of repMap.entries()) {
          const conversionRate = data.leads > 0 ? (data.conversions / data.leads) * 100 : 0;
          const avgFunnelTime = data.funnelTimes.length > 0
            ? data.funnelTimes.reduce((sum, t) => sum + t, 0) / data.funnelTimes.length
            : 0;

          const rep = userMap.get(repId);
          const repName = rep ? `${rep.first_name || ''} ${rep.last_name || ''}`.trim() : 'Unassigned';

          const performanceRating: 'Top Performer' | 'Above Average' | 'Average' | 'Below Average' =
            conversionRate >= 30 ? 'Top Performer' :
            conversionRate >= 20 ? 'Above Average' :
            conversionRate >= 10 ? 'Average' : 'Below Average';

          repPerformances.push({
            rep_name: repName,
            rep_id: repId,
            leads_handled: data.leads,
            conversions: data.conversions,
            conversion_rate: conversionRate,
            avg_funnel_time: avgFunnelTime,
            total_revenue: data.revenue,
            performance_rating: performanceRating,
          });
        }

        repPerformances.sort((a, b) => b.conversion_rate - a.conversion_rate);
      }

      // Funnel optimizations
      const optimizations: FunnelOptimization[] = [];

      // Identify bottlenecks
      const bottleneckStage = stages.reduce((worst, stage) =>
        stage.drop_off_rate > worst.drop_off_rate ? stage : worst
      );

      optimizations.push({
        bottleneck_stage: bottleneckStage.stage_name,
        impact_level: bottleneckStage.drop_off_rate > 60 ? 'Critical' :
                      bottleneckStage.drop_off_rate > 40 ? 'High' :
                      bottleneckStage.drop_off_rate > 25 ? 'Medium' : 'Low',
        recommendation: `Focus on improving ${bottleneckStage.stage_name} conversion (current drop-off: ${bottleneckStage.drop_off_rate.toFixed(1)}%)`,
        estimated_improvement: `Reducing drop-off by 10% could yield ${Math.round(bottleneckStage.drop_off_count * 0.1)} additional conversions`,
        priority: 1,
      });

      // Slow velocity optimization
      const slowestStage = stageVelocities.reduce((slowest, velocity) =>
        velocity.avg_days > slowest.avg_days ? velocity : slowest
      , stageVelocities[0] || { avg_days: 0, stage: '', velocity_rating: 'Excellent' } as StageVelocity);

      if (slowestStage.velocity_rating === 'Slow' || slowestStage.velocity_rating === 'Fair') {
        optimizations.push({
          bottleneck_stage: slowestStage.stage,
          impact_level: 'Medium',
          recommendation: `Accelerate ${slowestStage.stage} stage (currently ${slowestStage.avg_days.toFixed(1)} days avg)`,
          estimated_improvement: `Reducing time by 25% could improve overall funnel velocity`,
          priority: 2,
        });
      }

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        analysis_period_days: daysBack,
        funnel_metrics: funnelMetrics,
        funnel_stages: stages,
        stage_velocities: includeVelocity ? stageVelocities : undefined,
        drop_off_analysis: dropOffAnalysis,
        rep_performance: includeRepComparison ? repPerformances : undefined,
        funnel_optimizations: optimizations,
        key_insights: [
          `Overall conversion rate: ${funnelMetrics.overall_conversion_rate.toFixed(1)}%`,
          `Biggest bottleneck: ${bottleneckStage.stage_name} (${bottleneckStage.drop_off_rate.toFixed(1)}% drop-off)`,
          `Average funnel time: ${funnelMetrics.avg_funnel_time_days.toFixed(1)} days`,
          `Total revenue: $${funnelMetrics.total_revenue.toLocaleString()}`,
        ],
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }

  private calculateVelocity(stage: string, times: number[]): StageVelocity {
    const sorted = times.sort((a, b) => a - b);
    const avg = times.reduce((sum, t) => sum + t, 0) / times.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const fastest = sorted[0];
    const slowest = sorted[sorted.length - 1];

    const velocityRating: 'Excellent' | 'Good' | 'Fair' | 'Slow' =
      avg <= 7 ? 'Excellent' :
      avg <= 14 ? 'Good' :
      avg <= 30 ? 'Fair' : 'Slow';

    return {
      stage,
      avg_days: avg,
      median_days: median,
      fastest_days: fastest,
      slowest_days: slowest,
      velocity_rating: velocityRating,
    };
  }

  private getVelocityScore(avgDays: number, targetDays: number): number {
    if (avgDays <= targetDays) return 100;
    const penalty = ((avgDays - targetDays) / targetDays) * 50;
    return Math.max(0, 100 - penalty);
  }
}
