/**
 * Get Job Analytics
 * Comprehensive job analytics with summary dashboards and geographic estimate analysis
 *
 * Consolidates/Enhances:
 * - get_job_summary (summary) - ENHANCED from original
 * - get_estimates_with_addresses (estimates_geo)
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

// ============================================================================
// TYPE DEFINITIONS - Summary Analysis
// ============================================================================

interface JobKPI {
  total_jobs: number;
  active_jobs: number;
  completed_jobs: number;
  cancelled_jobs: number;
  total_revenue: number;
  pending_revenue: number;
  avg_job_value: number;
  completion_rate: number;
}

interface StatusBreakdown {
  status_name: string;
  count: number;
  percentage: number;
  total_value: number;
  avg_value: number;
  avg_age_days: number;
}

interface JobTypeMetrics {
  job_type: string;
  count: number;
  revenue: number;
  avg_value: number;
  completion_rate: number;
  avg_cycle_time_days: number;
}

// ============================================================================
// TYPE DEFINITIONS - Estimates Geographic Analysis
// ============================================================================

interface AddressQuality {
  has_street: boolean;
  has_city: boolean;
  has_state: boolean;
  has_zip: boolean;
  completeness_score: number;
  is_complete: boolean;
  missing_fields: string[];
}

interface EstimateWithAddress {
  estimate_id: string;
  estimate_number: string;
  status: string;
  total_value: number;
  date_created: string;
  date_sent: string | null;
  date_approved: string | null;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    full_address: string;
  };
  address_quality: AddressQuality;
  related_job_id: string | null;
  related_contact_id: string | null;
  days_since_created: number;
  days_since_sent: number | null;
  follow_up_priority: 'High' | 'Medium' | 'Low';
}

interface LocationGroup {
  location_name: string;
  estimate_count: number;
  total_value: number;
  avg_estimate_value: number;
  pending_value: number;
  approved_value: number;
  approval_rate: number;
  estimates: EstimateWithAddress[];
  distance_cluster: 'High Density' | 'Medium Density' | 'Low Density';
}

interface AddressAnalytics {
  total_estimates: number;
  complete_addresses: number;
  incomplete_addresses: number;
  address_completeness_rate: number;
  avg_completeness_score: number;
  missing_fields_summary: Record<string, number>;
}

interface ProximityRecommendation {
  location: string;
  nearby_estimates: number;
  total_opportunity: number;
  recommended_action: string;
  optimal_route_day: string;
}

// ============================================================================
// MAIN TOOL CLASS
// ============================================================================

export class GetJobAnalyticsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_job_analytics',
      description: 'Job analytics: summary dashboards, geographic estimate analysis',
      inputSchema: {
        type: 'object',
        properties: {
          analysis_type: {
            type: 'string',
            enum: ['summary', 'estimates_geo'],
            description: 'Analysis type: summary or estimates_geo',
          },
          // Summary parameters
          time_period_days: {
            type: 'number',
            default: 90,
            description: '[Summary] Time period days (default: 90)',
          },
          include_trends: {
            type: 'boolean',
            default: true,
            description: '[Summary] Include trend analysis',
          },
          group_by_type: {
            type: 'boolean',
            default: true,
            description: '[Summary] Group metrics by job type',
          },
          // Estimates geo parameters
          include_address_validation: {
            type: 'boolean',
            default: true,
            description: '[Estimates Geo] Include address validation',
          },
          grouping_level: {
            type: 'string',
            enum: ['city', 'zip', 'state'],
            default: 'city',
            description: '[Estimates Geo] Grouping level (default: city)',
          },
          status_filter: {
            type: 'string',
            description: '[Estimates Geo] Filter by estimate status',
          },
          min_value: {
            type: 'number',
            description: '[Estimates Geo] Minimum estimate value',
          },
          include_proximity_analysis: {
            type: 'boolean',
            default: true,
            description: '[Estimates Geo] Include proximity analysis',
          },
        },
        required: ['analysis_type'],
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    const analysisType = input.analysis_type;

    try {
      switch (analysisType) {
        case 'summary':
          return await this.analyzeSummary(input, context);
        case 'estimates_geo':
          return await this.analyzeEstimatesGeo(input, context);
        default:
          return {
            error: `Invalid analysis_type: ${analysisType}. Must be one of: summary, estimates_geo`,
            status: 'Failed',
          };
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
        analysis_type: analysisType,
      };
    }
  }

  // ==========================================================================
  // SUMMARY ANALYSIS (from get_job_summary - ENHANCED)
  // ==========================================================================

  private async analyzeSummary(input: any, context: ToolContext): Promise<any> {
    const timePeriodDays = input.time_period_days || 90;
    const includeTrends = input.include_trends !== false;
    const groupByType = input.group_by_type !== false;

    // Check if using new handle-based parameters for response optimization
    const useHandleResponse = this.hasNewParams(input);

    // OPTIMIZATION (Week 2-3): Query Delegation Pattern
    // Calculate time window boundary for server-side filtering
    const nowDate = new Date();
    const startDate = new Date(nowDate.getTime() - timePeriodDays * 24 * 60 * 60 * 1000);

    const jobsFilter = JSON.stringify({
      must: [{
        range: {
          date_created: {
            gte: Math.floor(startDate.getTime() / 1000) // Unix timestamp in seconds
          }
        }
      }]
    });

    // Fetch data with server-side filtering and field projection
    const [jobsResponse, estimatesResponse] = await Promise.all([
      this.client.get(context.apiKey, 'jobs', {
        size: 50, // OPTIMIZED: Reduced from 100 for token efficiency
        filter: jobsFilter,
        fields: ['jnid', 'number', 'date_created', 'status_name', 'job_type_name', 'record_type_name'], // JSONB Field Projection
      }),
      this.client.get(context.apiKey, 'estimates', {
        size: 50, // OPTIMIZED: Reduced from 100 for token efficiency
        fields: ['jnid', 'total', 'date_signed', 'status_name', 'related'], // JSONB Field Projection
      }),
    ]);

    const jobs = jobsResponse.data?.results || [];
    const estimates = estimatesResponse.data?.results || [];

    // Build estimate lookup
    const estimatesByJob = new Map<string, any[]>();
    for (const estimate of estimates) {
      const related = estimate.related || [];
      for (const rel of related) {
        if (rel.type === 'job' && rel.id) {
          if (!estimatesByJob.has(rel.id)) {
            estimatesByJob.set(rel.id, []);
          }
          estimatesByJob.get(rel.id)!.push(estimate);
        }
      }
    }

    const nowTimestamp = Date.now();
    const cutoffDate = nowTimestamp - (timePeriodDays * 24 * 60 * 60 * 1000);

    // Filter jobs by time period
    const filteredJobs = jobs.filter((j: any) => {
      const createdDate = j.date_created || 0;
      return createdDate >= cutoffDate;
    });

    // Calculate KPIs
    let totalJobs = 0;
    let activeJobs = 0;
    let completedJobs = 0;
    let cancelledJobs = 0;
    let totalRevenue = 0;
    let pendingRevenue = 0;

    // Status breakdown
    const statusMap = new Map<string, {
      count: number;
      totalValue: number;
      totalAge: number;
    }>();

    // Job type metrics
    const jobTypeMap = new Map<string, {
      count: number;
      revenue: number;
      completed: number;
      totalCycleTime: number;
    }>();

    for (const job of filteredJobs) {
      totalJobs++;

      const statusName = job.status_name || 'Unknown';
      const jobType = job.job_type_name || 'Unspecified';
      const isComplete = statusName.toLowerCase().includes('complete') ||
                        statusName.toLowerCase().includes('won') ||
                        statusName.toLowerCase().includes('sold');
      const isCancelled = statusName.toLowerCase().includes('cancel') ||
                         statusName.toLowerCase().includes('lost');

      // Count by status
      if (isComplete) {
        completedJobs++;
      } else if (isCancelled) {
        cancelledJobs++;
      } else {
        activeJobs++;
      }

      // Calculate job value
      let jobValue = 0;
      const jobEstimates = estimatesByJob.get(job.jnid) || [];
      for (const est of jobEstimates) {
        const estValue = parseFloat(est.total || 0);
        jobValue += estValue;

        if (est.date_signed > 0 || est.status_name === 'approved') {
          totalRevenue += estValue;
        } else {
          pendingRevenue += estValue;
        }
      }

      // Status breakdown
      if (!statusMap.has(statusName)) {
        statusMap.set(statusName, { count: 0, totalValue: 0, totalAge: 0 });
      }
      const statusData = statusMap.get(statusName)!;
      statusData.count++;
      statusData.totalValue += jobValue;

      const createdDate = job.date_created || nowTimestamp;
      const ageInDays = (nowTimestamp - createdDate) / (24 * 60 * 60 * 1000);
      statusData.totalAge += ageInDays;

      // Job type metrics
      if (groupByType) {
        if (!jobTypeMap.has(jobType)) {
          jobTypeMap.set(jobType, {
            count: 0,
            revenue: 0,
            completed: 0,
            totalCycleTime: 0,
          });
        }
        const typeData = jobTypeMap.get(jobType)!;
        typeData.count++;
        typeData.revenue += jobValue;

        if (isComplete) {
          typeData.completed++;
          const cycleTime = job.date_updated && job.date_created
            ? (job.date_updated - job.date_created) / (24 * 60 * 60 * 1000)
            : 0;
          typeData.totalCycleTime += cycleTime;
        }
      }
    }

    // Build KPI summary
    const avgJobValue = totalJobs > 0 ? (totalRevenue + pendingRevenue) / totalJobs : 0;
    const completionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

    const kpis: JobKPI = {
      total_jobs: totalJobs,
      active_jobs: activeJobs,
      completed_jobs: completedJobs,
      cancelled_jobs: cancelledJobs,
      total_revenue: totalRevenue,
      pending_revenue: pendingRevenue,
      avg_job_value: avgJobValue,
      completion_rate: completionRate,
    };

    // Status breakdown
    const statusBreakdown: StatusBreakdown[] = Array.from(statusMap.entries())
      .map(([statusName, data]) => ({
        status_name: statusName,
        count: data.count,
        percentage: (data.count / totalJobs) * 100,
        total_value: data.totalValue,
        avg_value: data.count > 0 ? data.totalValue / data.count : 0,
        avg_age_days: data.count > 0 ? data.totalAge / data.count : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Job type metrics
    const jobTypeMetrics: JobTypeMetrics[] = Array.from(jobTypeMap.entries())
      .map(([jobType, data]) => ({
        job_type: jobType,
        count: data.count,
        revenue: data.revenue,
        avg_value: data.count > 0 ? data.revenue / data.count : 0,
        completion_rate: data.count > 0 ? (data.completed / data.count) * 100 : 0,
        avg_cycle_time_days: data.completed > 0 ? data.totalCycleTime / data.completed : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Trend analysis
    let trends = null;
    if (includeTrends && filteredJobs.length >= 10) {
      // Split into two halves
      const midpoint = Math.floor(filteredJobs.length / 2);
      const firstHalf = filteredJobs.slice(0, midpoint);
      const secondHalf = filteredJobs.slice(midpoint);

      const firstHalfRevenue = firstHalf.reduce((sum: number, j: any) => {
        const jobEsts = estimatesByJob.get(j.jnid) || [];
        return sum + jobEsts.reduce((s, e) => s + parseFloat(e.total || 0), 0);
      }, 0);

      const secondHalfRevenue = secondHalf.reduce((sum: number, j: any) => {
        const jobEsts = estimatesByJob.get(j.jnid) || [];
        return sum + jobEsts.reduce((s, e) => s + parseFloat(e.total || 0), 0);
      }, 0);

      const revenueGrowth = firstHalfRevenue > 0
        ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100
        : 0;

      const firstHalfCompleted = firstHalf.filter((j: any) => {
        const status = (j.status_name || '').toLowerCase();
        return status.includes('complete') || status.includes('won');
      }).length;

      const secondHalfCompleted = secondHalf.filter((j: any) => {
        const status = (j.status_name || '').toLowerCase();
        return status.includes('complete') || status.includes('won');
      }).length;

      const firstHalfCompletionRate = firstHalf.length > 0
        ? (firstHalfCompleted / firstHalf.length) * 100
        : 0;
      const secondHalfCompletionRate = secondHalf.length > 0
        ? (secondHalfCompleted / secondHalf.length) * 100
        : 0;

      trends = {
        revenue_trend: revenueGrowth > 5 ? 'Growing' : revenueGrowth < -5 ? 'Declining' : 'Stable',
        revenue_growth_rate: revenueGrowth,
        completion_rate_trend: secondHalfCompletionRate > firstHalfCompletionRate ? 'Improving' :
                              secondHalfCompletionRate < firstHalfCompletionRate ? 'Declining' : 'Stable',
        volume_trend: secondHalf.length > firstHalf.length ? 'Increasing' :
                     secondHalf.length < firstHalf.length ? 'Decreasing' : 'Stable',
      };
    }

    // Key insights
    const insights: string[] = [];

    if (completionRate < 50) {
      insights.push(`⚠️ LOW completion rate at ${completionRate.toFixed(1)}% - review sales process`);
    } else if (completionRate > 75) {
      insights.push(`✅ EXCELLENT completion rate at ${completionRate.toFixed(1)}%`);
    }

    if (pendingRevenue > totalRevenue) {
      insights.push(`💰 Large pipeline: $${pendingRevenue.toFixed(2)} pending vs $${totalRevenue.toFixed(2)} closed`);
    }

    const avgCycleTime = jobTypeMetrics.length > 0
      ? jobTypeMetrics.reduce((sum, jt) => sum + jt.avg_cycle_time_days, 0) / jobTypeMetrics.length
      : 0;
    if (avgCycleTime > 30) {
      insights.push(`⏱️ Long sales cycle: ${avgCycleTime.toFixed(1)} days average - consider acceleration strategies`);
    }

    const topJobType = jobTypeMetrics.length > 0 ? jobTypeMetrics[0] : null;
    if (topJobType) {
      insights.push(`🏆 Top performer: ${topJobType.job_type} with $${topJobType.revenue.toFixed(2)} revenue`);
    }

    if (trends && trends.revenue_trend === 'Declining') {
      insights.push(`📉 Revenue declining at ${trends.revenue_growth_rate.toFixed(1)}% - immediate action needed`);
    } else if (trends && trends.revenue_trend === 'Growing') {
      insights.push(`📈 Revenue growing at ${trends.revenue_growth_rate.toFixed(1)}% - continue momentum`);
    }

    // Build response data
    const responseData = {
      analysis_type: 'summary',
      data_source: 'Live JobNimbus API data',
      analysis_timestamp: new Date().toISOString(),
      time_period: {
        days: timePeriodDays,
        start_date: new Date(cutoffDate).toISOString(),
        end_date: new Date(nowTimestamp).toISOString(),
      },
      kpis: kpis,
      status_breakdown: statusBreakdown,
      job_type_metrics: groupByType ? jobTypeMetrics : undefined,
      trends: trends,
      key_insights: insights,
      performance_rating: {
        completion_rate: completionRate >= 75 ? 'Excellent' : completionRate >= 50 ? 'Good' : completionRate >= 25 ? 'Fair' : 'Poor',
        revenue_health: pendingRevenue > totalRevenue * 0.5 ? 'Healthy Pipeline' : 'Pipeline Needs Attention',
        overall: completionRate >= 60 && pendingRevenue > totalRevenue * 0.3 ? 'Strong' : 'Needs Improvement',
      },
    };

    // Use handle-based response if requested
    if (useHandleResponse) {
      const envelope = await this.wrapResponse([responseData], input, context, {
        entity: 'job_analytics_summary',
        maxRows: 1,
        pageInfo: {
          current_page: 1,
          total_pages: 1,
          has_more: false,
        },
      });

      return {
        ...envelope,
        query_metadata: {
          analysis_type: 'summary',
          time_period_days: timePeriodDays,
          total_jobs_analyzed: totalJobs,
          data_freshness: 'real-time',
        },
      };
    }

    // Fallback to legacy response
    return responseData;
  }

  // ==========================================================================
  // ESTIMATES GEOGRAPHIC ANALYSIS (from get_estimates_with_addresses)
  // ==========================================================================

  private async analyzeEstimatesGeo(input: any, context: ToolContext): Promise<any> {
    const includeValidation = input.include_address_validation !== false;
    const groupingLevel = input.grouping_level || 'city';
    const statusFilter = input.status_filter;
    const minValue = input.min_value || 0;
    const includeProximity = input.include_proximity_analysis !== false;

    // Check if using new handle-based parameters for response optimization
    const useHandleResponse = this.hasNewParams(input);

    // OPTIMIZATION (Week 2-3): JSONB Field Projection
    // Fetch data with only required fields
    const [estimatesResponse, jobsResponse] = await Promise.all([
      this.client.get(context.apiKey, 'estimates', {
        size: 50, // OPTIMIZED: Reduced from 100 for token efficiency
        fields: ['jnid', 'total', 'status_name', 'date_created', 'date_sent', 'date_approved', 'address_line1', 'city', 'state', 'state_text', 'zip', 'related'], // JSONB Field Projection
      }),
      this.client.get(context.apiKey, 'jobs', {
        size: 50, // OPTIMIZED: Reduced from 100 for token efficiency
        fields: ['jnid', 'address_line1', 'city', 'state', 'state_text', 'zip'], // JSONB Field Projection
      }),
    ]);

    const estimates = estimatesResponse.data?.results || [];
    const jobs = jobsResponse.data?.results || [];

    // Build job lookup for address data
    const jobLookup = new Map<string, any>();
    for (const job of jobs) {
      if (job.jnid) {
        jobLookup.set(job.jnid, job);
      }
    }

    // Process estimates with addresses
    const estimatesWithAddresses: EstimateWithAddress[] = [];
    const now = Date.now();

    for (const estimate of estimates) {
      const estimateValue = parseFloat(estimate.total || 0);

      // Apply filters
      if (minValue > 0 && estimateValue < minValue) continue;
      if (statusFilter && estimate.status_name !== statusFilter) continue;

      // Get address from estimate or related job
      let street = estimate.address_line1 || '';
      let city = estimate.city || '';
      let state = estimate.state || estimate.state_text || '';
      let zip = estimate.zip || '';

      // Try to get address from related job
      const related = estimate.related || [];
      let relatedJobId: string | null = null;
      let relatedContactId: string | null = null;

      for (const rel of related) {
        if (rel.type === 'job' && rel.id) {
          relatedJobId = rel.id;
          const job = jobLookup.get(rel.id);
          if (job) {
            street = street || job.address_line1 || '';
            city = city || job.city || '';
            state = state || job.state || job.state_text || '';
            zip = zip || job.zip || '';
          }
        }
        if (rel.type === 'contact' && rel.id) {
          relatedContactId = rel.id;
        }
      }

      // Address quality assessment
      const addressQuality = this.assessAddressQuality(street, city, state, zip);

      // Calculate days
      const dateCreated = estimate.date_created || 0;
      const dateSent = estimate.date_sent || 0;
      const dateApproved = estimate.date_approved || 0;

      const daysSinceCreated = dateCreated > 0
        ? Math.floor((now - dateCreated) / (1000 * 60 * 60 * 24))
        : 0;

      const daysSinceSent = dateSent > 0
        ? Math.floor((now - dateSent) / (1000 * 60 * 60 * 24))
        : null;

      // Follow-up priority
      const followUpPriority = this.calculateFollowUpPriority(
        estimate.status_name || '',
        estimateValue,
        daysSinceCreated,
        daysSinceSent,
        addressQuality.is_complete
      );

      estimatesWithAddresses.push({
        estimate_id: estimate.jnid || '',
        estimate_number: estimate.number || estimate.record_id?.toString() || '',
        status: estimate.status_name || 'Unknown',
        total_value: estimateValue,
        date_created: dateCreated > 0 ? new Date(dateCreated).toISOString() : 'Unknown',
        date_sent: dateSent > 0 ? new Date(dateSent).toISOString() : null,
        date_approved: dateApproved > 0 ? new Date(dateApproved).toISOString() : null,
        address: {
          street: street || 'Not provided',
          city: city || 'Unknown',
          state: state || 'Unknown',
          zip: zip || 'Unknown',
          full_address: this.formatAddress(street, city, state, zip),
        },
        address_quality: addressQuality,
        related_job_id: relatedJobId,
        related_contact_id: relatedContactId,
        days_since_created: daysSinceCreated,
        days_since_sent: daysSinceSent,
        follow_up_priority: followUpPriority,
      });
    }

    // Address analytics
    const addressAnalytics: AddressAnalytics = {
      total_estimates: estimatesWithAddresses.length,
      complete_addresses: estimatesWithAddresses.filter(e => e.address_quality.is_complete).length,
      incomplete_addresses: estimatesWithAddresses.filter(e => !e.address_quality.is_complete).length,
      address_completeness_rate: 0,
      avg_completeness_score: 0,
      missing_fields_summary: {},
    };

    if (estimatesWithAddresses.length > 0) {
      addressAnalytics.address_completeness_rate =
        (addressAnalytics.complete_addresses / addressAnalytics.total_estimates) * 100;

      addressAnalytics.avg_completeness_score =
        estimatesWithAddresses.reduce((sum, e) => sum + e.address_quality.completeness_score, 0) /
        estimatesWithAddresses.length;

      // Missing fields summary
      const missingFieldsCount: Record<string, number> = {
        street: 0,
        city: 0,
        state: 0,
        zip: 0,
      };

      for (const estimate of estimatesWithAddresses) {
        for (const field of estimate.address_quality.missing_fields) {
          missingFieldsCount[field] = (missingFieldsCount[field] || 0) + 1;
        }
      }

      addressAnalytics.missing_fields_summary = missingFieldsCount;
    }

    // Group by location
    const locationMap = new Map<string, EstimateWithAddress[]>();

    for (const estimate of estimatesWithAddresses) {
      let locationKey = '';

      if (groupingLevel === 'city') {
        const city = estimate.address.city;
        const state = estimate.address.state;
        locationKey = city !== 'Unknown' && state !== 'Unknown'
          ? `${city}, ${state}`
          : city !== 'Unknown' ? city : state;
      } else if (groupingLevel === 'zip') {
        locationKey = estimate.address.zip;
      } else { // state
        locationKey = estimate.address.state;
      }

      if (!locationKey || locationKey === 'Unknown') continue;

      if (!locationMap.has(locationKey)) {
        locationMap.set(locationKey, []);
      }
      locationMap.get(locationKey)!.push(estimate);
    }

    // Build location groups
    const locationGroups: LocationGroup[] = [];

    for (const [location, estimates] of locationMap.entries()) {
      const totalValue = estimates.reduce((sum, e) => sum + e.total_value, 0);
      const pendingValue = estimates
        .filter(e => e.status.toLowerCase().includes('pending') || !e.date_approved)
        .reduce((sum, e) => sum + e.total_value, 0);
      const approvedValue = estimates
        .filter(e => e.date_approved !== null)
        .reduce((sum, e) => sum + e.total_value, 0);

      const approvalRate = estimates.length > 0
        ? (estimates.filter(e => e.date_approved !== null).length / estimates.length) * 100
        : 0;

      // Density classification
      const densityCluster: 'High Density' | 'Medium Density' | 'Low Density' =
        estimates.length >= 10 ? 'High Density' :
        estimates.length >= 5 ? 'Medium Density' : 'Low Density';

      locationGroups.push({
        location_name: location,
        estimate_count: estimates.length,
        total_value: totalValue,
        avg_estimate_value: totalValue / estimates.length,
        pending_value: pendingValue,
        approved_value: approvedValue,
        approval_rate: approvalRate,
        estimates: estimates,
        distance_cluster: densityCluster,
      });
    }

    // Sort by total value
    locationGroups.sort((a, b) => b.total_value - a.total_value);

    // Proximity recommendations
    const proximityRecommendations: ProximityRecommendation[] = [];

    if (includeProximity) {
      for (const group of locationGroups.slice(0, 5)) {
        const pendingEstimates = group.estimates.filter(e =>
          !e.date_approved && e.follow_up_priority !== 'Low'
        );

        if (pendingEstimates.length >= 2) {
          const totalOpportunity = pendingEstimates.reduce((sum, e) => sum + e.total_value, 0);

          const optimalDay = pendingEstimates.length >= 5 ? 'Full day route' :
                            pendingEstimates.length >= 3 ? 'Half day route' : 'Morning route';

          proximityRecommendations.push({
            location: group.location_name,
            nearby_estimates: pendingEstimates.length,
            total_opportunity: totalOpportunity,
            recommended_action: `Schedule ${pendingEstimates.length} follow-ups in ${group.location_name}`,
            optimal_route_day: optimalDay,
          });
        }
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];

    const highPriorityEstimates = estimatesWithAddresses.filter(e => e.follow_up_priority === 'High').length;
    if (highPriorityEstimates > 0) {
      recommendations.push(`🚨 ${highPriorityEstimates} high-priority estimate(s) need immediate follow-up`);
    }

    if (addressAnalytics.address_completeness_rate < 70) {
      recommendations.push(`⚠️ Low address completeness (${addressAnalytics.address_completeness_rate.toFixed(1)}%) - improve data quality`);
    }

    const topLocation = locationGroups[0];
    if (topLocation) {
      recommendations.push(`📍 Top location: ${topLocation.location_name} with $${topLocation.total_value.toFixed(2)} in estimates`);
    }

    if (proximityRecommendations.length > 0) {
      recommendations.push(`🗺️ ${proximityRecommendations.length} location(s) with clustered estimates - optimize routes`);
    }

    const incompleteHighValue = estimatesWithAddresses.filter(e =>
      !e.address_quality.is_complete && e.total_value > 5000
    ).length;

    if (incompleteHighValue > 0) {
      recommendations.push(`💰 ${incompleteHighValue} high-value estimate(s) with incomplete addresses - data cleanup needed`);
    }

    // Build response data
    const responseData = {
      analysis_type: 'estimates_geo',
      data_source: 'Live JobNimbus API data',
      analysis_timestamp: new Date().toISOString(),
      grouping_level: groupingLevel,
      summary: {
        total_estimates: estimatesWithAddresses.length,
        total_value: estimatesWithAddresses.reduce((sum, e) => sum + e.total_value, 0),
        pending_value: estimatesWithAddresses
          .filter(e => !e.date_approved)
          .reduce((sum, e) => sum + e.total_value, 0),
        approved_value: estimatesWithAddresses
          .filter(e => e.date_approved)
          .reduce((sum, e) => sum + e.total_value, 0),
        unique_locations: locationGroups.length,
        high_priority_count: highPriorityEstimates,
      },
      address_analytics: includeValidation ? addressAnalytics : undefined,
      location_groups: locationGroups,
      proximity_recommendations: includeProximity ? proximityRecommendations : undefined,
      estimates_with_addresses: estimatesWithAddresses,
      recommendations: recommendations,
      data_quality_insights: [
        `Address completeness: ${addressAnalytics.address_completeness_rate.toFixed(1)}%`,
        `Average completeness score: ${addressAnalytics.avg_completeness_score.toFixed(1)}/100`,
        `${addressAnalytics.incomplete_addresses} estimate(s) need address cleanup`,
        `Most common missing field: ${this.getMostCommonMissingField(addressAnalytics.missing_fields_summary)}`,
      ],
    };

    // Use handle-based response if requested
    if (useHandleResponse) {
      const envelope = await this.wrapResponse([responseData], input, context, {
        entity: 'estimates_geo_analytics',
        maxRows: estimatesWithAddresses.length,
        pageInfo: {
          current_page: 1,
          total_pages: 1,
          has_more: false,
        },
      });

      return {
        ...envelope,
        query_metadata: {
          analysis_type: 'estimates_geo',
          grouping_level: groupingLevel,
          total_estimates: estimatesWithAddresses.length,
          total_locations: locationGroups.length,
          data_freshness: 'real-time',
        },
      };
    }

    // Fallback to legacy response
    return responseData;
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Assess address quality
   */
  private assessAddressQuality(street: string, city: string, state: string, zip: string): AddressQuality {
    const hasStreet = !!street && street !== 'Not provided';
    const hasCity = !!city && city !== 'Unknown';
    const hasState = !!state && state !== 'Unknown';
    const hasZip = !!zip && zip !== 'Unknown';

    const missingFields: string[] = [];
    if (!hasStreet) missingFields.push('street');
    if (!hasCity) missingFields.push('city');
    if (!hasState) missingFields.push('state');
    if (!hasZip) missingFields.push('zip');

    const completenessScore = [hasStreet, hasCity, hasState, hasZip]
      .filter(Boolean).length * 25;

    const isComplete = completenessScore === 100;

    return {
      has_street: hasStreet,
      has_city: hasCity,
      has_state: hasState,
      has_zip: hasZip,
      completeness_score: completenessScore,
      is_complete: isComplete,
      missing_fields: missingFields,
    };
  }

  /**
   * Calculate follow-up priority
   */
  private calculateFollowUpPriority(
    status: string,
    value: number,
    daysSinceCreated: number,
    daysSinceSent: number | null,
    hasCompleteAddress: boolean
  ): 'High' | 'Medium' | 'Low' {
    const statusLower = status.toLowerCase();

    // Already approved - low priority
    if (statusLower.includes('approved') || statusLower.includes('won')) {
      return 'Low';
    }

    // High value + sent + waiting for response
    if (value >= 10000 && daysSinceSent !== null && daysSinceSent >= 3 && daysSinceSent <= 14) {
      return 'High';
    }

    // High value + old + no response
    if (value >= 5000 && daysSinceCreated >= 14 && !hasCompleteAddress) {
      return 'Medium';
    }

    // Sent recently - wait
    if (daysSinceSent !== null && daysSinceSent < 3) {
      return 'Low';
    }

    // Old estimate with complete address
    if (daysSinceCreated >= 30 && hasCompleteAddress) {
      return 'Medium';
    }

    // Default
    return daysSinceCreated >= 7 ? 'Medium' : 'Low';
  }

  /**
   * Format address string
   */
  private formatAddress(street: string, city: string, state: string, zip: string): string {
    const parts: string[] = [];

    if (street && street !== 'Not provided') parts.push(street);
    if (city && city !== 'Unknown') parts.push(city);
    if (state && state !== 'Unknown') parts.push(state);
    if (zip && zip !== 'Unknown') parts.push(zip);

    return parts.length > 0 ? parts.join(', ') : 'Address not available';
  }

  /**
   * Get most common missing field
   */
  private getMostCommonMissingField(summary: Record<string, number>): string {
    let maxField = 'None';
    let maxCount = 0;

    for (const [field, count] of Object.entries(summary)) {
      if (count > maxCount) {
        maxCount = count;
        maxField = field;
      }
    }

    return maxCount > 0 ? `${maxField} (${maxCount} missing)` : 'None';
  }
}
