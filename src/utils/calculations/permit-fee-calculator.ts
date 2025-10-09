/**
 * Permit Fee Calculator
 * Calculates permit fees and regulatory costs for construction projects
 */

import type {
  PermitFeeInput,
  PermitFeeResult,
  PermitFee,
  JobType
} from '../../types/calculations.types.js';

import {
  BASE_PERMIT_FEES,
  MUNICIPALITY_PERMIT_FEES,
  ADDITIONAL_PERMITS,
  INSPECTION_FEES,
  PERMIT_PROCESSING_TIMES,
  REQUIRED_DOCUMENTATION,
  PERMIT_EXEMPTIONS,
  CONNECTICUT_REQUIREMENTS,
  calculatePermitFeeByValue,
  getMunicipalityFees,
  isPermitRequired
} from '../../constants/permit-fees.constants.js';

// ============================================================================
// Main Calculator Class
// ============================================================================

export class PermitFeeCalculator {
  /**
   * Calculate permit fees and requirements for a construction project
   */
  static calculate(input: PermitFeeInput): PermitFeeResult {
    // Validate input
    this.validateInput(input);

    // Check if permit is even required
    if (!isPermitRequired(input.job_type, input.project_value)) {
      return this.createExemptResult(input);
    }

    // Get permits required for this project
    const permits = this.getRequiredPermits(input);

    // Calculate total fees
    const totalPermitFees = permits.reduce((sum, permit) => sum + permit.amount, 0);

    // Estimate processing time
    const estimatedProcessingDays = this.estimateProcessingTime(input);

    // Get required documentation
    const requirements = this.getRequirements(input);

    // Get warnings
    const warnings = this.getWarnings(input);

    return {
      permits,
      total_permit_fees: totalPermitFees,
      estimated_processing_days: estimatedProcessingDays,
      requirements,
      warnings
    };
  }

  /**
   * Validate input parameters
   */
  private static validateInput(input: PermitFeeInput): void {
    if (!input.job_type) {
      throw new Error('Job type is required');
    }

    if (input.project_value <= 0) {
      throw new Error('Project value must be greater than 0');
    }
  }

  /**
   * Create result for exempt project
   */
  private static createExemptResult(input: PermitFeeInput): PermitFeeResult {
    const exemptions = PERMIT_EXEMPTIONS[`${input.job_type}_exemptions` as keyof typeof PERMIT_EXEMPTIONS] || [];

    return {
      permits: [
        {
          fee_type: 'Exempt',
          description: `No permit required for this ${input.job_type} project`,
          amount: 0,
          jurisdiction: input.location?.city || 'Connecticut',
          notes: `Project value under $500 or work type exempt. Exemptions: ${exemptions.join(', ')}`
        }
      ],
      total_permit_fees: 0,
      estimated_processing_days: 0,
      requirements: ['No permit required - work may proceed immediately'],
      warnings: []
    };
  }

  /**
   * Get required permits for this project
   */
  private static getRequiredPermits(input: PermitFeeInput): PermitFee[] {
    const permits: PermitFee[] = [];

    // 1. Main building/construction permit
    const mainPermit = this.getMainPermit(input);
    permits.push(mainPermit);

    // 2. Additional permits based on scope
    if (input.scope?.structural_changes) {
      permits.push({
        fee_type: 'Structural Changes',
        description: ADDITIONAL_PERMITS.structural_changes.description,
        amount: ADDITIONAL_PERMITS.structural_changes.fee,
        jurisdiction: input.location?.city || 'Connecticut',
        notes: ADDITIONAL_PERMITS.structural_changes.required_when
      });
    }

    if (input.scope?.electrical_work) {
      permits.push({
        fee_type: 'Electrical',
        description: ADDITIONAL_PERMITS.electrical_work.description,
        amount: ADDITIONAL_PERMITS.electrical_work.fee,
        jurisdiction: input.location?.city || 'Connecticut',
        notes: ADDITIONAL_PERMITS.electrical_work.required_when
      });
    }

    if (input.scope?.plumbing_work) {
      permits.push({
        fee_type: 'Plumbing',
        description: ADDITIONAL_PERMITS.plumbing_work.description,
        amount: ADDITIONAL_PERMITS.plumbing_work.fee,
        jurisdiction: input.location?.city || 'Connecticut',
        notes: ADDITIONAL_PERMITS.plumbing_work.required_when
      });
    }

    // 3. Check for special jurisdictions
    const specialPermits = this.getSpecialJurisdictionPermits(input);
    permits.push(...specialPermits);

    // 4. Add inspection fees if applicable
    const inspectionPermits = this.getInspectionFees(input);
    if (inspectionPermits.length > 0) {
      permits.push(...inspectionPermits);
    }

    return permits;
  }

