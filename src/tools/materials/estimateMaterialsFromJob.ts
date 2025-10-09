/**
 * Estimate Materials From Job Tool
 * Intelligent material estimation from JobNimbus job/estimate data
 * Extracts measurements from custom fields and text, then routes to appropriate calculator
 */

import { BaseTool } from '../baseTool.js';
import { RoofingCalculator } from '../../services/calculations/RoofingCalculator.js';
import {
  extractMeasurementsFromJobData,
  getBestValue,
  calculateConfidenceScore,
  requiresManualReview
} from '../../utils/calculations/text-extraction.utils.js';
import type { EstimationInput, RoofingCalculationInput } from '../../types/calculations.types.js';

export class EstimateMaterialsFromJobTool extends BaseTool {
  private roofingCalculator = new RoofingCalculator();

  get definition() {
    return {
      name: 'estimate_materials_from_job',
      description: 'Intelligently estimate materials from JobNimbus job or estimate data. Extracts measurements from custom fields, line items, and text descriptions. Returns materials with confidence scores and manual review indicators.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          job_id: {
            type: 'string',
            description: 'JobNimbus job ID (JNID or job number)'
          },
          estimate_id: {
            type: 'string',
            description: 'JobNimbus estimate ID (alternative to job_id)'
          },
          scope_of_work: {
            type: 'string',
            description: 'Free text description of work scope (if job_id not provided)'
          },
          custom_fields: {
            type: 'object',
            description: 'Custom fields object with measurements (if job_id not provided)'
          },
          confidence_threshold: {
            type: 'number',
            description: 'Minimum confidence threshold for auto-estimation (0-1, default: 0.7)'
          }
        }
      }
    };
  }

  async execute(input: EstimationInput, context: any) {
    try {
      let jobData: any = {};

      // 1. Fetch job or estimate data from JobNimbus if ID provided
      if (input.job_id) {
        const response = await this.client.get(context.apiKey, `jobs/${input.job_id}`);
        jobData = response.data;
      } else if (input.estimate_id) {
        const response = await this.client.get(context.apiKey, `estimates/${input.estimate_id}`);
        jobData = response.data;
      } else {
        // Use provided custom fields and scope
        jobData = {
          custom_fields: input.custom_fields || {},
          scope_of_work: input.scope_of_work || '',
          name: input.scope_of_work || ''
        };
      }

      // 2. Extract measurements from job data
      const extracted = extractMeasurementsFromJobData(jobData);

      // 3. Calculate confidence scores
      const roofAreaConfidence = calculateConfidenceScore(extracted.roof_area);
      const pitchConfidence = calculateConfidenceScore(extracted.pitch);

      // 4. Get best values
      const bestRoofArea = getBestValue(extracted.roof_area);
      const bestPitch = getBestValue(extracted.pitch);

      // Check if manual review needed
      const threshold = input.confidence_threshold || 0.7;
      const reviewCheck = requiresManualReview(roofAreaConfidence, pitchConfidence, threshold);

      // 5. Prepare calculation input
      const calculationInput: RoofingCalculationInput = {
        roof_area_sqft: typeof bestRoofArea === 'number' ? bestRoofArea : 0,
        pitch: typeof bestPitch === 'string' ? bestPitch : '4/12', // Default pitch
        roof_type: 'architectural_shingles', // Default, could be extracted from job type
        include_waste: true
      };

      // Add optional linear measurements if extracted
      if (extracted.linear.ridge.length > 0) {
        calculationInput.ridge_length_lf = getBestValue(extracted.linear.ridge) as number;
      }
      if (extracted.linear.valley.length > 0) {
        calculationInput.valley_length_lf = getBestValue(extracted.linear.valley) as number;
      }
      if (extracted.linear.eave.length > 0) {
        calculationInput.eave_length_lf = getBestValue(extracted.linear.eave) as number;
      }
      if (extracted.linear.rake.length > 0) {
        calculationInput.rake_length_lf = getBestValue(extracted.linear.rake) as number;
      }

      // 6. Calculate materials (if sufficient data)
      let materials: any[] = [];
      let calculation_result: any = null;
      let totals = {
        total_cost: 0,
        total_price: 0,
        margin_percent: 0
      };

      if (calculationInput.roof_area_sqft > 0) {
        calculation_result = await this.roofingCalculator.calculateMaterials(calculationInput);
        materials = calculation_result.materials;
        totals = {
          total_cost: calculation_result.totals.total_cost,
          total_price: calculation_result.totals.total_price,
          margin_percent: calculation_result.totals.margin_percent
        };
      }

      // 7. Return comprehensive result
      return {
        success: true,
        job_info: {
          job_id: input.job_id,
          estimate_id: input.estimate_id,
          job_type: jobData.job_type || jobData.type || 'unknown'
        },
        extraction_results: {
          roof_area_sqft: extracted.roof_area.map(e => ({
            source: e.source,
            value: e.value,
            confidence: e.confidence,
            field_name: e.field_name
          })),
          pitch: extracted.pitch.map(e => ({
            source: e.source,
            value: e.value,
            confidence: e.confidence,
            field_name: e.field_name
          })),
          linear_measurements: {
            ridge: extracted.linear.ridge.length,
            valley: extracted.linear.valley.length,
            eave: extracted.linear.eave.length,
            rake: extracted.linear.rake.length
          }
        },
        confidence_scores: {
          roof_area: roofAreaConfidence,
          pitch: pitchConfidence,
          overall: (roofAreaConfidence + pitchConfidence) / 2
        },
        requires_manual_review: reviewCheck.required,
        review_reasons: reviewCheck.reasons,
        materials,
        totals,
        calculation_summary: calculation_result?.calculation_summary,
        recommendations: calculation_result?.recommendations || [],
        warnings: calculation_result?.warnings || [],
        metadata: {
          calculated_at: new Date().toISOString(),
          instance: context.instanceName || 'unknown',
          extraction_sources: {
            custom_fields: extracted.roof_area.filter(e => e.source === 'custom_fields').length,
            text_parsing: extracted.roof_area.filter(e => e.source === 'text_parsing').length
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Estimation failed',
        requires_manual_review: true,
        review_reasons: ['Estimation failed - manual input required'],
        details: error
      };
    }
  }
}

// Export default instance creator
export default () => new EstimateMaterialsFromJobTool();
