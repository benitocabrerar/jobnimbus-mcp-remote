/**
 * Text Extraction Utilities
 * Extract measurements and material data from JobNimbus job/estimate data
 */

import type { MeasurementExtraction } from '../../types/calculations.types.js';
import {
  parseAllMeasurements,
  normalizePitch
} from './measurement-parser.js';

// ============================================================================
// Field Mapping
// ============================================================================

/**
 * Common custom field names for roof measurements
 */
const ROOF_AREA_FIELD_NAMES = [
  'roof_area',
  'roof_size',
  'total_roof_area',
  'roofing_area',
  'roof_sqft',
  'roof_square_feet',
  'roof_area_sqft',
  'sq_ft',
  'square_feet',
  'area'
];

/**
 * Common custom field names for roof pitch
 */
const PITCH_FIELD_NAMES = [
  'pitch',
  'roof_pitch',
  'slope',
  'roof_slope',
  'rise',
  'roof_rise'
];

/**
 * Common custom field names for wall/siding area
 */
const WALL_AREA_FIELD_NAMES = [
  'wall_area',
  'siding_area',
  'exterior_area',
  'wall_sqft',
  'siding_sqft',
  'total_wall_area'
];

/**
 * Common custom field names for linear measurements
 */
const LINEAR_FIELD_NAMES = {
  ridge: ['ridge_length', 'ridge_lf', 'ridge'],
  valley: ['valley_length', 'valley_lf', 'valleys'],
  eave: ['eave_length', 'eave_lf', 'eaves'],
  rake: ['rake_length', 'rake_lf', 'rakes'],
  trim: ['trim_length', 'trim_lf', 'trim']
};

// ============================================================================
// Custom Fields Extraction
// ============================================================================

/**
 * Extract roof area from custom fields
 * @param custom_fields JobNimbus custom fields object
 * @returns Array of extraction results
 */
export function extractRoofAreaFromFields(custom_fields: Record<string, any>): MeasurementExtraction[] {
  const results: MeasurementExtraction[] = [];

  if (!custom_fields) return results;

  // Check each known field name
  for (const fieldName of ROOF_AREA_FIELD_NAMES) {
    if (fieldName in custom_fields) {
      const value = parseNumericValue(custom_fields[fieldName]);
      if (value !== null && value > 0) {
        results.push({
          source: 'custom_fields',
          field_name: fieldName,
          value,
          confidence: 0.95 // High confidence for explicit custom fields
        });
      }
    }
  }

  // Also check for variations with different casing
  const lowerKeys = Object.keys(custom_fields).map(k => k.toLowerCase());
  for (const fieldName of ROOF_AREA_FIELD_NAMES) {
    const index = lowerKeys.indexOf(fieldName.toLowerCase());
    if (index >= 0) {
      const actualKey = Object.keys(custom_fields)[index];
      const value = parseNumericValue(custom_fields[actualKey]);
      if (value !== null && value > 0 && !results.some(r => r.field_name.toLowerCase() === fieldName.toLowerCase())) {
        results.push({
          source: 'custom_fields',
          field_name: actualKey,
          value,
          confidence: 0.95
        });
      }
    }
  }

  return results;
}

/**
 * Extract roof pitch from custom fields
 */
export function extractPitchFromFields(custom_fields: Record<string, any>): MeasurementExtraction[] {
  const results: MeasurementExtraction[] = [];

  if (!custom_fields) return results;

  for (const fieldName of PITCH_FIELD_NAMES) {
    if (fieldName in custom_fields) {
      const rawValue = custom_fields[fieldName];
      const normalizedPitch = normalizePitch(rawValue);

      results.push({
        source: 'custom_fields',
        field_name: fieldName,
        value: normalizedPitch,
        confidence: 0.95,
        raw_text: String(rawValue)
      });
    }
  }

  // Check case-insensitive
  const lowerKeys = Object.keys(custom_fields).map(k => k.toLowerCase());
  for (const fieldName of PITCH_FIELD_NAMES) {
    const index = lowerKeys.indexOf(fieldName.toLowerCase());
    if (index >= 0) {
      const actualKey = Object.keys(custom_fields)[index];
      const rawValue = custom_fields[actualKey];
      const normalizedPitch = normalizePitch(rawValue);

      if (!results.some(r => r.field_name.toLowerCase() === fieldName.toLowerCase())) {
        results.push({
          source: 'custom_fields',
          field_name: actualKey,
          value: normalizedPitch,
          confidence: 0.95,
          raw_text: String(rawValue)
        });
      }
    }
  }

  return results;
}