  /**
   * Get main construction/building permit
   */
  private static getMainPermit(input: PermitFeeInput): PermitFee {
    const city = input.location?.city?.toLowerCase() || 'default';
    const municipalityFees = getMunicipalityFees(city);

    let permitFee = 0;
    let description = '';

    // Get fee based on job type
    switch (input.job_type) {
      case 'roofing':
        permitFee = municipalityFees.roofing_permit;
        description = 'Roofing permit';
        break;

      case 'siding':
        permitFee = municipalityFees.siding_permit;
        description = 'Siding permit';
        break;

      case 'windows':
        permitFee = municipalityFees.window_permit;
        description = 'Window replacement permit';
        break;

      case 'doors':
        permitFee = municipalityFees.door_permit;
        description = 'Door replacement permit';
        break;

      case 'gutters':
        permitFee = 0;
        description = 'Gutter installation (typically no permit required)';
        break;

      case 'general_construction':
        // For general construction, use percentage-based or tiered
        if (municipalityFees.percentage_based && municipalityFees.percentage_rate) {
          permitFee = Math.max(
            input.project_value * municipalityFees.percentage_rate,
            municipalityFees.minimum_fee
          );
        } else {
          permitFee = calculatePermitFeeByValue(input.project_value);
        }
        description = 'General construction permit';
        break;
    }

    // Ensure minimum fee
    permitFee = Math.max(permitFee, municipalityFees.minimum_fee);

    return {
      fee_type: 'Building Permit',
      description,
      amount: permitFee,
      jurisdiction: input.location?.city || input.location?.county || 'Connecticut',
      notes: municipalityFees.notes
    };
  }

  /**
   * Get special jurisdiction permits (historic, coastal, wetlands)
   */
  private static getSpecialJurisdictionPermits(input: PermitFeeInput): PermitFee[] {
    const permits: PermitFee[] = [];

    // Note: In a real implementation, this would check property databases
    // For now, we'll include warnings about checking these
    // The user would need to manually specify if these apply

    // Could check zip codes against known historic districts, coastal areas, etc.
    // For now, just provide information in warnings

    return permits;
  }

  /**
   * Get inspection fees
   */
  private static getInspectionFees(input: PermitFeeInput): PermitFee[] {
    const permits: PermitFee[] = [];

    // Most inspections are included in permit fee
    // Only add if there are special circumstances

    // Note: Re-inspection fees would only apply if work fails inspection
    // We don't include them in initial estimate

    return permits;
  }

  /**
   * Estimate processing time
   */
  private static estimateProcessingTime(input: PermitFeeInput): number {
    const processingTimes = PERMIT_PROCESSING_TIMES[input.job_type];

    // Use standard processing time
    let days = processingTimes.standard_days;

    // Add extra days for complex projects
    if (input.project_value > 100000) {
      days += 5; // Major projects require more review
    }

    if (input.scope?.structural_changes) {
      days += 3; // Structural review takes longer
    }

    return days;
  }

