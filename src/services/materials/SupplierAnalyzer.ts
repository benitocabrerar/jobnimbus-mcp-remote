/**
 * Supplier Analyzer Service
 * Compare suppliers and analyze pricing
 */

import {
  MaterialRecord,
  SupplierPricing,
  DateRange,
} from '../../types/materials.js';
import materialStatistics from './MaterialStatistics.js';
import { getDaysSince } from '../../utils/dateHelpers.js';

interface SupplierComparisonOptions {
  materialName?: string;
  sku?: string;
  category?: string;
  minPurchases?: number;
}

export class SupplierAnalyzer {
  /**
   * Compare suppliers for material pricing
   * @param records - Material records
   * @param dateRange - Date range for analysis
   * @param options - Comparison options
   * @returns Supplier comparison data
   */
  compareSuppliers(
    records: MaterialRecord[],
    _dateRange: DateRange,
    options: SupplierComparisonOptions = {}
  ): {
    suppliers: SupplierPricing[];
    bestSupplier: string | null;
    worstSupplier: string | null;
    priceDifference: number;
    potentialSavings: number;
  } {
    // Filter records
    let filteredRecords = this.filterRecords(records, options);

    // Group by supplier
    const supplierGroups = this.groupBySupplier(filteredRecords);

    // Calculate supplier pricing
    const suppliers = this.calculateSupplierPricing(
      supplierGroups,
      options.minPurchases || 1
    );

    // Find best and worst suppliers
    const { bestSupplier, worstSupplier, priceDifference, potentialSavings } =
      this.findBestAndWorst(suppliers, filteredRecords);

    return {
      suppliers,
      bestSupplier,
      worstSupplier,
      priceDifference,
      potentialSavings,
    };
  }

  /**
   * Filter records by options
   * @param records - Material records
   * @param options - Filter options
   * @returns Filtered records
   */
  private filterRecords(
    records: MaterialRecord[],
    options: SupplierComparisonOptions
  ): MaterialRecord[] {
    let filtered = records;

    if (options.materialName) {
      filtered = filtered.filter(
        r => r.name?.toLowerCase() === options.materialName?.toLowerCase()
      );
    }

    if (options.sku) {
      filtered = filtered.filter(r => r.sku === options.sku);
    }

    if (options.category) {
      filtered = filtered.filter(r => r.category === options.category);
    }

    // Only include records with supplier information
    filtered = filtered.filter(r => r.supplier && r.supplier.trim().length > 0);

    return filtered;
  }

  /**
   * Group records by supplier
   * @param records - Material records
   * @returns Map of supplier to records
   */
  private groupBySupplier(records: MaterialRecord[]): Map<string, MaterialRecord[]> {
    const groups = new Map<string, MaterialRecord[]>();

    for (const record of records) {
      const supplier = record.supplier || 'Unknown';

      if (!groups.has(supplier)) {
        groups.set(supplier, []);
      }

      groups.get(supplier)!.push(record);
    }

    return groups;
  }

  /**
   * Calculate supplier pricing metrics
   * @param supplierGroups - Grouped records by supplier
   * @param minPurchases - Minimum purchases to include
   * @returns Array of supplier pricing
   */
  private calculateSupplierPricing(
    supplierGroups: Map<string, MaterialRecord[]>,
    minPurchases: number
  ): SupplierPricing[] {
    const suppliers: SupplierPricing[] = [];

    for (const [supplierName, records] of supplierGroups.entries()) {
      if (records.length < minPurchases) {
        continue;
      }

      const costs = records.map(r => r.cost);
      const stats = materialStatistics.calculateStatistics(costs);

      // Get material info from first record
      const firstRecord = records[0];
      const totalQuantity = records.reduce((sum, r) => sum + r.quantity, 0);

      // Detect price trend
      const sortedRecords = [...records].sort((a, b) => a.date_created - b.date_created);
      const costValues = sortedRecords.map(r => r.cost);
      const priceTrend = materialStatistics.detectTrend(costValues);

      // Find last purchase date
      const lastPurchaseDate = Math.max(...records.map(r => r.date_created));

      suppliers.push({
        supplier_name: supplierName,
        material_name: firstRecord.name,
        sku: firstRecord.sku,
        avg_cost: stats.mean,
        min_cost: stats.min,
        max_cost: stats.max,
        usage_count: records.length,
        total_quantity: totalQuantity,
        last_purchase_date: lastPurchaseDate,
        price_trend: priceTrend,
      });
    }

    // Sort by average cost (ascending)
    return suppliers.sort((a, b) => a.avg_cost - b.avg_cost);
  }