/**
 * Extract wall area from custom fields
 */
export function extractWallAreaFromFields(custom_fields: Record<string, any>): MeasurementExtraction[] {
  const results: MeasurementExtraction[] = [];

  if (!custom_fields) return results;

  for (const fieldName of WALL_AREA_FIELD_NAMES) {
    if (fieldName in custom_fields) {
      const value = parseNumericValue(custom_fields[fieldName]);
      if (value !== null && value > 0) {
        results.push({
          source: 'custom_fields',
          field_name: fieldName,
          value,
          confidence: 0.95
        });
      }
    }
  }

  return results;
}

/**
 * Extract linear measurements from custom fields
 */
export function extractLinearMeasurements(custom_fields: Record<string, any>): Record<string, MeasurementExtraction[]> {
  const results: Record<string, MeasurementExtraction[]> = {
    ridge: [],
    valley: [],
    eave: [],
    rake: [],
    trim: []
  };

  if (!custom_fields) return results;

  for (const [category, fieldNames] of Object.entries(LINEAR_FIELD_NAMES)) {
    for (const fieldName of fieldNames) {
      if (fieldName in custom_fields) {
        const value = parseNumericValue(custom_fields[fieldName]);
        if (value !== null && value > 0) {
          results[category].push({
            source: 'custom_fields',
            field_name: fieldName,
            value,
            confidence: 0.95
          });
        }
      }
    }
  }

  return results;
}

// ============================================================================
// Text-Based Extraction
// ============================================================================

/**
 * Extract measurements from text fields (scope of work, notes, etc.)
 */
export function extractMeasurementsFromText(text: string): {
  roof_area: MeasurementExtraction[];
  pitch: MeasurementExtraction[];
  linear_measurements: MeasurementExtraction[];
} {
  const parsed = parseAllMeasurements(text);

  return {
    roof_area: [
      ...parsed.roof_area_sqft.map(m => ({
        source: 'text_parsing' as const,
        field_name: 'scope_of_work',
        value: m.value,
        confidence: m.confidence * 0.8, // Reduce confidence for text parsing
        raw_text: m.original_text
      })),
      ...parsed.roofing_squares.map(m => ({
        source: 'text_parsing' as const,
        field_name: 'scope_of_work',
        value: m.value * 100, // Convert squares to sqft
        confidence: m.confidence * 0.85,
        raw_text: m.original_text
      }))
    ],
    pitch: parsed.pitch.map(m => ({
      source: 'text_parsing' as const,
      field_name: 'scope_of_work',
      value: normalizePitch(m.value),
      confidence: m.confidence * 0.9,
      raw_text: m.original_text
    })),
    linear_measurements: parsed.linear_feet.map(m => ({
      source: 'text_parsing' as const,
      field_name: 'scope_of_work',
      value: m.value,
      confidence: m.confidence * 0.8,
      raw_text: m.original_text
    }))
  };
}

/**
 * Extract measurements from JobNimbus job/estimate name and description
 */
