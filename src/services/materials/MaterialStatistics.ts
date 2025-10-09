/**
 * Material Statistics Service
 * Statistical analysis and aggregation for material data
 */

import {
  StatisticalAnalysis,
  MaterialRecord,
  MaterialAggregate,
} from '../../types/materials.js';

export class MaterialStatistics {
  /**
   * Calculate comprehensive statistical analysis for a set of values
   * @param values - Array of numeric values
   * @returns Statistical analysis results
   */
  calculateStatistics(values: number[]): StatisticalAnalysis {
    if (!values || values.length === 0) {
      return {
        mean: 0,
        median: 0,
        std_deviation: 0,
        min: 0,
        max: 0,
        percentile_25: 0,
        percentile_75: 0,
        percentile_90: 0,
        count: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;

    // Mean
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const mean = sum / count;

    // Median
    const median =
      count % 2 === 0
        ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
        : sorted[Math.floor(count / 2)];

    // Standard deviation
    const squareDiffs = sorted.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((acc, val) => acc + val, 0) / count;
    const stdDeviation = Math.sqrt(avgSquareDiff);

    // Min and max
    const min = sorted[0];
    const max = sorted[count - 1];

    // Percentiles
    const percentile25 = this.calculatePercentile(sorted, 25);
    const percentile75 = this.calculatePercentile(sorted, 75);
    const percentile90 = this.calculatePercentile(sorted, 90);

    return {
      mean,
      median,
      std_deviation: stdDeviation,
      min,
      max,
      percentile_25: percentile25,
      percentile_75: percentile75,
      percentile_90: percentile90,
      count,
    };
  }

  /**
   * Calculate specific percentile from sorted values
   * @param sortedValues - Pre-sorted array of values
   * @param percentile - Percentile to calculate (0-100)
   * @returns Percentile value
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    if (sortedValues.length === 1) return sortedValues[0];

    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (lower === upper) {
      return sortedValues[lower];
    }

    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Aggregate material records by material name
   * @param records - Array of material records
   * @returns Map of material name to aggregated data
   */
  aggregateMaterials(records: MaterialRecord[]): Map<string, MaterialAggregate> {
    const aggregates = new Map<string, MaterialAggregate>();

    for (const record of records) {
      const key = record.name || 'Unknown Material';

      if (!aggregates.has(key)) {
        aggregates.set(key, {
          material_name: key,
          sku: record.sku,
          category: record.category,
          total_quantity: 0,
          total_cost: 0,
          total_revenue: 0,
          total_margin: 0,
          avg_unit_cost: 0,
          avg_unit_price: 0,
          avg_margin_percent: 0,
          usage_count: 0,
          estimates: [],
          jobs: [],
          uom: record.uom || '',
          first_used: record.date_created,
          last_used: record.date_created,
        });
      }

      const aggregate = aggregates.get(key)!;

      // Update totals
      aggregate.total_quantity += record.quantity || 0;
      aggregate.total_cost += record.total_cost || 0;
      aggregate.total_revenue += record.total_price || 0;
      aggregate.total_margin += record.margin_amount || 0;
      aggregate.usage_count += 1;

      // Track unique estimates and jobs
      if (record.estimate_id && !aggregate.estimates.includes(record.estimate_id)) {
        aggregate.estimates.push(record.estimate_id);
      }
      if (record.job_id && !aggregate.jobs.includes(record.job_id)) {
        aggregate.jobs.push(record.job_id);
      }

      // Update first/last used dates
      if (record.date_created < aggregate.first_used) {
        aggregate.first_used = record.date_created;
      }
      if (record.date_created > aggregate.last_used) {
        aggregate.last_used = record.date_created;
      }

      // Update SKU and category if missing
      if (!aggregate.sku && record.sku) {
        aggregate.sku = record.sku;
      }
      if (!aggregate.category && record.category) {
        aggregate.category = record.category;
      }
    }

    // Calculate averages
    for (const aggregate of aggregates.values()) {
      if (aggregate.usage_count > 0) {
        aggregate.avg_unit_cost =
          aggregate.total_cost / aggregate.total_quantity || 0;
        aggregate.avg_unit_price =
          aggregate.total_revenue / aggregate.total_quantity || 0;
        aggregate.avg_margin_percent =
          aggregate.total_revenue > 0
            ? (aggregate.total_margin / aggregate.total_revenue) * 100
            : 0;
      }
    }

    return aggregates;
  }

  /**
   * Detect trend in values over time
   * @param values - Array of values in chronological order
   * @returns Trend direction
   */
  detectTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (!values || values.length < 2) {
      return 'stable';
    }

    // Simple linear regression
    const n = values.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // Calculate relative slope (normalized by mean)
    const mean = sumY / n;
    const relativeSlope = mean !== 0 ? slope / mean : 0;

    // Threshold for trend detection (5% change per period)
    const threshold = 0.05;

    if (relativeSlope > threshold) {
      return 'increasing';
    } else if (relativeSlope < -threshold) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  /**
   * Calculate coefficient of variation (volatility measure)
   * @param values - Array of numeric values
   * @returns Coefficient of variation (std_dev / mean)
   */
  coefficientOfVariation(values: number[]): number {
    if (!values || values.length === 0) return 0;

    const stats = this.calculateStatistics(values);

    if (stats.mean === 0) return 0;

    return stats.std_deviation / stats.mean;
  }

  /**
   * Group records by category
   * @param records - Array of material records
   * @returns Map of category to records
   */
  groupByCategory(records: MaterialRecord[]): Map<string, MaterialRecord[]> {
    const grouped = new Map<string, MaterialRecord[]>();

    for (const record of records) {
      const category = record.category || 'Uncategorized';

      if (!grouped.has(category)) {
        grouped.set(category, []);
      }

      grouped.get(category)!.push(record);
    }

    return grouped;
  }

  /**
   * Calculate moving average
   * @param values - Array of values
   * @param windowSize - Size of moving average window
   * @returns Array of moving averages
   */
  calculateMovingAverage(values: number[], windowSize: number): number[] {
    if (!values || values.length === 0 || windowSize <= 0) {
      return [];
    }

    const result: number[] = [];

    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = values.slice(start, i + 1);
      const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
      result.push(avg);
    }

    return result;
  }

  /**
   * Find outliers using IQR method
   * @param values - Array of numeric values
   * @returns Array of outlier indices
   */
  findOutliers(values: number[]): number[] {
    if (!values || values.length < 4) return [];

    const sorted = [...values].sort((a, b) => a - b);
    const q1 = this.calculatePercentile(sorted, 25);
    const q3 = this.calculatePercentile(sorted, 75);
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const outliers: number[] = [];

    for (let i = 0; i < values.length; i++) {
      if (values[i] < lowerBound || values[i] > upperBound) {
        outliers.push(i);
      }
    }

    return outliers;
  }
}

export default new MaterialStatistics();
