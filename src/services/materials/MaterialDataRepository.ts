/**
 * Material Data Repository
 * Data fetching and caching for material records from estimates
 */

import jobNimbusClient from '../jobNimbusClient.js';
import {
  Estimate,
  MaterialRecord,
  DateRange,
} from '../../types/materials.js';
import { MaterialAnalysisError, ErrorCode } from '../../types/materials.js';
import { parseDate, getEndOfDay } from '../../utils/dateHelpers.js';

interface CacheEntry {
  data: Estimate[];
  timestamp: number;
}

interface MaterialRecordOptions {
  includeLabor?: boolean;
  filterByType?: 'material' | 'labor' | 'all';
  jobType?: string;
  materialCategories?: string[];
}

export class MaterialDataRepository {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  /**
   * Normalize estimate ID - detect format and convert if needed
   * @param estimateId - Raw estimate ID (could be JNID or number)
   * @returns Object with normalized ID and detected format
   */
  private normalizeEstimateId(estimateId: string): { id: string; format: 'jnid' | 'number' } {
    const trimmedId = estimateId.trim();

    // JNID format: alphanumeric with hyphens (e.g., "abc123-def456")
    if (/^[a-zA-Z0-9]+-[a-zA-Z0-9-]+$/.test(trimmedId)) {
      return { id: trimmedId, format: 'jnid' };
    }

    // Number format: pure digits (e.g., "12345")
    if (/^\d+$/.test(trimmedId)) {
      return { id: trimmedId, format: 'number' };
    }

    // Default: assume JNID if contains any letters
    return { id: trimmedId, format: 'jnid' };
  }

  /**
   * Search for estimate by number when JNID lookup fails
   * @param apiKey - JobNimbus API key
   * @param estimateNumber - Estimate number to search
   * @returns Estimate data or null
   */
  private async searchEstimateByNumber(
    apiKey: string,
    estimateNumber: string
  ): Promise<Estimate | null> {
    try {
      // Fetch recent estimates and search for matching number
      const params = { size: 100 };
      const response = await jobNimbusClient.get(apiKey, 'estimates', params);
      const estimates = (response.data as any)?.results || [];

      const match = estimates.find(
        (est: Estimate) => est.number === estimateNumber
      );

      return match || null;
    } catch (error) {
      // Search failed, return null to let main error handler take over
      return null;
    }
  }

  /**
   * Get a single estimate by ID with fallback strategy
   * @param apiKey - JobNimbus API key
   * @param estimateId - Estimate ID to fetch (JNID or number)
   * @returns Estimate data
   */
  async getEstimate(apiKey: string, estimateId: string): Promise<Estimate> {
    if (!estimateId || estimateId.trim().length === 0) {
      throw new MaterialAnalysisError(
        'Estimate ID is required',
        ErrorCode.INVALID_INPUT,
        { estimate_id: estimateId }
      );
    }

    const { id, format } = this.normalizeEstimateId(estimateId);

    try {
      // Primary attempt: direct API call with provided ID
      const response = await jobNimbusClient.get(apiKey, `estimates/${id}`);
      const estimate = response.data as Estimate;

      if (!estimate || !estimate.jnid) {
        throw new MaterialAnalysisError(
          `Estimate not found: ${estimateId}`,
          ErrorCode.ESTIMATE_NOT_FOUND,
          { estimate_id: estimateId }
        );
      }

      return estimate;
    } catch (error) {
      // Fallback strategy: if ID looks like a number, try searching by number
      if (format === 'number') {
        const searchResult = await this.searchEstimateByNumber(apiKey, id);
        if (searchResult) {
          return searchResult;
        }
      }

      // Enhanced error message with helpful context
      if (error instanceof MaterialAnalysisError) {
        throw error;
      }

      const errorMessage = format === 'jnid'
        ? `Estimate not found with JNID: ${estimateId}. Verify the estimate exists and you have access to it.`
        : `Estimate not found with number: ${estimateId}. Try using the estimate's JNID instead (format: abc123-def456).`;

      throw new MaterialAnalysisError(
        errorMessage,
        ErrorCode.ESTIMATE_NOT_FOUND,
        {
          estimate_id: estimateId,
          detected_format: format,
          error: String(error),
          hint: 'Use get_estimates tool to list available estimates and their IDs'
        }
      );
    }
  }