export function extractMeasurementsFromJobData(jobData: any): {
  roof_area: MeasurementExtraction[];
  wall_area: MeasurementExtraction[];
  pitch: MeasurementExtraction[];
  linear: Record<string, MeasurementExtraction[]>;
} {
  const results = {
    roof_area: [] as MeasurementExtraction[],
    wall_area: [] as MeasurementExtraction[],
    pitch: [] as MeasurementExtraction[],
    linear: {
      ridge: [] as MeasurementExtraction[],
      valley: [] as MeasurementExtraction[],
      eave: [] as MeasurementExtraction[],
      rake: [] as MeasurementExtraction[],
      trim: [] as MeasurementExtraction[]
    }
  };

  if (!jobData) return results;

  // Extract from custom fields
  if (jobData.custom_fields) {
    results.roof_area.push(...extractRoofAreaFromFields(jobData.custom_fields));
    results.wall_area.push(...extractWallAreaFromFields(jobData.custom_fields));
    results.pitch.push(...extractPitchFromFields(jobData.custom_fields));

    const linearMeasurements = extractLinearMeasurements(jobData.custom_fields);
    for (const [key, measurements] of Object.entries(linearMeasurements)) {
      if (key in results.linear) {
        (results.linear as any)[key].push(...measurements);
      }
    }
  }

  // Extract from text fields
  const textFields = [
    jobData.name,
    jobData.display_name,
    jobData.description,
    jobData.notes,
    jobData.scope_of_work
  ].filter(Boolean);

  for (const text of textFields) {
    const extracted = extractMeasurementsFromText(String(text));
    results.roof_area.push(...extracted.roof_area);
    results.pitch.push(...extracted.pitch);
    results.linear.ridge.push(...extracted.linear_measurements);
  }

  return results;
}

// ============================================================================
// Confidence Scoring
// ============================================================================

/**
 * Calculate overall confidence score based on multiple extractions
 * @param extractions Array of measurement extractions
 * @returns Confidence score 0-1
 */
export function calculateConfidenceScore(extractions: MeasurementExtraction[]): number {
  if (extractions.length === 0) return 0;

  // Weight factors
  const sourceWeights = {
    custom_fields: 1.0,
    line_items: 0.9,
    text_parsing: 0.7,
    user_input: 0.95
  };

  // Calculate weighted average confidence
  let totalWeight = 0;
  let weightedSum = 0;

  for (const extraction of extractions) {
    const sourceWeight = sourceWeights[extraction.source] || 0.5;
    const weight = extraction.confidence * sourceWeight;
    weightedSum += weight;
    totalWeight += sourceWeight;
  }

  const avgConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Bonus for multiple consistent sources
  if (extractions.length >= 2) {
    const values = extractions.map(e => typeof e.value === 'number' ? e.value : 0);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    const coefficientOfVariation = Math.sqrt(variance) / avg;

    // If values are consistent (low CV), boost confidence
    if (coefficientOfVariation < 0.1) {
      return Math.min(1.0, avgConfidence * 1.2);
    }
  }

  return avgConfidence;
}

/**
 * Check if manual review is needed based on confidence and data quality
 */
export function requiresManualReview(
  roofAreaConfidence: number,
  pitchConfidence: number,
  minConfidenceThreshold: number = 0.7
): { required: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (roofAreaConfidence < minConfidenceThreshold) {
    reasons.push(`Low confidence in roof area measurement (${(roofAreaConfidence * 100).toFixed(0)}%)`);
  }

  if (pitchConfidence < minConfidenceThreshold) {
    reasons.push(`Low confidence in pitch measurement (${(pitchConfidence * 100).toFixed(0)}%)`);
  }

  if (roofAreaConfidence === 0) {
    reasons.push('No roof area measurement found');
  }

  if (pitchConfidence === 0) {
    reasons.push('No pitch measurement found - assuming 4/12');
  }

  return {
    required: reasons.length > 0,
    reasons
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse numeric value from various formats
 * Handles strings, numbers, and special formats
 */
function parseNumericValue(value: any): number | null {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    // Remove common non-numeric characters
    const cleaned = value.replace(/[^0-9.,\-]/g, '');

    // Handle decimal comma (European format)
    const normalized = cleaned.replace(',', '.');

    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Get best value from multiple extractions
 * Prioritizes higher confidence and custom fields
 */
export function getBestValue(extractions: MeasurementExtraction[]): number | string | null {
  if (extractions.length === 0) return null;

  // Sort by source priority and confidence
  const sorted = [...extractions].sort((a, b) => {
    const sourceOrder = { custom_fields: 0, user_input: 1, line_items: 2, text_parsing: 3 };
    const aOrder = sourceOrder[a.source] ?? 99;
    const bOrder = sourceOrder[b.source] ?? 99;

    if (aOrder !== bOrder) return aOrder - bOrder;
    return b.confidence - a.confidence;
  });

  return sorted[0].value;
}
