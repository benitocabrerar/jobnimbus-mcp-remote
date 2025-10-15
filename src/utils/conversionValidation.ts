/**
 * Conversion Validation Utility
 *
 * Validates if a job or sales rep has real financial data backing conversion claims.
 * Used to prevent false positives in conversion_rate calculations where jobs are
 * marked as "won" but have no actual revenue (approved estimates or invoices).
 *
 * PROBLEM SOLVED:
 * Before this fix, conversion rates were calculated solely based on job status
 * (Won/Paid & Closed) without verifying financial data exists. This resulted in
 * inflated conversion rates (e.g., 100% conversion with $0 revenue).
 *
 * SOLUTION:
 * conversion_rate = (jobs_with(invoice_total > 0 OR estimates_approved > 0)) / total_jobs
 *
 * @module utils/conversionValidation
 */

/**
 * Result of conversion validation
 */
export interface ConversionValidation {
  /**
   * True if financial data exists to back the conversion claim
   * (either total_value > 0 OR estimates_approved > 0)
   */
  hasFinancialData: boolean;

  /**
   * Total monetary value from approved estimates or invoices
   */
  total_value: number;

  /**
   * Count of approved estimates
   */
  estimates_approved: number;
}

/**
 * Validate if a job/rep has real financial data backing its conversion
 *
 * This function ensures conversion_rate calculations are based on actual revenue
 * rather than just job status. A job can be marked as "Won" or "Paid & Closed"
 * but if it has no approved estimates and $0 value, it should NOT count as a
 * conversion.
 *
 * @param totalValue - Total monetary value (from estimates or invoices)
 * @param estimatesApproved - Count of approved estimates
 * @returns Validation result with hasFinancialData boolean
 *
 * @example
 * // Case 1: Real conversion (has approved estimate)
 * const result1 = validate_conversion_real(5000, 1);
 * // Returns: { hasFinancialData: true, total_value: 5000, estimates_approved: 1 }
 *
 * @example
 * // Case 2: False positive (job marked "won" but no revenue)
 * const result2 = validate_conversion_real(0, 0);
 * // Returns: { hasFinancialData: false, total_value: 0, estimates_approved: 0 }
 *
 * @example
 * // Case 3: Has value but no approved estimates yet (count as conversion)
 * const result3 = validate_conversion_real(3500, 0);
 * // Returns: { hasFinancialData: true, total_value: 3500, estimates_approved: 0 }
 */
export function validate_conversion_real(
  totalValue: number,
  estimatesApproved: number
): ConversionValidation {
  // Normalize inputs (handle undefined/null)
  const total_value = totalValue || 0;
  const estimates_approved = estimatesApproved || 0;

  // A conversion is "real" if there's either monetary value OR approved estimates
  const hasFinancialData = total_value > 0 || estimates_approved > 0;

  return {
    hasFinancialData,
    total_value,
    estimates_approved,
  };
}
