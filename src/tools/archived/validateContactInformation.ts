/**
 * Validate Contact Information
 * Comprehensive contact data validation with quality scoring, duplicate detection, and enrichment recommendations
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface ContactValidationResult {
  contact_id: string;
  contact_name: string;
  validation_status: 'Valid' | 'Warning' | 'Invalid';
  quality_score: number;
  issues: ValidationIssue[];
  warnings: string[];
  recommendations: string[];
  data_completeness: DataCompleteness;
  email_validation: EmailValidation;
  phone_validation: PhoneValidation;
  address_validation: AddressValidation;
  potential_duplicates: string[];
}

interface ValidationIssue {
  severity: 'Critical' | 'Warning' | 'Info';
  field: string;
  issue: string;
  suggestion: string;
}

interface DataCompleteness {
  completeness_score: number;
  total_fields: number;
  filled_fields: number;
  missing_fields: string[];
  critical_missing: string[];
}

interface EmailValidation {
  is_valid: boolean;
  email: string | null;
  format_valid: boolean;
  has_email: boolean;
  issues: string[];
}

interface PhoneValidation {
  is_valid: boolean;
  phone_numbers: string[];
  format_valid: boolean;
  has_phone: boolean;
  normalized_phones: string[];
  issues: string[];
}

interface AddressValidation {
  is_complete: boolean;
  completeness_score: number;
  has_street: boolean;
  has_city: boolean;
  has_state: boolean;
  has_zip: boolean;
  missing_components: string[];
}

interface ValidationSummary {
  total_contacts: number;
  valid_contacts: number;
  contacts_with_warnings: number;
  invalid_contacts: number;
  avg_quality_score: number;
  avg_completeness_score: number;
  total_duplicates_found: number;
  critical_issues_count: number;
}

interface QualityMetrics {
  email_quality: {
    contacts_with_email: number;
    valid_emails: number;
    invalid_emails: number;
    email_coverage: number;
  };
  phone_quality: {
    contacts_with_phone: number;
    valid_phones: number;
    invalid_phones: number;
    phone_coverage: number;
  };
  address_quality: {
    complete_addresses: number;
    partial_addresses: number;
    missing_addresses: number;
    avg_completeness: number;
  };
}

export class ValidateContactInformationTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'validate_contact_information',
      description: 'Comprehensive contact data validation with quality scoring, duplicate detection, format validation, and enrichment recommendations',
      inputSchema: {
        type: 'object',
        properties: {
          contact_id: {
            type: 'string',
            description: 'Specific contact ID to validate (optional, validates all if not specified)',
          },
          include_duplicates: {
            type: 'boolean',
            default: true,
            description: 'Include duplicate detection analysis',
          },
          strict_mode: {
            type: 'boolean',
            default: false,
            description: 'Use strict validation rules',
          },
          min_quality_score: {
            type: 'number',
            default: 0,
            description: 'Minimum quality score to include in results (0-100)',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const specificContactId = input.contact_id;
      const includeDuplicates = input.include_duplicates !== false;
      const strictMode = input.strict_mode || false;
      const minQualityScore = input.min_quality_score || 0;

      // Fetch contacts
      const contactsResponse = await this.client.get(context.apiKey, 'contacts', { size: 100 });
      const contacts = contactsResponse.data?.results || [];

      // Filter by specific contact if requested
      const contactsToValidate = specificContactId
        ? contacts.filter((c: any) => c.jnid === specificContactId)
        : contacts;

      if (specificContactId && contactsToValidate.length === 0) {
        return {
          error: `Contact with ID ${specificContactId} not found`,
          status: 'Failed',
        };
      }

      // Validate each contact
      const validationResults: ContactValidationResult[] = [];
      const emailMap = new Map<string, string[]>(); // email -> contact_ids
      const phoneMap = new Map<string, string[]>(); // phone -> contact_ids
      const nameMap = new Map<string, string[]>(); // name -> contact_ids

      for (const contact of contactsToValidate) {
        const result = this.validateContact(contact, strictMode);

        // Skip if below minimum quality score
        if (result.quality_score < minQualityScore) continue;

        validationResults.push(result);

        // Build duplicate detection maps
        if (includeDuplicates) {
          // Email duplicates
          const email = contact.email?.toLowerCase().trim();
          if (email) {
            if (!emailMap.has(email)) emailMap.set(email, []);
            emailMap.get(email)!.push(contact.jnid);
          }

          // Phone duplicates
          const phones = this.extractPhones(contact);
          for (const phone of phones) {
            const normalized = this.normalizePhone(phone);
            if (!phoneMap.has(normalized)) phoneMap.set(normalized, []);
            phoneMap.get(normalized)!.push(contact.jnid);
          }

          // Name duplicates
          const fullName = this.getFullName(contact).toLowerCase().trim();
          if (fullName) {
            if (!nameMap.has(fullName)) nameMap.set(fullName, []);
            nameMap.get(fullName)!.push(contact.jnid);
          }
        }
      }

      // Detect duplicates
      if (includeDuplicates) {
        for (const result of validationResults) {
          const duplicates = new Set<string>();

          // Email duplicates
          const contact = contactsToValidate.find((c: any) => c.jnid === result.contact_id);
          if (contact) {
            const email = contact.email?.toLowerCase().trim();
            if (email && emailMap.has(email)) {
              const matches = emailMap.get(email)!.filter(id => id !== result.contact_id);
              matches.forEach(id => duplicates.add(id));
            }

            // Phone duplicates
            const phones = this.extractPhones(contact);
            for (const phone of phones) {
              const normalized = this.normalizePhone(phone);
              if (phoneMap.has(normalized)) {
                const matches = phoneMap.get(normalized)!.filter(id => id !== result.contact_id);
                matches.forEach(id => duplicates.add(id));
              }
            }

            // Name duplicates (only if email or phone also matches)
            const fullName = this.getFullName(contact).toLowerCase().trim();
            if (fullName && nameMap.has(fullName)) {
              const nameMatches = nameMap.get(fullName)!.filter(id => id !== result.contact_id);
              // Only add if there's also email or phone overlap
              for (const matchId of nameMatches) {
                const matchContact = contactsToValidate.find((c: any) => c.jnid === matchId);
                if (matchContact) {
                  const matchEmail = matchContact.email?.toLowerCase().trim();
                  const matchPhones = this.extractPhones(matchContact);

                  if (email && matchEmail === email) {
                    duplicates.add(matchId);
                  } else if (phones.some(p => matchPhones.includes(p))) {
                    duplicates.add(matchId);
                  }
                }
              }
            }
          }

          result.potential_duplicates = Array.from(duplicates);
        }
      }

      // Calculate summary
      const summary: ValidationSummary = {
        total_contacts: validationResults.length,
        valid_contacts: validationResults.filter(r => r.validation_status === 'Valid').length,
        contacts_with_warnings: validationResults.filter(r => r.validation_status === 'Warning').length,
        invalid_contacts: validationResults.filter(r => r.validation_status === 'Invalid').length,
        avg_quality_score: validationResults.length > 0
          ? validationResults.reduce((sum, r) => sum + r.quality_score, 0) / validationResults.length
          : 0,
        avg_completeness_score: validationResults.length > 0
          ? validationResults.reduce((sum, r) => sum + r.data_completeness.completeness_score, 0) / validationResults.length
          : 0,
        total_duplicates_found: validationResults.filter(r => r.potential_duplicates.length > 0).length,
        critical_issues_count: validationResults.reduce((sum, r) =>
          sum + r.issues.filter(i => i.severity === 'Critical').length, 0
        ),
      };

      // Quality metrics
      const qualityMetrics: QualityMetrics = {
        email_quality: {
          contacts_with_email: validationResults.filter(r => r.email_validation.has_email).length,
          valid_emails: validationResults.filter(r => r.email_validation.is_valid).length,
          invalid_emails: validationResults.filter(r => r.email_validation.has_email && !r.email_validation.is_valid).length,
          email_coverage: validationResults.length > 0
            ? (validationResults.filter(r => r.email_validation.has_email).length / validationResults.length) * 100
            : 0,
        },
        phone_quality: {
          contacts_with_phone: validationResults.filter(r => r.phone_validation.has_phone).length,
          valid_phones: validationResults.filter(r => r.phone_validation.is_valid).length,
          invalid_phones: validationResults.filter(r => r.phone_validation.has_phone && !r.phone_validation.is_valid).length,
          phone_coverage: validationResults.length > 0
            ? (validationResults.filter(r => r.phone_validation.has_phone).length / validationResults.length) * 100
            : 0,
        },
        address_quality: {
          complete_addresses: validationResults.filter(r => r.address_validation.is_complete).length,
          partial_addresses: validationResults.filter(r =>
            !r.address_validation.is_complete && r.address_validation.completeness_score > 0
          ).length,
          missing_addresses: validationResults.filter(r => r.address_validation.completeness_score === 0).length,
          avg_completeness: validationResults.length > 0
            ? validationResults.reduce((sum, r) => sum + r.address_validation.completeness_score, 0) / validationResults.length
            : 0,
        },
      };

      // Generate recommendations
      const recommendations: string[] = [];

      if (summary.avg_quality_score < 70) {
        recommendations.push(`⚠️ Average quality score is low (${summary.avg_quality_score.toFixed(1)}/100) - data cleanup needed`);
      }

      if (qualityMetrics.email_quality.email_coverage < 80) {
        recommendations.push(`📧 Only ${qualityMetrics.email_quality.email_coverage.toFixed(1)}% of contacts have emails - improve email collection`);
      }

      if (qualityMetrics.phone_quality.phone_coverage < 90) {
        recommendations.push(`📱 ${qualityMetrics.phone_quality.phone_coverage.toFixed(1)}% phone coverage - collect missing phone numbers`);
      }

      if (summary.total_duplicates_found > 0) {
        recommendations.push(`🔄 ${summary.total_duplicates_found} potential duplicate(s) detected - review and merge`);
      }

      if (summary.critical_issues_count > 0) {
        recommendations.push(`🚨 ${summary.critical_issues_count} critical issue(s) require immediate attention`);
      }

      const incompleteAddresses = qualityMetrics.address_quality.partial_addresses + qualityMetrics.address_quality.missing_addresses;
      if (incompleteAddresses > validationResults.length * 0.3) {
        recommendations.push(`📍 ${incompleteAddresses} contact(s) have incomplete addresses - update for better service delivery`);
      }

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        validation_mode: strictMode ? 'Strict' : 'Standard',
        summary: summary,
        quality_metrics: qualityMetrics,
        validation_results: validationResults,
        recommendations: recommendations,
        data_quality_score: this.calculateOverallDataQuality(qualityMetrics, summary),
        best_practices: [
          'Ensure all contacts have at least one communication method (email or phone)',
          'Validate email formats before saving',
          'Normalize phone numbers to consistent format',
          'Complete address information for service delivery',
          'Regular duplicate detection and cleanup (monthly)',
          'Use data enrichment services for missing information',
        ],
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }

  /**
   * Validate individual contact
   */
  private validateContact(contact: any, strictMode: boolean): ContactValidationResult {
    const issues: ValidationIssue[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Data completeness
    const dataCompleteness = this.assessDataCompleteness(contact);

    // Email validation
    const emailValidation = this.validateEmail(contact.email, strictMode);
    if (!emailValidation.is_valid && emailValidation.has_email) {
      issues.push({
        severity: 'Warning',
        field: 'email',
        issue: emailValidation.issues.join(', '),
        suggestion: 'Verify email format with contact',
      });
    }
    if (!emailValidation.has_email) {
      warnings.push('Missing email address');
      recommendations.push('Collect email for digital communication');
    }

    // Phone validation
    const phoneValidation = this.validatePhones(contact, strictMode);
    if (!phoneValidation.is_valid && phoneValidation.has_phone) {
      issues.push({
        severity: 'Warning',
        field: 'phone',
        issue: phoneValidation.issues.join(', '),
        suggestion: 'Standardize phone number format',
      });
    }
    if (!phoneValidation.has_phone) {
      issues.push({
        severity: 'Critical',
        field: 'phone',
        issue: 'No phone number provided',
        suggestion: 'Collect at least one phone number',
      });
    }

    // Address validation
    const addressValidation = this.validateAddress(contact);
    if (!addressValidation.is_complete) {
      warnings.push(`Incomplete address (${addressValidation.missing_components.join(', ')} missing)`);
      recommendations.push('Complete address for service delivery');
    }

    // Name validation
    const fullName = this.getFullName(contact);
    if (!fullName) {
      issues.push({
        severity: 'Critical',
        field: 'name',
        issue: 'No name provided',
        suggestion: 'Add contact name',
      });
    }

    // Calculate quality score
    const qualityScore = this.calculateQualityScore(
      dataCompleteness,
      emailValidation,
      phoneValidation,
      addressValidation,
      !!fullName
    );

    // Determine validation status
    const criticalIssues = issues.filter(i => i.severity === 'Critical').length;
    const validationStatus: 'Valid' | 'Warning' | 'Invalid' =
      criticalIssues > 0 ? 'Invalid' :
      issues.length > 0 || warnings.length > 0 ? 'Warning' : 'Valid';

    return {
      contact_id: contact.jnid || 'unknown',
      contact_name: fullName || 'Unnamed Contact',
      validation_status: validationStatus,
      quality_score: qualityScore,
      issues: issues,
      warnings: warnings,
      recommendations: recommendations,
      data_completeness: dataCompleteness,
      email_validation: emailValidation,
      phone_validation: phoneValidation,
      address_validation: addressValidation,
      potential_duplicates: [], // Will be filled later
    };
  }

  /**
   * Assess data completeness
   */
  private assessDataCompleteness(contact: any): DataCompleteness {
    const fields = [
      'first_name', 'last_name', 'email', 'phone', 'mobile_phone',
      'address_line1', 'city', 'state_text', 'zip', 'company',
    ];

    let filledFields = 0;
    const missingFields: string[] = [];

    for (const field of fields) {
      if (contact[field] && String(contact[field]).trim()) {
        filledFields++;
      } else {
        missingFields.push(field);
      }
    }

    const criticalMissing: string[] = [];
    if (!contact.first_name && !contact.last_name && !contact.company) {
      criticalMissing.push('name_or_company');
    }
    if (!contact.email && !contact.phone && !contact.mobile_phone) {
      criticalMissing.push('contact_method');
    }

    return {
      completeness_score: (filledFields / fields.length) * 100,
      total_fields: fields.length,
      filled_fields: filledFields,
      missing_fields: missingFields,
      critical_missing: criticalMissing,
    };
  }

  /**
   * Validate email
   */
  private validateEmail(email: string | undefined, strictMode: boolean): EmailValidation {
    if (!email || !email.trim()) {
      return {
        is_valid: false,
        email: null,
        format_valid: false,
        has_email: false,
        issues: [],
      };
    }

    const emailTrimmed = email.trim().toLowerCase();
    const emailRegex = strictMode
      ? /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const formatValid = emailRegex.test(emailTrimmed);
    const issues: string[] = [];

    if (!formatValid) {
      issues.push('Invalid email format');
    }

    return {
      is_valid: formatValid,
      email: emailTrimmed,
      format_valid: formatValid,
      has_email: true,
      issues: issues,
    };
  }

  /**
   * Validate phones
   */
  private validatePhones(contact: any, strictMode: boolean): PhoneValidation {
    const phones = this.extractPhones(contact);

    if (phones.length === 0) {
      return {
        is_valid: false,
        phone_numbers: [],
        format_valid: false,
        has_phone: false,
        normalized_phones: [],
        issues: [],
      };
    }

    const normalizedPhones = phones.map(p => this.normalizePhone(p));
    const issues: string[] = [];

    for (const phone of phones) {
      const digitsOnly = phone.replace(/\D/g, '');
      if (strictMode && digitsOnly.length !== 10 && digitsOnly.length !== 11) {
        issues.push(`Invalid phone format: ${phone}`);
      }
    }

    return {
      is_valid: issues.length === 0,
      phone_numbers: phones,
      format_valid: issues.length === 0,
      has_phone: true,
      normalized_phones: normalizedPhones,
      issues: issues,
    };
  }

  /**
   * Validate address
   */
  private validateAddress(contact: any): AddressValidation {
    const hasStreet = !!(contact.address_line1 || '').trim();
    const hasCity = !!(contact.city || '').trim();
    const hasState = !!(contact.state_text || contact.state || '').trim();
    const hasZip = !!(contact.zip || '').trim();

    const missingComponents: string[] = [];
    if (!hasStreet) missingComponents.push('street');
    if (!hasCity) missingComponents.push('city');
    if (!hasState) missingComponents.push('state');
    if (!hasZip) missingComponents.push('zip');

    const completenessScore = [hasStreet, hasCity, hasState, hasZip]
      .filter(Boolean).length * 25;

    return {
      is_complete: completenessScore === 100,
      completeness_score: completenessScore,
      has_street: hasStreet,
      has_city: hasCity,
      has_state: hasState,
      has_zip: hasZip,
      missing_components: missingComponents,
    };
  }

  /**
   * Extract phone numbers from contact
   */
  private extractPhones(contact: any): string[] {
    const phones: string[] = [];
    if (contact.phone) phones.push(String(contact.phone));
    if (contact.mobile_phone) phones.push(String(contact.mobile_phone));
    if (contact.home_phone) phones.push(String(contact.home_phone));
    if (contact.work_phone) phones.push(String(contact.work_phone));
    return phones.filter(p => p && p.trim());
  }

  /**
   * Normalize phone number
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Get full name
   */
  private getFullName(contact: any): string {
    const parts: string[] = [];
    if (contact.first_name) parts.push(contact.first_name.trim());
    if (contact.last_name) parts.push(contact.last_name.trim());
    if (parts.length === 0 && contact.company) {
      return contact.company.trim();
    }
    return parts.join(' ');
  }

  /**
   * Calculate quality score
   */
  private calculateQualityScore(
    completeness: DataCompleteness,
    email: EmailValidation,
    phone: PhoneValidation,
    address: AddressValidation,
    hasName: boolean
  ): number {
    let score = 0;

    // Name (20 points)
    score += hasName ? 20 : 0;

    // Email (20 points)
    if (email.has_email && email.is_valid) score += 20;
    else if (email.has_email) score += 10;

    // Phone (25 points)
    if (phone.has_phone && phone.is_valid) score += 25;
    else if (phone.has_phone) score += 15;

    // Address (20 points)
    score += (address.completeness_score / 100) * 20;

    // Overall completeness (15 points)
    score += (completeness.completeness_score / 100) * 15;

    return Math.min(Math.round(score), 100);
  }

  /**
   * Calculate overall data quality
   */
  private calculateOverallDataQuality(metrics: QualityMetrics, summary: ValidationSummary): number {
    const emailScore = metrics.email_quality.email_coverage;
    const phoneScore = metrics.phone_quality.phone_coverage;
    const addressScore = metrics.address_quality.avg_completeness;
    const qualityScore = summary.avg_quality_score;

    return Math.round((emailScore + phoneScore + addressScore + qualityScore) / 4);
  }
}
