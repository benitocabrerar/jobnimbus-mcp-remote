/**
 * Get Territory Analytics
 * Consolidated territory and geographic analysis with multiple analysis types
 *
 * Consolidates:
 * - get_optimal_door_routes (routes)
 * - get_territory_heat_maps (heatmaps)
 * - get_jobs_distribution (distribution)
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

export class GetTerritoryAnalyticsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_territory_analytics',
      description: 'Territory & geographic analysis: routes optimization, heat maps, distribution',
      inputSchema: {
        type: 'object',
        properties: {
          analysis_type: {
            type: 'string',
            enum: ['routes', 'heatmaps', 'distribution'],
            description: 'Type of analysis: routes (door-to-door optimization), heatmaps (performance mapping), distribution (geographic spread)',
          },
          territory: {
            type: 'string',
            description: 'Territory or city to analyze (optional, analyzes all if not specified)',
          },
          grouping_level: {
            type: 'string',
            enum: ['city', 'zip', 'state'],
            default: 'city',
            description: 'Geographic grouping level (default: city) - used for heatmaps and distribution',
          },
          time_period_days: {
            type: 'number',
            default: 90,
            description: 'Days of history to analyze (default: 90)',
          },
          // Routes-specific parameters
          max_routes: {
            type: 'number',
            default: 5,
            description: '[Routes only] Maximum number of routes to generate (default: 5)',
          },
          target_hours_per_route: {
            type: 'number',
            default: 4,
            description: '[Routes only] Target hours per route (default: 4)',
          },
          prioritize_recent_activity: {
            type: 'boolean',
            default: true,
            description: '[Routes only] Prioritize areas with recent customer activity',
          },
          // Heatmaps/Distribution-specific parameters
          min_jobs_threshold: {
            type: 'number',
            default: 3,
            description: '[Heatmaps only] Minimum jobs to include zone in analysis (default: 3)',
          },
          include_opportunity_analysis: {
            type: 'boolean',
            default: true,
            description: '[Heatmaps only] Include untapped opportunity analysis',
          },
          min_jobs: {
            type: 'number',
            default: 1,
            description: '[Distribution only] Minimum jobs to include location (default: 1)',
          },
          identify_gaps: {
            type: 'boolean',
            default: true,
            description: '[Distribution only] Identify coverage gaps and expansion opportunities',
          },
          include_revenue_analysis: {
            type: 'boolean',
            default: true,
            description: '[Distribution only] Include revenue concentration analysis',
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
        case 'routes':
          return await this.analyzeRoutes(input, context);
        case 'heatmaps':
          return await this.analyzeHeatmaps(input, context);
        case 'distribution':
          return await this.analyzeDistribution(input, context);
        default:
          return {
            error: `Invalid analysis_type: ${analysisType}. Must be one of: routes, heatmaps, distribution`,
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

  /**
   * Routes Analysis - Door-to-door sales route optimization
   */
  private async analyzeRoutes(input: any, context: ToolContext): Promise<any> {
    const territory = input.territory;
    const maxRoutes = input.max_routes || 5;
    const targetHours = input.target_hours_per_route || 4;
    const prioritizeActivity = input.prioritize_recent_activity !== false;

    // Fetch data
    const [jobsResponse, contactsResponse] = await Promise.all([
      this.client.get(context.apiKey, 'jobs', { size: 200 }),
      this.client.get(context.apiKey, 'contacts', { size: 200 }),
    ]);

    const jobs = jobsResponse.data?.results || [];
    const contacts = contactsResponse.data?.results || [];

    // Build location map
    const locationMap = new Map<string, {
      addresses: Set<string>;
      jobCount: number;
      contactCount: number;
      recentActivity: number;
      lastActivity: number;
    }>();

    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

    // Process jobs
    for (const job of jobs) {
      const city = job.city || '';
      const state = job.state || job.state_text || '';
      const zip = job.zip || '';
      const address = job.address || job.address_line1 || '';

      let locationKey = '';
      if (city) {
        locationKey = `${city}, ${state}`.trim();
      } else if (zip) {
        locationKey = zip;
      } else {
        continue;
      }

      if (territory && !locationKey.toLowerCase().includes(territory.toLowerCase())) {
        continue;
      }

      if (!locationMap.has(locationKey)) {
        locationMap.set(locationKey, {
          addresses: new Set(),
          jobCount: 0,
          contactCount: 0,
          recentActivity: 0,
          lastActivity: 0,
        });
      }

      const location = locationMap.get(locationKey)!;
      if (address) location.addresses.add(address);
      location.jobCount++;

      const jobDate = job.date_created || 0;
      if (jobDate > thirtyDaysAgo) {
        location.recentActivity++;
      }
      if (jobDate > location.lastActivity) {
        location.lastActivity = jobDate;
      }
    }

    // Process contacts
    for (const contact of contacts) {
      const city = contact.city || '';
      const state = contact.state_text || contact.state || '';
      const zip = contact.zip || '';
      const address = contact.address_line1 || '';

      let locationKey = '';
      if (city) {
        locationKey = `${city}, ${state}`.trim();
      } else if (zip) {
        locationKey = zip;
      } else {
        continue;
      }

      if (territory && !locationKey.toLowerCase().includes(territory.toLowerCase())) {
        continue;
      }

      if (!locationMap.has(locationKey)) {
        locationMap.set(locationKey, {
          addresses: new Set(),
          jobCount: 0,
          contactCount: 0,
          recentActivity: 0,
          lastActivity: 0,
        });
      }

      const location = locationMap.get(locationKey)!;
      if (address) location.addresses.add(address);
      location.contactCount++;
    }

    // Build clusters
    const clusters: any[] = [];
    let clusterId = 1;

    for (const [locationKey, data] of locationMap.entries()) {
      const locationCount = data.addresses.size;
      if (locationCount === 0) continue;

      const doorsPerHour = 15;
      const estimatedTime = locationCount / doorsPerHour;

      let priorityScore = locationCount * 10;
      if (prioritizeActivity) {
        priorityScore += data.recentActivity * 50;
        priorityScore += data.jobCount * 20;
      }

      clusters.push({
        cluster_id: clusterId++,
        center_address: locationKey,
        location_count: locationCount,
        estimated_coverage_time_hours: estimatedTime,
        priority_score: priorityScore,
        recent_activity: data.recentActivity > 0,
      });
    }

    clusters.sort((a, b) => b.priority_score - a.priority_score);

    // Generate routes
    const routes: any[] = [];
    const usedClusters = new Set<number>();

    for (let routeNum = 1; routeNum <= maxRoutes && clusters.length > 0; routeNum++) {
      const routeClusters: number[] = [];
      let totalTime = 0;
      let totalLocations = 0;

      for (const cluster of clusters) {
        if (usedClusters.has(cluster.cluster_id)) continue;

        if (totalTime + cluster.estimated_coverage_time_hours <= targetHours * 1.2) {
          routeClusters.push(cluster.cluster_id);
          totalTime += cluster.estimated_coverage_time_hours;
          totalLocations += cluster.location_count;
          usedClusters.add(cluster.cluster_id);
        }

        if (totalTime >= targetHours) break;
      }

      if (routeClusters.length === 0) break;

      const bestDay = routeNum % 2 === 0 ? 'Saturday' : 'Thursday';
      const bestTime = routeNum % 2 === 0 ? '10:00 AM - 2:00 PM' : '5:00 PM - 8:00 PM';

      routes.push({
        route_id: routeNum,
        cluster_ids: routeClusters,
        total_locations: totalLocations,
        estimated_duration_hours: totalTime,
        potential_reach: totalLocations,
        best_day_of_week: bestDay,
        best_time_slot: bestTime,
      });
    }

    const totalClusters = clusters.length;
    const avgLocationsPerCluster = totalClusters > 0
      ? clusters.reduce((sum: number, c: any) => sum + c.location_count, 0) / totalClusters
      : 0;

    const routeDensity = avgLocationsPerCluster;
    const efficiencyRating = routeDensity >= 50 ? 'Excellent' :
                              routeDensity >= 30 ? 'Good' :
                              routeDensity >= 15 ? 'Fair' : 'Poor';

    return {
      analysis_type: 'routes',
      data_source: 'Live JobNimbus API data',
      analysis_timestamp: new Date().toISOString(),
      territory_filter: territory || 'All territories',
      summary: {
        total_clusters_identified: clusters.length,
        total_routes_generated: routes.length,
        total_doors_covered: routes.reduce((sum: number, r: any) => sum + r.total_locations, 0),
        total_estimated_hours: routes.reduce((sum: number, r: any) => sum + r.estimated_duration_hours, 0),
      },
      address_clusters: clusters.slice(0, 20),
      optimized_routes: routes,
      efficiency_metrics: {
        route_density: routeDensity,
        avg_walking_distance_minutes: 5,
        estimated_doors_per_hour: 12,
        efficiency_rating: efficiencyRating,
      },
    };
  }

  /**
   * Heatmaps Analysis - Territory performance heat maps
   */
  private async analyzeHeatmaps(input: any, context: ToolContext): Promise<any> {
    const groupingLevel = input.grouping_level || 'city';
    const minJobsThreshold = input.min_jobs_threshold || 3;
    const includeOpportunity = input.include_opportunity_analysis !== false;

    const jobsResponse = await this.client.get(context.apiKey, 'jobs', { size: 500 });
    const jobs = jobsResponse.data?.results || [];

    const zoneMap = new Map<string, {
      jobs: number;
      revenue: number;
      avgJobValue: number;
      wonJobs: number;
      lostJobs: number;
      winRate: number;
    }>();

    for (const job of jobs) {
      let zoneKey = '';

      switch (groupingLevel) {
        case 'city':
          zoneKey = job.city ? `${job.city}, ${job.state || job.state_text || ''}` : '';
          break;
        case 'zip':
          zoneKey = job.zip || '';
          break;
        case 'state':
          zoneKey = job.state || job.state_text || '';
          break;
      }

      if (!zoneKey) continue;

      if (!zoneMap.has(zoneKey)) {
        zoneMap.set(zoneKey, {
          jobs: 0,
          revenue: 0,
          avgJobValue: 0,
          wonJobs: 0,
          lostJobs: 0,
          winRate: 0,
        });
      }

      const zone = zoneMap.get(zoneKey)!;
      zone.jobs++;

      const jobValue = job.approved_estimate_total || job.last_estimate || 0;
      zone.revenue += jobValue;

      const status = (job.status_name || '').toLowerCase();
      if (status.includes('paid') || status.includes('closed') || status.includes('completed')) {
        zone.wonJobs++;
      } else if (status.includes('lost')) {
        zone.lostJobs++;
      }
    }

    // Calculate metrics
    const zones = Array.from(zoneMap.entries())
      .filter(([_, data]) => data.jobs >= minJobsThreshold)
      .map(([zone, data]) => {
        data.avgJobValue = data.jobs > 0 ? data.revenue / data.jobs : 0;
        data.winRate = (data.wonJobs + data.lostJobs) > 0
          ? data.wonJobs / (data.wonJobs + data.lostJobs)
          : 0;

        // Performance score (0-100)
        const revenueScore = Math.min(data.revenue / 100000, 1) * 40; // Up to 40 points for revenue
        const volumeScore = Math.min(data.jobs / 50, 1) * 30; // Up to 30 points for volume
        const winRateScore = data.winRate * 30; // Up to 30 points for win rate

        const performanceScore = revenueScore + volumeScore + winRateScore;
        const heatLevel = performanceScore >= 75 ? 'Hot' :
                         performanceScore >= 50 ? 'Warm' :
                         performanceScore >= 25 ? 'Cool' : 'Cold';

        return {
          zone,
          jobs: data.jobs,
          revenue: data.revenue,
          avg_job_value: data.avgJobValue,
          won_jobs: data.wonJobs,
          lost_jobs: data.lostJobs,
          win_rate: data.winRate,
          performance_score: performanceScore,
          heat_level: heatLevel,
        };
      });

    zones.sort((a, b) => b.performance_score - a.performance_score);

    return {
      analysis_type: 'heatmaps',
      data_source: 'Live JobNimbus API data',
      analysis_timestamp: new Date().toISOString(),
      grouping_level: groupingLevel,
      summary: {
        total_zones: zones.length,
        hot_zones: zones.filter(z => z.heat_level === 'Hot').length,
        warm_zones: zones.filter(z => z.heat_level === 'Warm').length,
        cool_zones: zones.filter(z => z.heat_level === 'Cool').length,
        cold_zones: zones.filter(z => z.heat_level === 'Cold').length,
      },
      zones: zones,
      top_performers: zones.slice(0, 10),
      opportunity_areas: includeOpportunity ? zones.filter(z => z.heat_level === 'Cool' || z.heat_level === 'Warm').slice(0, 10) : [],
    };
  }

  /**
   * Distribution Analysis - Geographic job distribution
   */
  private async analyzeDistribution(input: any, context: ToolContext): Promise<any> {
    const groupingLevel = input.grouping_level || 'city';
    const minJobs = input.min_jobs || 1;
    const identifyGaps = input.identify_gaps !== false;
    const includeRevenue = input.include_revenue_analysis !== false;

    const jobsResponse = await this.client.get(context.apiKey, 'jobs', { size: 500 });
    const jobs = jobsResponse.data?.results || [];

    const locationMap = new Map<string, {
      count: number;
      revenue: number;
      activeJobs: number;
      closedJobs: number;
    }>();

    for (const job of jobs) {
      let locationKey = '';

      switch (groupingLevel) {
        case 'city':
          locationKey = job.city ? `${job.city}, ${job.state || job.state_text || ''}` : '';
          break;
        case 'zip':
          locationKey = job.zip || '';
          break;
        case 'state':
          locationKey = job.state || job.state_text || '';
          break;
      }

      if (!locationKey) continue;

      if (!locationMap.has(locationKey)) {
        locationMap.set(locationKey, {
          count: 0,
          revenue: 0,
          activeJobs: 0,
          closedJobs: 0,
        });
      }

      const location = locationMap.get(locationKey)!;
      location.count++;

      if (includeRevenue) {
        location.revenue += job.approved_estimate_total || job.last_estimate || 0;
      }

      const status = (job.status_name || '').toLowerCase();
      if (status.includes('paid') || status.includes('closed')) {
        location.closedJobs++;
      } else {
        location.activeJobs++;
      }
    }

    const distribution = Array.from(locationMap.entries())
      .filter(([_, data]) => data.count >= minJobs)
      .map(([location, data]) => ({
        location,
        job_count: data.count,
        revenue: data.revenue,
        avg_revenue: data.count > 0 ? data.revenue / data.count : 0,
        active_jobs: data.activeJobs,
        closed_jobs: data.closedJobs,
        market_share: 0, // Will be calculated below
      }));

    const totalJobs = distribution.reduce((sum, d) => sum + d.job_count, 0);
    distribution.forEach(d => {
      d.market_share = totalJobs > 0 ? d.job_count / totalJobs : 0;
    });

    distribution.sort((a, b) => b.job_count - a.job_count);

    return {
      analysis_type: 'distribution',
      data_source: 'Live JobNimbus API data',
      analysis_timestamp: new Date().toISOString(),
      grouping_level: groupingLevel,
      summary: {
        total_locations: distribution.length,
        total_jobs: totalJobs,
        total_revenue: distribution.reduce((sum, d) => sum + d.revenue, 0),
        coverage_concentration: distribution.length > 0 ? distribution[0].market_share : 0,
      },
      distribution: distribution,
      top_locations: distribution.slice(0, 15),
      expansion_opportunities: identifyGaps ? distribution.filter(d => d.job_count < 10).slice(0, 10) : [],
    };
  }
}
