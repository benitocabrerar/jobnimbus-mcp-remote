/**
 * Validation Utilities for Material Tracking System
 * Input validation and sanitization functions
 */

import { MaterialAnalysisError, ErrorCode } from '../types/materials.js';

/**
 * Validate estimate ID format
 * @param estimateId - Estimate ID to validate
 * @throws MaterialAnalysisError if invalid
 */
export function validateEstimateId(estimateId: string): void {
  if (!estimateId || typeof estimateId !== 'string') {
    throw new MaterialAnalysisError(
      'Estimate ID is required and must be a string',
      ErrorCode.INVALID_INPUT,
      { estimateId }
    );
  }

  if (estimateId.trim().length === 0) {
    throw new MaterialAnalysisError(
      'Estimate ID cannot be empty',
      ErrorCode.INVALID_INPUT,
      { estimateId }
    );
  }
}

/**
 * Validate date string format (YYYY-MM-DD)
 * @param dateStr - Date string to validate
 * @param fieldName - Name of the field (for error messages)
 * @throws MaterialAnalysisError if invalid
 */
export function validateDateFormat(dateStr: string, fieldName: string): void {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!dateRegex.test(dateStr)) {
    throw new MaterialAnalysisError(
      `${fieldName} must be in YYYY-MM-DD format`,
      ErrorCode.INVALID_INPUT,
      { [fieldName]: dateStr }
    );
  }

  // Validate that it's a real date
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new MaterialAnalysisError(
      `${fieldName} is not a valid date`,
      ErrorCode.INVALID_INPUT,
      { [fieldName]: dateStr }
    );
  }
}

/**
 * Validate date range
 * @param dateFrom - Start date
 * @param dateTo - End date
 * @throws MaterialAnalysisError if invalid
 */
export function validateDateRange(dateFrom?: string, dateTo?: string): void {
  if (dateFrom) {
    validateDateFormat(dateFrom, 'date_from');
  }

  if (dateTo) {
    validateDateFormat(dateTo, 'date_to');
  }

  if (dateFrom && dateTo) {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);

    if (from > to) {
      throw new MaterialAnalysisError(
        'date_from cannot be after date_to',
        ErrorCode.INVALID_INPUT,
        { date_from: dateFrom, date_to: dateTo }
      );
    }
  }
}

/**
 * Validate aggregate_by parameter
 * @param aggregateBy - Aggregation period
 * @throws MaterialAnalysisError if invalid
 */
export function validateAggregateBy(aggregateBy?: string): void {
  const validValues = ['day', 'week', 'month'];

  if (aggregateBy && !validValues.includes(aggregateBy)) {
    throw new MaterialAnalysisError(
      `aggregate_by must be one of: ${validValues.join(', ')}`,
      ErrorCode.INVALID_INPUT,
      { aggregate_by: aggregateBy, valid_values: validValues }
    );
  }
}

/**
 * Validate positive number
 * @param value - Number to validate
 * @param fieldName - Name of the field (for error messages)
 * @param min - Minimum allowed value (optional)
 * @param max - Maximum allowed value (optional)
 * @throws MaterialAnalysisError if invalid
 */
export function validatePositiveNumber(
  value: number,
  fieldName: string,
  min?: number,
  max?: number
): void {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new MaterialAnalysisError(
      `${fieldName} must be a valid number`,
      ErrorCode.INVALID_INPUT,
      { [fieldName]: value }
    );
  }

  if (value < 0) {
    throw new MaterialAnalysisError(
      `${fieldName} must be positive`,
      ErrorCode.INVALID_INPUT,
      { [fieldName]: value }
    );
  }

  if (min !== undefined && value < min) {
    throw new MaterialAnalysisError(
      `${fieldName} must be at least ${min}`,
      ErrorCode.INVALID_INPUT,
      { [fieldName]: value, min }
    );
  }

  if (max !== undefined && value > max) {
    throw new MaterialAnalysisError(
      `${fieldName} must be at most ${max}`,
      ErrorCode.INVALID_INPUT,
      { [fieldName]: value, max }
    );
  }
}

/**
 * Validate array of strings
 * @param arr - Array to validate
 * @param fieldName - Name of the field (for error messages)
 * @throws MaterialAnalysisError if invalid
 */
export function validateStringArray(arr: any, fieldName: string): void {
  if (!Array.isArray(arr)) {
    throw new MaterialAnalysisError(
      `${fieldName} must be an array`,
      ErrorCode.INVALID_INPUT,
      { [fieldName]: arr }
    );
  }

  const allStrings = arr.every(item => typeof item === 'string');
  if (!allStrings) {
    throw new MaterialAnalysisError(
      `${fieldName} must contain only strings`,
      ErrorCode.INVALID_INPUT,
      { [fieldName]: arr }
    );
  }
}

/**
 * Sanitize string input (remove special characters, trim)
 * @param str - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str.trim();
}

/**
 * Validate item type filter
 * @param itemType - Item type to validate
 * @throws MaterialAnalysisError if invalid
 */
export function validateItemType(itemType?: string): void {
  const validTypes = ['material', 'labor', 'all'];

  if (itemType && !validTypes.includes(itemType)) {
    throw new MaterialAnalysisError(
      `filter_by_type must be one of: ${validTypes.join(', ')}`,
      ErrorCode.INVALID_INPUT,
      { filter_by_type: itemType, valid_values: validTypes }
    );
  }
}

/**
 * Ensure data is available for analysis
 * @param data - Data array to check
 * @param context - Context message for error
 * @throws MaterialAnalysisError if no data
 */
export function ensureDataAvailable<T>(data: T[], context: string): void {
  if (!data || data.length === 0) {
    throw new MaterialAnalysisError(
      `No data available for ${context}`,
      ErrorCode.NO_DATA_AVAILABLE,
      { context }
    );
  }
}

/**
 * Ensure sufficient data for statistical analysis
 * @param data - Data array to check
 * @param minCount - Minimum required count
 * @param context - Context message for error
 * @throws MaterialAnalysisError if insufficient data
 */
export function ensureSufficientData<T>(
  data: T[],
  minCount: number,
  context: string
): void {
  if (!data || data.length < minCount) {
    throw new MaterialAnalysisError(
      `Insufficient data for ${context}. Need at least ${minCount} records, got ${data?.length || 0}`,
      ErrorCode.INSUFFICIENT_DATA,
      { context, required: minCount, available: data?.length || 0 }
    );
  }
}
