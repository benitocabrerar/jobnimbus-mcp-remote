/**
 * Response Builder Utility
 *
 * Intelligently constructs responses based on verbosity levels and size constraints.
 * Automatically determines when to use handle storage vs direct response.
 *
 * Features:
 * - Automatic verbosity-based field selection
 * - Size-based handle storage decision
 * - Summary generation for large datasets
 * - Field truncation for long text
 * - Smart sampling for arrays
 *
 * @author Backend Architecture Team
 * @version 1.0.0
 */

import {
  VerbosityLevel,
  ResponseEnvelope,
  ResponseMetadata,
  PageInfo,
  BaseToolInput,
  ToolContext,
} from '../types/index.js';
import {
  RESPONSE_CONFIG,
  getMaxFields,
  calculateSize,
  formatSize,
  exceedsThreshold,
} from '../config/response.js';
import { handleStorage } from '../services/handleStorage.js';

/**
 * Response Builder Options
 */
export interface ResponseBuilderOptions extends Partial<BaseToolInput> {
  toolName: string;
  context: ToolContext;
  entity?: string;        // For handle generation (jobs, contacts, etc.)
  maxRows?: number;       // Maximum rows to include in response
  maxFields?: number;     // Maximum fields per object (overrides verbosity default)
  pageInfo?: PageInfo;    // Pagination information
  cacheHit?: boolean;     // Whether response came from cache
}

/**
 * Response Builder Class
 * Main logic for constructing optimized responses
 */
export class ResponseBuilder {
  /**
   * Build response envelope with automatic handle storage
   *
   * @param data - Raw data to wrap
   * @param options - Builder options
   * @returns Response envelope (may include handle if too large)
   */
  public static async build<T = any>(
    data: T,
    options: ResponseBuilderOptions
  ): Promise<ResponseEnvelope<T>> {
    const verbosity = options.verbosity || RESPONSE_CONFIG.VERBOSITY.DEFAULT;
    const maxFields = options.maxFields || getMaxFields(verbosity);
    const maxRows = options.maxRows || RESPONSE_CONFIG.LIMITS.MAX_ROWS_PER_PAGE;

    // Step 1: Apply field selection if specified
    let processedData = data;
    if (options.fields) {
      processedData = this.selectFields(data, options.fields.split(','));
    }

    // Step 2: Apply verbosity-based compaction
    processedData = this.applyVerbosity(processedData, verbosity, maxFields);

    // Step 3: Truncate long text fields
    processedData = this.truncateFields(processedData, RESPONSE_CONFIG.LIMITS.MAX_TEXT_FIELD_LENGTH);

    // Step 4: Limit array length for summary
    const summary = this.createSummary(processedData, maxRows);

    // Step 5: Calculate sizes
    const summarySize = calculateSize(summary);
    const fullDataSize = calculateSize(processedData);

    // Step 6: Determine if full data needs handle storage
    const needsHandle = this.needsHandle(fullDataSize);

    // Step 7: Build metadata
    const metadata: ResponseMetadata = {
      verbosity,
      size_bytes: summarySize,
      field_count: this.countFields(summary),
      row_count: this.countRows(summary),
      cache_hit: options.cacheHit,
      expires_in_sec: needsHandle ? RESPONSE_CONFIG.STORAGE.HANDLE_TTL_SEC : undefined,
      tool_name: options.toolName,
      timestamp: new Date().toISOString(),
    };

    // Step 8: Store handle if needed
    let resultHandle: string | undefined;
    if (needsHandle && options.entity) {
      try {
        resultHandle = await handleStorage.store(
          options.entity,
          processedData,
          options.toolName,
          verbosity,
          options.context.instance
        );

        console.log(
          `[ResponseBuilder] Created handle: ${resultHandle} ` +
          `(full: ${formatSize(fullDataSize)}, summary: ${formatSize(summarySize)})`
        );
      } catch (error) {
        console.warn(`[ResponseBuilder] Failed to create handle: ${error}`);
        // Continue without handle - return summary only
      }
    }

    // Step 9: Build final envelope
    const envelope: ResponseEnvelope<T> = {
      status: needsHandle ? 'partial' : 'ok',
      summary: summary as T,
      result_handle: resultHandle,
      page_info: options.pageInfo,
      metadata,
    };

    return envelope;
  }

  /**
   * Determine if response needs handle storage
   *
   * @param sizeBytes - Response size in bytes
   * @returns True if size exceeds threshold
   */
  public static needsHandle(data: any): boolean {
    const sizeBytes = typeof data === 'number' ? data : calculateSize(data);
    return exceedsThreshold(sizeBytes, 'hard');
  }

