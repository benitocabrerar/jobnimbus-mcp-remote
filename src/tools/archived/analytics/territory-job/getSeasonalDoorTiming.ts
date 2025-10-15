/**
 * Get Seasonal Door Timing
 * Optimal timing for door-to-door sales by season with weather analysis and historical performance
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

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

export class GetSeasonalDoorTimingTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_seasonal_door_timing',
      description: 'Optimal timing for door-to-door sales by season with weather analysis, historical performance, and strategic recommendations',
      inputSchema: {
        type: 'object',
        properties: {
          service_type: {
            type: 'string',
            description: 'Service type to optimize timing for (e.g., "roofing", "solar", "hvac")',
          },
          include_weather_analysis: {
            type: 'boolean',
            default: true,
            description: 'Include weather impact analysis',
          },
          current_month_only: {
            type: 'boolean',
            default: false,
            description: 'Focus only on current month recommendations',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
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
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }
}
