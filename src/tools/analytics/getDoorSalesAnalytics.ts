/**
 * Get Door Sales Analytics
 * Comprehensive door-to-door sales optimization with scripts and timing recommendations
 *
 * Consolidates:
 * - get_door_knocking_scripts_by_area (scripts)
 * - get_seasonal_door_timing (timing)
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

// ============================================================================
// TYPE DEFINITIONS - Scripts Analysis
// ============================================================================

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

// ============================================================================
// TYPE DEFINITIONS - Timing Analysis
// ============================================================================

interface SeasonalWindow {
  season: string;
  months: string[];
  optimal_rating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  best_days: string[];
  best_hours: string[];
  expected_receptivity: number;
  weather_considerations: string[];
  conversion_rate_multiplier: number;
}

interface MonthlyTiming {
  month: string;
  jobs_created_historical: number;
  optimal_time_slots: TimeSlot[];
  weather_impact: 'Favorable' | 'Neutral' | 'Challenging';
  holiday_considerations: string[];
  recommended_approach: string;
}

interface TimeSlot {
  day_type: 'Weekday' | 'Weekend';
  time_range: string;
  effectiveness_score: number;
  contact_likelihood: number;
  notes: string;
}

interface WeatherGuidance {
  ideal_conditions: string[];
  avoid_conditions: string[];
  seasonal_prep: string[];
}

// ============================================================================
// MAIN TOOL CLASS
// ============================================================================

export class GetDoorSalesAnalyticsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_door_sales_analytics',
      description: 'Door sales: customized scripts by area, seasonal timing optimization',
      inputSchema: {
        type: 'object',
        properties: {
          analysis_type: {
            type: 'string',
            enum: ['scripts', 'timing'],
            description: 'scripts (custom scripts) or timing',
          },
          // Scripts parameters
          area: {
            type: 'string',
            description: 'Area/city (optional, default: all)',
          },
          service_type: {
            type: 'string',
            description: 'Service type (roofing, solar, hvac)',
          },
          include_objection_handlers: {
            type: 'boolean',
            default: true,
            description: 'Include objection handlers',
          },
          script_style: {
            type: 'string',
            enum: ['conversational', 'professional', 'friendly', 'consultative'],
            default: 'consultative',
            description: 'Script communication style',
          },
          // Timing parameters
          include_weather_analysis: {
            type: 'boolean',
            default: true,
            description: 'Include weather analysis',
          },
          current_month_only: {
            type: 'boolean',
            default: false,
            description: 'Current month only (default: false)',
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
        case 'scripts':
          return await this.analyzeScripts(input, context);
        case 'timing':
          return await this.analyzeTiming(input, context);
        default:
          return {
            error: `Invalid analysis_type: ${analysisType}. Must be one of: scripts, timing`,
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
  // SCRIPTS ANALYSIS (from get_door_knocking_scripts_by_area)
  // ==========================================================================

  private async analyzeScripts(input: any, context: ToolContext): Promise<any> {
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
      analysis_type: 'scripts',
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

  // ==========================================================================
  // TIMING ANALYSIS (from get_seasonal_door_timing)
  // ==========================================================================

  private async analyzeTiming(input: any, context: ToolContext): Promise<any> {
    const serviceType = input.service_type || 'general services';
    const includeWeather = input.include_weather_analysis !== false;
    const currentMonthOnly = input.current_month_only || false;

    // Fetch jobs data
    const jobsResponse = await this.client.get(context.apiKey, 'jobs', { size: 100 });
    const jobs = jobsResponse.data?.results || [];

    // Analyze historical job creation by month
    const monthlyData = new Map<number, number>();
    for (let month = 0; month < 12; month++) {
      monthlyData.set(month, 0);
    }

    for (const job of jobs) {
      const createdDate = job.date_created || 0;
      if (createdDate > 0) {
        const date = new Date(createdDate);
        const month = date.getMonth();
        monthlyData.set(month, (monthlyData.get(month) || 0) + 1);
      }
    }

    // Define seasonal windows
    const seasonalWindows: SeasonalWindow[] = [
      {
        season: 'Spring (March - May)',
        months: ['March', 'April', 'May'],
        optimal_rating: 'Excellent',
        best_days: ['Tuesday', 'Wednesday', 'Thursday', 'Saturday'],
        best_hours: ['10:00 AM - 1:00 PM', '5:00 PM - 7:30 PM'],
        expected_receptivity: 85,
        weather_considerations: [
          'Mild temperatures ideal for outdoor conversations',
          'After-winter home improvement mindset',
          'Spring cleaning and renovation season',
        ],
        conversion_rate_multiplier: 1.3,
      },
      {
        season: 'Summer (June - August)',
        months: ['June', 'July', 'August'],
        optimal_rating: 'Good',
        best_days: ['Thursday', 'Friday', 'Saturday'],
        best_hours: ['6:00 PM - 8:00 PM', '9:00 AM - 11:00 AM (weekends)'],
        expected_receptivity: 70,
        weather_considerations: [
          'Avoid extreme heat hours (2-5 PM)',
          'Homeowners often on vacation',
          'Evening is best due to heat',
        ],
        conversion_rate_multiplier: 1.0,
      },
      {
        season: 'Fall (September - November)',
        months: ['September', 'October', 'November'],
        optimal_rating: 'Excellent',
        best_days: ['Wednesday', 'Thursday', 'Saturday'],
        best_hours: ['10:00 AM - 1:00 PM', '4:00 PM - 6:30 PM'],
        expected_receptivity: 90,
        weather_considerations: [
          'Pre-winter preparation mindset',
          'Comfortable weather for door knocking',
          'Homeowners focusing on home before holidays',
        ],
        conversion_rate_multiplier: 1.4,
      },
      {
        season: 'Winter (December - February)',
        months: ['December', 'January', 'February'],
        optimal_rating: 'Fair',
        best_days: ['Saturday', 'Sunday afternoon'],
        best_hours: ['11:00 AM - 2:00 PM', '2:00 PM - 5:00 PM'],
        expected_receptivity: 50,
        weather_considerations: [
          'Holiday season - low receptivity in December',
          'Cold weather - shorter conversations',
          'Post-storm opportunities for damage assessment',
        ],
        conversion_rate_multiplier: 0.7,
      },
    ];

    // Build monthly timing recommendations
    const monthlyTimings: MonthlyTiming[] = [];
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const currentMonth = new Date().getMonth();

    for (let month = 0; month < 12; month++) {
      if (currentMonthOnly && month !== currentMonth) continue;

      const jobsCount = monthlyData.get(month) || 0;

      // Determine season
      const season = month >= 2 && month <= 4 ? 'Spring' :
                    month >= 5 && month <= 7 ? 'Summer' :
                    month >= 8 && month <= 10 ? 'Fall' : 'Winter';

      // Weather impact
      const weatherImpact: 'Favorable' | 'Neutral' | 'Challenging' =
        season === 'Spring' || season === 'Fall' ? 'Favorable' :
        season === 'Summer' ? 'Neutral' : 'Challenging';

      // Holiday considerations
      const holidays: string[] = [];
      if (month === 11) holidays.push('Avoid first 3 weeks of December (holiday rush)');
      if (month === 0) holidays.push('Early January good for New Year resolutions');
      if (month === 6) holidays.push('July 4th week - low receptivity');
      if (month === 10) holidays.push('Thanksgiving week - avoid');

      // Time slots
      const timeSlots: TimeSlot[] = [];

      if (season === 'Spring' || season === 'Fall') {
        timeSlots.push({
          day_type: 'Weekday',
          time_range: '10:00 AM - 1:00 PM',
          effectiveness_score: 85,
          contact_likelihood: 60,
          notes: 'Morning is ideal for retirees and work-from-home',
        });
        timeSlots.push({
          day_type: 'Weekday',
          time_range: '5:00 PM - 7:30 PM',
          effectiveness_score: 90,
          contact_likelihood: 80,
          notes: 'Peak time - people home from work',
        });
        timeSlots.push({
          day_type: 'Weekend',
          time_range: '10:00 AM - 2:00 PM',
          effectiveness_score: 80,
          contact_likelihood: 70,
          notes: 'Mid-day weekend works well',
        });
      } else if (season === 'Summer') {
        timeSlots.push({
          day_type: 'Weekday',
          time_range: '6:00 PM - 8:00 PM',
          effectiveness_score: 75,
          contact_likelihood: 70,
          notes: 'Evening to avoid heat',
        });
        timeSlots.push({
          day_type: 'Weekend',
          time_range: '9:00 AM - 11:00 AM',
          effectiveness_score: 70,
          contact_likelihood: 65,
          notes: 'Early before it gets too hot',
        });
      } else { // Winter
        timeSlots.push({
          day_type: 'Weekend',
          time_range: '11:00 AM - 2:00 PM',
          effectiveness_score: 60,
          contact_likelihood: 55,
          notes: 'Warmest part of day',
        });
      }

      // Recommended approach
      let approach = '';
      if (season === 'Spring') {
        approach = 'Emphasize spring specials and pre-summer prep. Mention competitors likely booked soon.';
      } else if (season === 'Summer') {
        approach = 'Focus on energy savings and comfort. Schedule appointments for fall if not urgent.';
      } else if (season === 'Fall') {
        approach = 'Highlight winter preparation and end-of-year budgets. Strong urgency messaging works.';
      } else { // Winter
        approach = 'Post-storm damage assessment. Focus on emergency services and spring booking discounts.';
      }

      monthlyTimings.push({
        month: monthNames[month],
        jobs_created_historical: jobsCount,
        optimal_time_slots: timeSlots,
        weather_impact: weatherImpact,
        holiday_considerations: holidays.length > 0 ? holidays : ['No major conflicts'],
        recommended_approach: approach,
      });
    }

    // Weather guidance
    const weatherGuidance: WeatherGuidance = {
      ideal_conditions: [
        'Clear skies, 60-75°F (15-24°C)',
        'Light breeze, no precipitation',
        'Good visibility, daylight remaining',
      ],
      avoid_conditions: [
        'Heavy rain, snow, or extreme heat (>95°F)',
        'Severe weather warnings',
        'Temperatures below 32°F for extended knocking',
      ],
      seasonal_prep: [
        'Spring: Bring storm damage photos, focus on post-winter repairs',
        'Summer: Hydrate, use sun protection, keep presentations short',
        'Fall: Emphasize urgency before winter, highlight energy savings',
        'Winter: Dress warm but professional, focus on emergencies and spring booking',
      ],
    };

    // Generate recommendations
    const recommendations: string[] = [];

    const peakMonths = Array.from(monthlyData.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([month]) => monthNames[month]);

    recommendations.push(`📊 Historical peak months: ${peakMonths.join(', ')}`);

    const now = new Date();
    const currentMonthName = monthNames[now.getMonth()];
    const currentSeason = now.getMonth() >= 2 && now.getMonth() <= 4 ? 'Spring' :
                         now.getMonth() >= 5 && now.getMonth() <= 7 ? 'Summer' :
                         now.getMonth() >= 8 && now.getMonth() <= 10 ? 'Fall' : 'Winter';

    const currentSeasonWindow = seasonalWindows.find(s => s.season.includes(currentSeason));
    if (currentSeasonWindow) {
      recommendations.push(`🌟 Current season (${currentSeason}) rating: ${currentSeasonWindow.optimal_rating}`);
      recommendations.push(`⏰ Best times right now: ${currentSeasonWindow.best_hours.join(' or ')}`);
    }

    recommendations.push('📅 Fall (Sep-Nov) is historically the best season for door-to-door sales');
    recommendations.push('🌡️ Weather matters - check forecast before planning routes');
    recommendations.push('🎯 Weekday evenings (5-7:30 PM) have highest contact rates year-round');

    return {
      analysis_type: 'timing',
      data_source: 'Live JobNimbus API data + Industry best practices',
      analysis_timestamp: new Date().toISOString(),
      service_type: serviceType,
      current_month: currentMonthName,
      current_season: currentSeason,
      seasonal_windows: seasonalWindows,
      monthly_timing_recommendations: monthlyTimings,
      weather_guidance: includeWeather ? weatherGuidance : undefined,
      recommendations: recommendations,
      best_practices: [
        'Track weather forecasts 3-5 days in advance',
        'Avoid first/last week of month (budget constraints)',
        'Post-storm periods offer excellent opportunities',
        'Monday mornings and Friday evenings typically less effective',
        'Adjust schedule based on local events and holidays',
        'Door knock during daylight hours for safety and visibility',
      ],
      key_insights: [
        `${seasonalWindows.find(s => s.optimal_rating === 'Excellent')?.season || 'Spring/Fall'} offers highest conversion potential`,
        `Winter requires adjusted strategy - focus on emergency services`,
        `Summer vacations reduce contact rates - plan accordingly`,
        `Weather-dependent services (roofing, exteriors) peak in spring/fall`,
      ],
    };
  }
}
