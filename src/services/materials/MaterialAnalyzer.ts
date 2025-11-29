/**
 * Material Analyzer - Core Orchestrator
 * Main service that orchestrates all material analysis operations
 */

import materialDataRepository from './MaterialDataRepository.js';
import materialStatistics from './MaterialStatistics.js';
import materialForecasting from './MaterialForecasting.js';
import supplierAnalyzer from './SupplierAnalyzer.js';

import {
  MaterialRecord,
  MaterialAggregate,
  TrendDataPoint,
  DateRange,
  InventoryInsight,
  GetEstimateMaterialsOutput,
  AnalyzeMaterialCostsInput,
  AnalyzeMaterialCostsOutput,
  GetMaterialUsageReportInput,
  GetMaterialUsageReportOutput,
  GetSupplierComparisonInput,
  GetSupplierComparisonOutput,
  GetMaterialInventoryInsightsInput,
  GetMaterialInventoryInsightsOutput,
} from '../../types/materials.js';
import { getPeriodKey, getDaysSince, getMonthsBetween } from '../../utils/dateHelpers.js';
import { ensureDataAvailable } from '../../utils/validation.js';

export class MaterialAnalyzer {
  /**
   * Analyze materials for a specific estimate
   * @param apiKey - JobNimbus API key
   * @param estimateId - Estimate ID
   * @param includeLabor - Include labor items
   * @param includeCostAnalysis - Include detailed cost analysis
   * @returns Estimate materials analysis
   */
  async analyzeEstimateMaterials(
    apiKey: string,
    estimateId: string,
    includeLabor: boolean = false,
    includeCostAnalysis: boolean = false
  ): Promise<GetEstimateMaterialsOutput> {
    // Fetch estimate
    const estimate = await materialDataRepository.getEstimate(apiKey, estimateId);

    // Transform to material records
    let materials = materialDataRepository.transformToMaterialRecords(estimate);

    // Filter by type
    if (!includeLabor) {
      materials = materials.filter(m => m.item_type === 'material');
    }

    ensureDataAvailable(materials, 'estimate materials');

    // Calculate summary with null-safe aggregations
    const totalMaterials = materials.length;
    const totalQuantity = materials.reduce((sum, m) => sum + (m.quantity ?? 0), 0);
    const totalCost = materials.reduce((sum, m) => sum + (m.total_cost ?? 0), 0);
    const totalRevenue = materials.reduce((sum, m) => sum + (m.total_price ?? 0), 0);
    const totalMargin = totalRevenue - totalCost;
    const avgMarginPercent = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

    // Material breakdown by category
    const categoryGroups = materialStatistics.groupByCategory(materials);
    const materialBreakdown = Array.from(categoryGroups.entries()).map(
      ([category, records]) => {
        const catCost = records.reduce((sum, r) => sum + (r.total_cost ?? 0), 0);
        const catRevenue = records.reduce((sum, r) => sum + (r.total_price ?? 0), 0);
        const catMargin = catRevenue - catCost;

        return {
          category,
          count: records.length,
          cost: catCost,
          revenue: catRevenue,
          margin: catMargin,
        };
      }
    );

    const output: GetEstimateMaterialsOutput = {
      estimate_id: estimate.jnid,
      estimate_number: estimate.number || '',
      estimate_status: estimate.status_name || '',
      materials,
      summary: {
        total_materials: totalMaterials,
        total_quantity: totalQuantity,
        total_cost: totalCost,
        total_revenue: totalRevenue,
        total_margin: totalMargin,
        avg_margin_percent: avgMarginPercent,
        material_breakdown: materialBreakdown,
      },
    };

    // Add cost analysis if requested
    if (includeCostAnalysis) {
      const sorted = [...materials].sort((a, b) => b.margin_percent - a.margin_percent);

      output.cost_analysis = {
        high_margin_items: sorted.slice(0, Math.min(5, sorted.length)),
        low_margin_items: sorted.slice(-Math.min(5, sorted.length)).reverse(),
        high_cost_items: [...materials]
          .sort((a, b) => b.total_cost - a.total_cost)
          .slice(0, Math.min(5, materials.length)),
      };
    }

    return output;
  }

