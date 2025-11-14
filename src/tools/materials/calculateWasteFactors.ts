/**
 * Calculate Waste Factors Tool - Simplified Implementation
 */

import { BaseTool } from '../baseTool.js';
import { getRoofingWasteFactor, getSidingWasteFactor } from '../../constants/waste-factors.constants.js';

export class CalculateWasteFactorsTool extends BaseTool {
  get definition() {
    return {
      name: 'calculate_waste_factors',
      description: 'Materials: waste factor recommendations, complexity, crew experience, weather',
      inputSchema: {
        type: 'object' as const,
        properties: {
          material_type: { type: 'string', description: 'Type of material (roofing, siding, etc.)' },
          job_complexity: { type: 'string', enum: ['simple', 'moderate', 'complex'] },
          crew_experience: { type: 'string', enum: ['beginner', 'intermediate', 'expert'] },
          weather_conditions: { type: 'string', enum: ['ideal', 'normal', 'challenging'] }
        },
        required: ['material_type']
      }
    };
  }

  async execute(input: any, context: any) {
    // Check if using new handle-based parameters for response optimization
    const useHandleResponse = this.hasNewParams(input);

    const complexity = input.job_complexity || 'moderate';
    const material_type = input.material_type.toLowerCase();

    let waste_factor = 0.15; // Default 15%

    if (material_type.includes('roof') || material_type.includes('shingle')) {
      waste_factor = getRoofingWasteFactor(material_type, complexity);
    } else if (material_type.includes('siding')) {
      waste_factor = getSidingWasteFactor(material_type, complexity);
    }

    const result = {
      success: true,
      material_type: input.material_type,
      recommended_waste_factor: waste_factor,
      waste_percent: (waste_factor * 100).toFixed(1) + '%',
      industry_standard: 0.15,
      complexity: complexity,
      adjustments: {
        crew_experience: input.crew_experience || 'not_specified',
        weather: input.weather_conditions || 'not_specified'
      }
    };

    // Use handle-based response if requested
    if (useHandleResponse) {
      const envelope = await this.wrapResponse([result], input, context, {
        entity: 'waste_factors',
        maxRows: 1,
        pageInfo: {
          current_page: 1,
          total_pages: 1,
          has_more: false,
          total: 1,
        },
      });

      return {
        ...envelope,
        query_metadata: {
          calculation_type: 'waste_factor',
          material_type: input.material_type,
          job_complexity: complexity,
          recommended_waste_factor: waste_factor,
          crew_experience: input.crew_experience || null,
          weather_conditions: input.weather_conditions || null,
          data_freshness: 'real-time',
        },
      };
    }

    // Fallback to legacy response
    return result;
  }
}

export default () => new CalculateWasteFactorsTool();
