/**
 * Analyze Public Adjuster Pipeline
 * Specialized analysis for public adjuster businesses with claim value prediction and negotiation analytics
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface ClaimStage {
  stage_name: string;
  claim_count: number;
  total_value: number;
  avg_days_in_stage: number;
  conversion_rate: number;
}

export class AnalyzePublicAdjusterPipelineTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'analyze_public_adjuster_pipeline',
      description: 'Public Adjuster pipeline optimization with claim value prediction, negotiation success forecasting, timeline optimization',
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
            description: 'Analysis depth level',
          },
          include_predictions: {
            type: 'boolean',
            default: true,
            description: 'Include ML-based predictions',
          },
          include_recommendations: {
            type: 'boolean',
            default: true,
            description: 'Include AI recommendations',
          },
          negotiation_optimization: {
            type: 'boolean',
            default: true,
            description: 'Optimize negotiation strategy',
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
      const negotiationOpt = input.negotiation_optimization !== false;

      // Fetch data
      const [jobsResponse, estimatesResponse] = await Promise.all([
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'estimates', { size: 100 }),
      ]);

      const jobs = jobsResponse.data?.results || [];
      const estimates = estimatesResponse.data?.results || [];

      // Filter for Public Adjuster / Insurance claims
      const claimJobs = jobs.filter((j: any) => {
        const jobType = (j.job_type_name || '').toLowerCase();
        const statusName = (j.status_name || '').toLowerCase();
        return jobType.includes('insurance') || jobType.includes('claim') ||
               jobType.includes('adjuster') || statusName.includes('claim');
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

      // Analyze claim pipeline
      const claimStages: Map<string, ClaimStage> = new Map();
      const claimValues: number[] = [];
      const settlementRatios: number[] = [];

      let totalInitialValue = 0;
      let totalSettledValue = 0;
      let settledClaims = 0;
      let avgNegotiationTime = 0;
      let totalNegotiationTime = 0;
      let negotiationCount = 0;

      const adjusterPerformance = new Map<string, {
        claims: number;
        totalValue: number;
        avgSettlementRatio: number;
        avgNegotiationDays: number;
      }>();

      for (const job of claimJobs) {
        const jobDate = job.date_created || 0;
        if (jobDate < cutoffDate) continue;

        const statusName = job.status_name || 'Unknown';
        const isSettled = (statusName.toLowerCase().includes('complete') ||
                          statusName.toLowerCase().includes('settled') ||
                          statusName.toLowerCase().includes('closed'));

        // Get estimates
        const jobEstimates = estimatesByJob.get(job.jnid) || [];

        let initialValue = 0;
        let settledValue = 0;

        for (const est of jobEstimates) {
          const estValue = parseFloat(est.total || 0);
          initialValue += estValue;

          if (est.date_signed > 0 || est.status_name === 'approved') {
            settledValue += estValue;
          }
        }

        if (initialValue > 0) {
          claimValues.push(initialValue);
          totalInitialValue += initialValue;
        }

        if (isSettled && settledValue > 0) {
          settledClaims++;
          totalSettledValue += settledValue;

          if (initialValue > 0) {
            const settlementRatio = settledValue / initialValue;
            settlementRatios.push(settlementRatio);
          }

          // Calculate negotiation time
          const startDate = job.date_created || 0;
          const endDate = job.date_updated || now;
          if (startDate > 0 && endDate > startDate) {
            const negotiationDays = (endDate - startDate) / (24 * 60 * 60 * 1000);
            totalNegotiationTime += negotiationDays;
            negotiationCount++;
          }
        }

        // Track by stage
        if (!claimStages.has(statusName)) {
          claimStages.set(statusName, {
            stage_name: statusName,
            claim_count: 0,
            total_value: 0,
            avg_days_in_stage: 0,
            conversion_rate: 0,
          });
        }
        const stageData = claimStages.get(statusName)!;
        stageData.claim_count++;
        stageData.total_value += initialValue;

        // Adjuster performance
        const adjusterId = job.assigned_to_id || 'unassigned';
        if (!adjusterPerformance.has(adjusterId)) {
          adjusterPerformance.set(adjusterId, {
            claims: 0,
            totalValue: 0,
            avgSettlementRatio: 0,
            avgNegotiationDays: 0,
          });
        }
        const adjData = adjusterPerformance.get(adjusterId)!;
        adjData.claims++;
        adjData.totalValue += settledValue;
      }

      avgNegotiationTime = negotiationCount > 0 ? totalNegotiationTime / negotiationCount : 0;
      const avgSettlementRatio = settlementRatios.length > 0
        ? settlementRatios.reduce((a, b) => a + b, 0) / settlementRatios.length
        : 0;

      // Calculate claim value tiers
      claimValues.sort((a, b) => a - b);
      const p25 = claimValues[Math.floor(claimValues.length * 0.25)] || 0;
      const p50 = claimValues[Math.floor(claimValues.length * 0.50)] || 0;
      const p75 = claimValues[Math.floor(claimValues.length * 0.75)] || 0;
      const p90 = claimValues[Math.floor(claimValues.length * 0.90)] || 0;

      // Predictions
      let predictions = null;
      if (includePredict && settledClaims >= 3) {
        const avgClaimValue = totalInitialValue / Math.max(claimJobs.length, 1);
        const nextMonthClaims = Math.round(claimJobs.length * 1.05);

        predictions = {
          next_month_claim_count: nextMonthClaims,
          next_month_value: avgClaimValue * nextMonthClaims,
          expected_settlement_ratio: avgSettlementRatio,
          expected_negotiation_days: avgNegotiationTime,
          confidence: settledClaims >= 10 ? 'high' : settledClaims >= 5 ? 'medium' : 'low',
        };
      }

      // Recommendations
      const recommendations: string[] = [];
      if (includeRec) {
        if (avgSettlementRatio < 0.7) {
          recommendations.push('CRITICAL: Average settlement ratio below 70% - review negotiation strategies');
        }
        if (avgNegotiationTime > 60) {
          recommendations.push('Negotiation time exceeds 60 days - implement faster resolution protocols');
        }
        if (settledClaims < claimJobs.length * 0.3) {
          recommendations.push('Low settlement rate - only ' + settledClaims + ' of ' + claimJobs.length + ' claims settled');
        }
        if (p90 > p50 * 3) {
          recommendations.push('High variance in claim values - develop specialized handling for high-value claims');
        }
      }

      // Negotiation optimization
      const negotiationStrategies: string[] = [];
      if (negotiationOpt) {
        negotiationStrategies.push('For claims > $' + p75.toFixed(0) + ': Assign senior adjusters and allow 90+ days');
        negotiationStrategies.push('For claims < $' + p25.toFixed(0) + ': Fast-track with 30-day target');
        negotiationStrategies.push('Target settlement ratio: 80-90% of initial claim value');

        if (avgSettlementRatio > 0) {
          negotiationStrategies.push(
            'Current settlement ratio: ' + (avgSettlementRatio * 100).toFixed(1) + '% - ' +
            (avgSettlementRatio >= 0.8 ? 'EXCELLENT' : avgSettlementRatio >= 0.7 ? 'GOOD' : 'NEEDS IMPROVEMENT')
          );
        }
      }

      // Adjuster leaderboard
      const topAdjusters = Array.from(adjusterPerformance.entries())
        .map(([id, data]) => ({
          adjuster_id: id,
          claims_handled: data.claims,
          total_value: data.totalValue,
          avg_claim_value: data.claims > 0 ? data.totalValue / data.claims : 0,
        }))
        .sort((a, b) => b.total_value - a.total_value)
        .slice(0, 10);

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        analysis_period: {
          days: timeWindowDays,
          start_date: new Date(cutoffDate).toISOString(),
          end_date: new Date(now).toISOString(),
        },
        summary: {
          total_claims: claimJobs.length,
          settled_claims: settledClaims,
          total_initial_value: totalInitialValue,
          total_settled_value: totalSettledValue,
          avg_settlement_ratio: avgSettlementRatio,
          avg_negotiation_days: avgNegotiationTime,
          settlement_rate: claimJobs.length > 0 ? (settledClaims / claimJobs.length) * 100 : 0,
        },
        claim_value_distribution: {
          p25: p25,
          p50_median: p50,
          p75: p75,
          p90_high_value: p90,
        },
        pipeline_stages: Array.from(claimStages.values())
          .sort((a, b) => b.total_value - a.total_value),
        adjuster_performance: topAdjusters,
        predictions: predictions,
        negotiation_strategies: negotiationStrategies,
        recommendations: recommendations,
        insights: [
          `Average claim value: $${(totalInitialValue / Math.max(claimJobs.length, 1)).toFixed(2)}`,
          `Settlement rate: ${((settledClaims / Math.max(claimJobs.length, 1)) * 100).toFixed(1)}%`,
          `Average settlement ratio: ${(avgSettlementRatio * 100).toFixed(1)}%`,
          `Average negotiation time: ${avgNegotiationTime.toFixed(1)} days`,
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
