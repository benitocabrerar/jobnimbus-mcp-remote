/**
 * Specialized Insurance Jobs Search Tool
 *
 * Dedicated tool for searching and analyzing insurance claim jobs
 * with insurance-specific filters and enrichment
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { JobCategorizer, Job } from '../../services/business/JobCategorizer.js';
import { getCurrentDate } from '../../utils/dateHelpers.js';

interface SearchInsuranceJobsInput {
  // Basic search
  query?: string;
  from?: number;
  size?: number;

  // Date filters
  date_from?: string;
  date_to?: string;

  // Insurance-specific filters
  claim_status?: 'filed' | 'approved' | 'denied' | 'supplementing' | 'closed' | 'paid';
  has_supplements?: boolean;
  carrier_name?: string;
  adjuster_name?: string;
  min_claim_value?: number;
  max_claim_value?: number;
  min_rcv?: number;  // Replacement Cost Value
  max_deductible?: number;
  has_depreciation?: boolean;
  supplement_count?: number;

  // Processing stage filters
  stage?: 'initial' | 'inspection' | 'estimate' | 'approval' | 'work' | 'completion' | 'payment';
  days_in_process?: number;
  is_stalled?: boolean;  // No activity > 14 days

  // Confidence and enrichment
  min_confidence?: number;
  enrich_with_contacts?: boolean;
  enrich_with_documents?: boolean;
  include_analytics?: boolean;
}

interface InsuranceJob extends Job {
  // Enhanced insurance fields
  _insurance_score?: number;
  _confidence?: number;
  _indicators?: string[];
  _stage?: string;
  _days_in_process?: number;
  _is_stalled?: boolean;
  _supplement_count?: number;
  _total_claim_value?: number;
  _net_claim_value?: number;  // After deductible
  _approval_probability?: number;
  _estimated_completion?: string;
}

interface InsuranceAnalytics {
  total_jobs: number;
  total_claim_value: number;
  average_claim_value: number;
  average_deductible: number;
  average_days_to_approval: number;
  approval_rate: number;
  supplement_rate: number;
  carriers: Array<{ name: string; count: number; value: number }>;
  adjusters: Array<{ name: string; count: number; approval_rate: number }>;
  stages: Record<string, number>;
  stalled_jobs: number;
  risk_indicators: string[];
}

export class SearchInsuranceJobsTool extends BaseTool<SearchInsuranceJobsInput, any> {
  private categorizer: JobCategorizer;

  constructor() {
    super();
    this.categorizer = new JobCategorizer();
  }

  get definition(): MCPToolDefinition {
    return {
      name: 'search_insurance_jobs',
      description: 'Specialized search for insurance claim jobs with advanced insurance-specific filtering and analytics',
      inputSchema: {
        type: 'object',
        properties: {
          // Basic search
          query: {
            type: 'string',
            description: 'Search query',
          },
          from: {
            type: 'number',
            description: 'Starting index (default: 0)',
          },
          size: {
            type: 'number',
            description: 'Number of results (default: 50, max: 100)',
          },

          // Date filters
          date_from: {
            type: 'string',
            description: 'Start date (YYYY-MM-DD)',
          },
          date_to: {
            type: 'string',
            description: 'End date (YYYY-MM-DD)',
          },

          // Insurance-specific
          claim_status: {
            type: 'string',
            enum: ['filed', 'approved', 'denied', 'supplementing', 'closed', 'paid'],
            description: 'Filter by claim status',
          },
          has_supplements: {
            type: 'boolean',
            description: 'Filter jobs with supplements',
          },
          carrier_name: {
            type: 'string',
            description: 'Insurance carrier name',
          },
          adjuster_name: {
            type: 'string',
            description: 'Adjuster name',
          },
          min_claim_value: {
            type: 'number',
            description: 'Minimum claim value',
          },
          max_claim_value: {
            type: 'number',
            description: 'Maximum claim value',
          },
          min_rcv: {
            type: 'number',
            description: 'Minimum Replacement Cost Value',
          },
          max_deductible: {
            type: 'number',
            description: 'Maximum deductible amount',
          },
          has_depreciation: {
            type: 'boolean',
            description: 'Has depreciation holdback',
          },
          supplement_count: {
            type: 'number',
            description: 'Minimum supplement count',
          },

          // Stage filters
          stage: {
            type: 'string',
            enum: ['initial', 'inspection', 'estimate', 'approval', 'work', 'completion', 'payment'],
            description: 'Current processing stage',
          },
          days_in_process: {
            type: 'number',
            description: 'Minimum days in process',
          },
          is_stalled: {
            type: 'boolean',
            description: 'Jobs with no activity > 14 days',
          },

          // Options
          min_confidence: {
            type: 'number',
            description: 'Minimum confidence score (0-100, default: 70)',
            minimum: 0,
            maximum: 100,
          },
          enrich_with_contacts: {
            type: 'boolean',
            description: 'Include related contact data',
          },
          enrich_with_documents: {
            type: 'boolean',
            description: 'Include document analysis',
          },
          include_analytics: {
            type: 'boolean',
            description: 'Include insurance analytics',
          },
        },
      },
    };
  }

  /**
   * Detect insurance-specific claim status
   */
  private detectClaimStatus(job: InsuranceJob): string | null {
    const status = (job.status || job.status_name || '').toLowerCase();

    const statusMap: Record<string, string[]> = {
      'filed': ['filed', 'submitted', 'pending', 'new claim'],
      'approved': ['approved', 'accepted', 'authorized'],
      'denied': ['denied', 'rejected', 'declined'],
      'supplementing': ['supplement', 'supplementing', 'additional'],
      'closed': ['closed', 'completed', 'finalized'],
      'paid': ['paid', 'payment received', 'settled']
    };

    for (const [key, patterns] of Object.entries(statusMap)) {
      if (patterns.some(p => status.includes(p))) {
        return key;
      }
    }

    return null;
  }

  /**
   * Detect current processing stage
   */
  private detectStage(job: InsuranceJob): string {
    const status = (job.status || '').toLowerCase();
    const hasEstimate = job.rcv || job.acv;
    const hasAdjuster = job.adjuster_name || job.adjuster_email;

    if (status.includes('paid') || status.includes('closed')) {
      return 'payment';
    }
    if (status.includes('complete') || status.includes('finish')) {
      return 'completion';
    }
    if (status.includes('work') || status.includes('repair') || status.includes('install')) {
      return 'work';
    }
    if (status.includes('approved')) {
      return 'approval';
    }
    if (hasEstimate) {
      return 'estimate';
    }
    if (hasAdjuster || status.includes('inspect')) {
      return 'inspection';
    }

    return 'initial';
  }

  /**
   * Calculate days in process
   */
  private calculateDaysInProcess(job: InsuranceJob): number {
    if (!job.date_created) return 0;

    const now = Date.now() / 1000;  // Current time in seconds
    const created = job.date_created;
    const daysElapsed = (now - created) / 86400;  // Convert to days

    return Math.floor(daysElapsed);
  }

  /**
   * Check if job is stalled
   */
  private isStalled(job: InsuranceJob): boolean {
    if (!job.date_updated) return false;

    const now = Date.now() / 1000;
    const lastUpdate = job.date_updated;
    const daysSinceUpdate = (now - lastUpdate) / 86400;

    return daysSinceUpdate > 14;  // No updates in 14 days
  }

  /**
   * Calculate total claim value
   */
  private calculateClaimValue(job: InsuranceJob): number {
    // Priority: RCV > ACV > estimate total
    if (typeof job.rcv === 'number' && job.rcv > 0) {
      return job.rcv;
    }
    if (typeof job.acv === 'number' && job.acv > 0) {
      return job.acv;
    }
    // Check for any total field
    if (typeof job.total === 'number' && job.total > 0) {
      return job.total;
    }
    if (typeof job.estimate_total === 'number' && job.estimate_total > 0) {
      return job.estimate_total;
    }

    return 0;
  }

  /**
   * Enhance job with insurance-specific data
   */
  private enhanceInsuranceJob(job: Job): InsuranceJob {
    const category = this.categorizer.categorize(job);
    const enhanced: InsuranceJob = {
      ...job,
      _insurance_score: category.insurance_score,
      _confidence: category.confidence,
      _indicators: category.indicators_found,
      _stage: this.detectStage(job as InsuranceJob),
      _days_in_process: this.calculateDaysInProcess(job as InsuranceJob),
      _is_stalled: this.isStalled(job as InsuranceJob),
      _total_claim_value: this.calculateClaimValue(job as InsuranceJob),
    };

    // Calculate net claim value (after deductible)
    if (enhanced._total_claim_value && typeof job.deductible === 'number') {
      enhanced._net_claim_value = enhanced._total_claim_value - job.deductible;
    }

    // Estimate approval probability based on indicators
    if (category.insurance_score >= 80) {
      enhanced._approval_probability = 0.9;
    } else if (category.insurance_score >= 60) {
      enhanced._approval_probability = 0.7;
    } else {
      enhanced._approval_probability = 0.5;
    }

    return enhanced;
  }

  /**
   * Generate insurance analytics
   */
  private generateAnalytics(jobs: InsuranceJob[]): InsuranceAnalytics {
    const analytics: InsuranceAnalytics = {
      total_jobs: jobs.length,
      total_claim_value: 0,
      average_claim_value: 0,
      average_deductible: 0,
      average_days_to_approval: 0,
      approval_rate: 0,
      supplement_rate: 0,
      carriers: [],
      adjusters: [],
      stages: {
        initial: 0,
        inspection: 0,
        estimate: 0,
        approval: 0,
        work: 0,
        completion: 0,
        payment: 0
      },
      stalled_jobs: 0,
      risk_indicators: []
    };

    // Aggregate data
    const carrierMap = new Map<string, { count: number; value: number }>();
    const adjusterMap = new Map<string, { count: number; approved: number }>();
    let totalDeductible = 0;
    let deductibleCount = 0;
    let approvedCount = 0;
    let supplementCount = 0;
    let totalDaysToApproval = 0;
    let approvalDaysCount = 0;

    for (const job of jobs) {
      // Claim value
      const claimValue = job._total_claim_value || 0;
      analytics.total_claim_value += claimValue;

      // Deductible
      if (typeof job.deductible === 'number') {
        totalDeductible += job.deductible;
        deductibleCount++;
      }

      // Approval tracking
      const status = this.detectClaimStatus(job);
      if (status === 'approved' || status === 'paid' || status === 'closed') {
        approvedCount++;
        if (job._days_in_process) {
          totalDaysToApproval += job._days_in_process;
          approvalDaysCount++;
        }
      }

      // Supplements
      if (job.has_supplements || (job.notes && job.notes.toLowerCase().includes('supplement'))) {
        supplementCount++;
      }

      // Carriers
      if (job.insurance_carrier) {
        const carrier = carrierMap.get(job.insurance_carrier) || { count: 0, value: 0 };
        carrier.count++;
        carrier.value += claimValue;
        carrierMap.set(job.insurance_carrier, carrier);
      }

      // Adjusters
      if (job.adjuster_name) {
        const adjuster = adjusterMap.get(job.adjuster_name) || { count: 0, approved: 0 };
        adjuster.count++;
        if (status === 'approved' || status === 'paid') {
          adjuster.approved++;
        }
        adjusterMap.set(job.adjuster_name, adjuster);
      }

      // Stages
      if (job._stage) {
        analytics.stages[job._stage]++;
      }

      // Stalled jobs
      if (job._is_stalled) {
        analytics.stalled_jobs++;
      }
    }

    // Calculate averages
    if (jobs.length > 0) {
      analytics.average_claim_value = analytics.total_claim_value / jobs.length;
      analytics.approval_rate = approvedCount / jobs.length;
      analytics.supplement_rate = supplementCount / jobs.length;
    }

    if (deductibleCount > 0) {
      analytics.average_deductible = totalDeductible / deductibleCount;
    }

    if (approvalDaysCount > 0) {
      analytics.average_days_to_approval = totalDaysToApproval / approvalDaysCount;
    }

    // Convert maps to arrays
    analytics.carriers = Array.from(carrierMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    analytics.adjusters = Array.from(adjusterMap.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        approval_rate: data.count > 0 ? data.approved / data.count : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Risk indicators
    if (analytics.stalled_jobs > jobs.length * 0.2) {
      analytics.risk_indicators.push('High stalled job rate (>20%)');
    }
    if (analytics.approval_rate < 0.5) {
      analytics.risk_indicators.push('Low approval rate (<50%)');
    }
    if (analytics.average_days_to_approval > 30) {
      analytics.risk_indicators.push('Long approval times (>30 days)');
    }

    return analytics;
  }

  async execute(input: SearchInsuranceJobsInput, context: ToolContext): Promise<any> {
    const fromIndex = input.from || 0;
    const requestedSize = Math.min(input.size || 50, 100);
    const minConfidence = input.min_confidence || 70;

    // Use current date as default if no date filters provided
    const currentDate = getCurrentDate();
    const dateFrom = input.date_from || currentDate;
    const dateTo = input.date_to || currentDate;

    // Fetch all jobs (we need to filter for insurance type)
    const batchSize = 100;
    const maxIterations = 50;
    let allJobs: Job[] = [];
    let offset = 0;
    let iteration = 0;

    // Build search query with insurance keywords
    let searchQuery = input.query || '';
    searchQuery = `${searchQuery} claim OR insurance OR adjuster OR supplement`.trim();

    while (iteration < maxIterations) {
      const params: any = { size: batchSize, from: offset };
      params.q = searchQuery;

      const response = await this.client.get(context.apiKey, 'jobs/search', params);
      const batch = response.data?.results || [];

      if (batch.length === 0) {
        break;
      }

      allJobs = allJobs.concat(batch);
      offset += batchSize;
      iteration++;

      if (batch.length < batchSize) {
        break;
      }
    }

    // Filter for insurance jobs with confidence threshold
    let insuranceJobs: InsuranceJob[] = allJobs
      .map(job => this.enhanceInsuranceJob(job))
      .filter(job => job._insurance_score! >= minConfidence);

    // Apply date filters
    if (dateFrom || dateTo) {
      insuranceJobs = insuranceJobs.filter(job => {
        if (!job.date_created) return false;

        if (dateFrom) {
          const fromDate = new Date(dateFrom).getTime() / 1000;
          if (job.date_created < fromDate) return false;
        }

        if (dateTo) {
          const toDate = new Date(dateTo + 'T23:59:59').getTime() / 1000;
          if (job.date_created > toDate) return false;
        }

        return true;
      });
    }

    // Apply claim status filter
    if (input.claim_status) {
      insuranceJobs = insuranceJobs.filter(job =>
        this.detectClaimStatus(job) === input.claim_status
      );
    }

    // Apply carrier filter
    if (input.carrier_name) {
      const carrierLower = input.carrier_name.toLowerCase();
      insuranceJobs = insuranceJobs.filter(job =>
        job.insurance_carrier &&
        job.insurance_carrier.toLowerCase().includes(carrierLower)
      );
    }

    // Apply adjuster filter
    if (input.adjuster_name) {
      const adjusterLower = input.adjuster_name.toLowerCase();
      insuranceJobs = insuranceJobs.filter(job =>
        job.adjuster_name &&
        job.adjuster_name.toLowerCase().includes(adjusterLower)
      );
    }

    // Apply value filters
    if (typeof input.min_claim_value === 'number') {
      insuranceJobs = insuranceJobs.filter(job =>
        (job._total_claim_value || 0) >= input.min_claim_value!
      );
    }

    if (typeof input.max_claim_value === 'number') {
      insuranceJobs = insuranceJobs.filter(job =>
        (job._total_claim_value || 0) <= input.max_claim_value!
      );
    }

    if (typeof input.min_rcv === 'number') {
      insuranceJobs = insuranceJobs.filter(job =>
        typeof job.rcv === 'number' && job.rcv >= input.min_rcv!
      );
    }

    if (typeof input.max_deductible === 'number') {
      insuranceJobs = insuranceJobs.filter(job =>
        typeof job.deductible === 'number' && job.deductible <= input.max_deductible!
      );
    }

    // Apply stage filter
    if (input.stage) {
      insuranceJobs = insuranceJobs.filter(job => job._stage === input.stage);
    }

    // Apply stalled filter
    if (input.is_stalled === true) {
      insuranceJobs = insuranceJobs.filter(job => job._is_stalled === true);
    }

    // Apply days in process filter
    if (typeof input.days_in_process === 'number') {
      insuranceJobs = insuranceJobs.filter(job =>
        (job._days_in_process || 0) >= input.days_in_process!
      );
    }

    // Sort by claim value (descending)
    insuranceJobs.sort((a, b) =>
      (b._total_claim_value || 0) - (a._total_claim_value || 0)
    );

    // Paginate
    const paginatedJobs = insuranceJobs.slice(fromIndex, fromIndex + requestedSize);

    // Generate analytics if requested
    let analytics = null;
    if (input.include_analytics) {
      analytics = this.generateAnalytics(insuranceJobs);
    }

    return {
      count: paginatedJobs.length,
      total: insuranceJobs.length,
      from: fromIndex,
      size: requestedSize,
      has_more: fromIndex + paginatedJobs.length < insuranceJobs.length,
      total_pages: Math.ceil(insuranceJobs.length / requestedSize),
      current_page: Math.floor(fromIndex / requestedSize) + 1,

      // Filters applied
      filters: {
        min_confidence: minConfidence,
        claim_status: input.claim_status,
        carrier: input.carrier_name,
        adjuster: input.adjuster_name,
        value_range: input.min_claim_value || input.max_claim_value ?
          `${input.min_claim_value || 0}-${input.max_claim_value || 'unlimited'}` : null,
        stage: input.stage,
        is_stalled: input.is_stalled,
        days_in_process: input.days_in_process
      },

      // Analytics
      analytics,

      // Results
      results: paginatedJobs
    };
  }
}