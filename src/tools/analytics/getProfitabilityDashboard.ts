/**
 * Get Profitability Dashboard - Real-time profitability and KPI dashboard
 * Comprehensive business health metrics with forecasting
 *
 * ENHANCED: Now uses actual invoiced amounts with NET calculations by default
 * Revenue = Invoiced - Credit Memos - Refunds (NET invoiced)
 * Supports toggle to legacy estimate-based reporting for comparison
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { GetConsolidatedFinancialsTool } from '../financials/getConsolidatedFinancials.js';

interface KPIMetric {
  name: string;
  current_value: number;
  previous_value?: number;
  change_percentage?: number;
  trend: 'up' | 'down' | 'stable';
  status: 'excellent' | 'good' | 'warning' | 'critical';
  target?: number;
}

export class GetProfitabilityDashboardTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_profitability_dashboard',
      description: 'Real-time profitability and KPI dashboard with comprehensive business health metrics. DEFAULT: Uses actual invoiced amounts with NET calculations (invoiced - credit_memos - refunds). Set use_invoiced_amounts=false for legacy estimate-based reporting for comparison. Provides forecasting, alerts, and actionable recommendations.',
      inputSchema: {
        type: 'object',
        properties: {
          dashboard_type: {
            type: 'string',
            enum: ['executive', 'operational', 'detailed'],
            default: 'executive',
            description: 'Dashboard detail level',
          },
          use_invoiced_amounts: {
            type: 'boolean',
            default: true,
            description: 'Use actual invoiced amounts with NET calculations (invoiced - credits - refunds). When true, reports real revenue. When false, uses estimates (legacy behavior).',
          },
          include_forecasts: {
            type: 'boolean',
            default: true,
            description: 'Include revenue forecasts',
          },
          refresh_interval: {
            type: 'number',
            default: 3600,
            description: 'Data refresh interval in seconds',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const dashboardType = input.dashboard_type || 'executive';
      const includeForecasts = input.include_forecasts !== false;
      const useInvoicedAmounts = input.use_invoiced_amounts !== false; // Default: true

      // Initialize consolidated financials tool for invoice-based mode
      const consolidatedTool = useInvoicedAmounts ? new GetConsolidatedFinancialsTool() : null;

      // Fetch comprehensive data
      const [jobsResponse, activitiesResponse] = await Promise.all([
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'activities', { size: 100 }),
      ]);

      const jobs = jobsResponse.data?.results || [];
      const activities = activitiesResponse.data?.activity || activitiesResponse.data?.results || [];

      // Calculate financial metrics
      let totalRevenue = 0;
      let approvedRevenue = 0;
      let pendingRevenue = 0;
      let wonJobs = 0;
      let lostJobs = 0;
      let activeJobs = 0;

      const revenueByMonth = new Map<string, number>();
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = now - (60 * 24 * 60 * 60 * 1000);

      let revenueLastMonth = 0;
      let revenuePreviousMonth = 0;

      // MODE 1: INVOICE-BASED REVENUE (uses actual invoiced amounts with NET calculations)
      if (useInvoicedAmounts && consolidatedTool) {
        for (const job of jobs) {
          if (!job.jnid) continue;

          const jobDate = job.date_created || 0;
          const statusName = (job.status_name || '').toLowerCase();

          // Categorize jobs
          if (statusName.includes('complete') || statusName.includes('won') || statusName.includes('sold')) {
            wonJobs += 1;
          } else if (statusName.includes('lost') || statusName.includes('cancelled')) {
            lostJobs += 1;
          } else {
            activeJobs += 1;
          }

          try {
            // Query consolidated financials for this job
            const financialsResponse = await consolidatedTool.execute(
              {
                job_id: job.jnid,
                verbosity: 'compact',
                page_size: 100,
                include_invoices: true,
                include_credit_memos: true,
                include_payments: false, // Don't need payments for revenue calculation
                include_refunds: true,
              },
              context
            );

            // Extract NET invoiced amount (invoiced - credit_memos - refunds)
            const netInvoiced = financialsResponse.summary?.net_invoiced || 0;
            const jobRevenue = netInvoiced;

            if (jobRevenue > 0) {
              totalRevenue += jobRevenue;
              approvedRevenue += jobRevenue;

              // Monthly tracking
              if (jobDate > thirtyDaysAgo) {
                revenueLastMonth += jobRevenue;
              } else if (jobDate > sixtyDaysAgo) {
                revenuePreviousMonth += jobRevenue;
              }

              // Revenue by month
              if (jobDate > 0) {
                const monthKey = new Date(jobDate).toISOString().substring(0, 7);
                revenueByMonth.set(monthKey, (revenueByMonth.get(monthKey) || 0) + jobRevenue);
              }
            }
          } catch (error) {
            // Gracefully handle errors for individual jobs
            console.error(`Error fetching financials for job ${job.jnid}:`, error);
          }
        }
      } else {
        // MODE 2: ESTIMATE-BASED REVENUE (legacy behavior for backward compatibility)
        const estimatesResponse = await this.client.get(context.apiKey, 'estimates', { size: 100 });
        const estimates = estimatesResponse.data?.results || [];

        // Build estimate lookup by job
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

        for (const job of jobs) {
          if (!job.jnid) continue;

          const jobDate = job.date_created || 0;
          const statusName = (job.status_name || '').toLowerCase();

          // Categorize jobs
          if (statusName.includes('complete') || statusName.includes('won') || statusName.includes('sold')) {
            wonJobs += 1;
          } else if (statusName.includes('lost') || statusName.includes('cancelled')) {
            lostJobs += 1;
          } else {
            activeJobs += 1;
          }

          // Calculate revenue
          const jobEstimates = estimatesByJob.get(job.jnid) || [];
          let jobRevenue = 0;

          for (const estimate of jobEstimates) {
            const estimateValue = parseFloat(estimate.total || 0) || 0;
            const estimateStatus = (estimate.status_name || '').toLowerCase();
            const isSigned = estimate.date_signed > 0;
            const isApproved = isSigned || estimateStatus === 'approved' || estimateStatus === 'signed';

            if (isApproved) {
              jobRevenue += estimateValue;
              approvedRevenue += estimateValue;
            } else {
              pendingRevenue += estimateValue;
            }
          }

          totalRevenue += jobRevenue;

          // Monthly tracking
          if (jobDate > thirtyDaysAgo) {
            revenueLastMonth += jobRevenue;
          } else if (jobDate > sixtyDaysAgo) {
            revenuePreviousMonth += jobRevenue;
          }

          // Revenue by month
          if (jobDate > 0) {
            const monthKey = new Date(jobDate).toISOString().substring(0, 7);
            revenueByMonth.set(monthKey, (revenueByMonth.get(monthKey) || 0) + jobRevenue);
          }
        }
      }

      // Calculate KPIs
      const totalJobs = wonJobs + lostJobs + activeJobs;
      const winRate = (wonJobs + lostJobs) > 0 ? (wonJobs / (wonJobs + lostJobs)) * 100 : 0;
      const avgDealSize = wonJobs > 0 ? approvedRevenue / wonJobs : 0;
      const conversionRate = estimates.length > 0
        ? (estimates.filter((e: any) => e.date_signed > 0).length / estimates.length) * 100
        : 0;

      // Activity metrics
      const recentActivities = activities.filter((a: any) => (a.date_created || 0) > thirtyDaysAgo).length;
      const activitiesPerDay = recentActivities / 30;

      // Revenue growth
      const revenueGrowth = revenuePreviousMonth > 0
        ? ((revenueLastMonth - revenuePreviousMonth) / revenuePreviousMonth) * 100
        : 0;

      // Build KPIs
      const kpis: KPIMetric[] = [
        {
          name: 'Total Revenue',
          current_value: totalRevenue,
          previous_value: revenuePreviousMonth,
          change_percentage: revenueGrowth,
          trend: revenueGrowth > 5 ? 'up' : revenueGrowth < -5 ? 'down' : 'stable',
          status: totalRevenue > 50000 ? 'excellent' : totalRevenue > 20000 ? 'good' : 'warning',
        },
        {
          name: 'Win Rate',
          current_value: winRate,
          trend: winRate > 60 ? 'up' : winRate < 40 ? 'down' : 'stable',
          status: winRate > 60 ? 'excellent' : winRate > 40 ? 'good' : winRate > 20 ? 'warning' : 'critical',
          target: 50,
        },
        {
          name: 'Average Deal Size',
          current_value: avgDealSize,
          trend: 'stable',
          status: avgDealSize > 5000 ? 'excellent' : avgDealSize > 2000 ? 'good' : 'warning',
        },
        {
          name: 'Conversion Rate',
          current_value: conversionRate,
          trend: conversionRate > 30 ? 'up' : conversionRate < 15 ? 'down' : 'stable',
          status: conversionRate > 30 ? 'excellent' : conversionRate > 20 ? 'good' : 'warning',
          target: 25,
        },
        {
          name: 'Active Pipeline',
          current_value: activeJobs,
          trend: activeJobs > wonJobs ? 'up' : 'down',
          status: activeJobs > 20 ? 'excellent' : activeJobs > 10 ? 'good' : 'warning',
        },
        {
          name: 'Activities Per Day',
          current_value: activitiesPerDay,
          trend: activitiesPerDay > 5 ? 'up' : activitiesPerDay < 2 ? 'down' : 'stable',
          status: activitiesPerDay > 5 ? 'excellent' : activitiesPerDay > 3 ? 'good' : 'warning',
        },
      ];

      // Forecasting
      let forecast = null;
      if (includeForecasts && revenueByMonth.size >= 3) {
        const monthlyValues = Array.from(revenueByMonth.values()).slice(-3);
        const avgMonthlyRevenue = monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length;
        const trend = monthlyValues[2] > monthlyValues[0] ? 'growth' : 'decline';
        const growthRate = monthlyValues[0] > 0 ? (monthlyValues[2] - monthlyValues[0]) / monthlyValues[0] : 0;

        forecast = {
          next_month_projection: avgMonthlyRevenue * (1 + growthRate),
          next_quarter_projection: avgMonthlyRevenue * 3 * (1 + growthRate),
          trend,
          confidence: 'medium',
        };
      }

      // Health score
      const healthScore = kpis.reduce((score, kpi) => {
        if (kpi.status === 'excellent') return score + 25;
        if (kpi.status === 'good') return score + 15;
        if (kpi.status === 'warning') return score + 5;
        return score;
      }, 0) / kpis.length;

      let overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
      if (healthScore > 20) overallHealth = 'excellent';
      else if (healthScore > 15) overallHealth = 'good';
      else if (healthScore > 10) overallHealth = 'fair';
      else overallHealth = 'poor';

      return {
        data_source: 'Live JobNimbus API data',
        dashboard_timestamp: new Date().toISOString(),
        dashboard_type: dashboardType,
        overall_health: {
          score: Math.round(healthScore),
          status: overallHealth,
          summary: this.getHealthSummary(overallHealth, kpis),
        },
        financial_summary: {
          total_revenue: totalRevenue,
          approved_revenue: approvedRevenue,
          pending_revenue: pendingRevenue,
          revenue_last_30_days: revenueLastMonth,
          revenue_previous_30_days: revenuePreviousMonth,
          revenue_growth_rate: revenueGrowth,
        },
        pipeline_summary: {
          total_jobs: totalJobs,
          won_jobs: wonJobs,
          lost_jobs: lostJobs,
          active_jobs: activeJobs,
          win_rate: winRate,
        },
        key_performance_indicators: kpis,
        forecast: forecast,
        alerts: this.generateAlerts(kpis, pendingRevenue, activeJobs),
        recommendations: this.generateRecommendations(kpis, revenueGrowth, winRate),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }

  private getHealthSummary(health: string, kpis: KPIMetric[]): string {
    const excellentKPIs = kpis.filter(k => k.status === 'excellent').length;
    const criticalKPIs = kpis.filter(k => k.status === 'critical').length;

    if (health === 'excellent') {
      return `Business performing excellently with ${excellentKPIs}/${kpis.length} KPIs at target`;
    } else if (health === 'good') {
      return `Business performing well with room for improvement`;
    } else if (health === 'fair') {
      return `Business showing mixed results - attention needed in key areas`;
    } else {
      return `Business requires immediate attention - ${criticalKPIs} critical KPIs`;
    }
  }

  private generateAlerts(kpis: KPIMetric[], pendingRevenue: number, activeJobs: number): string[] {
    const alerts: string[] = [];

    for (const kpi of kpis) {
      if (kpi.status === 'critical') {
        alerts.push(`CRITICAL: ${kpi.name} at ${kpi.current_value.toFixed(1)} - immediate action required`);
      } else if (kpi.status === 'warning') {
        alerts.push(`WARNING: ${kpi.name} below target at ${kpi.current_value.toFixed(1)}`);
      }
    }

    if (pendingRevenue > 0 && activeJobs > 0) {
      alerts.push(`OPPORTUNITY: $${pendingRevenue.toFixed(2)} in pending estimates across ${activeJobs} active jobs`);
    }

    if (alerts.length === 0) {
      alerts.push('All systems operating normally');
    }

    return alerts;
  }

  private generateRecommendations(kpis: KPIMetric[], revenueGrowth: number, winRate: number): string[] {
    const recommendations: string[] = [];

    if (revenueGrowth < 0) {
      recommendations.push('Focus on lead generation - revenue declining month-over-month');
    }

    if (winRate < 40) {
      recommendations.push('Improve sales process - win rate below industry standard (40%)');
    }

    const activitiesKPI = kpis.find(k => k.name === 'Activities Per Day');
    if (activitiesKPI && activitiesKPI.current_value < 3) {
      recommendations.push('Increase sales activity - current level is below optimal');
    }

    const conversionKPI = kpis.find(k => k.name === 'Conversion Rate');
    if (conversionKPI && conversionKPI.current_value < 20) {
      recommendations.push('Optimize estimate follow-up process to improve conversion rate');
    }

    if (recommendations.length === 0) {
      recommendations.push('Maintain current strategies - performance is healthy');
    }

    return recommendations;
  }
}
