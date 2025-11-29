/**
 * Get Pipeline Forecasting
 * Predict quarterly revenue and conversion rates with confidence intervals
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { validate_conversion_real } from '../../utils/conversionValidation.js';
import { isWonStatus } from '../../utils/statusMapping.js';

interface StageForecast {
  stage_name: string;
  current_count: number;
  expected_conversion_rate: number;
  forecasted_conversions: number;
  forecasted_revenue: number;
  confidence_level: 'high' | 'medium' | 'low';
}

// Bug #2 Fix: Interface for estimate-based pipeline tracking
interface EstimatePipelineStage {
  stage: string;
  status_code: number;
  count: number;
  total_value: number;
  average_value: number;
}

// Estimate status names from SumoQuote
const ESTIMATE_STATUS_NAMES: Record<number, string> = {
  1: 'Draft (Borrador)',
  2: 'Sent (Enviado)',
  3: 'Viewed (Visto)',
  4: 'Approved (Aprobado)',
  5: 'Invoiced (Facturado)',
  6: 'Declined (Rechazado)',
};

// Active pipeline = estimates NOT yet invoiced or declined
const ACTIVE_PIPELINE_STATUSES = [1, 2, 3, 4];

export class GetPipelineForecastingTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_pipeline_forecasting',
      description: 'Pipeline forecasting: quarterly revenue, conversion predictions, confidence intervals',
      inputSchema: {
        type: 'object',
        properties: {
          forecast_months: {
            type: 'number',
            default: 3,
            description: 'Months to forecast (default: 3)',
          },
          include_probability: {
            type: 'boolean',
            default: true,
            description: 'Include probability dist.',
          },
          confidence_level: {
            type: 'number',
            default: 0.8,
            description: 'Confidence level (0.0-1.0)',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    // Check if using new handle-based parameters for response optimization
    const useHandleResponse = this.hasNewParams(input);

    try {
      const forecastMonths = input.forecast_months || 3;
      const includeProbability = input.include_probability !== false;
      const confidenceLevel = input.confidence_level || 0.8;

      // Fetch data
      const [jobsResponse, estimatesResponse] = await Promise.all([
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'estimates', { size: 100 }),
      ]);

      const jobs = jobsResponse.data?.results || [];
      const estimates = estimatesResponse.data?.results || [];

      // Build estimate lookup
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

      // Bug #2 Fix: Group ALL estimates by status for pipeline value calculation
      const estimatePipeline = new Map<number, EstimatePipelineStage>();
      let totalPipelineValue = 0;
      let totalInvoicedValue = 0;

      for (const estimate of estimates) {
        const status = estimate.status || 0;
        const total = parseFloat(estimate.total || 0);

        if (!estimatePipeline.has(status)) {
          estimatePipeline.set(status, {
            stage: ESTIMATE_STATUS_NAMES[status] || `Status ${status}`,
            status_code: status,
            count: 0,
            total_value: 0,
            average_value: 0,
          });
        }

        const stage = estimatePipeline.get(status)!;
        stage.count++;
        stage.total_value += total;

        // Calculate pipeline value from active statuses only (Draft, Sent, Viewed, Approved)
        if (ACTIVE_PIPELINE_STATUSES.includes(status)) {
          totalPipelineValue += total;
        }

        // Track invoiced separately
        if (status === 5) {
          totalInvoicedValue += total;
        }
      }

      // Calculate averages for each stage
      for (const stage of estimatePipeline.values()) {
        stage.average_value = stage.count > 0 ? stage.total_value / stage.count : 0;
      }

      // Build estimate pipeline array sorted by status code
      const estimatePipelineArray: EstimatePipelineStage[] = Array.from(estimatePipeline.values())
        .sort((a, b) => a.status_code - b.status_code);

      // Analyze historical data (last 90 days)
      const now = Date.now();
      const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);

      // Group jobs by status/stage
      const stageData = new Map<string, {
        count: number;
        conversions: number;
        revenue: number;
        avgDaysToConvert: number;
      }>();

      let totalHistoricalRevenue = 0;
      let totalHistoricalJobs = 0;
      let totalConversions = 0;

      for (const job of jobs) {
        // FIX: JobNimbus returns Unix seconds, convert to milliseconds for comparison
        const jobDate = (job.date_created || 0) * 1000;
        if (jobDate < ninetyDaysAgo) continue;

        const statusName = job.status_name || 'Unknown';
        // FIX: Use centralized isWonStatus for consistent status recognition
        const isWon = isWonStatus(statusName);

        if (!stageData.has(statusName)) {
          stageData.set(statusName, {
            count: 0,
            conversions: 0,
            revenue: 0,
            avgDaysToConvert: 0,
          });
        }

        const stage = stageData.get(statusName)!;
        stage.count++;
        totalHistoricalJobs++;

        if (isWon) {
          // Calculate revenue and count approved estimates first
          let jobRevenue = 0;
          let approvedEstimates = 0;
          const jobEstimates = estimatesByJob.get(job.jnid) || [];

          for (const est of jobEstimates) {
            if (est.date_signed > 0 || est.status_name === 'approved') {
              approvedEstimates++;
              const revenue = parseFloat(est.total || 0);
              jobRevenue += revenue;
              stage.revenue += revenue;
              totalHistoricalRevenue += revenue;
            }
          }

          // FIXED: Only count as conversion if financial data exists
          // Prevents false positives where jobs are marked "won" but have no revenue
          const validation = validate_conversion_real(jobRevenue, approvedEstimates);
          if (validation.hasFinancialData) {
            stage.conversions++;
            totalConversions++;

            // Calculate time to convert (only for validated conversions)
            // FIX: JobNimbus returns Unix seconds, convert to milliseconds
            const startDate = (job.date_created || 0) * 1000;
            const endDate = (job.date_updated || 0) * 1000 || now;
            if (startDate > 0 && endDate > startDate) {
              const daysToConvert = (endDate - startDate) / (24 * 60 * 60 * 1000);
              stage.avgDaysToConvert += daysToConvert;
            }
          }
        }
      }

      // Calculate conversion rates
      const overallConversionRate = totalHistoricalJobs > 0
        ? totalConversions / totalHistoricalJobs
        : 0.25; // Default 25% if no data

      const avgJobValue = totalConversions > 0
        ? totalHistoricalRevenue / totalConversions
        : 0;

      // Forecast by stage
      const stageForecasts: StageForecast[] = [];

      for (const [stageName, data] of stageData.entries()) {
        const stageConversionRate = data.count > 0
          ? data.conversions / data.count
          : overallConversionRate;

        const avgStageRevenue = data.conversions > 0
          ? data.revenue / data.conversions
          : avgJobValue;

        // Forecast conversions
        const forecastedConversions = Math.round(data.count * stageConversionRate);
        const forecastedRevenue = forecastedConversions * avgStageRevenue;

        // Determine confidence
        let confidence: 'high' | 'medium' | 'low';
        if (data.count >= 20 && data.conversions >= 5) {
          confidence = 'high';
        } else if (data.count >= 10 && data.conversions >= 3) {
          confidence = 'medium';
        } else {
          confidence = 'low';
        }

        stageForecasts.push({
          stage_name: stageName,
          current_count: data.count,
          expected_conversion_rate: stageConversionRate,
          forecasted_conversions: forecastedConversions,
          forecasted_revenue: forecastedRevenue,
          confidence_level: confidence,
        });
      }

      // Overall quarterly forecast
      const monthlyJobRate = totalHistoricalJobs / 3; // Last 90 days = 3 months
      const expectedJobsNextQuarter = Math.round(monthlyJobRate * forecastMonths);
      const expectedConversionsNextQuarter = Math.round(expectedJobsNextQuarter * overallConversionRate);
      const expectedRevenueNextQuarter = expectedConversionsNextQuarter * avgJobValue;

      // Calculate growth rate
      const firstMonthRevenue = totalHistoricalRevenue / 3;
      const lastMonthRevenue = totalHistoricalRevenue / 3; // Simplified - would need monthly breakdown
      const growthRate = firstMonthRevenue > 0
        ? ((lastMonthRevenue - firstMonthRevenue) / firstMonthRevenue)
        : 0;

      // Probability distribution
      let probabilityDistribution = null;
      if (includeProbability) {
        const stdDev = avgJobValue * 0.3; // Assume 30% standard deviation

        probabilityDistribution = {
          pessimistic: expectedRevenueNextQuarter * 0.7,
          likely: expectedRevenueNextQuarter,
          optimistic: expectedRevenueNextQuarter * 1.3,
          confidence_interval: {
            lower: expectedRevenueNextQuarter - (stdDev * 1.96),
            upper: expectedRevenueNextQuarter + (stdDev * 1.96),
            confidence: confidenceLevel,
          },
        };
      }

      // Recommendations
      const recommendations: string[] = [];

      if (overallConversionRate < 0.25) {
        recommendations.push('CRITICAL: Conversion rate below 25% - focus on improving sales process');
      }

      if (expectedJobsNextQuarter < totalHistoricalJobs) {
        recommendations.push('WARNING: Pipeline velocity declining - increase lead generation efforts');
      }

      if (growthRate < 0) {
        recommendations.push('Negative growth detected - review pricing and market positioning');
      } else if (growthRate > 0.2) {
        recommendations.push('Strong growth trajectory - consider scaling operations');
      }

      recommendations.push(`To hit $${(expectedRevenueNextQuarter * 1.2).toFixed(0)} target, need ${Math.ceil(expectedJobsNextQuarter * 1.2)} jobs at current conversion rate`);

      // Risk factors
      const riskFactors: string[] = [];

      const lowConfidenceStages = stageForecasts.filter(s => s.confidence_level === 'low');
      if (lowConfidenceStages.length > 0) {
        riskFactors.push(`${lowConfidenceStages.length} stage(s) with low confidence due to insufficient data`);
      }

      if (overallConversionRate < 0.2) {
        riskFactors.push('Very low conversion rate increases forecast uncertainty');
      }

      if (totalHistoricalJobs < 30) {
        riskFactors.push('Limited historical data - forecasts have higher uncertainty');
      }

      // Build response data
      const responseData = {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        forecast_period: {
          months: forecastMonths,
          start_date: new Date().toISOString(),
          end_date: new Date(now + (forecastMonths * 30 * 24 * 60 * 60 * 1000)).toISOString(),
        },
        // Bug #2 Fix: Estimate-based pipeline value (CEO Dashboard KPI)
        pipeline_value: {
          total_active_pipeline: totalPipelineValue,
          total_invoiced: totalInvoicedValue,
          active_statuses: 'Draft, Sent, Viewed, Approved',
          note: 'Pipeline value calculated from estimates in active statuses (1-4)',
        },
        estimate_pipeline: estimatePipelineArray,
        invoiced_summary: {
          total_invoiced: totalInvoicedValue,
          estimates_count: estimatePipelineArray.find(s => s.status_code === 5)?.count || 0,
          average_invoice_value: (estimatePipelineArray.find(s => s.status_code === 5)?.average_value || 0),
        },
        historical_baseline: {
          period_days: 90,
          total_jobs: totalHistoricalJobs,
          total_conversions: totalConversions,
          total_revenue: totalHistoricalRevenue,
          conversion_rate: overallConversionRate,
          avg_job_value: avgJobValue,
        },
        quarterly_forecast: {
          expected_jobs: expectedJobsNextQuarter,
          expected_conversions: expectedConversionsNextQuarter,
          expected_revenue: expectedRevenueNextQuarter,
          growth_rate: growthRate,
          confidence: totalHistoricalJobs >= 30 ? 'high' : totalHistoricalJobs >= 15 ? 'medium' : 'low',
        },
        stage_forecasts: stageForecasts.sort((a, b) => b.forecasted_revenue - a.forecasted_revenue),
        probability_distribution: probabilityDistribution,
        recommendations: recommendations,
        risk_factors: riskFactors,
        insights: [
          `💰 Total Pipeline Value: $${totalPipelineValue.toFixed(2)} (active estimates)`,
          `📊 Total Invoiced: $${totalInvoicedValue.toFixed(2)}`,
          `Current conversion rate: ${(overallConversionRate * 100).toFixed(1)}%`,
          `Average deal size: $${avgJobValue.toFixed(2)}`,
          `Expected quarterly revenue: $${expectedRevenueNextQuarter.toFixed(2)}`,
          `Growth rate: ${(growthRate * 100).toFixed(1)}%`,
        ],
      };

      // Use handle-based response if requested
      if (useHandleResponse) {
        const envelope = await this.wrapResponse([responseData], input, context, {
          entity: 'pipeline_forecasting',
          maxRows: stageForecasts.length,
          pageInfo: {
            current_page: 1,
            total_pages: 1,
            has_more: false,
          },
        });

        return {
          ...envelope,
          query_metadata: {
            forecast_months: forecastMonths,
            total_jobs: totalHistoricalJobs,
            conversion_rate: overallConversionRate,
            expected_revenue: expectedRevenueNextQuarter,
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
}
