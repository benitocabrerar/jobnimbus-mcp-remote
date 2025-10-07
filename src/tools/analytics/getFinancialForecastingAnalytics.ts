/**
 * Get Financial Forecasting Analytics
 * Comprehensive financial forecasting with revenue predictions, cash flow analysis, and financial health indicators
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface FinancialMetrics {
  current_mrr: number;
  projected_next_month_revenue: number;
  yoy_growth_rate: number;
  avg_monthly_revenue: number;
  total_revenue_ytd: number;
  total_expenses_ytd: number;
  net_profit_ytd: number;
  profit_margin: number;
  cash_flow_health: 'Excellent' | 'Good' | 'Fair' | 'Critical';
}

interface RevenueForecast {
  period: string;
  forecast_type: 'Conservative' | 'Likely' | 'Optimistic';
  projected_revenue: number;
  confidence_level: number;
  based_on: string;
  growth_rate: number;
}

interface CashFlowProjection {
  month: string;
  projected_inflow: number;
  projected_outflow: number;
  net_cash_flow: number;
  cumulative_cash: number;
  burn_rate: number;
  runway_months: number;
}

interface FinancialHealthIndicator {
  indicator_name: string;
  current_value: number;
  target_value: number;
  status: 'Healthy' | 'Warning' | 'Critical';
  trend: 'Improving' | 'Stable' | 'Declining';
  recommendation: string;
}

interface ProfitabilityTrend {
  month: string;
  revenue: number;
  costs: number;
  gross_profit: number;
  net_profit: number;
  profit_margin: number;
  trend_direction: 'Up' | 'Stable' | 'Down';
}

interface ScenarioAnalysis {
  scenario: 'Best Case' | 'Base Case' | 'Worst Case';
  probability: number;
  projected_revenue_next_quarter: number;
  projected_profit: number;
  key_assumptions: string[];
  risk_factors: string[];
}

interface FinancialRisk {
  risk_type: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  impact_amount: number;
  likelihood: number;
  mitigation_strategy: string;
  priority: number;
}

export class GetFinancialForecastingAnalyticsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_financial_forecasting_analytics',
      description: 'Comprehensive financial forecasting with revenue predictions, cash flow projections, profitability analysis, financial health indicators, scenario planning, and risk assessment',
      inputSchema: {
        type: 'object',
        properties: {
          forecast_months: {
            type: 'number',
            default: 12,
            description: 'Months to forecast (default: 12)',
          },
          include_scenarios: {
            type: 'boolean',
            default: true,
            description: 'Include scenario analysis',
          },
          include_risk_assessment: {
            type: 'boolean',
            default: true,
            description: 'Include financial risk assessment',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const forecastMonths = input.forecast_months || 12;
      const includeScenarios = input.include_scenarios !== false;
      const includeRiskAssessment = input.include_risk_assessment !== false;

      const [jobsResponse] = await Promise.all([
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        // this.client.get(context.apiKey, 'estimates', { size: 100 }),
      ]);

      const jobs = jobsResponse.data?.results || [];
      // const estimates = estimatesResponse.data?.results || [];

      const now = Date.now();
      const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);

      // Calculate monthly revenue
      const monthlyRevenue = new Map<string, number>();
      let totalRevenueYTD = 0;

      for (const job of jobs) {
        const status = (job.status_name || '').toLowerCase();
        if (!status.includes('complete') && !status.includes('won')) continue;

        const completedDate = job.date_status_change || job.date_updated || 0;
        if (completedDate === 0) continue;

        const monthKey = new Date(completedDate).toISOString().slice(0, 7);
        const revenue = parseFloat(job.total || job.value || 0);

        if (!monthlyRevenue.has(monthKey)) {
          monthlyRevenue.set(monthKey, 0);
        }
        monthlyRevenue.set(monthKey, monthlyRevenue.get(monthKey)! + revenue);

        if (completedDate >= oneYearAgo) {
          totalRevenueYTD += revenue;
        }
      }

      // Sort months
      const sortedMonths = Array.from(monthlyRevenue.keys()).sort();
      const recentMonths = sortedMonths.slice(-6);

      // Current MRR
      const currentMRR = recentMonths.length > 0
        ? monthlyRevenue.get(recentMonths[recentMonths.length - 1]) || 0
        : 0;

      // Average monthly revenue
      const avgMonthlyRevenue = recentMonths.length > 0
        ? recentMonths.reduce((sum, month) => sum + (monthlyRevenue.get(month) || 0), 0) / recentMonths.length
        : 0;

      // Growth rate (comparing last 3 months to previous 3 months)
      const last3Months = recentMonths.slice(-3);
      const prev3Months = recentMonths.slice(-6, -3);

      const avgLast3 = last3Months.length > 0
        ? last3Months.reduce((sum, m) => sum + (monthlyRevenue.get(m) || 0), 0) / last3Months.length
        : 0;

      const avgPrev3 = prev3Months.length > 0
        ? prev3Months.reduce((sum, m) => sum + (monthlyRevenue.get(m) || 0), 0) / prev3Months.length
        : 0;

      const growthRate = avgPrev3 > 0 ? ((avgLast3 - avgPrev3) / avgPrev3) * 100 : 0;

      // Estimate expenses (40% of revenue for simplicity)
      const totalExpensesYTD = totalRevenueYTD * 0.4;
      const netProfitYTD = totalRevenueYTD - totalExpensesYTD;
      const profitMargin = totalRevenueYTD > 0 ? (netProfitYTD / totalRevenueYTD) * 100 : 0;

      // Cash flow health
      const cashFlowHealth: 'Excellent' | 'Good' | 'Fair' | 'Critical' =
        profitMargin >= 30 ? 'Excellent' :
        profitMargin >= 20 ? 'Good' :
        profitMargin >= 10 ? 'Fair' : 'Critical';

      const financialMetrics: FinancialMetrics = {
        current_mrr: currentMRR,
        projected_next_month_revenue: avgMonthlyRevenue * (1 + growthRate / 100),
        yoy_growth_rate: growthRate,
        avg_monthly_revenue: avgMonthlyRevenue,
        total_revenue_ytd: totalRevenueYTD,
        total_expenses_ytd: totalExpensesYTD,
        net_profit_ytd: netProfitYTD,
        profit_margin: profitMargin,
        cash_flow_health: cashFlowHealth,
      };

      // Revenue forecasts
      const revenueForecasts: RevenueForecast[] = [];
      const monthlyGrowthRate = growthRate / 100 / 12;

      // Conservative
      revenueForecasts.push({
        period: 'Next Quarter (3 months)',
        forecast_type: 'Conservative',
        projected_revenue: avgMonthlyRevenue * 3 * (1 + monthlyGrowthRate * 0.5),
        confidence_level: 80,
        based_on: 'Historical avg with 50% growth rate',
        growth_rate: growthRate * 0.5,
      });

      // Likely
      revenueForecasts.push({
        period: 'Next Quarter (3 months)',
        forecast_type: 'Likely',
        projected_revenue: avgMonthlyRevenue * 3 * (1 + monthlyGrowthRate),
        confidence_level: 65,
        based_on: 'Historical avg with current growth rate',
        growth_rate: growthRate,
      });

      // Optimistic
      revenueForecasts.push({
        period: 'Next Quarter (3 months)',
        forecast_type: 'Optimistic',
        projected_revenue: avgMonthlyRevenue * 3 * (1 + monthlyGrowthRate * 1.5),
        confidence_level: 50,
        based_on: 'Historical avg with 150% growth rate',
        growth_rate: growthRate * 1.5,
      });

      // Cash flow projections
      const cashFlowProjections: CashFlowProjection[] = [];
      let cumulativeCash = netProfitYTD;

      for (let i = 0; i < forecastMonths; i++) {
        const monthDate = new Date(now);
        monthDate.setMonth(monthDate.getMonth() + i + 1);
        const monthKey = monthDate.toISOString().slice(0, 7);

        const projectedInflow = avgMonthlyRevenue * (1 + (monthlyGrowthRate * i));
        const projectedOutflow = projectedInflow * 0.4; // 40% expenses
        const netCashFlow = projectedInflow - projectedOutflow;

        cumulativeCash += netCashFlow;

        const burnRate = projectedOutflow;
        const runwayMonths = burnRate > 0 ? cumulativeCash / burnRate : 999;

        cashFlowProjections.push({
          month: monthKey,
          projected_inflow: projectedInflow,
          projected_outflow: projectedOutflow,
          net_cash_flow: netCashFlow,
          cumulative_cash: cumulativeCash,
          burn_rate: burnRate,
          runway_months: Math.min(runwayMonths, 999),
        });
      }

      // Financial health indicators
      const financialHealthIndicators: FinancialHealthIndicator[] = [
        {
          indicator_name: 'Profit Margin',
          current_value: profitMargin,
          target_value: 25,
          status: profitMargin >= 25 ? 'Healthy' : profitMargin >= 15 ? 'Warning' : 'Critical',
          trend: growthRate > 0 ? 'Improving' : growthRate < -5 ? 'Declining' : 'Stable',
          recommendation: profitMargin < 25 ? 'Optimize costs or increase pricing' : 'Maintain current trajectory',
        },
        {
          indicator_name: 'Revenue Growth Rate',
          current_value: growthRate,
          target_value: 20,
          status: growthRate >= 20 ? 'Healthy' : growthRate >= 10 ? 'Warning' : 'Critical',
          trend: growthRate > 0 ? 'Improving' : 'Declining',
          recommendation: growthRate < 20 ? 'Invest in sales and marketing' : 'Continue scaling',
        },
        {
          indicator_name: 'Cash Runway',
          current_value: cashFlowProjections[0]?.runway_months || 0,
          target_value: 12,
          status: cashFlowProjections[0]?.runway_months >= 12 ? 'Healthy' :
                  cashFlowProjections[0]?.runway_months >= 6 ? 'Warning' : 'Critical',
          trend: 'Stable',
          recommendation: cashFlowProjections[0]?.runway_months < 12 ? 'Raise capital or reduce burn' : 'Healthy cash position',
        },
      ];

      // Profitability trends
      const profitabilityTrends: ProfitabilityTrend[] = [];
      for (const month of recentMonths.slice(-6)) {
        const revenue = monthlyRevenue.get(month) || 0;
        const costs = revenue * 0.4;
        const grossProfit = revenue - costs;
        const netProfit = grossProfit;
        const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

        profitabilityTrends.push({
          month: month,
          revenue: revenue,
          costs: costs,
          gross_profit: grossProfit,
          net_profit: netProfit,
          profit_margin: margin,
          trend_direction: 'Stable',
        });
      }

      // Scenario analysis
      const scenarioAnalyses: ScenarioAnalysis[] = [];
      if (includeScenarios) {
        scenarioAnalyses.push({
          scenario: 'Best Case',
          probability: 20,
          projected_revenue_next_quarter: avgMonthlyRevenue * 3 * 1.5,
          projected_profit: avgMonthlyRevenue * 3 * 1.5 * 0.6,
          key_assumptions: ['All deals close', 'High market demand', 'No competition'],
          risk_factors: ['Overexpansion', 'Quality issues'],
        });

        scenarioAnalyses.push({
          scenario: 'Base Case',
          probability: 60,
          projected_revenue_next_quarter: avgMonthlyRevenue * 3,
          projected_profit: avgMonthlyRevenue * 3 * 0.6,
          key_assumptions: ['Normal win rate', 'Stable market'],
          risk_factors: ['Competition', 'Economic headwinds'],
        });

        scenarioAnalyses.push({
          scenario: 'Worst Case',
          probability: 20,
          projected_revenue_next_quarter: avgMonthlyRevenue * 3 * 0.7,
          projected_profit: avgMonthlyRevenue * 3 * 0.7 * 0.6,
          key_assumptions: ['Low conversion', 'Market downturn'],
          risk_factors: ['Loss of key clients', 'Recession'],
        });
      }

      // Financial risks
      const financialRisks: FinancialRisk[] = [];
      if (includeRiskAssessment) {
        if (profitMargin < 20) {
          financialRisks.push({
            risk_type: 'Low Profit Margin',
            severity: 'High',
            impact_amount: totalRevenueYTD * 0.1,
            likelihood: 80,
            mitigation_strategy: 'Review pricing and reduce costs',
            priority: 1,
          });
        }

        if (growthRate < 10) {
          financialRisks.push({
            risk_type: 'Slow Growth',
            severity: 'Medium',
            impact_amount: avgMonthlyRevenue * 12 * 0.2,
            likelihood: 60,
            mitigation_strategy: 'Increase sales and marketing investment',
            priority: 2,
          });
        }
      }

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        financial_metrics: financialMetrics,
        revenue_forecasts: revenueForecasts,
        cash_flow_projections: cashFlowProjections.slice(0, 12),
        financial_health_indicators: financialHealthIndicators,
        profitability_trends: profitabilityTrends,
        scenario_analyses: includeScenarios ? scenarioAnalyses : undefined,
        financial_risks: includeRiskAssessment ? financialRisks : undefined,
        key_insights: [
          `Current MRR: $${currentMRR.toLocaleString()}`,
          `Growth rate: ${growthRate.toFixed(1)}%`,
          `Profit margin: ${profitMargin.toFixed(1)}%`,
          `Cash runway: ${cashFlowProjections[0]?.runway_months.toFixed(0)} months`,
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