  /**
   * Get requirements for permit application
   */
  private static getRequirements(input: PermitFeeInput): string[] {
    const requirements: string[] = [];

    // Add job-specific documentation requirements
    const docRequirements = REQUIRED_DOCUMENTATION[input.job_type];
    requirements.push(...docRequirements);

    // Add Connecticut state requirements
    requirements.push(
      `Home Improvement Contractor Registration (CT DCP) - $${CONNECTICUT_REQUIREMENTS.home_improvement_contractor_registration.registration_fee}`
    );

    requirements.push(
      `Workers Compensation Insurance - minimum $${CONNECTICUT_REQUIREMENTS.workers_compensation_insurance.minimum_coverage.toLocaleString()}`
    );

    requirements.push(
      `General Liability Insurance - minimum $${CONNECTICUT_REQUIREMENTS.general_liability_insurance.minimum_coverage.toLocaleString()}, recommended $${CONNECTICUT_REQUIREMENTS.general_liability_insurance.recommended_coverage.toLocaleString()}`
    );

    // Check for lead paint certification
    if (input.scope && input.project_value > 0) {
      // Assume most homes in CT are pre-1978
      requirements.push(
        `EPA RRP Lead Paint Certification (for homes built before 1978) - $${CONNECTICUT_REQUIREMENTS.lead_paint_certification.certification_fee}`
      );
    }

    // Add scope-specific requirements
    if (input.scope?.structural_changes) {
      requirements.push('Structural engineering calculations and stamped drawings');
      requirements.push('Architect or engineer seal on plans');
    }

    if (input.scope?.electrical_work) {
      requirements.push('Licensed electrician (E-1 or E-2 license)');
    }

    if (input.scope?.plumbing_work) {
      requirements.push('Licensed plumber (P-1 or P-2 license)');
    }

    return requirements;
  }

  /**
   * Get warnings about special considerations
   */
  private static getWarnings(input: PermitFeeInput): string[] {
    const warnings: string[] = [];

    // Warn about potential special jurisdiction fees
    if (input.location?.city) {
      const historicCities = ['new haven', 'hartford', 'guilford', 'stonington', 'norwalk'];
      if (historicCities.includes(input.location.city.toLowerCase())) {
        warnings.push(
          `${input.location.city} has historic districts. Check if property is in historic district - may require additional approval ($${ADDITIONAL_PERMITS.historic_district.fee})`
        );
      }
    }

    // Warn about coastal areas
    if (input.location?.county) {
      const coastalCounties = ['new london', 'new haven', 'fairfield'];
      if (coastalCounties.some(c => input.location!.county!.toLowerCase().includes(c))) {
        warnings.push(
          `Property may be in Coastal Area Management jurisdiction - verify with town ($${ADDITIONAL_PERMITS.coastal_area.fee} if applicable)`
        );
      }
    }

    // Warn about high-value projects
    if (input.project_value > 100000) {
      warnings.push(
        'Major project may require additional engineering review and extended processing time'
      );
    }

    // Warn about structural work
    if (input.scope?.structural_changes) {
      warnings.push(
        'Structural changes require engineering review - ensure all drawings are sealed by licensed professional'
      );
    }

    // General warning about municipality variations
    warnings.push(
      'Permit fees vary by municipality. Contact local building department to confirm exact fees and requirements.'
    );

    // Processing time warning
    const processingDays = this.estimateProcessingTime(input);
    if (processingDays > 5) {
      warnings.push(
        `Estimated processing time is ${processingDays} business days. Plan accordingly and apply early.`
      );
    }

    return warnings;
  }

  /**
   * Quick estimate of permit costs
   */
  static estimateQuick(
    jobType: JobType,
    projectValue: number,
    city?: string
  ): number {
    if (!isPermitRequired(jobType, projectValue)) {
      return 0;
    }

    const result = this.calculate({
      job_type: jobType,
      project_value: projectValue,
      location: city ? { city } : undefined
    });

    return result.total_permit_fees;
  }

  /**
   * Get permit fee breakdown by category
   */
  static getBreakdown(input: PermitFeeInput): {
    building_permit: number;
    additional_permits: number;
    inspection_fees: number;
    total: number;
  } {
    const result = this.calculate(input);

    let buildingPermit = 0;
    let additionalPermits = 0;
    let inspectionFees = 0;

    for (const permit of result.permits) {
      if (permit.fee_type === 'Building Permit' || permit.fee_type === 'Exempt') {
        buildingPermit += permit.amount;
      } else if (permit.fee_type.includes('Inspection')) {
        inspectionFees += permit.amount;
      } else {
        additionalPermits += permit.amount;
      }
    }

    return {
      building_permit: buildingPermit,
      additional_permits: additionalPermits,
      inspection_fees: inspectionFees,
      total: result.total_permit_fees
    };
  }
}
