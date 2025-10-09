/**
 * Measurement Parser Utility
 * Extracts measurements from text and validates formats
 */

export interface ParsedMeasurement {
  value: number;
  unit: string;
  original_text: string;
  confidence: number; // 0-1
}

// ============================================================================
// Regex Patterns for Common Measurements
// ============================================================================

const PATTERNS = {
  // Square feet patterns
  sqft: /(\d+[\.,]?\d*)\s*(sq\.?\s*ft\.?|square\s*feet|sf|sqft)/gi,

  // Linear feet patterns
  linearft: /(\d+[\.,]?\d*)\s*(lin\.?\s*ft\.?|linear\s*feet|lf|lineal\s*feet)/gi,

  // Roofing squares
  squares: /(\d+[\.,]?\d*)\s*(roofing\s*)?squares?/gi,

  // Pitch patterns (4/12, 6:12, 4-12, etc.)
  pitch: /(\d+)[\s]*[\/:\-][\s]*12/gi,

  // Dimensions patterns (12x16, 12' x 16', 12 by 16, etc.)
  dimensions: /(\d+[\.,]?\d*)[\s]*(?:x|by|×)[\s]*(\d+[\.,]?\d*)(?:\s*(?:ft|feet|'))?/gi,

  // Individual measurements with feet/inches
  feet: /(\d+[\.,]?\d*)[\s]*(?:ft|feet|')/gi,
  inches: /(\d+[\.,]?\d*)[\s]*(?:in|inches|")/gi,

  // Area with specific units
  area_generic: /(\d+[\.,]?\d*)\s*(sq|square)\s*(\w+)/gi,

  // Count/quantity patterns
  quantity: /(\d+[\.,]?\d*)\s*(pieces?|units?|items?|count)/gi
};

// ============================================================================
// Main Parsing Functions
// ============================================================================

/**
 * Parse square feet from text
 * Returns all matches with confidence scores
 */
export function parseSquareFeet(text: string): ParsedMeasurement[] {
  const results: ParsedMeasurement[] = [];

  // Try sqft pattern
  let matches = text.matchAll(PATTERNS.sqft);
  for (const match of matches) {
    const value = parseFloat(match[1].replace(',', ''));
    if (!isNaN(value) && value > 0) {
      results.push({
        value,
        unit: 'sqft',
        original_text: match[0],
        confidence: 0.95 // High confidence for explicit sqft
      });
    }
  }

  // Try dimensions pattern (LxW)
  matches = text.matchAll(PATTERNS.dimensions);
  for (const match of matches) {
    const length = parseFloat(match[1].replace(',', ''));
    const width = parseFloat(match[2].replace(',', ''));
    if (!isNaN(length) && !isNaN(width) && length > 0 && width > 0) {
      results.push({
        value: length * width,
        unit: 'sqft',
        original_text: match[0],
        confidence: 0.85 // Good confidence for dimensions
      });
    }
  }

  return results;
}

/**
 * Parse linear feet from text
 */
export function parseLinearFeet(text: string): ParsedMeasurement[] {
  const results: ParsedMeasurement[] = [];

  const matches = text.matchAll(PATTERNS.linearft);
  for (const match of matches) {
    const value = parseFloat(match[1].replace(',', ''));
    if (!isNaN(value) && value > 0) {
      results.push({
        value,
        unit: 'lf',
        original_text: match[0],
        confidence: 0.95
      });
    }
  }

  return results;
}

/**
 * Parse roofing squares from text
 * 1 square = 100 sqft
 */
export function parseRoofingSquares(text: string): ParsedMeasurement[] {
  const results: ParsedMeasurement[] = [];

  const matches = text.matchAll(PATTERNS.squares);
  for (const match of matches) {
    const value = parseFloat(match[1].replace(',', ''));
    if (!isNaN(value) && value > 0) {
      results.push({
        value,
        unit: 'square',
        original_text: match[0],
        confidence: 0.95
      });
    }
  }

  return results;
}

/**
 * Parse roof pitch from text
 * Returns pitch as string (e.g., "4/12", "6/12")
 */
export function parsePitch(text: string): ParsedMeasurement[] {
  const results: ParsedMeasurement[] = [];

  const matches = text.matchAll(PATTERNS.pitch);
  for (const match of matches) {
    const rise = parseInt(match[1]);
    if (!isNaN(rise) && rise >= 0 && rise <= 24) {
      results.push({
        value: rise, // Store rise number
        unit: 'pitch',
        original_text: match[0],
        confidence: 0.98
      });
    }
  }

  return results;
}

/**
 * Parse generic quantities from text
 */
export function parseQuantity(text: string): ParsedMeasurement[] {
  const results: ParsedMeasurement[] = [];

  const matches = text.matchAll(PATTERNS.quantity);
  for (const match of matches) {
    const value = parseFloat(match[1].replace(',', ''));
    if (!isNaN(value) && value > 0) {
      results.push({
        value,
        unit: 'quantity',
        original_text: match[0],
        confidence: 0.80
      });
    }
  }

  return results;
}

// ============================================================================
// Comprehensive Parser
// ============================================================================

export interface ParsedMeasurements {
  roof_area_sqft: ParsedMeasurement[];
  wall_area_sqft: ParsedMeasurement[];
  linear_feet: ParsedMeasurement[];
  roofing_squares: ParsedMeasurement[];
  pitch: ParsedMeasurement[];
  quantities: ParsedMeasurement[];
  dimensions: { length: number; width: number; original_text: string }[];
}

/**
 * Parse all measurements from text
 * Returns categorized measurements
 */
export function parseAllMeasurements(text: string): ParsedMeasurements {
  const result: ParsedMeasurements = {
    roof_area_sqft: [],
    wall_area_sqft: [],
    linear_feet: [],
    roofing_squares: [],
    pitch: [],
    quantities: [],
    dimensions: []
  };

  // Check for roof-related keywords
  const lowerText = text.toLowerCase();
  const isRoofContext = lowerText.includes('roof') ||
                        lowerText.includes('shingle') ||
                        lowerText.includes('pitch');

  const isWallContext = lowerText.includes('wall') ||
                         lowerText.includes('siding') ||
                         lowerText.includes('exterior');

  // Parse square feet
  const sqftMatches = parseSquareFeet(text);
  for (const match of sqftMatches) {
    if (isRoofContext) {
      result.roof_area_sqft.push(match);
    } else if (isWallContext) {
      result.wall_area_sqft.push(match);
    } else {
      // Default to roof if ambiguous
      result.roof_area_sqft.push({ ...match, confidence: match.confidence * 0.7 });
    }
  }

  // Parse other measurements
  result.linear_feet = parseLinearFeet(text);
  result.roofing_squares = parseRoofingSquares(text);
  result.pitch = parsePitch(text);
  result.quantities = parseQuantity(text);

  // Parse dimensions
  const dimensionMatches = text.matchAll(PATTERNS.dimensions);
  for (const match of dimensionMatches) {
    const length = parseFloat(match[1].replace(',', ''));
    const width = parseFloat(match[2].replace(',', ''));
    if (!isNaN(length) && !isNaN(width)) {
      result.dimensions.push({
        length,
        width,
        original_text: match[0]
      });
    }
  }

  return result;
}

// ============================================================================
// Validation and Normalization
// ============================================================================

/**
 * Validate measurement value
 */
export function isValidMeasurement(value: number, unit: string): boolean {
  if (isNaN(value) || value <= 0) return false;

  // Unit-specific validation
  switch (unit) {
    case 'sqft':
      return value >= 1 && value <= 1000000; // 1 sqft to 1M sqft
    case 'lf':
      return value >= 1 && value <= 100000; // 1 lf to 100K lf
    case 'square':
      return value >= 0.1 && value <= 10000; // 0.1 to 10K squares
    case 'pitch':
      return value >= 0 && value <= 24; // Roof pitch rise 0-24
    case 'quantity':
      return value >= 1 && value <= 1000000; // Generic quantity
    default:
      return value > 0;
  }
}

/**
 * Normalize pitch format
 * Converts various formats to standard "X/12"
 */
export function normalizePitch(pitch: string | number): string {
  if (typeof pitch === 'number') {
    return `${pitch}/12`;
  }

  const str = pitch.toString().trim();

  // Already in X/12 format
  if (/^\d+\/12$/.test(str)) {
    return str;
  }

  // Try to extract rise number
  const match = str.match(/(\d+)[\s]*[\/:\-][\s]*12/);
  if (match) {
    return `${match[1]}/12`;
  }

  // Try to parse just a number
  const num = parseInt(str);
  if (!isNaN(num) && num >= 0 && num <= 24) {
    return `${num}/12`;
  }

  // Default to 4/12 (common residential pitch)
  console.warn(`Could not parse pitch: ${pitch}, defaulting to 4/12`);
  return '4/12';
}

/**
 * Convert roofing squares to square feet
 */
export function squaresToSqft(squares: number): number {
  return squares * 100;
}

/**
 * Convert square feet to roofing squares
 */
export function sqftToSquares(sqft: number): number {
  return sqft / 100;
}

/**
 * Get best measurement from multiple parses
 * Returns highest confidence measurement
 */
export function getBestMeasurement(measurements: ParsedMeasurement[]): ParsedMeasurement | null {
  if (measurements.length === 0) return null;

  // Sort by confidence descending
  const sorted = [...measurements].sort((a, b) => b.confidence - a.confidence);
  return sorted[0];
}

/**
 * Calculate average measurement with weighted confidence
 */
export function getWeightedAverage(measurements: ParsedMeasurement[]): number | null {
  if (measurements.length === 0) return null;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const m of measurements) {
    weightedSum += m.value * m.confidence;
    totalWeight += m.confidence;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : null;
}
