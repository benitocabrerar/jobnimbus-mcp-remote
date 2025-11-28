/**
 * Status Mapping Utilities - Central status categorization for JobNimbus jobs
 *
 * CRITICAL FIX: Expanded status lists to properly recognize JobNimbus statuses
 *
 * JobNimbus uses various status names across different accounts/workflows:
 * - "Job Completed" indicates a won deal (not just "won")
 * - "Signed Contract" indicates a won deal
 * - "Paid & Closed" indicates a won deal
 * - etc.
 *
 * Using .includes() matching to handle variations like:
 * - "Job Completed - Paid"
 * - "Signed Contract - Approved"
 */

/**
 * Status patterns that indicate a WON deal
 * Uses .includes() matching for flexibility with status variations
 */
export const WON_STATUS_PATTERNS = [
  'won',
  'complete',
  'completed',
  'job completed',
  'signed contract',
  'sold',
  'approved',
  'paid & closed',
  'paid and closed',
  'closed won',
  'invoiced',
  'paid',
  'finished',
  'closed',
] as const;

/**
 * Status patterns that indicate a LOST deal
 */
export const LOST_STATUS_PATTERNS = [
  'lost',
  'cancelled',
  'canceled',
  'declined',
  'rejected',
  'dead',
  'no sale',
] as const;

/**
 * Status patterns that indicate an ACTIVE/PENDING deal
 */
export const ACTIVE_STATUS_PATTERNS = [
  'lead',
  'estimating',
  'pending',
  'in progress',
  'scheduled',
  'appointment',
  'job prep',
  'proposal',
  'negotiation',
  'follow up',
  'new',
  'open',
] as const;

/**
 * Check if a status indicates a WON deal
 * @param status - The job status string (e.g., "Job Completed")
 * @returns true if the status matches any won pattern
 */
export function isWonStatus(status: string): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase().trim();

  // First check if it's a lost status (to avoid false positives like "completed but lost")
  if (isLostStatus(status)) return false;

  return WON_STATUS_PATTERNS.some(pattern => normalized.includes(pattern));
}

/**
 * Check if a status indicates a LOST deal
 * @param status - The job status string (e.g., "Lost")
 * @returns true if the status matches any lost pattern
 */
export function isLostStatus(status: string): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase().trim();
  return LOST_STATUS_PATTERNS.some(pattern => normalized.includes(pattern));
}

/**
 * Check if a status indicates an ACTIVE/PENDING deal
 * @param status - The job status string
 * @returns true if the status matches any active pattern
 */
export function isActiveStatus(status: string): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase().trim();

  // If it's won or lost, it's not active
  if (isWonStatus(status) || isLostStatus(status)) return false;

  return ACTIVE_STATUS_PATTERNS.some(pattern => normalized.includes(pattern));
}

/**
 * Categorize a job status into won/lost/active
 * @param status - The job status string
 * @returns 'won' | 'lost' | 'active' | 'unknown'
 */
export function categorizeStatus(status: string): 'won' | 'lost' | 'active' | 'unknown' {
  if (!status) return 'unknown';

  if (isLostStatus(status)) return 'lost';
  if (isWonStatus(status)) return 'won';
  if (isActiveStatus(status)) return 'active';

  return 'unknown';
}

/**
 * Get detailed status classification with logging info
 * Useful for debugging status mapping issues
 */
export function getStatusDetails(status: string): {
  original: string;
  normalized: string;
  category: 'won' | 'lost' | 'active' | 'unknown';
  matchedPattern: string | null;
} {
  if (!status) {
    return {
      original: '',
      normalized: '',
      category: 'unknown',
      matchedPattern: null,
    };
  }

  const normalized = status.toLowerCase().trim();

  // Check lost first
  const lostMatch = LOST_STATUS_PATTERNS.find(pattern => normalized.includes(pattern));
  if (lostMatch) {
    return {
      original: status,
      normalized,
      category: 'lost',
      matchedPattern: lostMatch,
    };
  }

  // Check won
  const wonMatch = WON_STATUS_PATTERNS.find(pattern => normalized.includes(pattern));
  if (wonMatch) {
    return {
      original: status,
      normalized,
      category: 'won',
      matchedPattern: wonMatch,
    };
  }

  // Check active
  const activeMatch = ACTIVE_STATUS_PATTERNS.find(pattern => normalized.includes(pattern));
  if (activeMatch) {
    return {
      original: status,
      normalized,
      category: 'active',
      matchedPattern: activeMatch,
    };
  }

  return {
    original: status,
    normalized,
    category: 'unknown',
    matchedPattern: null,
  };
}
