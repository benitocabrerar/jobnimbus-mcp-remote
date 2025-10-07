/**
 * Get Door Knocking Scripts By Area
 * AI-generated door-to-door sales scripts customized by area demographics and market analysis
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface AreaProfile {
  area_name: string;
  demographic_type: 'Residential' | 'Commercial' | 'Mixed';
  avg_property_value_estimate: string;
  customer_density: number;
  recent_jobs_count: number;
  win_rate: number;
  common_service_types: string[];
}

interface ScriptTemplate {
  script_name: string;
  target_demographic: string;
  opening_line: string;
  value_proposition: string[];
  objection_handlers: { objection: string; response: string }[];
  closing_technique: string;
  follow_up_strategy: string;
  success_rate_estimate: number;
}

interface AreaInsight {
  insight_type: 'Opportunity' | 'Challenge' | 'Strategy';
  description: string;
  recommended_action: string;
}

export class GetDoorKnockingScriptsByAreaTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_door_knocking_scripts_by_area',
      description: 'AI-generated door-to-door sales scripts customized by area demographics, market analysis, and proven techniques',
      inputSchema: {
        type: 'object',
        properties: {
          area: {
            type: 'string',
            description: 'Specific area/city to analyze (optional, analyzes all areas if not specified)',
          },
          service_type: {
            type: 'string',
            description: 'Service type to focus scripts on (e.g., "roofing", "solar", "hvac")',
          },
          include_objection_handlers: {
            type: 'boolean',
            default: true,
            description: 'Include common objection handlers',
          },
          script_style: {
            type: 'string',
            enum: ['conversational', 'professional', 'friendly', 'consultative'],
            default: 'consultative',
            description: 'Communication style for scripts',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const targetArea = input.area;
      const serviceType = input.service_type || 'general services';
      const includeObjections = input.include_objection_handlers !== false;
      const scriptStyle = input.script_style || 'consultative';

      // Fetch data
      const [jobsResponse, contactsResponse] = await Promise.all([
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'contacts', { size: 100 }),
      ]);

      const jobs = jobsResponse.data?.results || [];
      const contacts = contactsResponse.data?.results || [];

      // Build area profiles
      const areaMap = new Map<string, {
        jobs: any[];
        contacts: any[];
        wonJobs: number;
        serviceTypes: Map<string, number>;
      }>();

      // Process jobs
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

      for (const job of jobs) {
        const city = job.city || 'Unknown';
        const state = job.state || '';
        const areaKey = city && state ? `${city}, ${state}` : city;

        if (targetArea && !areaKey.toLowerCase().includes(targetArea.toLowerCase())) {
          continue;
        }

        if (!areaMap.has(areaKey)) {
          areaMap.set(areaKey, {
            jobs: [],
            contacts: [],
            wonJobs: 0,
            serviceTypes: new Map(),
          });
        }

        const area = areaMap.get(areaKey)!;
        area.jobs.push(job);

        const isWon = (job.status_name || '').toLowerCase().includes('complete') ||
                     (job.status_name || '').toLowerCase().includes('won');
        if (isWon) area.wonJobs++;

        const jobType = job.job_type_name || 'General';
        area.serviceTypes.set(jobType, (area.serviceTypes.get(jobType) || 0) + 1);
      }

      // Process contacts
      for (const contact of contacts) {
        const city = contact.city || 'Unknown';
        const state = contact.state_text || '';
        const areaKey = city && state ? `${city}, ${state}` : city;

        if (targetArea && !areaKey.toLowerCase().includes(targetArea.toLowerCase())) {
          continue;
        }

        if (!areaMap.has(areaKey)) {
          areaMap.set(areaKey, {
            jobs: [],
            contacts: [],
            wonJobs: 0,
            serviceTypes: new Map(),
          });
        }

        const area = areaMap.get(areaKey)!;
        area.contacts.push(contact);
      }

      // Build area profiles
      const areaProfiles: AreaProfile[] = [];

      for (const [areaName, data] of areaMap.entries()) {
        if (data.jobs.length === 0) continue;

        const recentJobs = data.jobs.filter(j => (j.date_created || 0) > thirtyDaysAgo).length;
        const winRate = data.jobs.length > 0 ? (data.wonJobs / data.jobs.length) * 100 : 0;
        const customerDensity = data.contacts.length / Math.max(data.jobs.length, 1);

        // Determine demographic type
        const hasCommercial = Array.from(data.serviceTypes.keys()).some(type =>
          type.toLowerCase().includes('commercial') || type.toLowerCase().includes('business')
        );
        const demographicType: 'Residential' | 'Commercial' | 'Mixed' =
          hasCommercial && data.jobs.length > 10 ? 'Mixed' :
          hasCommercial ? 'Commercial' : 'Residential';

        // Property value estimate (simplified)
        const avgPropertyValue = winRate > 60 ? 'High' : winRate > 30 ? 'Medium' : 'Entry-level';

        // Top service types
        const commonServices = Array.from(data.serviceTypes.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([type]) => type);

        areaProfiles.push({
          area_name: areaName,
          demographic_type: demographicType,
          avg_property_value_estimate: avgPropertyValue,
          customer_density: customerDensity,
          recent_jobs_count: recentJobs,
          win_rate: winRate,
          common_service_types: commonServices,
        });
      }

      // Sort by recent activity
      areaProfiles.sort((a, b) => b.recent_jobs_count - a.recent_jobs_count);

      // Generate scripts for each area
      const scriptTemplates: ScriptTemplate[] = [];

      for (const profile of areaProfiles.slice(0, 5)) { // Top 5 areas
        const script = this.generateScript(profile, serviceType, scriptStyle, includeObjections);
        scriptTemplates.push(script);
      }

      // Generate area insights
      const insights: AreaInsight[] = [];

      for (const profile of areaProfiles.slice(0, 3)) {
        if (profile.win_rate > 60) {
          insights.push({
            insight_type: 'Opportunity',
            description: `${profile.area_name} has high win rate (${profile.win_rate.toFixed(1)}%)`,
            recommended_action: 'Increase door-knocking frequency and referral requests',
          });
        }

        if (profile.win_rate < 30 && profile.recent_jobs_count > 0) {
          insights.push({
            insight_type: 'Challenge',
            description: `${profile.area_name} has low win rate (${profile.win_rate.toFixed(1)}%)`,
            recommended_action: 'Review pricing strategy and competitive positioning',
          });
        }

        if (profile.customer_density < 0.5) {
          insights.push({
            insight_type: 'Strategy',
            description: `${profile.area_name} has low customer density - untapped market`,
            recommended_action: 'Implement targeted lead generation campaign',
          });
        }
      }

      // General recommendations
      const recommendations: string[] = [];

      const avgWinRate = areaProfiles.length > 0
        ? areaProfiles.reduce((sum, p) => sum + p.win_rate, 0) / areaProfiles.length
        : 0;

      recommendations.push(`📊 Average win rate across areas: ${avgWinRate.toFixed(1)}%`);

      const topArea = areaProfiles[0];
      if (topArea) {
        recommendations.push(`🏆 Most active area: ${topArea.area_name} (${topArea.recent_jobs_count} recent jobs)`);
      }

      recommendations.push('🎯 Customize scripts based on property value and demographic type');
      recommendations.push('📱 Use tablet/phone to show before/after photos during pitch');
      recommendations.push('🤝 Always ask for referrals in high win-rate areas');

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        target_area: targetArea || 'All areas',
        service_type: serviceType,
        script_style: scriptStyle,
        summary: {
          areas_analyzed: areaProfiles.length,
          scripts_generated: scriptTemplates.length,
          avg_win_rate: avgWinRate,
        },
        area_profiles: areaProfiles,
        customized_scripts: scriptTemplates,
        area_insights: insights,
        general_recommendations: recommendations,
        best_practices: [
          'Research the neighborhood before knocking (recent permits, storm damage, etc.)',
          'Knock during optimal times: weekdays 5-8pm, weekends 10am-2pm',
          'Lead with value, not features - focus on benefits to homeowner',
          'Use local references and completed jobs as proof',
          'Practice active listening - let them talk about their needs',
          'Always follow up within 24 hours of initial contact',
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
   * Generate customized script based on area profile
   */
  private generateScript(
    profile: AreaProfile,
    serviceType: string,
    style: string,
    includeObjections: boolean
  ): ScriptTemplate {
    const isResidential = profile.demographic_type !== 'Commercial';

    // Opening lines by style
    const openingLines: Record<string, string> = {
      conversational: `Hi there! I'm [Name] with [Company]. We've been helping your neighbors with ${serviceType} - mind if I share how we can help you too?`,
      professional: `Good ${this.getTimeOfDay()}, I'm [Name] from [Company]. We're the ${serviceType} experts in ${profile.area_name}.`,
      friendly: `Hey! I'm [Name], your local ${serviceType} specialist. We've been working in ${profile.area_name} and I wanted to stop by.`,
      consultative: `Hello, I'm [Name] with [Company]. We specialize in ${serviceType} solutions for ${isResidential ? 'homeowners' : 'businesses'} in ${profile.area_name}.`,
    };

    // Value propositions
    const valueProps: string[] = [
      `We've completed ${profile.recent_jobs_count}+ ${serviceType} projects in ${profile.area_name} this month`,
      `${profile.win_rate > 60 ? 'Your neighbors' : 'Local residents'} trust us for quality work and fair pricing`,
      `Free inspection with no obligation - we'll identify any issues before they become expensive`,
    ];

    if (profile.avg_property_value_estimate === 'High') {
      valueProps.push('Premium materials and workmanship with extended warranty options');
    } else {
      valueProps.push('Flexible financing options to fit any budget');
    }

    // Objection handlers
    const objectionHandlers = includeObjections ? [
      {
        objection: "I'm not interested",
        response: "I understand! Can I just leave you my card? If you know anyone who needs ${serviceType}, we offer $100 referral bonuses.",
      },
      {
        objection: "How much does it cost?",
        response: "Great question! Every project is unique. Can I do a quick inspection? It's free and takes 10 minutes - then I can give you an exact quote.",
      },
      {
        objection: "I need to think about it",
        response: "Absolutely, this is a big decision. What specific concerns do you have? I'm happy to address those right now.",
      },
      {
        objection: "I already have someone",
        response: "That's great you're being proactive! Would you like a second opinion? No cost, and you might discover savings or better options.",
      },
    ] : [];

    // Closing technique
    const closing = profile.win_rate > 60
      ? "I have time this week for a free inspection. Does Thursday or Friday work better for you?"
      : "Let me leave my information. If you'd like a free consultation, give me a call or text anytime.";

    // Follow-up strategy
    const followUp = isResidential
      ? "Text within 24 hours with photo of completed project in neighborhood + special offer"
      : "Email detailed service brochure + schedule follow-up call in 3 days";

    // Success rate estimate
    const successRate = profile.win_rate * 0.8; // 80% of historical win rate

    return {
      script_name: `${profile.area_name} - ${profile.demographic_type} Script`,
      target_demographic: `${profile.demographic_type} (${profile.avg_property_value_estimate} value)`,
      opening_line: openingLines[style] || openingLines.consultative,
      value_proposition: valueProps,
      objection_handlers: objectionHandlers,
      closing_technique: closing,
      follow_up_strategy: followUp,
      success_rate_estimate: successRate,
    };
  }

  /**
   * Get time of day greeting
   */
  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }
}
