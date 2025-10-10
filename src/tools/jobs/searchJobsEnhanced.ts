/**
 * Enhanced Search Jobs Tool with Business Type Categorization
 *
 * Extends the existing search functionality with intelligent insurance vs retail filtering
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { JobCategorizer, Job, JobBusinessType, CategoryScore } from '../../services/business/JobCategorizer.js';
import { getCurrentDate } from '../../utils/dateHelpers.js';

interface SearchJobsEnhancedInput {
  // Existing search parameters
  query?: string;
  from?: number;
  size?: number;
  date_from?: string;
  date_to?: string;
  scheduled_from?: string;
  scheduled_to?: string;
  has_schedule?: boolean;
  sort_by?: 'date_start' | 'date_end' | 'date_created' | 'date_updated' | 'date_status_change';
  order?: 'asc' | 'desc';

  // New business type filtering
  business_type?: 'insurance' | 'retail' | 'hybrid' | 'unknown' | 'all';
  confidence_threshold?: number;  // 0-100, default 60
  include_categorization?: boolean; // Include scores in response

  // Advanced insurance filtering
  insurance_has_claim?: boolean;
  insurance_has_adjuster?: boolean;
  insurance_carrier?: string;
  insurance_status?: string;

  // Advanced retail filtering
  retail_has_financing?: boolean;
  retail_has_contract?: boolean;
  retail_min_commission?: number;
  retail_payment_method?: string;
}

interface EnhancedJob extends Job {
  _category?: CategoryScore;
  _business_type?: JobBusinessType;
  _confidence?: number;
}

export class SearchJobsEnhancedTool extends BaseTool<SearchJobsEnhancedInput, any> {
  private categorizer: JobCategorizer;

  constructor() {
    super();
    this.categorizer = new JobCategorizer();
  }

  get definition(): MCPToolDefinition {
    return {
      name: 'search_jobs_enhanced',
      description: 'Advanced job search with intelligent business type categorization (insurance vs retail)',
      inputSchema: {
        type: 'object',
        properties: {
          // Basic search
          query: {
            type: 'string',
            description: 'Search query (optional)',
          },
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
          },
          size: {
            type: 'number',
            description: 'Number of records to retrieve (default: 50, max: 100)',
          },

          // Date filters
          date_from: {
            type: 'string',
            description: 'Start date filter for date_created (YYYY-MM-DD format)',
          },
          date_to: {
            type: 'string',
            description: 'End date filter for date_created (YYYY-MM-DD format)',
          },
          scheduled_from: {
            type: 'string',
            description: 'Filter jobs scheduled on or after this date (YYYY-MM-DD format)',
          },
          scheduled_to: {
            type: 'string',
            description: 'Filter jobs scheduled on or before this date (YYYY-MM-DD format)',
          },
          has_schedule: {
            type: 'boolean',
            description: 'Filter only jobs with scheduled dates',
          },

          // Sorting
          sort_by: {
            type: 'string',
            enum: ['date_start', 'date_end', 'date_created', 'date_updated', 'date_status_change'],
            description: 'Field to sort by',
          },
          order: {
            type: 'string',
            enum: ['asc', 'desc'],
            description: 'Sort order (default: desc)',
          },

          // Business type filtering
          business_type: {
            type: 'string',
            enum: ['insurance', 'retail', 'hybrid', 'unknown', 'all'],
            description: 'Filter by business type (insurance claims vs retail sales)',
          },
          confidence_threshold: {
            type: 'number',
            description: 'Minimum confidence score for categorization (0-100, default: 60)',
            minimum: 0,
            maximum: 100,
          },
          include_categorization: {
            type: 'boolean',
            description: 'Include detailed categorization scores in response',
          },

          // Insurance-specific filters
          insurance_has_claim: {
            type: 'boolean',
            description: 'Filter for jobs with claim numbers',
          },
          insurance_has_adjuster: {
            type: 'boolean',
            description: 'Filter for jobs with adjuster information',
          },
          insurance_carrier: {
            type: 'string',
            description: 'Filter by insurance carrier name',
          },
          insurance_status: {
            type: 'string',
            description: 'Filter by insurance claim status',
          },

          // Retail-specific filters
          retail_has_financing: {
            type: 'boolean',
            description: 'Filter for jobs with financing',
          },
          retail_has_contract: {
            type: 'boolean',
            description: 'Filter for jobs with signed contracts',
          },
          retail_min_commission: {
            type: 'number',
            description: 'Minimum commission amount',
          },
          retail_payment_method: {
            type: 'string',
            description: 'Filter by payment method',
          },
        },
      },
    };
  }

  /**
   * Convert YYYY-MM-DD string to Unix timestamp
   */
  private dateStringToUnix(dateStr: string, isStartOfDay: boolean = true): number {
    const date = new Date(dateStr + 'T00:00:00Z');
    if (isStartOfDay) {
      return Math.floor(date.getTime() / 1000);
    } else {
      return Math.floor(date.getTime() / 1000) + 86399;
    }
  }

  /**
   * Filter jobs by date_created
   */
  private filterByDateCreated(jobs: EnhancedJob[], dateFrom?: string, dateTo?: string): EnhancedJob[] {
    let filtered = jobs;

    if (dateFrom) {
      const fromTs = this.dateStringToUnix(dateFrom, true);
      filtered = filtered.filter(j => (j.date_created || 0) >= fromTs);
    }

    if (dateTo) {
      const toTs = this.dateStringToUnix(dateTo, false);
      filtered = filtered.filter(j => (j.date_created || 0) <= toTs);
    }

    return filtered;
  }

  /**
   * Filter jobs by scheduling parameters
   */
  private filterBySchedule(
    jobs: EnhancedJob[],
    scheduledFrom?: string,
    scheduledTo?: string,
    hasSchedule?: boolean
  ): EnhancedJob[] {
    let filtered = jobs;

    if (hasSchedule !== undefined) {
      if (hasSchedule) {
        filtered = filtered.filter(j => (j.date_start || 0) > 0);
      } else {
        filtered = filtered.filter(j => (j.date_start || 0) === 0);
      }
    }

    if (scheduledFrom) {
      const scheduledFromTs = this.dateStringToUnix(scheduledFrom, true);
      filtered = filtered.filter(j => (j.date_start || 0) >= scheduledFromTs);
    }

    if (scheduledTo) {
      const scheduledToTs = this.dateStringToUnix(scheduledTo, false);
      filtered = filtered.filter(j => {
        const dateStart = j.date_start || 0;
        return dateStart > 0 && dateStart <= scheduledToTs;
      });
    }

    return filtered;
  }

  /**
   * Sort jobs by specified field
   */
  private sortJobs(jobs: EnhancedJob[], sortBy?: string, order: string = 'desc'): EnhancedJob[] {
    if (!sortBy || jobs.length === 0) {
      return jobs;
    }

    const validFields = ['date_start', 'date_end', 'date_created', 'date_updated', 'date_status_change'];
    if (!validFields.includes(sortBy)) {
      return jobs;
    }

    const reverse = order === 'desc';

    return [...jobs].sort((a, b) => {
      const aVal = (a[sortBy] as number) || 0;
      const bVal = (b[sortBy] as number) || 0;
      return reverse ? bVal - aVal : aVal - bVal;
    });
  }

  /**
   * Apply business type categorization and filtering
   */
  private applyBusinessTypeFilter(
    jobs: EnhancedJob[],
    businessType?: string,
    confidenceThreshold: number = 60,
    includeCategorization: boolean = false
  ): EnhancedJob[] {
    if (!businessType || businessType === 'all') {
      if (includeCategorization) {
        // Add categorization data without filtering
        return jobs.map(job => ({
          ...job,
          _category: this.categorizer.categorize(job)
        }));
      }
      return jobs;
    }

    // Categorize all jobs
    const categorizedJobs = jobs.map(job => {
      const category = this.categorizer.categorize(job);
      return {
        ...job,
        _category: category,
        _business_type: category.category,
        _confidence: category.confidence
      };
    });

    // Filter by business type and confidence
    const filtered = categorizedJobs.filter(job => {
      return job._category &&
             job._category.category === businessType &&
             job._category.confidence >= confidenceThreshold;
    });

    // Remove categorization data if not requested
    if (!includeCategorization) {
      return filtered.map(job => {
        const { _category, _business_type, _confidence, ...cleanJob } = job;
        return cleanJob;
      });
    }

    return filtered;
  }

  /**
   * Apply insurance-specific filters
   */
  private applyInsuranceFilters(jobs: EnhancedJob[], input: SearchJobsEnhancedInput): EnhancedJob[] {
    let filtered = jobs;

    if (input.insurance_has_claim === true) {
      filtered = filtered.filter(j => j.claim_number && j.claim_number.trim().length > 0);
    }

    if (input.insurance_has_adjuster === true) {
      filtered = filtered.filter(j => j.adjuster_name || j.adjuster_email || j.adjuster_phone);
    }

    if (input.insurance_carrier) {
      const carrierLower = input.insurance_carrier.toLowerCase();
      filtered = filtered.filter(j =>
        j.insurance_carrier && j.insurance_carrier.toLowerCase().includes(carrierLower)
      );
    }

    if (input.insurance_status) {
      const statusLower = input.insurance_status.toLowerCase();
      filtered = filtered.filter(j =>
        (j.status && j.status.toLowerCase().includes(statusLower)) ||
        (j.status_name && j.status_name.toLowerCase().includes(statusLower))
      );
    }

    return filtered;
  }

  /**
   * Apply retail-specific filters
   */
  private applyRetailFilters(jobs: EnhancedJob[], input: SearchJobsEnhancedInput): EnhancedJob[] {
    let filtered = jobs;

    if (input.retail_has_financing === true) {
      filtered = filtered.filter(j =>
        j.financing_type || (typeof j.loan_amount === 'number' && j.loan_amount > 0)
      );
    }

    if (input.retail_has_contract === true) {
      filtered = filtered.filter(j => j.contract_signed === true);
    }

    if (typeof input.retail_min_commission === 'number') {
      const minCommission = input.retail_min_commission;
      filtered = filtered.filter(j =>
        typeof j.commission_amount === 'number' &&
        j.commission_amount >= minCommission
      );
    }

    if (input.retail_payment_method) {
      const methodLower = input.retail_payment_method.toLowerCase();
      filtered = filtered.filter(j =>
        j.payment_method && j.payment_method.toLowerCase().includes(methodLower)
      );
    }

    return filtered;
  }

  async execute(input: SearchJobsEnhancedInput, context: ToolContext): Promise<any> {
    const fromIndex = input.from || 0;
    const requestedSize = Math.min(input.size || 50, 100);
    const order = input.order || 'desc';
    const confidenceThreshold = input.confidence_threshold || 60;

    // Use current date as default if no date filters provided
    const currentDate = getCurrentDate();
    const dateFrom = input.date_from || currentDate;
    const dateTo = input.date_to || currentDate;

    // Determine if we need to fetch all jobs for filtering/sorting
    // Always do full fetch when dateFrom/dateTo have values to apply date filtering
    const needsFullFetch =
      dateFrom ||
      dateTo ||
      input.scheduled_from ||
      input.scheduled_to ||
      input.has_schedule !== undefined ||
      input.sort_by ||
      input.business_type ||
      input.insurance_has_claim !== undefined ||
      input.insurance_has_adjuster !== undefined ||
      input.insurance_carrier ||
      input.insurance_status ||
      input.retail_has_financing !== undefined ||
      input.retail_has_contract !== undefined ||
      input.retail_min_commission !== undefined ||
      input.retail_payment_method;

    if (needsFullFetch) {
      // Fetch all jobs with pagination
      const batchSize = 100;
      const maxIterations = 50;
      let allJobs: EnhancedJob[] = [];
      let offset = 0;
      let iteration = 0;

      while (iteration < maxIterations) {
        const params: any = { size: batchSize, from: offset };
        if (input.query) {
          params.q = input.query;
        }

        const response = await this.client.get(context.apiKey, 'jobs', params);
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

      // Apply filters in sequence
      let filteredJobs = allJobs;

      // 1. Date filtering
      filteredJobs = this.filterByDateCreated(filteredJobs, dateFrom, dateTo);

      // 2. Schedule filtering
      if (input.scheduled_from || input.scheduled_to || input.has_schedule !== undefined) {
        filteredJobs = this.filterBySchedule(
          filteredJobs,
          input.scheduled_from,
          input.scheduled_to,
          input.has_schedule
        );
      }

      // 3. Business type categorization and filtering
      const preBusinessFilterCount = filteredJobs.length;
      filteredJobs = this.applyBusinessTypeFilter(
        filteredJobs,
        input.business_type,
        confidenceThreshold,
        input.include_categorization || false
      );

      // 4. Insurance-specific filters
      if (input.business_type === 'insurance' || input.business_type === 'hybrid') {
        filteredJobs = this.applyInsuranceFilters(filteredJobs, input);
      }

      // 5. Retail-specific filters
      if (input.business_type === 'retail' || input.business_type === 'hybrid') {
        filteredJobs = this.applyRetailFilters(filteredJobs, input);
      }

      // 6. Sorting
      if (input.sort_by) {
        filteredJobs = this.sortJobs(filteredJobs, input.sort_by, order);
      }

      // 7. Pagination
      const paginatedJobs = filteredJobs.slice(fromIndex, fromIndex + requestedSize);

      // Generate categorization statistics
      let categorizationStats = null;
      if (input.business_type && input.business_type !== 'all') {
        const report = this.categorizer.generateReport(allJobs);
        categorizationStats = {
          total_analyzed: allJobs.length,
          pre_filter_count: preBusinessFilterCount,
          post_filter_count: filteredJobs.length,
          distribution: report.statistics.distribution,
          average_confidence: report.statistics.averageConfidence,
          confidence_threshold: confidenceThreshold,
          top_indicators: report.statistics.topIndicators.slice(0, 5)
        };
      }

      return {
        count: paginatedJobs.length,
        total_filtered: filteredJobs.length,
        total_fetched: allJobs.length,
        iterations: iteration,
        from: fromIndex,
        size: requestedSize,
        has_more: fromIndex + paginatedJobs.length < filteredJobs.length,
        total_pages: Math.ceil(filteredJobs.length / requestedSize),
        current_page: Math.floor(fromIndex / requestedSize) + 1,

        // Filter status
        filters_applied: {
          query: input.query,
          date_filter: !!(input.date_from || input.date_to),
          schedule_filter: !!(input.scheduled_from || input.scheduled_to || input.has_schedule !== undefined),
          business_type_filter: input.business_type && input.business_type !== 'all',
          insurance_filters: !!(input.insurance_has_claim !== undefined ||
                               input.insurance_has_adjuster !== undefined ||
                               input.insurance_carrier ||
                               input.insurance_status),
          retail_filters: !!(input.retail_has_financing !== undefined ||
                            input.retail_has_contract !== undefined ||
                            input.retail_min_commission !== undefined ||
                            input.retail_payment_method),
          sorting: !!input.sort_by
        },

        // Categorization statistics
        categorization_stats: categorizationStats,

        // Results
        results: paginatedJobs
      };
    } else {
      // Simple search without advanced filtering
      const params: any = {
        from: fromIndex,
        size: requestedSize,
      };

      if (input.query) {
        params.q = input.query;
      }

      const result = await this.client.get(context.apiKey, 'jobs', params);
      const jobs = result.data?.results || [];

      // Optionally add categorization even for simple searches
      let processedJobs = jobs;
      if (input.include_categorization) {
        processedJobs = jobs.map((job: Job) => ({
          ...job,
          _category: this.categorizer.categorize(job)
        }));
      }

      return {
        count: processedJobs.length,
        total_filtered: processedJobs.length,
        from: fromIndex,
        size: requestedSize,
        has_more: false,
        filters_applied: {
          query: input.query,
          date_filter: false,
          schedule_filter: false,
          business_type_filter: false,
          insurance_filters: false,
          retail_filters: false,
          sorting: false
        },
        results: processedJobs
      };
    }
  }
}