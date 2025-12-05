/**
 * Job Business Type Categorizer
 *
 * Intelligently categorizes JobNimbus jobs as Insurance, Retail, Hybrid, or Unknown
 * based on multiple data signals and confidence scoring.
 */

export enum JobBusinessType {
  INSURANCE = 'insurance',
  RETAIL = 'retail',
  HYBRID = 'hybrid',
  UNKNOWN = 'unknown'
}

export interface CategoryScore {
  insurance_score: number;      // 0-100
  retail_score: number;         // 0-100
  confidence: number;           // 0-100
  indicators_found: string[];
  category: JobBusinessType;
  reasoning: string;
  timestamp: number;
}

export interface Job {
  jnid?: string;
  number?: string;
  display_name?: string;
  status?: string;
  status_name?: string;
  sales_rep?: string;

  // Standard fields
  date_start?: number;
  date_end?: number;
  date_created?: number;
  date_updated?: number;

  // Custom fields (commonly used in JobNimbus)
  claim_number?: string;
  policy_number?: string;
  insurance_carrier?: string;
  adjuster_name?: string;
  adjuster_email?: string;
  adjuster_phone?: string;
  deductible?: number;
  depreciation?: number;
  rcv?: number;  // Replacement Cost Value
  acv?: number;  // Actual Cash Value

  // Retail indicators
  financing_type?: string;
  loan_amount?: number;
  contract_signed?: boolean;
  commission_rate?: number;
  commission_amount?: number;
  retail_price?: number;
  payment_method?: string;
  marketing_source?: string;

  // Generic fields
  type?: string;
  sub_type?: string;
  tags?: string[];
  notes?: string;
  description?: string;

  // Extensible
  [key: string]: any;
}

export class JobCategorizer {
  // Indicator weights
  private readonly PRIMARY_WEIGHT = 30;
  private readonly SECONDARY_WEIGHT = 10;
  private readonly TERTIARY_WEIGHT = 5;

  // Insurance status patterns
  private readonly INSURANCE_STATUS_PATTERNS = [
    'claim filed', 'claim approved', 'claim denied', 'supplementing',
    'invoiced', 'paid', 'closed', 'pending approval', 'adjuster review',
    'supplement approved', 'depreciation released', 'final payment'
  ];

  // Retail status patterns
  private readonly RETAIL_STATUS_PATTERNS = [
    'lead', 'appointment set', 'presented', 'proposal sent',
    'contract signed', 'sold', 'installed', 'completed', 'paid in full',
    'financing approved', 'down payment received'
  ];

  // Insurance keywords
  private readonly INSURANCE_KEYWORDS = [
    'supplement', 'depreciation', 'rcv', 'acv', 'deductible',
    'adjuster', 'carrier', 'claim', 'policy', 'coverage',
    'scope', 'xactimate', 'symbility', 'mortgage', 'inspection'
  ];

  // Retail keywords
  private readonly RETAIL_KEYWORDS = [
    'financing', 'loan', 'commission', 'retail', 'cash price',
    'monthly payment', 'apr', 'down payment', 'credit',
    'sales', 'discount', 'promotion', 'referral', 'door knock'
  ];

