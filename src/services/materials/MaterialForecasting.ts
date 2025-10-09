/**
 * Material Forecasting Service
 * Simple forecasting algorithms for material usage prediction
 */

import { TrendDataPoint } from '../../types/materials.js';

export interface Forecast {
  period: string;
  predicted_value: number;
  confidence_interval: {
    lower: number;
    upper: number;
  };
}

export class MaterialForecasting {
  /**
   * Forecast future usage using linear regression
   * @param trendData - Historical trend data
   * @param periods - Number of periods to forecast
   * @returns Array of forecasts
   */
  forecastUsage(trendData: TrendDataPoint[], periods: number): Forecast[] {
    if (!trendData || trendData.length < 2 || periods <= 0) {
      return [];
    }

    // Calculate linear regression coefficients
    const { slope, intercept, standardError } = this.calculateLinearRegression(trendData);

    const forecasts: Forecast[] = [];
    const n = trendData.length;

    for (let i = 1; i <= periods; i++) {
      const x = n + i - 1; // Continue from last data point
      const predicted = slope * x + intercept;

      // Calculate confidence interval (95% confidence)
      // Using simplified approach: ±2 * standard error
      const margin = 2 * standardError;

      forecasts.push({
        period: this.getNextPeriod(trendData[n - 1].period, i),
        predicted_value: Math.max(0, predicted), // Don't predict negative values
        confidence_interval: {
          lower: Math.max(0, predicted - margin),
          upper: predicted + margin,
        },
      });
    }

    return forecasts;
  }

  /**
   * Forecast using moving average (simpler, more stable)
   * @param trendData - Historical trend data
   * @param periods - Number of periods to forecast
   * @param windowSize - Moving average window size
   * @returns Array of forecasts
   */
  forecastMovingAverage(
    trendData: TrendDataPoint[],
    periods: number,
    windowSize: number = 3
  ): Forecast[] {
    if (!trendData || trendData.length < windowSize || periods <= 0) {
      return [];
    }

    const forecasts: Forecast[] = [];
    const recentValues = trendData.slice(-windowSize).map(d => d.value);
    const avgValue = recentValues.reduce((sum, val) => sum + val, 0) / windowSize;

    // Calculate standard deviation for confidence interval
    const variance =
      recentValues.reduce((sum, val) => sum + Math.pow(val - avgValue, 2), 0) / windowSize;
    const stdDev = Math.sqrt(variance);

    const lastPeriod = trendData[trendData.length - 1].period;

    for (let i = 1; i <= periods; i++) {
      forecasts.push({
        period: this.getNextPeriod(lastPeriod, i),
        predicted_value: Math.max(0, avgValue),
        confidence_interval: {
          lower: Math.max(0, avgValue - 2 * stdDev),
          upper: avgValue + 2 * stdDev,
        },
      });
    }

    return forecasts;
  }

  /**
   * Calculate linear regression coefficients
   * @param data - Trend data points
   * @returns Regression coefficients
   */
  private calculateLinearRegression(data: TrendDataPoint[]): {
    slope: number;
    intercept: number;
    standardError: number;
  } {
    const n = data.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = data[i].value;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate standard error
    let sumSquaredErrors = 0;
    for (let i = 0; i < n; i++) {
      const predicted = slope * i + intercept;
      const error = data[i].value - predicted;
      sumSquaredErrors += error * error;
    }
    const standardError = Math.sqrt(sumSquaredErrors / (n - 2));

    return { slope, intercept, standardError };
  }

  /**
   * Get next period label based on current period
   * @param currentPeriod - Current period string
   * @param offset - Number of periods ahead
   * @returns Next period string
   */
  private getNextPeriod(currentPeriod: string, offset: number): string {
    // Try to parse as date (YYYY-MM-DD)
    const dateMatch = currentPeriod.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
      const date = new Date(currentPeriod);
      date.setDate(date.getDate() + offset);
      return date.toISOString().split('T')[0];
    }

    // Try to parse as month (YYYY-MM)
    const monthMatch = currentPeriod.match(/^(\d{4})-(\d{2})$/);
    if (monthMatch) {
      const [_, year, month] = monthMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1 + offset, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    // Try to parse as week (YYYY-WXX)
    const weekMatch = currentPeriod.match(/^(\d{4})-W(\d{2})$/);
    if (weekMatch) {
      const [_, year, week] = weekMatch;
      const newWeek = parseInt(week) + offset;
      const newYear = parseInt(year) + Math.floor((newWeek - 1) / 52);
      const finalWeek = ((newWeek - 1) % 52) + 1;
      return `${newYear}-W${String(finalWeek).padStart(2, '0')}`;
    }

    // Fallback: just append offset
    return `${currentPeriod}+${offset}`;
  }

  /**
   * Calculate trend strength (R-squared)
   * @param data - Trend data points
   * @returns R-squared value (0-1)
   */
  calculateTrendStrength(data: TrendDataPoint[]): number {
    if (data.length < 2) return 0;

    const { slope, intercept } = this.calculateLinearRegression(data);

    const mean = data.reduce((sum, d) => sum + d.value, 0) / data.length;

    let ssTotal = 0;
    let ssResidual = 0;

    for (let i = 0; i < data.length; i++) {
      const predicted = slope * i + intercept;
      ssTotal += Math.pow(data[i].value - mean, 2);
      ssResidual += Math.pow(data[i].value - predicted, 2);
    }

    if (ssTotal === 0) return 0;

    return 1 - ssResidual / ssTotal;
  }

  /**
   * Detect seasonality in data
   * @param data - Trend data points
   * @param period - Expected seasonal period
   * @returns Seasonality strength (0-1)
   */
  detectSeasonality(data: TrendDataPoint[], period: number = 12): number {
    if (data.length < period * 2) return 0;

    // Simple autocorrelation at lag = period
    const values = data.map(d => d.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < values.length - period; i++) {
      numerator += (values[i] - mean) * (values[i + period] - mean);
    }

    for (let i = 0; i < values.length; i++) {
      denominator += Math.pow(values[i] - mean, 2);
    }

    if (denominator === 0) return 0;

    const autocorrelation = numerator / denominator;
    return Math.max(0, Math.min(1, autocorrelation));
  }
}

export default new MaterialForecasting();