  /**
   * Analyze material costs over a period
   * @param apiKey - JobNimbus API key
   * @param input - Analysis input parameters
   * @returns Material cost analysis
   */
  async analyzeMaterialCosts(
    apiKey: string,
    input: AnalyzeMaterialCostsInput
  ): Promise<AnalyzeMaterialCostsOutput> {
    const dateRange: DateRange = {
      date_from: input.date_from,
      date_to: input.date_to,
    };

    // Fetch material records
    const records = await materialDataRepository.getMaterialRecords(apiKey, dateRange, {
      includeLabor: false,
      jobType: input.job_type,
      materialCategories: input.material_categories,
    });

    ensureDataAvailable(records, 'material cost analysis');

    // Count unique estimates
    const uniqueEstimates = new Set(records.map(r => r.estimate_id));

    // Calculate summary
    const totalCost = records.reduce((sum, r) => sum + r.total_cost, 0);
    const totalRevenue = records.reduce((sum, r) => sum + r.total_price, 0);
    const totalMargin = totalRevenue - totalCost;
    const avgMarginPercent = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

    // Aggregate materials
    const aggregates = materialStatistics.aggregateMaterials(records);

    // Filter by min usage count
    const minUsage = input.min_usage_count || 1;
    const filteredAggregates = Array.from(aggregates.values()).filter(
      a => a.usage_count >= minUsage
    );

    // Calculate material analysis with statistics
    const materialAnalysis = filteredAggregates.map(aggregate => {
      const materialRecords = records.filter(r => r.name === aggregate.material_name);

      const costs = materialRecords.map(r => r.cost);
      const prices = materialRecords.map(r => r.price);
      const margins = materialRecords.map(r => r.margin_percent);

      const analysis: any = {
        material_name: aggregate.material_name,
        aggregate,
        statistics: {
          cost: materialStatistics.calculateStatistics(costs),
          price: materialStatistics.calculateStatistics(prices),
          margin: materialStatistics.calculateStatistics(margins),
        },
      };

      // Add trend data if requested
      if (input.include_trends) {
        analysis.trend = this.calculateTrendData(
          materialRecords,
          input.date_from,
          input.date_to
        );
      }

      return analysis;
    });

    // Identify high and low performers
    const sortedByMargin = [...filteredAggregates].sort(
      (a, b) => b.total_margin - a.total_margin
    );

    const highPerformers = sortedByMargin.slice(0, Math.min(10, sortedByMargin.length));
    const lowPerformers = sortedByMargin
      .slice(-Math.min(10, sortedByMargin.length))
      .reverse();

    // Generate recommendations
    const recommendations = this.generateCostRecommendations(
      filteredAggregates,
      records
    );

    return {
      period: dateRange,
      summary: {
        total_estimates: uniqueEstimates.size,
        total_materials: records.length,
        total_cost: totalCost,
        total_revenue: totalRevenue,
        total_margin: totalMargin,
        avg_margin_percent: avgMarginPercent,
      },
      material_analysis: materialAnalysis,
      high_performers: highPerformers,
      low_performers: lowPerformers,
      recommendations,
    };
  }

  /**
   * Get material usage report
   * @param apiKey - JobNimbus API key
   * @param input - Report input parameters
   * @returns Material usage report
   */
  async getMaterialUsageReport(
    apiKey: string,
    input: GetMaterialUsageReportInput
  ): Promise<GetMaterialUsageReportOutput> {
    const dateRange: DateRange = {
      date_from: input.date_from,
      date_to: input.date_to,
    };

    // Fetch material records
    let records = await materialDataRepository.getMaterialRecords(apiKey, dateRange, {
      includeLabor: false,
    });

    // Apply filters
    if (input.material_name) {
      records = records.filter(
        r => r.name?.toLowerCase().includes(input.material_name!.toLowerCase())
      );
    }

    if (input.sku) {
      records = records.filter(r => r.sku === input.sku);
    }

    if (input.category) {
      records = records.filter(r => r.category === input.category);
    }

    ensureDataAvailable(records, 'material usage report');

    // Group by material
    const aggregates = materialStatistics.aggregateMaterials(records);

    const materials = Array.from(aggregates.values()).map(aggregate => {
      const materialRecords = records.filter(r => r.name === aggregate.material_name);

      // Calculate usage statistics
      const usageStatistics = {
        total_quantity: aggregate.total_quantity,
        usage_count: aggregate.usage_count,
        avg_quantity_per_use: aggregate.total_quantity / aggregate.usage_count,
        total_cost: aggregate.total_cost,
        avg_cost_per_unit: aggregate.avg_unit_cost,
      };

      // Calculate trend data
      const aggregateBy = input.aggregate_by || 'month';
      const trendData = this.calculateTrendData(materialRecords, input.date_from, input.date_to, aggregateBy);

      const result: any = {
        material_name: aggregate.material_name,
        sku: aggregate.sku,
        category: aggregate.category,
        usage_statistics: usageStatistics,
        trend_data: trendData,
      };

      // Add forecast if requested
      if (input.include_forecast && trendData.length >= 3) {
        const forecastPeriods = 3;
        const forecasts = materialForecasting.forecastUsage(trendData, forecastPeriods);
        result.forecast = forecasts;
      }

      return result;
    });

    return {
      filters: {
        material_name: input.material_name,
        sku: input.sku,
        category: input.category,
        date_range: dateRange,
      },
      materials,
    };
  }