  /**
   * Main categorization method
   */
  public categorize(job: Job): CategoryScore {
    let insuranceScore = 0;
    let retailScore = 0;
    const indicatorsFound: string[] = [];
    const reasoning: string[] = [];

    // Check Primary Insurance Indicators
    if (this.hasClaimNumber(job)) {
      insuranceScore += this.PRIMARY_WEIGHT;
      indicatorsFound.push('claim_number');
      reasoning.push('Has claim number');
    }

    if (this.hasPolicyNumber(job)) {
      insuranceScore += this.PRIMARY_WEIGHT;
      indicatorsFound.push('policy_number');
      reasoning.push('Has policy number');
    }

    if (this.hasAdjusterInfo(job)) {
      insuranceScore += this.PRIMARY_WEIGHT;
      indicatorsFound.push('adjuster_info');
      reasoning.push('Has adjuster information');
    }

    if (this.hasInsuranceCarrier(job)) {
      insuranceScore += this.PRIMARY_WEIGHT;
      indicatorsFound.push('insurance_carrier');
      reasoning.push('Has insurance carrier');
    }

    if (this.hasDeductible(job)) {
      insuranceScore += this.SECONDARY_WEIGHT;
      indicatorsFound.push('deductible');
      reasoning.push('Has deductible amount');
    }

    // Check Primary Retail Indicators
    if (this.hasFinancingInfo(job)) {
      retailScore += this.PRIMARY_WEIGHT;
      indicatorsFound.push('financing_info');
      reasoning.push('Has financing information');
    }

    if (this.hasRetailContract(job)) {
      retailScore += this.PRIMARY_WEIGHT;
      indicatorsFound.push('retail_contract');
      reasoning.push('Has retail contract');
    }

    if (this.hasCommissionData(job)) {
      retailScore += this.PRIMARY_WEIGHT;
      indicatorsFound.push('commission_data');
      reasoning.push('Has commission data');
    }

    if (this.hasRetailPricing(job)) {
      retailScore += this.SECONDARY_WEIGHT;
      indicatorsFound.push('retail_pricing');
      reasoning.push('Has retail pricing');
    }

    // Check Secondary Indicators - Status Patterns
    const statusScore = this.analyzeStatus(job);
    insuranceScore += statusScore.insurance;
    retailScore += statusScore.retail;
    if (statusScore.insurance > 0) {
      indicatorsFound.push('insurance_status');
      reasoning.push(`Insurance status: ${job.status}`);
    }
    if (statusScore.retail > 0) {
      indicatorsFound.push('retail_status');
      reasoning.push(`Retail status: ${job.status}`);
    }

    // Check Tertiary Indicators - Keywords in text fields
    const keywordScore = this.analyzeKeywords(job);
    insuranceScore += keywordScore.insurance;
    retailScore += keywordScore.retail;
    if (keywordScore.insurance > 0) {
      indicatorsFound.push('insurance_keywords');
      reasoning.push('Contains insurance keywords');
    }
    if (keywordScore.retail > 0) {
      indicatorsFound.push('retail_keywords');
      reasoning.push('Contains retail keywords');
    }

    // Analyze job type if present
    const typeScore = this.analyzeJobType(job);
    insuranceScore += typeScore.insurance;
    retailScore += typeScore.retail;
    if (typeScore.insurance > 0) {
      indicatorsFound.push('insurance_job_type');
      reasoning.push(`Insurance job type: ${job.type}`);
    }
    if (typeScore.retail > 0) {
      indicatorsFound.push('retail_job_type');
      reasoning.push(`Retail job type: ${job.type}`);
    }

    // Normalize scores to 0-100
    insuranceScore = Math.min(100, insuranceScore);
    retailScore = Math.min(100, retailScore);

    // Determine category
    let category: JobBusinessType;
    if (insuranceScore >= 60 && retailScore < 30) {
      category = JobBusinessType.INSURANCE;
    } else if (retailScore >= 60 && insuranceScore < 30) {
      category = JobBusinessType.RETAIL;
    } else if (insuranceScore >= 40 && retailScore >= 40) {
      category = JobBusinessType.HYBRID;
    } else {
      category = JobBusinessType.UNKNOWN;
    }

    // Calculate confidence
    const confidence = Math.max(insuranceScore, retailScore);

    return {
      insurance_score: insuranceScore,
      retail_score: retailScore,
      confidence,
      indicators_found: indicatorsFound,
      category,
      reasoning: reasoning.join('; '),
      timestamp: Date.now()
    };
  }

  /**
   * Batch categorization for performance
   */
  public batchCategorize(jobs: Job[]): Map<string, CategoryScore> {
    const results = new Map<string, CategoryScore>();

    for (const job of jobs) {
      if (job.jnid) {
        results.set(job.jnid, this.categorize(job));
      }
    }

    return results;
  }

  // Primary Insurance Indicators
  private hasClaimNumber(job: Job): boolean {
    return !!(job.claim_number && job.claim_number.trim().length > 0);
  }

  private hasPolicyNumber(job: Job): boolean {
    return !!(job.policy_number && job.policy_number.trim().length > 0);
  }

  private hasAdjusterInfo(job: Job): boolean {
    return !!(job.adjuster_name || job.adjuster_email || job.adjuster_phone);
  }

  private hasInsuranceCarrier(job: Job): boolean {
    return !!(job.insurance_carrier && job.insurance_carrier.trim().length > 0);
  }

  private hasDeductible(job: Job): boolean {
    return typeof job.deductible === 'number' && job.deductible > 0;
  }

  // Primary Retail Indicators
  private hasFinancingInfo(job: Job): boolean {
    return !!(job.financing_type ||
             (typeof job.loan_amount === 'number' && job.loan_amount > 0));
  }

  private hasRetailContract(job: Job): boolean {
    return job.contract_signed === true;
  }

  private hasCommissionData(job: Job): boolean {
    return !!(typeof job.commission_rate === 'number' ||
             typeof job.commission_amount === 'number');
  }

  private hasRetailPricing(job: Job): boolean {
    return typeof job.retail_price === 'number' && job.retail_price > 0;
  }

