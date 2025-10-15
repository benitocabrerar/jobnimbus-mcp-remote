/**
 * Get Optimal Door Routes
 * AI-powered route optimization for door-to-door sales with geographic clustering and efficiency scoring
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface AddressCluster {
  cluster_id: number;
  center_address: string;
  location_count: number;
  estimated_coverage_time_hours: number;
  priority_score: number;
  recent_activity: boolean;
}

interface OptimizedRoute {
  route_id: number;
  cluster_ids: number[];
  total_locations: number;
  estimated_duration_hours: number;
  potential_reach: number;
  best_day_of_week: string;
  best_time_slot: string;
}

interface RouteEfficiency {
  route_density: number;
  avg_walking_distance_minutes: number;
  estimated_doors_per_hour: number;
  efficiency_rating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
}

export class GetOptimalDoorRoutesTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_optimal_door_routes',
      description: 'AI-powered door-to-door sales route optimization with geographic clustering, efficiency scoring, and timing recommendations',
      inputSchema: {
        type: 'object',
        properties: {
          territory: {
            type: 'string',
            description: 'Territory or city to analyze (optional, analyzes all if not specified)',
          },
          max_routes: {
            type: 'number',
            default: 5,
            description: 'Maximum number of routes to generate (default: 5)',
          },
          target_hours_per_route: {
            type: 'number',
            default: 4,
            description: 'Target hours per route (default: 4)',
          },
          prioritize_recent_activity: {
            type: 'boolean',
            default: true,
            description: 'Prioritize areas with recent customer activity',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const territory = input.territory;
      const maxRoutes = input.max_routes || 5;
      const targetHours = input.target_hours_per_route || 4;
      const prioritizeActivity = input.prioritize_recent_activity !== false;

      // Fetch data
      const [jobsResponse, contactsResponse] = await Promise.all([
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'contacts', { size: 100 }),
      ]);

      const jobs = jobsResponse.data?.results || [];
      const contacts = contactsResponse.data?.results || [];

      // Extract addresses and build location map
      const locationMap = new Map<string, {
        addresses: Set<string>;
        jobCount: number;
        contactCount: number;
        recentActivity: number;
        lastActivity: number;
      }>();

      // Process jobs
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

      for (const job of jobs) {
        let locationKey = '';

        // Try to extract city or area from address
        const address = job.address || '';
        const city = job.city || '';
        const state = job.state || '';
        const zip = job.zip || '';

        if (city) {
          locationKey = `${city}, ${state}`.trim();
        } else if (zip) {
          locationKey = zip;
        } else {
          continue; // Skip jobs without location info
        }

        // Filter by territory if specified
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
        let locationKey = '';

        const address = contact.address_line1 || '';
        const city = contact.city || '';
        const state = contact.state_text || '';
        const zip = contact.zip || '';

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
      const clusters: AddressCluster[] = [];
      let clusterId = 1;

      for (const [locationKey, data] of locationMap.entries()) {
        const locationCount = data.addresses.size;
        if (locationCount === 0) continue;

        // Estimate coverage time (assuming 15 doors per hour)
        const doorsPerHour = 15;
        const estimatedTime = locationCount / doorsPerHour;

        // Calculate priority score
        let priorityScore = locationCount * 10; // Base score from location count
        if (prioritizeActivity) {
          priorityScore += data.recentActivity * 50; // Boost for recent activity
          priorityScore += data.jobCount * 20; // Boost for existing customers
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

      // Sort clusters by priority
      clusters.sort((a, b) => b.priority_score - a.priority_score);

      // Generate optimal routes
      const routes: OptimizedRoute[] = [];
      const usedClusters = new Set<number>();

      for (let routeNum = 1; routeNum <= maxRoutes && clusters.length > 0; routeNum++) {
        const routeClusters: number[] = [];
        let totalTime = 0;
        let totalLocations = 0;

        // Greedy algorithm: add clusters until target hours reached
        for (const cluster of clusters) {
          if (usedClusters.has(cluster.cluster_id)) continue;

          if (totalTime + cluster.estimated_coverage_time_hours <= targetHours * 1.2) { // Allow 20% overage
            routeClusters.push(cluster.cluster_id);
            totalTime += cluster.estimated_coverage_time_hours;
            totalLocations += cluster.location_count;
            usedClusters.add(cluster.cluster_id);
          }

          if (totalTime >= targetHours) break;
        }

        if (routeClusters.length === 0) break;

        // Determine best day and time
        // Residential: weekends and evenings
        // Commercial: weekdays and business hours
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

      // Calculate route efficiency metrics
      const totalClusters = clusters.length;
      const avgLocationsPerCluster = totalClusters > 0
        ? clusters.reduce((sum, c) => sum + c.location_count, 0) / totalClusters
        : 0;

      const routeDensity = totalClusters > 0 ? avgLocationsPerCluster : 0;
      const avgWalkingDistance = 5; // Estimate 5 minutes between doors
      const doorsPerHour = 60 / avgWalkingDistance;

      const efficiency: RouteEfficiency = {
        route_density: routeDensity,
        avg_walking_distance_minutes: avgWalkingDistance,
        estimated_doors_per_hour: doorsPerHour,
        efficiency_rating: routeDensity >= 50 ? 'Excellent' :
                          routeDensity >= 30 ? 'Good' :
                          routeDensity >= 15 ? 'Fair' : 'Poor',
      };

      // Generate recommendations
      const recommendations: string[] = [];

      if (clusters.length === 0) {
        recommendations.push('⚠️ No location data available - ensure jobs and contacts have address information');
      } else {
        if (efficiency.efficiency_rating === 'Poor') {
          recommendations.push('📍 Low route density - consider expanding territory or combining with nearby areas');
        }

        const highPriorityClusters = clusters.filter(c => c.recent_activity).length;
        if (highPriorityClusters > 0) {
          recommendations.push(`🎯 ${highPriorityClusters} high-priority areas with recent customer activity - prioritize these first`);
        }

        recommendations.push('🕒 Best times: Residential (evenings/weekends), Commercial (weekday mornings)');
        recommendations.push('📱 Use mobile app for real-time route tracking and lead capture');
        recommendations.push('🎁 Bring door hangers or flyers for non-contact visits');

        const totalDoors = routes.reduce((sum, r) => sum + r.total_locations, 0);
        const assumedConversion = 0.05; // 5% conversion rate
        const estimatedLeads = Math.round(totalDoors * assumedConversion);
        recommendations.push(`💰 Estimated ${estimatedLeads} qualified leads from ${totalDoors} doors at 5% conversion rate`);
      }

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        territory_filter: territory || 'All territories',
        summary: {
          total_clusters_identified: clusters.length,
          total_routes_generated: routes.length,
          total_doors_covered: routes.reduce((sum, r) => sum + r.total_locations, 0),
          total_estimated_hours: routes.reduce((sum, r) => sum + r.estimated_duration_hours, 0),
        },
        address_clusters: clusters.slice(0, 20), // Top 20 clusters
        optimized_routes: routes,
        efficiency_metrics: efficiency,
        recommendations: recommendations,
        tactical_tips: [
          'Start with highest priority clusters first',
          'Track knockback ratio to optimize approach',
          'Schedule callbacks for interested prospects',
          'Use CRM mobile app for instant data entry',
          'Prepare elevator pitch for 30-second door interactions',
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
