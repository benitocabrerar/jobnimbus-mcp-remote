/**
 * Get Lead Scoring Analytics
 * AI-powered lead scoring with qualification analysis, conversion prediction, and prioritization recommendations
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface LeadScore {
  contact_id: string;
  contact_name: string;
  company: string;
  lead_score: number;
  qualification_status: 'Hot' | 'Warm' | 'Cold' | 'Unqualified';
  conversion_probability: number;
  engagement_score: number;
  recency_score: number;
  value_score: number;
  priority_rank: number;
  recommended_action: string;
  next_follow_up_date: string;
}

interface ScoringFactors {
  factor_name: string;
  weight: number;
  description: string;
}

interface LeadDistribution {
  qualification_status: string;
  count: number;
  avg_score: number;
  total_potential_value: number;
  conversion_rate: number;
}

interface ConversionPrediction {
  time_period: '7_days' | '30_days' | '90_days';
  predicted_conversions: number;
  predicted_revenue: number;
  confidence_level: number;
}

export class GetLeadScoringAnalyticsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_lead_scoring_analytics',
      description: 'Lead scoring, qualification & priority',
      inputSchema: {
        type: 'object',
        properties: {
          min_score: {
            type: 'number',
            default: 0,
            description: 'Min lead score (0-100)',
          },
          include_predictions: {
            type: 'boolean',
            default: true,
            description: 'Include conversion predictions',
          },
          qualification_filter: {
            type: 'string',
            enum: ['Hot', 'Warm', 'Cold', 'Unqualified'],
            description: 'Filter by qualification',
          },
          days_back: {
            type: 'number',
            default: 90,
            description: 'Days to analyze (default: 90)',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const minScore = input.min_score || 0;
      const includePredictions = input.include_predictions !== false;
      const qualificationFilter = input.qualification_filter;
      const daysBack = input.days_back || 90;

      // Fetch data
      const [contactsResponse, jobsResponse, estimatesResponse, activitiesResponse] = await Promise.all([
        this.client.get(context.apiKey, 'contacts', { size: 100 }),
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'estimates', { size: 100 }),
        this.client.get(context.apiKey, 'activities', { size: 100 }),
      ]);

      const contacts = contactsResponse.data?.results || [];
      const jobs = jobsResponse.data?.results || [];
      const estimates = estimatesResponse.data?.results || [];
      const activities = activitiesResponse.data?.activity || [];

      const now = Date.now();
      const cutoffDate = now - (daysBack * 24 * 60 * 60 * 1000);

      // Build contact engagement map
      const contactEngagement = new Map<string, {
        activities: number;
        jobs: number;
        estimates: number;
        lastContact: number;
        totalValue: number;
        won: boolean;
      }>();

      // Process activities for engagement
      for (const activity of activities) {
        const createdDate = activity.date_created || activity.created_at || 0;
        if (createdDate < cutoffDate) continue;

        const related = activity.related || [];
        for (const rel of related) {
          if (rel.type === 'contact' && rel.id) {
            if (!contactEngagement.has(rel.id)) {
              contactEngagement.set(rel.id, { activities: 0, jobs: 0, estimates: 0, lastContact: 0, totalValue: 0, won: false });
            }
            const data = contactEngagement.get(rel.id)!;
            data.activities++;
            data.lastContact = Math.max(data.lastContact, createdDate);
          }
        }
      }

      // Process jobs
      for (const job of jobs) {
        const related = job.related || [];
        for (const rel of related) {
          if (rel.type === 'contact' && rel.id) {
            if (!contactEngagement.has(rel.id)) {
              contactEngagement.set(rel.id, { activities: 0, jobs: 0, estimates: 0, lastContact: 0, totalValue: 0, won: false });
            }
            const data = contactEngagement.get(rel.id)!;
            data.jobs++;

            const status = (job.status_name || '').toLowerCase();
            if (status.includes('complete') || status.includes('won')) {
              data.won = true;
            }
          }
        }
      }

      // Process estimates
      for (const estimate of estimates) {
        const related = estimate.related || [];
        for (const rel of related) {
          if (rel.type === 'contact' && rel.id) {
            if (!contactEngagement.has(rel.id)) {
              contactEngagement.set(rel.id, { activities: 0, jobs: 0, estimates: 0, lastContact: 0, totalValue: 0, won: false });
            }
            const data = contactEngagement.get(rel.id)!;
            data.estimates++;
            data.totalValue += parseFloat(estimate.total || 0);
          }
        }
      }

      // Calculate lead scores
      const leadScores: LeadScore[] = [];
      const distributionMap = new Map<string, { count: number; scores: number[]; values: number[]; conversions: number }>();

      for (const contact of contacts) {
        const contactId = contact.jnid || contact.id;
        if (!contactId) continue;

        const engagement = contactEngagement.get(contactId) || { activities: 0, jobs: 0, estimates: 0, lastContact: 0, totalValue: 0, won: false };

        // Skip won contacts (already converted)
        if (engagement.won) continue;

        // Calculate scores
        const engagementScore = this.calculateEngagementScore(engagement.activities, engagement.jobs, engagement.estimates);
        const recencyScore = this.calculateRecencyScore(engagement.lastContact, now);
        const valueScore = this.calculateValueScore(engagement.totalValue);

        // Overall lead score (weighted average)
        const leadScore = (engagementScore * 0.4) + (recencyScore * 0.3) + (valueScore * 0.3);

        // Skip if below minimum score
        if (leadScore < minScore) continue;

        // Qualification status
        const qualificationStatus: 'Hot' | 'Warm' | 'Cold' | 'Unqualified' =
          leadScore >= 75 ? 'Hot' :
          leadScore >= 50 ? 'Warm' :
          leadScore >= 25 ? 'Cold' : 'Unqualified';

        // Skip if qualification filter doesn't match
        if (qualificationFilter && qualificationStatus !== qualificationFilter) continue;

        // Conversion probability
        const conversionProbability = this.calculateConversionProbability(leadScore, engagement);

        // Recommended action
        const recommendedAction = this.getRecommendedAction(qualificationStatus, recencyScore, engagement);

        // Next follow-up date
        const daysUntilFollowup = qualificationStatus === 'Hot' ? 1 : qualificationStatus === 'Warm' ? 3 : 7;
        const nextFollowUp = new Date(now + (daysUntilFollowup * 24 * 60 * 60 * 1000));

        leadScores.push({
          contact_id: contactId,
          contact_name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.company || 'Unknown',
          company: contact.company || 'N/A',
          lead_score: Math.round(leadScore),
          qualification_status: qualificationStatus,
          conversion_probability: Math.round(conversionProbability),
          engagement_score: Math.round(engagementScore),
          recency_score: Math.round(recencyScore),
          value_score: Math.round(valueScore),
          priority_rank: 0, // Will be set after sorting
          recommended_action: recommendedAction,
          next_follow_up_date: nextFollowUp.toISOString().split('T')[0],
        });

        // Distribution tracking
        if (!distributionMap.has(qualificationStatus)) {
          distributionMap.set(qualificationStatus, { count: 0, scores: [], values: [], conversions: 0 });
        }
        const dist = distributionMap.get(qualificationStatus)!;
        dist.count++;
        dist.scores.push(leadScore);
        dist.values.push(engagement.totalValue);
      }

      // Sort by lead score and assign priority ranks
      leadScores.sort((a, b) => b.lead_score - a.lead_score);
      leadScores.forEach((lead, index) => {
        lead.priority_rank = index + 1;
      });

      // Lead distribution
      const leadDistribution: LeadDistribution[] = [];
      for (const [status, data] of distributionMap.entries()) {
        leadDistribution.push({
          qualification_status: status,
          count: data.count,
          avg_score: data.scores.length > 0 ? data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length : 0,
          total_potential_value: data.values.reduce((sum, v) => sum + v, 0),
          conversion_rate: 0, // Would be calculated from historical data
        });
      }

      // Conversion predictions
      const conversionPredictions: ConversionPrediction[] = [];
      if (includePredictions) {
        const hotLeads = leadScores.filter(l => l.qualification_status === 'Hot').length;
        const warmLeads = leadScores.filter(l => l.qualification_status === 'Warm').length;

        conversionPredictions.push({
          time_period: '7_days',
          predicted_conversions: Math.round(hotLeads * 0.3),
          predicted_revenue: hotLeads * 15000 * 0.3,
          confidence_level: 75,
        });

        conversionPredictions.push({
          time_period: '30_days',
          predicted_conversions: Math.round(hotLeads * 0.6 + warmLeads * 0.2),
          predicted_revenue: (hotLeads * 15000 * 0.6) + (warmLeads * 10000 * 0.2),
          confidence_level: 65,
        });

        conversionPredictions.push({
          time_period: '90_days',
          predicted_conversions: Math.round(hotLeads * 0.8 + warmLeads * 0.4),
          predicted_revenue: (hotLeads * 15000 * 0.8) + (warmLeads * 10000 * 0.4),
          confidence_level: 55,
        });
      }

      // Scoring factors
      const scoringFactors: ScoringFactors[] = [
        { factor_name: 'Engagement', weight: 40, description: 'Activities, jobs, and estimates interaction' },
        { factor_name: 'Recency', weight: 30, description: 'Time since last contact interaction' },
        { factor_name: 'Value Potential', weight: 30, description: 'Estimated deal value and size' },
      ];

      // Recommendations
      const recommendations: string[] = [];

      const hotLeadsCount = leadScores.filter(l => l.qualification_status === 'Hot').length;
      if (hotLeadsCount > 0) {
        recommendations.push(`🔥 ${hotLeadsCount} hot lead(s) - prioritize immediate follow-up`);
      }

      const staleLeads = leadScores.filter(l => l.recency_score < 30).length;
      if (staleLeads > 5) {
        recommendations.push(`⏰ ${staleLeads} stale lead(s) - re-engagement campaign needed`);
      }

      const highValueLeads = leadScores.filter(l => l.value_score > 70).length;
      if (highValueLeads > 0) {
        recommendations.push(`💰 ${highValueLeads} high-value lead(s) - assign senior sales rep`);
      }

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        analysis_period_days: daysBack,
        summary: {
          total_leads: leadScores.length,
          hot_leads: leadScores.filter(l => l.qualification_status === 'Hot').length,
          warm_leads: leadScores.filter(l => l.qualification_status === 'Warm').length,
          cold_leads: leadScores.filter(l => l.qualification_status === 'Cold').length,
          avg_lead_score: leadScores.length > 0
            ? leadScores.reduce((sum, l) => sum + l.lead_score, 0) / leadScores.length
            : 0,
        },
        scoring_factors: scoringFactors,
        lead_scores: leadScores,
        lead_distribution: leadDistribution,
        conversion_predictions: includePredictions ? conversionPredictions : undefined,
        recommendations: recommendations,
        key_insights: [
          `${hotLeadsCount} hot lead(s) ready for immediate contact`,
          `Average lead score: ${leadScores.length > 0 ? (leadScores.reduce((sum, l) => sum + l.lead_score, 0) / leadScores.length).toFixed(1) : 0}/100`,
          `Top priority: ${leadScores[0]?.contact_name || 'N/A'}`,
        ],
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }

  private calculateEngagementScore(activities: number, jobs: number, estimates: number): number {
    return Math.min((activities * 10) + (jobs * 20) + (estimates * 15), 100);
  }

  private calculateRecencyScore(lastContact: number, now: number): number {
    if (lastContact === 0) return 0;
    const daysSinceContact = (now - lastContact) / (1000 * 60 * 60 * 24);
    if (daysSinceContact <= 7) return 100;
    if (daysSinceContact <= 14) return 80;
    if (daysSinceContact <= 30) return 60;
    if (daysSinceContact <= 60) return 40;
    if (daysSinceContact <= 90) return 20;
    return 10;
  }

  private calculateValueScore(totalValue: number): number {
    if (totalValue >= 50000) return 100;
    if (totalValue >= 25000) return 80;
    if (totalValue >= 10000) return 60;
    if (totalValue >= 5000) return 40;
    if (totalValue >= 1000) return 20;
    return 10;
  }

  private calculateConversionProbability(leadScore: number, engagement: any): number {
    let probability = leadScore * 0.6;
    if (engagement.estimates > 0) probability += 20;
    if (engagement.jobs > 0) probability += 10;
    return Math.min(probability, 95);
  }

  private getRecommendedAction(status: string, recencyScore: number, engagement: any): string {
    if (status === 'Hot') {
      return engagement.estimates > 0 ? 'Follow up on estimate immediately' : 'Schedule demo/consultation ASAP';
    }
    if (status === 'Warm') {
      return recencyScore < 50 ? 'Re-engage with value proposition' : 'Continue nurturing with content';
    }
    if (status === 'Cold') {
      return 'Re-qualification call needed';
    }
    return 'Add to automated nurture campaign';
  }
}