  // Secondary Indicators
  private analyzeStatus(job: Job): { insurance: number; retail: number } {
    // Safe extraction with type checking
    const statusValue = this.toSafeString(job.status || job.status_name);

    if (!statusValue || statusValue.trim().length === 0) {
      return { insurance: 0, retail: 0 };
    }

    const status = statusValue.toLowerCase();

    for (const pattern of this.INSURANCE_STATUS_PATTERNS) {
      if (status.includes(pattern)) {
        return { insurance: this.SECONDARY_WEIGHT, retail: 0 };
      }
    }

    for (const pattern of this.RETAIL_STATUS_PATTERNS) {
      if (status.includes(pattern)) {
        return { insurance: 0, retail: this.SECONDARY_WEIGHT };
      }
    }

    return { insurance: 0, retail: 0 };
  }

  // Helper function: Convert any value to safe string
  private toSafeString(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    return String(value);
  }

  // Tertiary Indicators - Keywords
  private analyzeKeywords(job: Job): { insurance: number; retail: number } {
    // Construct searchText safely with explicit type checking
    const textParts: string[] = [];

    // Add text fields with validation
    if (job.notes) textParts.push(this.toSafeString(job.notes));
    if (job.description) textParts.push(this.toSafeString(job.description));
    if (job.display_name) textParts.push(this.toSafeString(job.display_name));

    // Add tags safely - ensure each tag is a string
    if (Array.isArray(job.tags)) {
      for (const tag of job.tags) {
        if (tag) {
          textParts.push(this.toSafeString(tag));
        }
      }
    }

    const searchText = textParts.join(' ').toLowerCase();

    if (!searchText.trim()) {
      return { insurance: 0, retail: 0 };
    }

    let insuranceCount = 0;
    let retailCount = 0;

    for (const keyword of this.INSURANCE_KEYWORDS) {
      if (searchText.includes(keyword)) {
        insuranceCount++;
      }
    }

    for (const keyword of this.RETAIL_KEYWORDS) {
      if (searchText.includes(keyword)) {
        retailCount++;
      }
    }

    return {
      insurance: insuranceCount > 0 ? Math.min(this.TERTIARY_WEIGHT * 2, insuranceCount * 2) : 0,
      retail: retailCount > 0 ? Math.min(this.TERTIARY_WEIGHT * 2, retailCount * 2) : 0
    };
  }

  // Job Type Analysis
  private analyzeJobType(job: Job): { insurance: number; retail: number } {
    // Safe extraction with type checking
    const typeValue = this.toSafeString(job.type || job.sub_type);

    if (!typeValue || typeValue.trim().length === 0) {
      return { insurance: 0, retail: 0 };
    }

    const type = typeValue.toLowerCase();

    // Insurance type patterns
    const insuranceTypes = ['storm', 'hail', 'wind', 'water', 'damage', 'claim'];
    for (const pattern of insuranceTypes) {
      if (type.includes(pattern)) {
        return { insurance: this.SECONDARY_WEIGHT, retail: 0 };
      }
    }

    // Retail type patterns
    const retailTypes = ['new', 'replacement', 'upgrade', 'installation'];
    for (const pattern of retailTypes) {
      if (type.includes(pattern)) {
        return { insurance: 0, retail: this.SECONDARY_WEIGHT };
      }
    }

    return { insurance: 0, retail: 0 };
  }

  /**
   * Get detailed categorization report
   */
  public generateReport(jobs: Job[]): any {
    const categories = this.batchCategorize(jobs);

    const stats = {
      total: jobs.length,
      insurance: 0,
      retail: 0,
      hybrid: 0,
      unknown: 0,
      averageConfidence: 0,
      topIndicators: new Map<string, number>()
    };

    let totalConfidence = 0;

    categories.forEach(score => {
      stats[score.category]++;
      totalConfidence += score.confidence;

      // Track indicator frequency
      score.indicators_found.forEach(indicator => {
        stats.topIndicators.set(
          indicator,
          (stats.topIndicators.get(indicator) || 0) + 1
        );
      });
    });

    stats.averageConfidence = categories.size > 0 ? totalConfidence / categories.size : 0;

    // Sort indicators by frequency
    const sortedIndicators = Array.from(stats.topIndicators.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      statistics: {
        total: stats.total,
        distribution: {
          insurance: stats.insurance,
          retail: stats.retail,
          hybrid: stats.hybrid,
          unknown: stats.unknown
        },
        percentages: {
          insurance: (stats.total > 0 ? (stats.insurance / stats.total * 100) : 0).toFixed(1) + '%',
          retail: (stats.total > 0 ? (stats.retail / stats.total * 100) : 0).toFixed(1) + '%',
          hybrid: (stats.total > 0 ? (stats.hybrid / stats.total * 100) : 0).toFixed(1) + '%',
          unknown: (stats.total > 0 ? (stats.unknown / stats.total * 100) : 0).toFixed(1) + '%'
        },
        averageConfidence: stats.averageConfidence.toFixed(1),
        topIndicators: sortedIndicators
      },
      details: Array.from(categories.entries()).map(([id, score]) => ({
        jobId: id,
        ...score
      }))
    };
  }
}