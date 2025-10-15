/**
 * Get Estimates With Addresses
 * Comprehensive estimate analysis with geographic mapping, address validation, and revenue concentration
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

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

export class GetEstimatesWithAddressesTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_estimates_with_addresses',
      description: 'Comprehensive estimate analysis with geographic mapping, address validation, revenue concentration, and follow-up prioritization',
      inputSchema: {
        type: 'object',
        properties: {
          include_address_validation: {
            type: 'boolean',
            default: true,
            description: 'Include address completeness validation',
          },
          grouping_level: {
            type: 'string',
            enum: ['city', 'zip', 'state'],
            default: 'city',
            description: 'Geographic grouping level (default: city)',
          },
          status_filter: {
            type: 'string',
            description: 'Filter by estimate status (e.g., "pending", "approved")',
          },
          min_value: {
            type: 'number',
            description: 'Minimum estimate value to include',
          },
          include_proximity_analysis: {
            type: 'boolean',
            default: true,
            description: 'Include geographic proximity analysis for route optimization',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const includeValidation = input.include_address_validation !== false;
      const groupingLevel = input.grouping_level || 'city';
      const statusFilter = input.status_filter;
      const minValue = input.min_value || 0;
      const includeProximity = input.include_proximity_analysis !== false;

      // Fetch data
      const [estimatesResponse, jobsResponse] = await Promise.all([
        this.client.get(context.apiKey, 'estimates', { size: 100 }),
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
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

      return {
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
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }

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