  /**
   * Get estimates within a date range (with caching)
   * @param apiKey - JobNimbus API key
   * @param dateRange - Date range filter
   * @returns Array of estimates
   */
  async getEstimatesInRange(apiKey: string, dateRange: DateRange): Promise<Estimate[]> {
    const cacheKey = this.getCacheKey(dateRange);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      // Fetch all estimates with pagination
      const estimates = await this.fetchAllEstimates(apiKey, dateRange);

      // Update cache
      this.cache.set(cacheKey, {
        data: estimates,
        timestamp: Date.now(),
      });

      // Clean old cache entries
      this.cleanCache();

      return estimates;
    } catch (error) {
      throw new MaterialAnalysisError(
        'Failed to fetch estimates from API',
        ErrorCode.API_ERROR,
        { dateRange, error: String(error) }
      );
    }
  }

  /**
   * Fetch all estimates with pagination
   * @param apiKey - JobNimbus API key
   * @param dateRange - Date range filter
   * @returns Array of all estimates
   */
  private async fetchAllEstimates(
    apiKey: string,
    dateRange: DateRange
  ): Promise<Estimate[]> {
    const allEstimates: Estimate[] = [];
    const batchSize = 100;
    const maxIterations = 50; // Safety limit
    let offset = 0;
    let iteration = 0;

    while (iteration < maxIterations) {
      const params: Record<string, any> = {
        size: batchSize,
        from: offset,
      };

      // Note: API might not support date filtering directly,
      // so we fetch all and filter in memory
      const response = await jobNimbusClient.get(apiKey, 'estimates', params);
      const batch = (response.data as any)?.results || [];

      if (batch.length === 0) {
        break;
      }

      allEstimates.push(...batch);
      offset += batchSize;
      iteration++;

      if (batch.length < batchSize) {
        break;
      }
    }

    // Filter by date range if specified
    return this.filterByDateRange(allEstimates, dateRange);
  }

  /**
   * Filter estimates by date range
   * @param estimates - Array of estimates
   * @param dateRange - Date range filter
   * @returns Filtered estimates
   */
  private filterByDateRange(estimates: Estimate[], dateRange: DateRange): Estimate[] {
    const fromTs = parseDate(dateRange.date_from);
    const toTs = dateRange.date_to ? getEndOfDay(dateRange.date_to) : 0;

    return estimates.filter(estimate => {
      const dateCreated = estimate.date_created || 0;

      if (fromTs > 0 && dateCreated < fromTs) return false;
      if (toTs > 0 && dateCreated > toTs) return false;

      return true;
    });
  }

  /**
   * Transform estimate to material records
   * @param estimate - Estimate to transform
   * @returns Array of material records
   */
  transformToMaterialRecords(estimate: Estimate): MaterialRecord[] {
    if (!estimate.items || estimate.items.length === 0) {
      return [];
    }

    const records: MaterialRecord[] = [];
    const related = estimate.related || [];
    const job = related.find(r => r.type === 'job');

    for (const item of estimate.items) {
      // Safe defaults: use 0 for null/undefined numeric values to prevent NaN
      const safeAmount = item.amount ?? 0;
      const safeCost = item.cost ?? 0;
      const safePrice = item.price ?? 0;
      const safeQuantity = item.quantity ?? 0;

      const record: MaterialRecord = {
        // Copy all item fields
        ...item,
        // Add estimate context
        estimate_id: estimate.jnid,
        estimate_number: estimate.number || '',
        estimate_status: estimate.status_name || '',
        // Add job context if available
        job_id: job?.id,
        job_name: job?.name,
        job_type: undefined, // Would need to fetch job details
        // Calculate derived fields with null safety
        margin_percent:
          safeAmount > 0 ? ((safeAmount - safeCost) / safeAmount) * 100 : 0,
        margin_amount: safeAmount - safeCost,
        total_cost: safeCost * safeQuantity,
        total_price: safePrice * safeQuantity,
        // Add dates
        date_created: estimate.date_created || 0,
        date_approved: estimate.date_approved,
        sales_rep: estimate.sales_rep_name || estimate.sales_rep,
        // Supplier would need to be in item data or separate lookup
        supplier: undefined,
      };

      records.push(record);
    }

    return records;
  }

  /**
   * Get material records with filtering options
   * @param apiKey - JobNimbus API key
   * @param dateRange - Date range filter
   * @param options - Additional filtering options
   * @returns Array of material records
   */
  async getMaterialRecords(
    apiKey: string,
    dateRange: DateRange,
    options: MaterialRecordOptions = {}
  ): Promise<MaterialRecord[]> {
    const estimates = await this.getEstimatesInRange(apiKey, dateRange);

    if (estimates.length === 0) {
      return [];
    }

    // Transform all estimates to material records
    let records: MaterialRecord[] = [];
    for (const estimate of estimates) {
      const estimateRecords = this.transformToMaterialRecords(estimate);
      records.push(...estimateRecords);
    }

    // Apply filters
    records = this.applyFilters(records, options);

    return records;
  }

  /**
   * Apply filtering options to material records
   * @param records - Array of material records
   * @param options - Filtering options
   * @returns Filtered records
   */
  private applyFilters(
    records: MaterialRecord[],
    options: MaterialRecordOptions
  ): MaterialRecord[] {
    let filtered = records;

    // Filter by item type
    if (options.filterByType && options.filterByType !== 'all') {
      filtered = filtered.filter(r => r.item_type === options.filterByType);
    } else if (!options.includeLabor) {
      filtered = filtered.filter(r => r.item_type === 'material');
    }

    // Filter by job type (if available)
    if (options.jobType) {
      filtered = filtered.filter(r => r.job_type === options.jobType);
    }

    // Filter by material categories
    if (options.materialCategories && options.materialCategories.length > 0) {
      filtered = filtered.filter(
        r => r.category && options.materialCategories!.includes(r.category)
      );
    }

    return filtered;
  }

  /**
   * Generate cache key from date range
   * @param dateRange - Date range
   * @returns Cache key string
   */
  private getCacheKey(dateRange: DateRange): string {
    return `${dateRange.date_from || 'none'}_${dateRange.date_to || 'none'}`;
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns Cache stats
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export default new MaterialDataRepository();