  /**
   * Create summary from data (sample for large arrays)
   *
   * @param data - Data to summarize
   * @param maxRows - Maximum rows to include
   * @returns Summarized data
   */
  public static createSummary(data: any, maxRows: number): any {
    if (Array.isArray(data)) {
      // Sample array if too large
      if (data.length > maxRows) {
        return data.slice(0, maxRows);
      }
      return data;
    }

    // For objects, return as-is (field selection already applied)
    return data;
  }

  /**
   * Apply field selection to data
   *
   * @param data - Data to filter
   * @param fields - Array of field names to include
   * @returns Data with only selected fields
   */
  public static selectFields(data: any, fields: string[]): any {
    if (!fields || fields.length === 0) {
      return data;
    }

    const fieldSet = new Set(fields.map(f => f.trim()));

    if (Array.isArray(data)) {
      return data.map(item => this.selectFieldsFromObject(item, fieldSet));
    }

    if (typeof data === 'object' && data !== null) {
      return this.selectFieldsFromObject(data, fieldSet);
    }

    return data;
  }

  /**
   * Select fields from single object
   */
  private static selectFieldsFromObject(obj: any, fields: Set<string>): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const result: any = {};
    for (const field of fields) {
      if (field in obj) {
        result[field] = obj[field];
      }
    }
    return result;
  }

  /**
   * Apply verbosity level to data
   *
   * @param data - Data to process
   * @param verbosity - Verbosity level
   * @param maxFields - Maximum fields to include
   * @returns Processed data
   */
  public static applyVerbosity(data: any, verbosity: VerbosityLevel, maxFields: number): any {
    if (verbosity === 'raw') {
      return data; // Return everything
    }

    if (Array.isArray(data)) {
      return data.map(item => this.limitFields(item, maxFields));
    }

    if (typeof data === 'object' && data !== null) {
      return this.limitFields(data, maxFields);
    }

    return data;
  }

  /**
   * Limit number of fields in object
   *
   * Priority: Keep core fields (jnid, number, name, status, date_created)
   */
  private static limitFields(obj: any, maxFields: number): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const allKeys = Object.keys(obj);
    if (allKeys.length <= maxFields) {
      return obj;
    }

    // Core fields to always include
    const coreFields = ['jnid', 'number', 'name', 'status', 'status_name', 'date_created', 'type'];
    const result: any = {};

    // Add core fields first
    let fieldCount = 0;
    for (const field of coreFields) {
      if (field in obj && fieldCount < maxFields) {
        result[field] = obj[field];
        fieldCount++;
      }
    }

    // Add remaining fields up to limit
    for (const key of allKeys) {
      if (fieldCount >= maxFields) break;
      if (!(key in result)) {
        result[key] = obj[key];
        fieldCount++;
      }
    }

    return result;
  }

  /**
   * Truncate long text fields
   *
   * @param data - Data to process
   * @param maxLength - Maximum length for text fields
   * @returns Data with truncated text
   */
  public static truncateFields(data: any, maxLength: number): any {
    if (Array.isArray(data)) {
      return data.map(item => this.truncateFields(item, maxLength));
    }

    if (typeof data === 'object' && data !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string' && value.length > maxLength) {
          result[key] = value.substring(0, maxLength) + '...';
        } else if (typeof value === 'object' && value !== null) {
          result[key] = this.truncateFields(value, maxLength);
        } else {
          result[key] = value;
        }
      }
      return result;
    }

    return data;
  }

  /**
   * Count fields in data structure
   */
  public static countFields(data: any): number {
    if (Array.isArray(data)) {
      return data.length > 0 ? Object.keys(data[0]).length : 0;
    }

    if (typeof data === 'object' && data !== null) {
      return Object.keys(data).length;
    }

    return 0;
  }

  /**
   * Count rows in data structure
   */
  public static countRows(data: any): number {
    if (Array.isArray(data)) {
      return data.length;
    }

    return 1;
  }

  /**
   * Build error response envelope
   */
  public static buildError(
    error: Error | string,
    toolName: string,
    verbosity: VerbosityLevel = 'compact'
  ): ResponseEnvelope<null> {
    const errorMessage = typeof error === 'string' ? error : error.message;

    return {
      status: 'error',
      summary: null,
      error: errorMessage,
      metadata: {
        verbosity,
        size_bytes: calculateSize({ error: errorMessage }),
        field_count: 0,
        row_count: 0,
        tool_name: toolName,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
