/**
 * Record Type Normalizer
 * Maps custom record types to standard categories for analytics
 *
 * Fixes Issue #3: Record type classification mismatches
 * - "POST A GALERIA", "POST SEMANAL", "VIDEO - SEMANAL" now properly classified
 * - Bilingual support (English/Spanish)
 */

export interface RecordTypeMapping {
  pattern: RegExp;
  category: string;
  priority?: number;
}

const RECORD_TYPE_MAPPINGS: RecordTypeMapping[] = [
  // Social Media Posts (HIGH PRIORITY - Issue #3 Fix)
  { pattern: /post.*galeria|gallery.*post|post a la galeria/i, category: 'Social Media - Gallery', priority: 3 },
  { pattern: /post.*semanal|weekly.*post|semanal.*post/i, category: 'Social Media - Weekly', priority: 3 },
  { pattern: /video.*semanal|weekly.*video|semanal.*video/i, category: 'Social Media - Video', priority: 3 },
  { pattern: /social.*media|facebook|instagram|tiktok|twitter|linkedin/i, category: 'Social Media', priority: 2 },

  // Communication
  { pattern: /phone.*call|call.*phone|llamada|telephone/i, category: 'Phone Call', priority: 2 },
  { pattern: /email|correo|mensaje/i, category: 'Email', priority: 2 },
  { pattern: /meeting|reunion|appointment|cita/i, category: 'Meeting', priority: 3 },
  { pattern: /follow.*up|seguimiento|followup/i, category: 'Lead Follow-Up', priority: 2 },

  // Tasks - Expanded list from bug report
  { pattern: /task|tarea/i, category: 'Task', priority: 2 },
  { pattern: /initial.*appointment|primera.*cita/i, category: 'Initial Appointment', priority: 4 },
  { pattern: /final.*walk.*through|inspeccion.*final/i, category: 'Final Walk Through', priority: 4 },
  { pattern: /labor.*notes|notas.*trabajo/i, category: 'Labor Notes', priority: 3 },
  { pattern: /collect.*acv|cobrar.*acv|acv.*payment/i, category: 'Collect ACV Payment', priority: 4 },
  { pattern: /pull.*permit|sacar.*permiso|permit/i, category: 'Pull Permit', priority: 4 },
  { pattern: /project.*start|inicio.*proyecto|start.*date/i, category: 'Project Start Date', priority: 4 },

  // Inspections & Work
  { pattern: /inspection|inspeccion/i, category: 'Inspection', priority: 4 },
  { pattern: /estimate|presupuesto|quote/i, category: 'Estimate', priority: 3 },
  { pattern: /installation|instalacion/i, category: 'Installation', priority: 4 },
  { pattern: /repair|reparacion/i, category: 'Repair', priority: 4 },

  // Documentation
  { pattern: /document|documento|paperwork/i, category: 'Documentation', priority: 2 },
  { pattern: /contract|contrato/i, category: 'Contract', priority: 4 },
  { pattern: /invoice|factura/i, category: 'Invoice', priority: 3 },

  // Default fallback
  { pattern: /.*/, category: 'General Task', priority: 1 },
];

/**
 * Valid record type names that should be included in analytics
 * Based on bug report requirements
 */
export const VALID_RECORD_TYPES = [
  'Task',
  'Meeting',
  'Phone Call',
  'Labor Notes',
  'Initial Appointment',
  'Final Walk Through',
  'Lead Follow-Up',
  'Collect ACV Payment',
  'Pull Permit',
  'Project Start Date',
  'Social Media - Gallery',
  'Social Media - Weekly',
  'Social Media - Video',
  'Social Media',
];

export class RecordTypeNormalizer {
  /**
   * Normalize a record type name to standard category
   *
   * @param recordTypeName - Original record type name from JobNimbus
   * @returns Normalized record type with metadata
   */
  static normalize(recordTypeName: string | undefined): {
    original: string;
    normalized: string;
    priority: number;
    is_valid: boolean;
  } {
    const original = recordTypeName || 'Unknown';

    // Find best matching category
    let bestMatch = RECORD_TYPE_MAPPINGS[RECORD_TYPE_MAPPINGS.length - 1]; // Default fallback

    for (const mapping of RECORD_TYPE_MAPPINGS) {
      if (mapping.pattern.test(original)) {
        bestMatch = mapping;
        break;
      }
    }

    const normalized = bestMatch.category;
    const isValid = VALID_RECORD_TYPES.includes(normalized) ||
                    VALID_RECORD_TYPES.some(valid => normalized.includes(valid));

    return {
      original,
      normalized,
      priority: bestMatch.priority || 1,
      is_valid: isValid,
    };
  }

  /**
   * Batch normalize multiple record types
   *
   * @param recordTypes - Array of record type names
   * @returns Map of original → normalized names
   */
  static normalizeMany(recordTypes: Array<string | undefined>): Map<string, string> {
    const normalized = new Map<string, string>();

    for (const recordType of recordTypes) {
      const result = this.normalize(recordType);
      normalized.set(result.original, result.normalized);
    }

    return normalized;
  }

  /**
   * Check if a record type should be included in analytics
   * Based on bug report Issue #1 requirements
   */
  static shouldIncludeInAnalytics(recordTypeName: string | undefined): boolean {
    const normalized = this.normalize(recordTypeName);
    return normalized.is_valid;
  }
}