  /**
   * Get supplier comparison
   * @param apiKey - JobNimbus API key
   * @param input - Comparison input parameters
   * @returns Supplier comparison
   */
  async getSupplierComparison(
    apiKey: string,
    input: GetSupplierComparisonInput
  ): Promise<GetSupplierComparisonOutput> {
    const dateRange: DateRange = {
      date_from: input.date_from,
      date_to: input.date_to,
    };

    // Fetch material records
    const records = await materialDataRepository.getMaterialRecords(apiKey, dateRange, {
      includeLabor: false,
    });

    ensureDataAvailable(records, 'supplier comparison');

    // Compare suppliers
    const comparison = supplierAnalyzer.compareSuppliers(records, dateRange, {
      materialName: input.material_name,
      sku: input.sku,
      category: input.category,
      minPurchases: input.min_purchases || 1,
    });

    // Generate recommendations
    const recommendations = supplierAnalyzer.generateRecommendations(
      comparison.suppliers
    );

    // Calculate price trends per supplier
    const priceTrends = comparison.suppliers.map(supplier => {
      const supplierRecords = records.filter(r => r.supplier === supplier.supplier_name);
      const trendData = this.calculateTrendData(
        supplierRecords,
        input.date_from,
        input.date_to
      );

      return {
        supplier_name: supplier.supplier_name,
        trend_data: trendData,
      };
    });

    return {
      material: input.material_name || input.sku || input.category || 'All Materials',
      period: dateRange,
      suppliers: comparison.suppliers,
      comparison: {
        best_price_supplier: comparison.bestSupplier || '',
        worst_price_supplier: comparison.worstSupplier || '',
        price_difference_percent: comparison.priceDifference,
        potential_savings: comparison.potentialSavings,
      },
      recommendations,
      price_trends: priceTrends,
    };
  }

  /**
   * Get material inventory insights
   * @param apiKey - JobNimbus API key
   * @param input - Insights input parameters
   * @returns Inventory insights
   */
  async getInventoryInsights(
    apiKey: string,
    input: GetMaterialInventoryInsightsInput
  ): Promise<GetMaterialInventoryInsightsOutput> {
    const dateRange: DateRange = {
      date_from: input.date_from,
      date_to: input.date_to,
    };

    // Fetch material records
    let records = await materialDataRepository.getMaterialRecords(apiKey, dateRange, {
      includeLabor: false,
      materialCategories: input.category ? [input.category] : undefined,
    });

    ensureDataAvailable(records, 'inventory insights');

    // Calculate months in period
    const months = getMonthsBetween(input.date_from, input.date_to);

    // Aggregate materials
    const aggregates = materialStatistics.aggregateMaterials(records);

    // Filter by min usage count
    const minUsage = input.min_usage_count || 1;
    const filteredAggregates = Array.from(aggregates.values()).filter(
      a => a.usage_count >= minUsage
    );

    // Generate insights
    const insights: InventoryInsight[] = filteredAggregates.map(aggregate => {
      const materialRecords = records.filter(r => r.name === aggregate.material_name);

      // Calculate monthly usage
      const avgMonthlyUsage = aggregate.total_quantity / months;

      // Detect usage trend
      const usageTrend = materialStatistics.detectTrend(
        materialRecords.map(r => r.quantity)
      );

      // Calculate cost volatility
      const costs = materialRecords.map(r => r.cost);
      const costVolatility = materialStatistics.coefficientOfVariation(costs);

      const lastUsed = aggregate.last_used;
      const daysSinceLastUse = getDaysSince(lastUsed);

      // Generate reorder recommendation
      const reorderRecommendation = this.generateReorderRecommendation(
        avgMonthlyUsage,
        usageTrend,
        daysSinceLastUse,
        input.low_stock_threshold || 30
      );

      return {
        material_name: aggregate.material_name,
        sku: aggregate.sku,
        category: aggregate.category,
        avg_monthly_usage: avgMonthlyUsage,
        usage_trend: usageTrend,
        reorder_recommendation: reorderRecommendation,
        cost_analysis: {
          avg_cost: aggregate.avg_unit_cost,
          cost_volatility: costVolatility,
          last_cost: costs[costs.length - 1] || 0,
        },
        last_used: lastUsed,
        days_since_last_use: daysSinceLastUse,
      };
    });

    // Calculate summary
    const needsReorder = insights.filter(i => i.reorder_recommendation.should_reorder).length;
    const highVelocity = insights.filter(i => i.usage_trend === 'increasing').length;
    const slowMoving = insights.filter(i => i.usage_trend === 'decreasing').length;
    const inactive = insights.filter(i => i.days_since_last_use > 90).length;

    // Generate alerts
    const alerts = this.generateInventoryAlerts(insights, input.low_stock_threshold || 30);

    // Generate reorder schedule
    const reorderSchedule = this.generateReorderSchedule(insights);

    return {
      period: dateRange,
      insights,
      summary: {
        total_materials: insights.length,
        materials_needing_reorder: needsReorder,
        high_velocity_materials: highVelocity,
        slow_moving_materials: slowMoving,
        inactive_materials: inactive,
      },
      alerts,
      reorder_schedule: reorderSchedule,
    };
  }

