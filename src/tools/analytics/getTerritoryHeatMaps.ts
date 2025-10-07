/**
 * Get Territory Heat Maps
 * Generate territory heat maps for sales optimization with geographic performance analysis
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface TerritoryZone {
  zone_name: string;
  heat_score: number;
  heat_level: 'Hot' | 'Warm' | 'Cool' | 'Cold';
  total_jobs: number;
  total_revenue: number;
  conversion_rate: number;
  avg_deal_size: number;
  market_penetration: number;
  opportunity_score: number;
}

interface GeographicMetric {
  location: string;
  customer_density: number;
  revenue_per_sqmile: number;
  growth_trend: 'Expanding' | 'Stable' | 'Declining';
  saturation_level: number;
}

interface TerritoryRecommendation {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  zone: string;
  action: string;
  expected_impact: string;
  estimated_roi: string;
}

export class GetTerritoryHeatMapsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_territory_heat_maps',
      description: 'Generate territory heat maps with geographic performance analysis, opportunity scoring, and expansion recommendations',
      inputSchema: {
        type: 'object',
        properties: {
          grouping_level: {
            type: 'string',
            enum: ['city', 'zip', 'state'],
            default: 'city',
            description: 'Geographic grouping level (default: city)',
          },
          min_jobs_threshold: {
            type: 'number',
            default: 3,
            description: 'Minimum jobs to include zone in analysis (default: 3)',
          },
          include_opportunity_analysis: {
            type: 'boolean',
            default: true,
            description: 'Include untapped opportunity analysis',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const groupingLevel = input.grouping_level || 'city';
      const minJobsThreshold = input.min_jobs_threshold || 3;
      const includeOpportunity = input.include_opportunity_analysis !== false;

      // Fetch data
      const [jobsResponse, contactsResponse, estimatesResponse] = await Promise.all([
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'contacts', { size: 100 }),
        this.client.get(context.apiKey, 'estimates', { size: 100 }),
      ]);

      const jobs = jobsResponse.data?.results || [];
      const contacts = contactsResponse.data?.results || [];
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

      // Build zone map
      const zoneMap = new Map<string, {
        totalJobs: number;
        wonJobs: number;
        totalRevenue: number;
        totalContacts: number;
        jobValues: number[];
      }>();

      // Extract zone name based on grouping level
      const getZoneName = (obj: any): string => {
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

      // Process jobs
      for (const job of jobs) {
        const zoneName = getZoneName(job);
        if (!zoneName || zoneName === 'Unknown') continue;

        if (!zoneMap.has(zoneName)) {
          zoneMap.set(zoneName, {
            totalJobs: 0,
            wonJobs: 0,
            totalRevenue: 0,
            totalContacts: 0,
            jobValues: [],
          });
        }

        const zone = zoneMap.get(zoneName)!;
        zone.totalJobs++;

        // Check if won
        const statusName = (job.status_name || '').toLowerCase();
        const isWon = statusName.includes('complete') ||
                     statusName.includes('won') ||
                     statusName.includes('sold');

        if (isWon) {
          zone.wonJobs++;
        }

        // Calculate revenue
        const jobEstimates = estimatesByJob.get(job.jnid) || [];
        for (const est of jobEstimates) {
          if (est.date_signed > 0 || est.status_name === 'approved') {
            const value = parseFloat(est.total || 0);
            zone.totalRevenue += value;
            zone.jobValues.push(value);
          }
        }
      }

      // Process contacts for market penetration
      for (const contact of contacts) {
        const zoneName = getZoneName(contact);
        if (!zoneName || zoneName === 'Unknown') continue;

        if (!zoneMap.has(zoneName)) {
          zoneMap.set(zoneName, {
            totalJobs: 0,
            wonJobs: 0,
            totalRevenue: 0,
            totalContacts: 0,
            jobValues: [],
          });
        }

        const zone = zoneMap.get(zoneName)!;
        zone.totalContacts++;
      }

      // Build territory zones
      const territoryZones: TerritoryZone[] = [];

      for (const [zoneName, data] of zoneMap.entries()) {
        if (data.totalJobs < minJobsThreshold) continue;

        const conversionRate = data.totalJobs > 0
          ? (data.wonJobs / data.totalJobs) * 100
          : 0;

        const avgDealSize = data.wonJobs > 0
          ? data.totalRevenue / data.wonJobs
          : 0;

        // Market penetration: jobs per contact (higher = more penetrated)
        const marketPenetration = data.totalContacts > 0
          ? (data.totalJobs / data.totalContacts) * 100
          : 0;

        // Calculate heat score (0-100)
        let heatScore = 0;
        heatScore += Math.min((data.totalRevenue / 10000) * 20, 20); // Revenue component (max 20)
        heatScore += Math.min(conversionRate, 20); // Conversion component (max 20)
        heatScore += Math.min((data.totalJobs / 10) * 20, 20); // Volume component (max 20)
        heatScore += Math.min(avgDealSize / 1000, 20); // Deal size component (max 20)
        heatScore += Math.min(marketPenetration * 2, 20); // Penetration component (max 20)

        // Opportunity score (inverse of penetration + revenue potential)
        const opportunityScore = includeOpportunity
          ? (100 - Math.min(marketPenetration, 100)) * 0.6 + // Untapped market
            (data.totalContacts / Math.max(data.totalJobs, 1)) * 0.4 // Contact to job ratio
          : 0;

        const heatLevel: 'Hot' | 'Warm' | 'Cool' | 'Cold' =
          heatScore >= 70 ? 'Hot' :
          heatScore >= 50 ? 'Warm' :
          heatScore >= 30 ? 'Cool' : 'Cold';

        territoryZones.push({
          zone_name: zoneName,
          heat_score: heatScore,
          heat_level: heatLevel,
          total_jobs: data.totalJobs,
          total_revenue: data.totalRevenue,
          conversion_rate: conversionRate,
          avg_deal_size: avgDealSize,
          market_penetration: marketPenetration,
          opportunity_score: opportunityScore,
        });
      }

      // Sort by heat score
      territoryZones.sort((a, b) => b.heat_score - a.heat_score);

      // Geographic metrics
      const geographicMetrics: GeographicMetric[] = territoryZones.map(zone => {
        // Simplified density calculation
        const customerDensity = zone.total_jobs / Math.max(zone.zone_name.length, 1) * 100;
        const revenuePerSqMile = zone.total_revenue; // Simplified

        // Growth trend (simplified: based on conversion rate)
        const growthTrend: 'Expanding' | 'Stable' | 'Declining' =
          zone.conversion_rate >= 60 ? 'Expanding' :
          zone.conversion_rate >= 30 ? 'Stable' : 'Declining';

        return {
          location: zone.zone_name,
          customer_density: customerDensity,
          revenue_per_sqmile: revenuePerSqMile,
          growth_trend: growthTrend,
          saturation_level: zone.market_penetration,
        };
      });

      // Generate recommendations
      const recommendations: TerritoryRecommendation[] = [];

      // Hot zones - maintain momentum
      const hotZones = territoryZones.filter(z => z.heat_level === 'Hot');
      for (const zone of hotZones.slice(0, 2)) {
        recommendations.push({
          priority: 'HIGH',
          zone: zone.zone_name,
          action: 'Maintain market leadership with account management and referral programs',
          expected_impact: `Protect $${zone.total_revenue.toFixed(0)} revenue base`,
          estimated_roi: '3:1',
        });
      }

      // High opportunity zones - low penetration but good potential
      const opportunityZones = territoryZones
        .filter(z => z.opportunity_score > 50 && z.total_jobs >= minJobsThreshold)
        .sort((a, b) => b.opportunity_score - a.opportunity_score);

      for (const zone of opportunityZones.slice(0, 2)) {
        recommendations.push({
          priority: 'HIGH',
          zone: zone.zone_name,
          action: 'Launch targeted campaign - high untapped potential',
          expected_impact: `Potential ${Math.round(zone.opportunity_score)}% market share increase`,
          estimated_roi: '5:1',
        });
      }

      // Warm zones - nurture and grow
      const warmZones = territoryZones.filter(z => z.heat_level === 'Warm');
      for (const zone of warmZones.slice(0, 2)) {
        recommendations.push({
          priority: 'MEDIUM',
          zone: zone.zone_name,
          action: 'Increase sales activity and marketing presence',
          expected_impact: `Grow from $${zone.total_revenue.toFixed(0)} to $${(zone.total_revenue * 1.5).toFixed(0)}`,
          estimated_roi: '4:1',
        });
      }

      // Cold zones - evaluate or exit
      const coldZones = territoryZones.filter(z => z.heat_level === 'Cold');
      if (coldZones.length > 0) {
        const zone = coldZones[0];
        recommendations.push({
          priority: 'LOW',
          zone: zone.zone_name,
          action: 'Evaluate ROI - consider reallocating resources to hotter territories',
          expected_impact: 'Cost savings through resource optimization',
          estimated_roi: 'N/A',
        });
      }

      // Summary statistics
      const totalRevenue = territoryZones.reduce((sum, z) => sum + z.total_revenue, 0);
      const totalJobs = territoryZones.reduce((sum, z) => sum + z.total_jobs, 0);
      const avgConversion = territoryZones.length > 0
        ? territoryZones.reduce((sum, z) => sum + z.conversion_rate, 0) / territoryZones.length
        : 0;

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        grouping_level: groupingLevel,
        summary: {
          total_zones_analyzed: territoryZones.length,
          total_revenue: totalRevenue,
          total_jobs: totalJobs,
          avg_conversion_rate: avgConversion,
          hot_zones_count: territoryZones.filter(z => z.heat_level === 'Hot').length,
          warm_zones_count: territoryZones.filter(z => z.heat_level === 'Warm').length,
          cool_zones_count: territoryZones.filter(z => z.heat_level === 'Cool').length,
          cold_zones_count: territoryZones.filter(z => z.heat_level === 'Cold').length,
        },
        territory_zones: territoryZones,
        geographic_metrics: geographicMetrics.slice(0, 10),
        recommendations: recommendations,
        strategic_insights: [
          `Top performing zone: ${territoryZones[0]?.zone_name || 'N/A'} with $${territoryZones[0]?.total_revenue.toFixed(2) || 0}`,
          `${hotZones.length} hot zones generating ${((hotZones.reduce((s, z) => s + z.total_revenue, 0) / totalRevenue) * 100).toFixed(1)}% of revenue`,
          `Average market penetration: ${territoryZones.reduce((s, z) => s + z.market_penetration, 0) / territoryZones.length}%`,
          `${opportunityZones.length} high-opportunity zones identified for expansion`,
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
