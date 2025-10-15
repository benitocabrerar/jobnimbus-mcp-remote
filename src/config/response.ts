/**
 * Response Configuration for Handle-Based System
 *
 * Defines size limits, verbosity levels, and pagination defaults
 * to prevent chat saturation and optimize token usage.
 *
 * Key Metrics:
 * - Target: 70-90% reduction in response sizes
 * - Hard limit: 25 KB per response
 * - Default verbosity: compact (15 fields max)
 * - Handle TTL: 15 minutes
 *
 * @author Backend Architecture Team
 * @version 1.0.0
 */

export type VerbosityLevel = 'summary' | 'compact' | 'detailed' | 'raw';

/**
 * Response configuration constants
 */
export const RESPONSE_CONFIG = {
  /**
   * Verbosity level settings
   * Controls how many fields are included in responses
   */
  VERBOSITY: {
    DEFAULT: 'compact' as VerbosityLevel,
    SUMMARY_MAX_FIELDS: 5,      // Ultra-minimal: only critical fields
    COMPACT_MAX_FIELDS: 15,      // Default: essential fields for most use cases
    DETAILED_MAX_FIELDS: 50,     // Comprehensive: most fields without heavy data
  },

  /**
   * Pagination settings
   * Replaces from/size with cursor-based pagination
   */
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    MIN_PAGE_SIZE: 1,
  },

  /**
   * Response size limits
   * Prevents chat saturation and token overflow
   */
  LIMITS: {
    MAX_RESPONSE_SIZE_KB: 25,      // Hard limit before handle storage
    MAX_ROWS_PER_PAGE: 20,         // Maximum rows in a single response
    MAX_TEXT_FIELD_LENGTH: 200,    // Truncate long text fields
    WARN_SIZE_KB: 15,              // Warn at 15 KB (60% of limit)
  },

  /**
   * Handle storage configuration
   * Redis-backed temporary storage for large payloads
   */
  STORAGE: {
    HANDLE_TTL_SEC: 900,           // 15 minutes
    HANDLE_PREFIX: 'jn:handle:',   // Redis key prefix
    CLEANUP_INTERVAL_SEC: 300,     // Clean expired handles every 5 min
  },
} as const;

/**
 * Get maximum fields for verbosity level
 */
export function getMaxFields(verbosity: VerbosityLevel): number {
  switch (verbosity) {
    case 'summary':
      return RESPONSE_CONFIG.VERBOSITY.SUMMARY_MAX_FIELDS;
    case 'compact':
      return RESPONSE_CONFIG.VERBOSITY.COMPACT_MAX_FIELDS;
    case 'detailed':
      return RESPONSE_CONFIG.VERBOSITY.DETAILED_MAX_FIELDS;
    case 'raw':
      return Infinity;
    default:
      return RESPONSE_CONFIG.VERBOSITY.COMPACT_MAX_FIELDS;
  }
}

/**
 * Check if response size exceeds threshold
 */
export function exceedsThreshold(sizeBytes: number, threshold: 'warn' | 'hard'): boolean {
  const limitKB = threshold === 'warn'
    ? RESPONSE_CONFIG.LIMITS.WARN_SIZE_KB
    : RESPONSE_CONFIG.LIMITS.MAX_RESPONSE_SIZE_KB;

  return sizeBytes > (limitKB * 1024);
}

/**
 * Calculate response size in bytes
 */
export function calculateSize(data: any): number {
  try {
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  } catch {
    return 0;
  }
}

/**
 * Format size for display
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}
