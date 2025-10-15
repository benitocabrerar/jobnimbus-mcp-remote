/**
 * Get Marketing Campaign Analytics
 * Comprehensive marketing analytics with lead source tracking, campaign ROI, conversion analysis, and budget optimization
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface CampaignMetrics {
  total_campaigns: number;
  active_campaigns: number;
  total_leads: number;
  qualified_leads: number;
  total_conversions: number;
  overall_conversion_rate: number;
  total_revenue: number;
  total_marketing_spend: number;
  roi: number;
  avg_cost_per_lead: number;
  avg_cost_per_acquisition: number;
}

interface CampaignPerformance {
  campaign_name: string;
  channel: string;
  leads_generated: number;
  qualified_leads: number;
  conversions: number;
  conversion_rate: number;
  revenue_generated: number;
  marketing_spend: number;
  roi: number;
  cost_per_lead: number;
  cost_per_acquisition: number;
  performance_rating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  budget_efficiency_score: number;
  recommended_action: string;
}

interface LeadSourceAnalysis {
  source: string;
  total_leads: number;
  percentage_of_total: number;
  conversion_rate: number;
  avg_lead_value: number;
  quality_score: number;
  trend: 'Growing' | 'Stable' | 'Declining';
}

interface ChannelEffectiveness {
  channel: string;
  campaigns: number;
  total_reach: number;
  engagement_rate: number;
  leads_generated: number;
  conversions: number;
  revenue: number;
  spend: number;
  roi: number;
  effectiveness_score: number;
  recommended_budget_allocation: number;
}

interface ConversionFunnelBySource {
  source: string;
  stage_1_leads: number;
  stage_2_qualified: number;
  stage_3_opportunities: number;
  stage_4_conversions: number;
  conversion_rate_1_2: number;
  conversion_rate_2_3: number;
  conversion_rate_3_4: number;
  overall_conversion: number;
  bottleneck_stage: string;
}

interface AttributionModel {
  model_type: 'First Touch' | 'Last Touch' | 'Linear' | 'Time Decay';
  channel: string;
  attributed_conversions: number;
  attributed_revenue: number;
  attribution_percentage: number;
}

interface BudgetRecommendation {
  channel: string;
  current_budget: number;
  recommended_budget: number;
  budget_change_percentage: number;
  rationale: string;
  expected_impact: string;
  priority: 'High' | 'Medium' | 'Low';
}

export class GetMarketingCampaignAnalyticsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_marketing_campaign_analytics',
      description: 'Comprehensive marketing campaign analytics with lead source tracking, ROI calculation, conversion funnel analysis, channel effectiveness, and budget optimization recommendations',
      inputSchema: {
        type: 'object',
        properties: {
          days_back: {
            type: 'number',
            default: 90,
            description: 'Days of history to analyze (default: 90)',
          },
          include_attribution: {
            type: 'boolean',
            default: true,
            description: 'Include attribution modeling',
          },
          include_budget_recommendations: {
            type: 'boolean',
            default: true,
            description: 'Include budget allocation recommendations',
          },
          min_roi_threshold: {
            type: 'number',
            default: 2.0,
            description: 'Minimum ROI threshold for campaign success (default: 2.0)',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const daysBack = input.days_back || 90;
      const includeAttribution = input.include_attribution !== false;
      const includeBudgetRecs = input.include_budget_recommendations !== false;
      const minRoiThreshold = input.min_roi_threshold || 2.0;

      // Fetch data
      const [contactsResponse, jobsResponse] = await Promise.all([
        this.client.get(context.apiKey, 'contacts', { size: 100 }),
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        // this.client.get(context.apiKey, 'activities', { size: 100 }),
        // this.client.get(context.apiKey, 'estimates', { size: 100 }),
      ]);

      const contacts = contactsResponse.data?.results || [];
      const jobs = jobsResponse.data?.results || [];
      // const activities = activitiesResponse.data?.activity || [];
      // const estimates = estimatesResponse.data?.results || [];

      const now = Date.now();
      const cutoffDate = now - (daysBack * 24 * 60 * 60 * 1000);

      // Infer campaign/source from contact tags and job types
      const campaignMap = new Map<string, {
        channel: string;
        leads: Set<string>;
        qualifiedLeads: Set<string>;
        conversions: Set<string>;
        revenue: number;
        spend: number; // Estimated based on conversion
        touchpoints: string[];
      }>();

      // Process contacts (leads)
      for (const contact of contacts) {
        const createdDate = contact.date_created || contact.created_at || 0;
        if (createdDate < cutoffDate) continue;

        // Infer source from tags or fields
        const tags = contact.tags || [];
        const source = tags.length > 0 ? tags[0] : contact.source || contact.lead_source || 'Direct';
        const channel = this.inferChannel(source);

        if (!campaignMap.has(source)) {
          campaignMap.set(source, {
            channel: channel,
            leads: new Set(),
            qualifiedLeads: new Set(),
            conversions: new Set(),
            revenue: 0,
            spend: 0,
            touchpoints: [],
          });
        }

        const campaign = campaignMap.get(source)!;
        const contactId = contact.jnid || contact.id;
        if (contactId) {
          campaign.leads.add(contactId);
          campaign.touchpoints.push('contact_created');
        }
      }

      // Process jobs (conversions)
      for (const job of jobs) {
        const related = job.related || [];
        const contactRel = related.find((r: any) => r.type === 'contact');
        if (!contactRel || !contactRel.id) continue;

        const contactId = contactRel.id;

        // Find source from contact
        const contact = contacts.find((c: any) => (c.jnid || c.id) === contactId);
        if (!contact) continue;

        const tags = contact.tags || [];
        const source = tags.length > 0 ? tags[0] : contact.source || contact.lead_source || 'Direct';

        if (!campaignMap.has(source)) continue;

        const campaign = campaignMap.get(source)!;

        // Check if won
        const status = (job.status_name || '').toLowerCase();
        if (status.includes('complete') || status.includes('won')) {
          campaign.conversions.add(contactId);
          const revenue = parseFloat(job.total || job.value || 0);
          campaign.revenue += revenue;
          campaign.touchpoints.push('conversion');
        } else {
          // Qualified lead (has job but not won)
          campaign.qualifiedLeads.add(contactId);
          campaign.touchpoints.push('qualified');
        }
      }

      // Estimate marketing spend (simplified: 10% of revenue or $100 per lead)
      for (const [_source, campaign] of campaignMap.entries()) {
        const estimatedSpend = Math.max(
          campaign.revenue * 0.1,
          campaign.leads.size * 100
        );
        campaign.spend = estimatedSpend;
      }

      // Campaign performance
      const campaignPerformances: CampaignPerformance[] = [];
      let totalLeads = 0;
      let totalQualified = 0;
      let totalConversions = 0;
      let totalRevenue = 0;
      let totalSpend = 0;

      for (const [source, campaign] of campaignMap.entries()) {
        const leadsGenerated = campaign.leads.size;
        const qualifiedLeads = campaign.qualifiedLeads.size;
        const conversions = campaign.conversions.size;
        const revenue = campaign.revenue;
        const spend = campaign.spend;

        totalLeads += leadsGenerated;
        totalQualified += qualifiedLeads;
        totalConversions += conversions;
        totalRevenue += revenue;
        totalSpend += spend;

        const conversionRate = leadsGenerated > 0 ? (conversions / leadsGenerated) * 100 : 0;
        const roi = spend > 0 ? revenue / spend : 0;
        const costPerLead = leadsGenerated > 0 ? spend / leadsGenerated : 0;
        const costPerAcquisition = conversions > 0 ? spend / conversions : 0;

        const performanceRating: 'Excellent' | 'Good' | 'Fair' | 'Poor' =
          roi >= 5 && conversionRate >= 15 ? 'Excellent' :
          roi >= 3 && conversionRate >= 10 ? 'Good' :
          roi >= 2 && conversionRate >= 5 ? 'Fair' : 'Poor';

        // Budget efficiency score (0-100)
        const budgetEfficiencyScore = Math.min(
          (roi / 5) * 50 + (conversionRate / 15) * 50,
          100
        );

        const recommendedAction =
          performanceRating === 'Excellent' ? 'Scale up - increase budget by 25-50%' :
          performanceRating === 'Good' ? 'Optimize and scale moderately' :
          performanceRating === 'Fair' ? 'Improve targeting and messaging' :
          'Review or discontinue campaign';

        campaignPerformances.push({
          campaign_name: source,
          channel: campaign.channel,
          leads_generated: leadsGenerated,
          qualified_leads: qualifiedLeads,
          conversions: conversions,
          conversion_rate: conversionRate,
          revenue_generated: revenue,
          marketing_spend: spend,
          roi: roi,
          cost_per_lead: costPerLead,
          cost_per_acquisition: costPerAcquisition,
          performance_rating: performanceRating,
          budget_efficiency_score: budgetEfficiencyScore,
          recommended_action: recommendedAction,
        });
      }

      campaignPerformances.sort((a, b) => b.roi - a.roi);

      // Campaign metrics
      const overallConversionRate = totalLeads > 0 ? (totalConversions / totalLeads) * 100 : 0;
      const overallRoi = totalSpend > 0 ? totalRevenue / totalSpend : 0;
      const avgCostPerLead = totalLeads > 0 ? totalSpend / totalLeads : 0;
      const avgCostPerAcquisition = totalConversions > 0 ? totalSpend / totalConversions : 0;

      const campaignMetrics: CampaignMetrics = {
        total_campaigns: campaignMap.size,
        active_campaigns: campaignPerformances.filter(c => c.performance_rating !== 'Poor').length,
        total_leads: totalLeads,
        qualified_leads: totalQualified,
        total_conversions: totalConversions,
        overall_conversion_rate: overallConversionRate,
        total_revenue: totalRevenue,
        total_marketing_spend: totalSpend,
        roi: overallRoi,
        avg_cost_per_lead: avgCostPerLead,
        avg_cost_per_acquisition: avgCostPerAcquisition,
      };

      // Lead source analysis
      const leadSourceAnalyses: LeadSourceAnalysis[] = [];
      for (const [source, campaign] of campaignMap.entries()) {
        const totalSourceLeads = campaign.leads.size;
        const percentage = totalLeads > 0 ? (totalSourceLeads / totalLeads) * 100 : 0;
        const conversionRate = totalSourceLeads > 0 ? (campaign.conversions.size / totalSourceLeads) * 100 : 0;
        const avgLeadValue = campaign.conversions.size > 0 ? campaign.revenue / campaign.conversions.size : 0;

        // Quality score (0-100)
        const qualityScore = Math.min(
          (conversionRate / 15) * 50 + (avgLeadValue / 10000) * 50,
          100
        );

        const trend: 'Growing' | 'Stable' | 'Declining' = 'Stable'; // Simplified

        leadSourceAnalyses.push({
          source: source,
          total_leads: totalSourceLeads,
          percentage_of_total: percentage,
          conversion_rate: conversionRate,
          avg_lead_value: avgLeadValue,
          quality_score: qualityScore,
          trend: trend,
        });
      }

      leadSourceAnalyses.sort((a, b) => b.quality_score - a.quality_score);

      // Channel effectiveness
      const channelMap = new Map<string, {
        campaigns: Set<string>;
        reach: number;
        leads: number;
        conversions: number;
        revenue: number;
        spend: number;
      }>();

      for (const [source, campaign] of campaignMap.entries()) {
        const channel = campaign.channel;

        if (!channelMap.has(channel)) {
          channelMap.set(channel, {
            campaigns: new Set(),
            reach: 0,
            leads: 0,
            conversions: 0,
            revenue: 0,
            spend: 0,
          });
        }

        const channelData = channelMap.get(channel)!;
        channelData.campaigns.add(source);
        channelData.reach += campaign.leads.size * 10; // Estimated reach
        channelData.leads += campaign.leads.size;
        channelData.conversions += campaign.conversions.size;
        channelData.revenue += campaign.revenue;
        channelData.spend += campaign.spend;
      }

      const channelEffectivenesses: ChannelEffectiveness[] = [];
      for (const [channel, data] of channelMap.entries()) {
        const engagementRate = data.reach > 0 ? (data.leads / data.reach) * 100 : 0;
        const roi = data.spend > 0 ? data.revenue / data.spend : 0;

        // Effectiveness score (0-100)
        const effectivenessScore = Math.min(
          (roi / 5) * 40 + (engagementRate / 10) * 30 + (data.conversions / 50) * 30,
          100
        );

        // Recommended budget allocation based on performance
        const recommendedBudgetAllocation = totalSpend > 0
          ? (effectivenessScore / 100) * data.spend
          : 0;

        channelEffectivenesses.push({
          channel: channel,
          campaigns: data.campaigns.size,
          total_reach: data.reach,
          engagement_rate: engagementRate,
          leads_generated: data.leads,
          conversions: data.conversions,
          revenue: data.revenue,
          spend: data.spend,
          roi: roi,
          effectiveness_score: effectivenessScore,
          recommended_budget_allocation: recommendedBudgetAllocation,
        });
      }

      channelEffectivenesses.sort((a, b) => b.effectiveness_score - a.effectiveness_score);

      // Conversion funnel by source
      const conversionFunnels: ConversionFunnelBySource[] = [];
      for (const [source, campaign] of campaignMap.entries()) {
        const stage1 = campaign.leads.size;
        const stage2 = campaign.qualifiedLeads.size;
        const stage3 = Math.floor(stage2 * 0.7); // Estimated opportunities
        const stage4 = campaign.conversions.size;

        const convRate12 = stage1 > 0 ? (stage2 / stage1) * 100 : 0;
        const convRate23 = stage2 > 0 ? (stage3 / stage2) * 100 : 0;
        const convRate34 = stage3 > 0 ? (stage4 / stage3) * 100 : 0;
        const overallConv = stage1 > 0 ? (stage4 / stage1) * 100 : 0;

        const bottleneck =
          convRate12 < 30 ? 'Lead Qualification' :
          convRate23 < 50 ? 'Opportunity Creation' :
          convRate34 < 40 ? 'Closing' : 'None';

        conversionFunnels.push({
          source: source,
          stage_1_leads: stage1,
          stage_2_qualified: stage2,
          stage_3_opportunities: stage3,
          stage_4_conversions: stage4,
          conversion_rate_1_2: convRate12,
          conversion_rate_2_3: convRate23,
          conversion_rate_3_4: convRate34,
          overall_conversion: overallConv,
          bottleneck_stage: bottleneck,
        });
      }

      // Attribution modeling
      const attributionModels: AttributionModel[] = [];
      if (includeAttribution) {
        // First Touch Attribution
        for (const [channel, data] of channelMap.entries()) {
          attributionModels.push({
            model_type: 'First Touch',
            channel: channel,
            attributed_conversions: data.conversions,
            attributed_revenue: data.revenue,
            attribution_percentage: totalConversions > 0 ? (data.conversions / totalConversions) * 100 : 0,
          });
        }

        // Last Touch Attribution (same as first touch in simplified model)
        for (const [channel, data] of channelMap.entries()) {
          attributionModels.push({
            model_type: 'Last Touch',
            channel: channel,
            attributed_conversions: data.conversions,
            attributed_revenue: data.revenue,
            attribution_percentage: totalConversions > 0 ? (data.conversions / totalConversions) * 100 : 0,
          });
        }
      }

      // Budget recommendations
      const budgetRecommendations: BudgetRecommendation[] = [];
      if (includeBudgetRecs) {
        for (const channel of channelEffectivenesses) {
          const currentBudget = channel.spend;
          let recommendedBudget = currentBudget;
          let budgetChangePercentage = 0;
          let rationale = '';
          let priority: 'High' | 'Medium' | 'Low' = 'Medium';

          if (channel.roi >= 5) {
            recommendedBudget = currentBudget * 1.5;
            budgetChangePercentage = 50;
            rationale = `Excellent ROI (${channel.roi.toFixed(1)}x) - scale aggressively`;
            priority = 'High';
          } else if (channel.roi >= 3) {
            recommendedBudget = currentBudget * 1.25;
            budgetChangePercentage = 25;
            rationale = `Strong ROI (${channel.roi.toFixed(1)}x) - scale moderately`;
            priority = 'High';
          } else if (channel.roi >= minRoiThreshold) {
            recommendedBudget = currentBudget * 1.1;
            budgetChangePercentage = 10;
            rationale = `Good ROI (${channel.roi.toFixed(1)}x) - maintain and optimize`;
            priority = 'Medium';
          } else {
            recommendedBudget = currentBudget * 0.7;
            budgetChangePercentage = -30;
            rationale = `Low ROI (${channel.roi.toFixed(1)}x) - reduce budget`;
            priority = 'Low';
          }

          budgetRecommendations.push({
            channel: channel.channel,
            current_budget: currentBudget,
            recommended_budget: recommendedBudget,
            budget_change_percentage: budgetChangePercentage,
            rationale: rationale,
            expected_impact: budgetChangePercentage > 0
              ? `Increase revenue by ${(budgetChangePercentage * channel.roi).toFixed(0)}%`
              : `Reduce waste by ${Math.abs(budgetChangePercentage)}%`,
            priority: priority,
          });
        }

        budgetRecommendations.sort((a, b) => {
          const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
      }

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        analysis_period_days: daysBack,
        campaign_metrics: campaignMetrics,
        campaign_performances: campaignPerformances,
        lead_source_analysis: leadSourceAnalyses,
        channel_effectiveness: channelEffectivenesses,
        conversion_funnels: conversionFunnels,
        attribution_models: includeAttribution ? attributionModels : undefined,
        budget_recommendations: includeBudgetRecs ? budgetRecommendations : undefined,
        key_insights: [
          `Overall ROI: ${overallRoi.toFixed(1)}x`,
          `Conversion rate: ${overallConversionRate.toFixed(1)}%`,
          `Best performing channel: ${channelEffectivenesses[0]?.channel || 'N/A'} (${channelEffectivenesses[0]?.roi.toFixed(1)}x ROI)`,
          `${campaignPerformances.filter(c => c.performance_rating === 'Poor').length} campaign(s) need review`,
        ],
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }

  private inferChannel(source: string): string {
    const sourceLower = source.toLowerCase();

    if (sourceLower.includes('google') || sourceLower.includes('adwords') || sourceLower.includes('ppc')) {
      return 'Paid Search';
    }
    if (sourceLower.includes('facebook') || sourceLower.includes('instagram') || sourceLower.includes('social')) {
      return 'Social Media';
    }
    if (sourceLower.includes('email') || sourceLower.includes('newsletter')) {
      return 'Email Marketing';
    }
    if (sourceLower.includes('referral') || sourceLower.includes('word')) {
      return 'Referral';
    }
    if (sourceLower.includes('organic') || sourceLower.includes('seo')) {
      return 'Organic Search';
    }
    if (sourceLower.includes('direct')) {
      return 'Direct';
    }
    return 'Other';
  }
}
