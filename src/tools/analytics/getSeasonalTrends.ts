/**
 * Get Seasonal Trends
 * Comprehensive seasonal demand pattern analysis with forecasting and planning recommendations
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface MonthlyTrend {
  month: string;
  year: number;
  job_count: number;
  revenue: number;
  avg_job_value: number;
  trend_direction: 'up' | 'down' | 'stable';
}

interface SeasonalPattern {
  season: string;
  months: string[];
  avg_jobs_per_month: number;
  avg_revenue_per_month: number;
  peak_indicator: boolean;
}

export class GetSeasonalTrendsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_seasonal_trends',
      description: 'Seasonal demand pattern analysis & forecast',
      inputSchema: {
        type: 'object',
        properties: {
          years_to_analyze: {
            type: 'number',
            default: 2,
            description: 'Historical years to include (default: 2)',
          },
          service_type: {
            type: 'string',
            description: 'Filter by service type (optional)',
          },
          include_forecasts: {
            type: 'boolean',
            default: true,
            description: 'Include seasonal forecasts',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const yearsToAnalyze = input.years_to_analyze || 2;
      const serviceTypeFilter = input.service_type;
      const includeForecasts = input.include_forecasts !== false;

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

      // Filter jobs
      let filteredJobs = jobs;
      if (serviceTypeFilter) {
        filteredJobs = jobs.filter((j: any) =>
          (j.job_type_name || '').toLowerCase().includes(serviceTypeFilter.toLowerCase())
        );
      }

      // Group by month
      const monthlyData = new Map<string, {
        jobs: number;
        revenue: number;
        year: number;
        month: number;
      }>();

      const now = new Date();
      const cutoffDate = new Date();
      cutoffDate.setFullYear(cutoffDate.getFullYear() - yearsToAnalyze);

      for (const job of filteredJobs) {
        const jobDate = job.date_created || 0;
        if (jobDate === 0) continue;

        const date = new Date(jobDate);
        if (date < cutoffDate) continue;

        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyData.has(monthKey)) {
          monthlyData.set(monthKey, {
            jobs: 0,
            revenue: 0,
            year: date.getFullYear(),
            month: date.getMonth() + 1,
          });
        }

        const monthData = monthlyData.get(monthKey)!;
        monthData.jobs++;

        // Add revenue
        const jobEstimates = estimatesByJob.get(job.jnid) || [];
        for (const est of jobEstimates) {
          if (est.date_signed > 0 || est.status_name === 'approved') {
            monthData.revenue += parseFloat(est.total || 0);
          }
        }
      }

      // Convert to monthly trends
      const monthlyTrends: MonthlyTrend[] = Array.from(monthlyData.entries())
        .map(([monthKey, data]) => {
          const avgJobValue = data.jobs > 0 ? data.revenue / data.jobs : 0;

          return {
            month: monthKey,
            year: data.year,
            job_count: data.jobs,
            revenue: data.revenue,
            avg_job_value: avgJobValue,
            trend_direction: 'stable' as 'up' | 'down' | 'stable',
          };
        })
        .sort((a, b) => a.month.localeCompare(b.month));

      // Calculate trend directions
      for (let i = 1; i < monthlyTrends.length; i++) {
        const current = monthlyTrends[i];
        const previous = monthlyTrends[i - 1];

        const revenueChange = (current.revenue - previous.revenue) / Math.max(previous.revenue, 1);

        if (revenueChange > 0.1) {
          current.trend_direction = 'up';
        } else if (revenueChange < -0.1) {
          current.trend_direction = 'down';
        } else {
          current.trend_direction = 'stable';
        }
      }

      // Identify seasonal patterns
      const seasonalPatterns: SeasonalPattern[] = [
        {
          season: 'Winter (Dec-Feb)',
          months: ['December', 'January', 'February'],
          avg_jobs_per_month: 0,
          avg_revenue_per_month: 0,
          peak_indicator: false,
        },
        {
          season: 'Spring (Mar-May)',
          months: ['March', 'April', 'May'],
          avg_jobs_per_month: 0,
          avg_revenue_per_month: 0,
          peak_indicator: false,
        },
        {
          season: 'Summer (Jun-Aug)',
          months: ['June', 'July', 'August'],
          avg_jobs_per_month: 0,
          avg_revenue_per_month: 0,
          peak_indicator: false,
        },
        {
          season: 'Fall (Sep-Nov)',
          months: ['September', 'October', 'November'],
          avg_jobs_per_month: 0,
          avg_revenue_per_month: 0,
          peak_indicator: false,
        },
      ];

      // Calculate seasonal averages
      for (const trend of monthlyTrends) {
        const monthNum = trend.month.split('-')[1];
        const month = parseInt(monthNum, 10);

        let seasonIndex = 0;
        if (month >= 3 && month <= 5) seasonIndex = 1;  // Spring
        else if (month >= 6 && month <= 8) seasonIndex = 2;  // Summer
        else if (month >= 9 && month <= 11) seasonIndex = 3;  // Fall

        seasonalPatterns[seasonIndex].avg_jobs_per_month += trend.job_count;
        seasonalPatterns[seasonIndex].avg_revenue_per_month += trend.revenue;
      }

      // Finalize averages
      const monthsPerSeason = yearsToAnalyze * 3;
      for (const pattern of seasonalPatterns) {
        pattern.avg_jobs_per_month /= monthsPerSeason;
        pattern.avg_revenue_per_month /= monthsPerSeason;
      }

      // Identify peak season
      const maxRevenue = Math.max(...seasonalPatterns.map(s => s.avg_revenue_per_month));
      for (const pattern of seasonalPatterns) {
        if (pattern.avg_revenue_per_month >= maxRevenue * 0.9) {
          pattern.peak_indicator = true;
        }
      }

      // Forecasting
      let forecasts = null;
      if (includeForecasts && monthlyTrends.length >= 6) {
        const recentTrends = monthlyTrends.slice(-6);
        const avgRecentJobs = recentTrends.reduce((sum, t) => sum + t.job_count, 0) / recentTrends.length;
        const avgRecentRevenue = recentTrends.reduce((sum, t) => sum + t.revenue, 0) / recentTrends.length;

        const growthRate = monthlyTrends.length >= 12
          ? (monthlyTrends[monthlyTrends.length - 1].revenue - monthlyTrends[monthlyTrends.length - 12].revenue) /
            Math.max(monthlyTrends[monthlyTrends.length - 12].revenue, 1)
          : 0;

        forecasts = {
          next_month: {
            expected_jobs: Math.round(avgRecentJobs * (1 + growthRate)),
            expected_revenue: avgRecentRevenue * (1 + growthRate),
          },
          next_quarter: {
            expected_jobs: Math.round(avgRecentJobs * 3 * (1 + growthRate)),
            expected_revenue: avgRecentRevenue * 3 * (1 + growthRate),
          },
          growth_rate: growthRate,
          trend: growthRate > 0.05 ? 'Growing' : growthRate < -0.05 ? 'Declining' : 'Stable',
        };
      }

      // Planning recommendations
      const recommendations: string[] = [];
      const peakSeasons = seasonalPatterns.filter(s => s.peak_indicator);

      if (peakSeasons.length > 0) {
        recommendations.push(
          `Peak season identified: ${peakSeasons.map(s => s.season).join(', ')} - ` +
          `plan staffing and inventory accordingly`
        );
      }

      const lowSeasons = seasonalPatterns
        .filter(s => !s.peak_indicator)
        .sort((a, b) => a.avg_revenue_per_month - b.avg_revenue_per_month)
        .slice(0, 2);

      if (lowSeasons.length > 0) {
        recommendations.push(
          `Low season(s): ${lowSeasons.map(s => s.season).join(', ')} - ` +
          `implement promotional campaigns to boost demand`
        );
      }

      if (forecasts && forecasts.growth_rate < 0) {
        recommendations.push('WARNING: Declining trend detected - review market conditions and marketing strategy');
      }

      recommendations.push('Consider implementing seasonal pricing to maximize revenue during peak periods');
      recommendations.push('Schedule preventive maintenance during low seasons to prepare for peak demand');

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        analysis_period: {
          years: yearsToAnalyze,
          start_date: cutoffDate.toISOString(),
          end_date: now.toISOString(),
        },
        service_type_filter: serviceTypeFilter || 'All',
        monthly_trends: monthlyTrends,
        seasonal_patterns: seasonalPatterns,
        peak_season: peakSeasons.map(s => s.season),
        forecasts: forecasts,
        planning_recommendations: recommendations,
        insights: [
          `Peak season: ${peakSeasons.map(s => s.season).join(', ')}`,
          `Seasonal revenue variance: ${((maxRevenue - Math.min(...seasonalPatterns.map(s => s.avg_revenue_per_month))) / maxRevenue * 100).toFixed(1)}%`,
          forecasts ? `Trend: ${forecasts.trend}` : 'Insufficient data for trending',
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