  /**
   * Calculate trend data for materials
   * @param records - Material records
   * @param dateFrom - Start date
   * @param dateTo - End date
   * @param aggregateBy - Aggregation period
   * @returns Trend data points
   */
  private calculateTrendData(
    records: MaterialRecord[],
    _dateFrom?: string,
    _dateTo?: string,
    aggregateBy: 'day' | 'week' | 'month' = 'month'
  ): TrendDataPoint[] {
    const periodMap = new Map<string, { value: number; count: number }>();

    for (const record of records) {
      const period = getPeriodKey(record.date_created, aggregateBy);

      if (!periodMap.has(period)) {
        periodMap.set(period, { value: 0, count: 0 });
      }

      const data = periodMap.get(period)!;
      data.value += record.quantity;
      data.count += 1;
    }

    const trendData: TrendDataPoint[] = Array.from(periodMap.entries())
      .map(([period, data]) => ({
        period,
        value: data.value,
        count: data.count,
        average: data.value / data.count,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return trendData;
  }

  /**
   * Generate cost recommendations
   * @param aggregates - Material aggregates
   * @param records - Material records
   * @returns Array of recommendations
   */
  private generateCostRecommendations(
    aggregates: MaterialAggregate[],
    _records: MaterialRecord[]
  ): Array<{
    type: 'cost_reduction' | 'pricing_increase' | 'supplier_change' | 'discontinue';
    material_name: string;
    current_metric: number;
    suggested_metric: number;
    potential_impact: number;
    reason: string;
  }> {
    const recommendations: Array<any> = [];

    for (const aggregate of aggregates) {
      // Low margin - suggest price increase
      if (aggregate.avg_margin_percent < 20 && aggregate.total_revenue > 1000) {
        const targetMargin = 25;
        const currentPrice = aggregate.avg_unit_price;
        const suggestedPrice = aggregate.avg_unit_cost / (1 - targetMargin / 100);
        const impact = (suggestedPrice - currentPrice) * aggregate.total_quantity;

        recommendations.push({
          type: 'pricing_increase',
          material_name: aggregate.material_name,
          current_metric: aggregate.avg_margin_percent,
          suggested_metric: targetMargin,
          potential_impact: impact,
          reason: `Low margin (${aggregate.avg_margin_percent.toFixed(1)}%). Consider increasing price to achieve ${targetMargin}% margin.`,
        });
      }

      // Low usage - suggest discontinuation
      if (aggregate.usage_count < 3 && aggregate.total_margin < 0) {
        recommendations.push({
          type: 'discontinue',
          material_name: aggregate.material_name,
          current_metric: aggregate.usage_count,
          suggested_metric: 0,
          potential_impact: Math.abs(aggregate.total_margin),
          reason: `Low usage (${aggregate.usage_count} times) with negative margin. Consider discontinuing.`,
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate reorder recommendation
   * @param avgMonthlyUsage - Average monthly usage
   * @param usageTrend - Usage trend
   * @param daysSinceLastUse - Days since last use
   * @param threshold - Low stock threshold in days
   * @returns Reorder recommendation
   */
  private generateReorderRecommendation(
    avgMonthlyUsage: number,
    usageTrend: 'increasing' | 'decreasing' | 'stable',
    daysSinceLastUse: number,
    threshold: number
  ): {
    should_reorder: boolean;
    suggested_quantity: number;
    reason: string;
  } {
    // Calculate daily usage
    const dailyUsage = avgMonthlyUsage / 30;

    // Adjust for trend
    let multiplier = 1;
    if (usageTrend === 'increasing') multiplier = 1.5;
    if (usageTrend === 'decreasing') multiplier = 0.7;

    // Suggest reorder if approaching threshold
    const daysOfSupply = dailyUsage > 0 ? 1 / dailyUsage : Infinity;

    if (daysOfSupply < threshold || daysSinceLastUse > 90) {
      const suggestedQuantity = Math.ceil(dailyUsage * threshold * multiplier);

      return {
        should_reorder: true,
        suggested_quantity: suggestedQuantity,
        reason: `Stock running low. Daily usage: ${dailyUsage.toFixed(2)}. Trend: ${usageTrend}.`,
      };
    }

    return {
      should_reorder: false,
      suggested_quantity: 0,
      reason: 'Sufficient stock available',
    };
  }

  /**
   * Generate inventory alerts
   * @param insights - Inventory insights
   * @param threshold - Low stock threshold
   * @returns Array of alerts
   */
  private generateInventoryAlerts(
    insights: InventoryInsight[],
    _threshold: number
  ): Array<{
    type: 'low_stock' | 'high_cost_volatility' | 'unused' | 'overused';
    material_name: string;
    severity: 'high' | 'medium' | 'low';
    message: string;
    action_required: string;
  }> {
    const alerts: Array<any> = [];

    for (const insight of insights) {
      // Low stock alert
      if (insight.reorder_recommendation.should_reorder) {
        alerts.push({
          type: 'low_stock',
          material_name: insight.material_name,
          severity: 'high',
          message: `Material needs reordering. ${insight.reorder_recommendation.reason}`,
          action_required: `Order ${insight.reorder_recommendation.suggested_quantity} units`,
        });
      }

      // High cost volatility alert
      if (insight.cost_analysis.cost_volatility > 0.3) {
        alerts.push({
          type: 'high_cost_volatility',
          material_name: insight.material_name,
          severity: 'medium',
          message: `High cost volatility (${(insight.cost_analysis.cost_volatility * 100).toFixed(1)}%)`,
          action_required: 'Review supplier pricing and consider alternatives',
        });
      }

      // Unused material alert
      if (insight.days_since_last_use > 180) {
        alerts.push({
          type: 'unused',
          material_name: insight.material_name,
          severity: 'low',
          message: `Material unused for ${insight.days_since_last_use} days`,
          action_required: 'Review if material is still needed',
        });
      }

      // High velocity alert
      if (insight.usage_trend === 'increasing' && insight.avg_monthly_usage > 100) {
        alerts.push({
          type: 'overused',
          material_name: insight.material_name,
          severity: 'medium',
          message: 'High velocity material with increasing trend',
          action_required: 'Consider bulk ordering for better pricing',
        });
      }
    }

    return alerts;
  }

  /**
   * Generate reorder schedule
   * @param insights - Inventory insights
   * @returns Reorder schedule
   */
  private generateReorderSchedule(
    insights: InventoryInsight[]
  ): Array<{
    material_name: string;
    suggested_reorder_date: string;
    suggested_quantity: number;
    estimated_cost: number;
  }> {
    return insights
      .filter(i => i.reorder_recommendation.should_reorder)
      .map(insight => {
        // Suggest reordering ASAP
        const today = new Date();
        const reorderDate = new Date(today);
        reorderDate.setDate(today.getDate() + 7); // 1 week from now

        return {
          material_name: insight.material_name,
          suggested_reorder_date: reorderDate.toISOString().split('T')[0],
          suggested_quantity: insight.reorder_recommendation.suggested_quantity,
          estimated_cost:
            insight.cost_analysis.avg_cost * insight.reorder_recommendation.suggested_quantity,
        };
      });
  }
}

export default new MaterialAnalyzer();
