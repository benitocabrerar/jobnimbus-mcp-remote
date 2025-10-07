/**
 * Get Jobs Distribution
 * Geographic distribution analysis with density mapping, revenue concentration, and expansion recommendations
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface LocationMetrics {
  location: string;
  job_count: number;
  total_revenue: number;
  avg_job_value: number;
  win_rate: number;
  market_share_estimate: number;
  density_score: number;
}

interface GeographicCluster {
  cluster_name: string;
  locations: string[];
  total_jobs: number;
  total_revenue: number;
  concentration_percentage: number;
  expansion_priority: 'High' | 'Medium' | 'Low';
}

interface DistributionMetrics {
  total_locations: number;
  geographic_spread: 'Concentrated' | 'Moderate' | 'Dispersed';
  revenue_concentration_top_3: number;
  coverage_gaps: string[];
  saturation_level: 'High' | 'Medium' | 'Low';
}

export class GetJobsDistributionTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_jobs_distribution',
      description: 'Geographic distribution analysis with density mapping, revenue concentration analysis, and strategic expansion recommendations',
      inputSchema: {
        type: 'object',
        properties: {
          grouping_level: {
            type: 'string',
            enum: ['city', 'state', 'zip'],
            default: 'city',
            description: 'Geographic grouping level (default: city)',
          },
          min_jobs: {
            type: 'number',
            default: 1,
            description: 'Minimum jobs to include location (default: 1)',
          },
          include_revenue_analysis: {
            type: 'boolean',
            default: true,
            description: 'Include revenue concentration analysis',
          },
          identify_gaps: {
            type: 'boolean',
            default: true,
            description: 'Identify coverage gaps and expansion opportunities',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const groupingLevel = input.grouping_level || 'city';
      const minJobs = input.min_jobs || 1;
      const identifyGaps = input.identify_gaps !== false;

      // Fetch data
      const [jobsResponse, estimatesResponse, contactsResponse] = await Promise.all([
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'estimates', { size: 100 }),
        this.client.get(context.apiKey, 'contacts', { size: 100 }),
      ]);

      const jobs = jobsResponse.data?.results || [];
      const estimates = estimatesResponse.data?.results || [];
      const contacts = contactsResponse.data?.results || [];

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

      // Extract location name
      const getLocation = (obj: any): string => {
        if (groupingLevel === 'city') {
          const city = obj.city || '';
          const state = obj.state || obj.state_text || '';
          return city && state ? `${city}, ${state}` : city || state || 'Unknown';
        } else if (groupingLevel === 'zip') {
          return obj.zip || 'Unknown';
        } else { // state
          return obj.state || obj.state_text || 'Unknown';
        }
      };

      // Location map
      const locationMap = new Map<string, {
        jobCount: number;
        wonJobs: number;
        totalRevenue: number;
        jobValues: number[];
        contactCount: number;
      }>();

      // Process jobs
      for (const job of jobs) {
        const location = getLocation(job);
        if (!location || location === 'Unknown') continue;

        if (!locationMap.has(location)) {
          locationMap.set(location, {
            jobCount: 0,
            wonJobs: 0,
            totalRevenue: 0,
            jobValues: [],
            contactCount: 0,
          });
        }

        const loc = locationMap.get(location)!;
        loc.jobCount++;

        // Check if won
        const statusName = (job.status_name || '').toLowerCase();
        const isWon = statusName.includes('complete') ||
                     statusName.includes('won') ||
                     statusName.includes('sold');

        if (isWon) {
          loc.wonJobs++;
        }

        // Calculate revenue
        const jobEstimates = estimatesByJob.get(job.jnid) || [];
        for (const est of jobEstimates) {
          if (est.date_signed > 0 || est.status_name === 'approved') {
            const value = parseFloat(est.total || 0);
            loc.totalRevenue += value;
            loc.jobValues.push(value);
          }
        }
      }

      // Process contacts for market share estimation
      for (const contact of contacts) {
        const location = getLocation(contact);
        if (!location || location === 'Unknown') continue;

        if (!locationMap.has(location)) {
          locationMap.set(location, {
            jobCount: 0,
            wonJobs: 0,
            totalRevenue: 0,
            jobValues: [],
            contactCount: 0,
          });
        }

        const loc = locationMap.get(location)!;
        loc.contactCount++;
      }

      // Build location metrics
      const locationMetrics: LocationMetrics[] = [];
      let totalJobs = 0;
      let totalRevenue = 0;

      for (const [location, data] of locationMap.entries()) {
        if (data.jobCount < minJobs) continue;

        totalJobs += data.jobCount;
        totalRevenue += data.totalRevenue;

        const winRate = data.jobCount > 0
          ? (data.wonJobs / data.jobCount) * 100
          : 0;

        const avgJobValue = data.wonJobs > 0
          ? data.totalRevenue / data.wonJobs
          : 0;

        // Market share estimate (jobs per contact ratio)
        const marketShare = data.contactCount > 0
          ? (data.jobCount / data.contactCount) * 100
          : 0;

        // Density score (jobs per unit area - simplified)
        const densityScore = data.jobCount * 10; // Simplified scoring

        locationMetrics.push({
          location,
          job_count: data.jobCount,
          total_revenue: data.totalRevenue,
          avg_job_value: avgJobValue,
          win_rate: winRate,
          market_share_estimate: marketShare,
          density_score: densityScore,
        });
      }

      // Sort by job count
      locationMetrics.sort((a, b) => b.job_count - a.job_count);

      // Calculate distribution metrics
      const top3Revenue = locationMetrics.slice(0, 3)
        .reduce((sum, loc) => sum + loc.total_revenue, 0);
      const revenueConcentration = totalRevenue > 0
        ? (top3Revenue / totalRevenue) * 100
        : 0;

      const geographicSpread: 'Concentrated' | 'Moderate' | 'Dispersed' =
        locationMetrics.length <= 5 ? 'Concentrated' :
        locationMetrics.length <= 15 ? 'Moderate' : 'Dispersed';

      const saturationLevel: 'High' | 'Medium' | 'Low' =
        revenueConcentration >= 70 ? 'High' :
        revenueConcentration >= 40 ? 'Medium' : 'Low';

      // Identify coverage gaps
      const coverageGaps: string[] = [];
      if (identifyGaps) {
        // Simple gap identification based on existing locations
        const lowPerformingLocations = locationMetrics.filter(loc =>
          loc.job_count < totalJobs / locationMetrics.length * 0.5
        );

        if (lowPerformingLocations.length > locationMetrics.length * 0.3) {
          coverageGaps.push('Multiple underperforming locations detected - review resource allocation');
        }

        const noContactLocations = locationMetrics.filter(loc =>
          loc.market_share_estimate === 0
        );

        if (noContactLocations.length > 0) {
          coverageGaps.push(`${noContactLocations.length} location(s) with jobs but no contacts - lead generation opportunity`);
        }

        if (locationMetrics.length < 5) {
          coverageGaps.push('Limited geographic coverage - consider expansion into new markets');
        }
      }

      const distributionMetrics: DistributionMetrics = {
        total_locations: locationMetrics.length,
        geographic_spread: geographicSpread,
        revenue_concentration_top_3: revenueConcentration,
        coverage_gaps: coverageGaps,
        saturation_level: saturationLevel,
      };

      // Create geographic clusters
      const clusters: GeographicCluster[] = [];

      // High-revenue cluster (top 30% by revenue)
      const highRevenueThreshold = locationMetrics.length > 0
        ? locationMetrics[Math.floor(locationMetrics.length * 0.3)]?.total_revenue || 0
        : 0;

      const highRevenueLocs = locationMetrics.filter(loc => loc.total_revenue >= highRevenueThreshold);
      if (highRevenueLocs.length > 0) {
        const clusterRevenue = highRevenueLocs.reduce((sum, loc) => sum + loc.total_revenue, 0);
        const clusterJobs = highRevenueLocs.reduce((sum, loc) => sum + loc.job_count, 0);

        clusters.push({
          cluster_name: 'High Revenue Zone',
          locations: highRevenueLocs.map(loc => loc.location),
          total_jobs: clusterJobs,
          total_revenue: clusterRevenue,
          concentration_percentage: (clusterRevenue / totalRevenue) * 100,
          expansion_priority: 'High',
        });
      }

      // High-volume cluster (top 30% by job count)
      const sortedByJobs = [...locationMetrics].sort((a, b) => b.job_count - a.job_count);
      const highVolumeLocs = sortedByJobs.slice(0, Math.max(1, Math.floor(sortedByJobs.length * 0.3)));

      if (highVolumeLocs.length > 0 && !clusters.some(c => c.cluster_name === 'High Revenue Zone')) {
        const clusterRevenue = highVolumeLocs.reduce((sum, loc) => sum + loc.total_revenue, 0);
        const clusterJobs = highVolumeLocs.reduce((sum, loc) => sum + loc.job_count, 0);

        clusters.push({
          cluster_name: 'High Volume Zone',
          locations: highVolumeLocs.map(loc => loc.location),
          total_jobs: clusterJobs,
          total_revenue: clusterRevenue,
          concentration_percentage: (clusterRevenue / totalRevenue) * 100,
          expansion_priority: 'Medium',
        });
      }

      // Emerging markets (good win rate but low volume)
      const emergingLocs = locationMetrics.filter(loc =>
        loc.win_rate >= 50 && loc.job_count < totalJobs / locationMetrics.length
      );

      if (emergingLocs.length > 0) {
        const clusterRevenue = emergingLocs.reduce((sum, loc) => sum + loc.total_revenue, 0);
        const clusterJobs = emergingLocs.reduce((sum, loc) => sum + loc.job_count, 0);

        clusters.push({
          cluster_name: 'Emerging Markets',
          locations: emergingLocs.map(loc => loc.location),
          total_jobs: clusterJobs,
          total_revenue: clusterRevenue,
          concentration_percentage: (clusterRevenue / totalRevenue) * 100,
          expansion_priority: 'Medium',
        });
      }

      // Generate recommendations
      const recommendations: string[] = [];

      if (revenueConcentration > 70) {
        recommendations.push(`⚠️ High revenue concentration (${revenueConcentration.toFixed(1)}%) in top 3 locations - diversification recommended`);
      }

      if (locationMetrics.length < 5) {
        recommendations.push('📍 Limited geographic presence - consider expanding into new markets');
      }

      const topLocation = locationMetrics[0];
      if (topLocation) {
        recommendations.push(`🏆 Top market: ${topLocation.location} with ${topLocation.job_count} jobs and $${topLocation.total_revenue.toFixed(2)} revenue`);
      }

      if (emergingLocs.length > 0) {
        recommendations.push(`🌱 ${emergingLocs.length} emerging market(s) with high win rates - invest in marketing and sales`);
      }

      const lowWinRateLocs = locationMetrics.filter(loc => loc.win_rate < 30);
      if (lowWinRateLocs.length > 0) {
        recommendations.push(`⚠️ ${lowWinRateLocs.length} location(s) with low win rates (<30%) - review pricing and competition`);
      }

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        grouping_level: groupingLevel,
        summary: {
          total_jobs: totalJobs,
          total_revenue: totalRevenue,
          unique_locations: locationMetrics.length,
          avg_jobs_per_location: locationMetrics.length > 0 ? totalJobs / locationMetrics.length : 0,
          avg_revenue_per_location: locationMetrics.length > 0 ? totalRevenue / locationMetrics.length : 0,
        },
        distribution_metrics: distributionMetrics,
        location_metrics: locationMetrics,
        geographic_clusters: clusters,
        recommendations: recommendations,
        strategic_insights: [
          `Geographic spread: ${geographicSpread}`,
          `Revenue concentration in top 3: ${revenueConcentration.toFixed(1)}%`,
          `Market saturation level: ${saturationLevel}`,
          `${coverageGaps.length} coverage gap(s) identified`,
        ],
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }
}
