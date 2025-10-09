/**
 * Calculate Waste Factors Tool - Simplified Implementation
 */

import { BaseTool } from '../baseTool.js';
import { getRoofingWasteFactor, getSidingWasteFactor } from '../../constants/waste-factors.constants.js';

export class CalculateWasteFactorsTool extends BaseTool {
  get definition() {
    return {
      name: 'calculate_waste_factors',
      description: 'Calculate recommended waste factors based on material type, job complexity, crew experience, and weather conditions',
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

  async execute(input: any) {
    const complexity = input.job_complexity || 'moderate';
    const material_type = input.material_type.toLowerCase();

    let waste_factor = 0.15; // Default 15%

    if (material_type.includes('roof') || material_type.includes('shingle')) {
      waste_factor = getRoofingWasteFactor(material_type, complexity);
    } else if (material_type.includes('siding')) {
      waste_factor = getSidingWasteFactor(material_type, complexity);
    }

    return {
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
  }
}

export default () => new CalculateWasteFactorsTool();