  /**
   * Find best and worst suppliers
   * @param suppliers - Array of supplier pricing
   * @param records - All material records
   * @returns Best/worst supplier info
   */
  private findBestAndWorst(
    suppliers: SupplierPricing[],
    records: MaterialRecord[]
  ): {
    bestSupplier: string | null;
    worstSupplier: string | null;
    priceDifference: number;
    potentialSavings: number;
  } {
    if (suppliers.length === 0) {
      return {
        bestSupplier: null,
        worstSupplier: null,
        priceDifference: 0,
        potentialSavings: 0,
      };
    }

    const bestSupplier = suppliers[0].supplier_name;
    const worstSupplier = suppliers[suppliers.length - 1].supplier_name;
    const bestCost = suppliers[0].avg_cost;
    const worstCost = suppliers[suppliers.length - 1].avg_cost;

    const priceDifference =
      bestCost > 0 ? ((worstCost - bestCost) / bestCost) * 100 : 0;

    // Calculate potential savings if all purchases were from best supplier
    const totalQuantity = records.reduce((sum, r) => sum + r.quantity, 0);
    const currentAvgCost =
      records.reduce((sum, r) => sum + r.cost * r.quantity, 0) / totalQuantity;
    const potentialSavings = (currentAvgCost - bestCost) * totalQuantity;

    return {
      bestSupplier,
      worstSupplier,
      priceDifference,
      potentialSavings: Math.max(0, potentialSavings),
    };
  }

  /**
   * Generate supplier recommendations
   * @param suppliers - Array of supplier pricing
   * @returns Array of recommendations
   */
  generateRecommendations(
    suppliers: SupplierPricing[]
  ): Array<{
    supplier_name: string;
    reason: string;
    estimated_savings: number;
    reliability_score: number;
  }> {
    if (suppliers.length === 0) return [];

    const recommendations: Array<{
      supplier_name: string;
      reason: string;
      estimated_savings: number;
      reliability_score: number;
    }> = [];

    const bestSupplier = suppliers[0];
    const avgCost =
      suppliers.reduce((sum, s) => sum + s.avg_cost, 0) / suppliers.length;

    for (const supplier of suppliers) {
      // Calculate reliability score (0-100)
      const recencyScore = this.calculateRecencyScore(supplier.last_purchase_date);
      const volumeScore = Math.min(100, (supplier.usage_count / 10) * 100);
      const priceStabilityScore =
        supplier.max_cost > 0
          ? 100 - ((supplier.max_cost - supplier.min_cost) / supplier.max_cost) * 100
          : 100;

      const reliabilityScore =
        (recencyScore + volumeScore + priceStabilityScore) / 3;

      // Generate recommendation
      if (supplier.supplier_name === bestSupplier.supplier_name) {
        const savings = (avgCost - supplier.avg_cost) * supplier.total_quantity;

        recommendations.push({
          supplier_name: supplier.supplier_name,
          reason: 'Lowest average cost with good reliability',
          estimated_savings: Math.max(0, savings),
          reliability_score: reliabilityScore,
        });
      } else if (supplier.price_trend === 'decreasing' && reliabilityScore > 70) {
        recommendations.push({
          supplier_name: supplier.supplier_name,
          reason: 'Decreasing price trend - good opportunity',
          estimated_savings: 0,
          reliability_score: reliabilityScore,
        });
      } else if (supplier.price_trend === 'increasing' && supplier.avg_cost > avgCost) {
        recommendations.push({
          supplier_name: supplier.supplier_name,
          reason: 'Consider switching - increasing prices and above average cost',
          estimated_savings: (supplier.avg_cost - bestSupplier.avg_cost) * supplier.total_quantity,
          reliability_score: reliabilityScore,
        });
      }
    }

    return recommendations;
  }

  /**
   * Calculate recency score based on last purchase date
   * @param lastPurchaseDate - Last purchase timestamp
   * @returns Score 0-100 (100 = very recent)
   */
  private calculateRecencyScore(lastPurchaseDate: number): number {
    const daysSince = getDaysSince(lastPurchaseDate);

    if (daysSince <= 30) return 100;
    if (daysSince <= 90) return 75;
    if (daysSince <= 180) return 50;
    if (daysSince <= 365) return 25;

    return 0;
  }
}

export default new SupplierAnalyzer();
