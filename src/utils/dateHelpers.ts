/**
 * Date Helpers for Material Tracking System
 * Utilities for date parsing, formatting, and period calculations
 */

/**
 * Parse a date string (YYYY-MM-DD) to Unix timestamp
 * If no date string provided, returns 0
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Unix timestamp in seconds
 */
export function parseDate(dateStr?: string): number {
  if (!dateStr) return 0;

  try {
    const date = new Date(dateStr + 'T00:00:00Z');
    return Math.floor(date.getTime() / 1000);
  } catch {
    return 0;
  }
}

/**
 * Format Unix timestamp to YYYY-MM-DD string
 * @param timestamp - Unix timestamp in seconds
 * @returns Date string in YYYY-MM-DD format
 */
export function formatDate(timestamp: number): string {
  if (!timestamp || timestamp <= 0) return '';

  try {
    const date = new Date(timestamp * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

/**
 * Get period key for aggregation (day, week, or month)
 * @param timestamp - Unix timestamp in seconds
 * @param aggregateBy - Aggregation period ('day', 'week', or 'month')
 * @returns Period key string
 */
export function getPeriodKey(
  timestamp: number,
  aggregateBy: 'day' | 'week' | 'month'
): string {
  if (!timestamp || timestamp <= 0) return '';

  try {
    const date = new Date(timestamp * 1000);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();

    switch (aggregateBy) {
      case 'day':
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      case 'week': {
        // Get ISO week number
        const startOfYear = new Date(Date.UTC(year, 0, 1));
        const weekNum = Math.ceil(
          ((date.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7
        );
        return `${year}-W${String(weekNum).padStart(2, '0')}`;
      }

      case 'month':
        return `${year}-${String(month).padStart(2, '0')}`;

      default:
        return formatDate(timestamp);
    }
  } catch {
    return '';
  }
}

/**
 * Calculate number of months between two dates
 * @param dateFrom - Start date in YYYY-MM-DD format
 * @param dateTo - End date in YYYY-MM-DD format
 * @returns Number of months (rounded up)
 */
export function getMonthsBetween(dateFrom?: string, dateTo?: string): number {
  const fromTs = parseDate(dateFrom);
  const toTs = parseDate(dateTo);

  if (!fromTs && !toTs) {
    // Default to 3 months if no dates provided
    return 3;
  }

  const from = fromTs || toTs;
  const to = toTs || Date.now() / 1000;

  const diffMs = (to - from) * 1000;
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44); // Average days per month

  return Math.max(1, Math.ceil(diffMonths));
}

/**
 * Get start of day timestamp
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Unix timestamp at start of day (00:00:00)
 */
export function getStartOfDay(dateStr: string): number {
  return parseDate(dateStr);
}

/**
 * Get end of day timestamp
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Unix timestamp at end of day (23:59:59)
 */
export function getEndOfDay(dateStr: string): number {
  const startTs = parseDate(dateStr);
  return startTs > 0 ? startTs + 86399 : 0;
}

/**
 * Get current timestamp
 * @returns Current Unix timestamp in seconds
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get current date in YYYY-MM-DD format
 * @returns Current date string in YYYY-MM-DD format
 */
export function getCurrentDate(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate days since timestamp
 * @param timestamp - Unix timestamp in seconds
 * @returns Number of days since timestamp
 */
export function getDaysSince(timestamp: number): number {
  if (!timestamp || timestamp <= 0) return 0;

  const now = getCurrentTimestamp();
  const diffSeconds = now - timestamp;
  return Math.floor(diffSeconds / 86400);
}

/**
 * Add days to a timestamp
 * @param timestamp - Unix timestamp in seconds
 * @param days - Number of days to add
 * @returns New timestamp
 */
export function addDays(timestamp: number, days: number): number {
  return timestamp + (days * 86400);
}

/**
 * Check if timestamp is within date range
 * @param timestamp - Unix timestamp to check
 * @param dateFrom - Start date (YYYY-MM-DD)
 * @param dateTo - End date (YYYY-MM-DD)
 * @returns True if timestamp is within range
 */
export function isWithinRange(
  timestamp: number,
  dateFrom?: string,
  dateTo?: string
): boolean {
  if (!timestamp || timestamp <= 0) return false;

  const fromTs = parseDate(dateFrom);
  const toTs = parseDate(dateTo);

  if (fromTs > 0 && timestamp < fromTs) return false;
  if (toTs > 0 && timestamp > getEndOfDay(dateTo!)) return false;

  return true;
}
