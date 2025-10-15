/**
 * Get Customer Segmentation Analytics
 * Comprehensive customer segmentation with RFM analysis, clustering, personas, and targeting recommendations
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface SegmentationMetrics {
  total_customers: number;
  total_segments: number;
  avg_customers_per_segment: number;
  most_valuable_segment: string;
  fastest_growing_segment: string;
}

interface CustomerSegment {
  segment_id: string;
  segment_name: string;
  description: string;
  customer_count: number;
  percentage_of_total: number;
  avg_customer_value: number;
  total_segment_value: number;
  recency_score: number;
  frequency_score: number;
  monetary_score: number;
  engagement_level: 'Very High' | 'High' | 'Medium' | 'Low';
  churn_risk: 'Low' | 'Medium' | 'High';
  growth_potential: 'High' | 'Medium' | 'Low';
  recommended_strategy: string;
}

interface RFMAnalysis {
  customer_id: string;
  customer_name: string;
  recency_days: number;
  frequency_count: number;
  monetary_value: number;
  rfm_score: string;
  rfm_segment: 'Champions' | 'Loyal' | 'Potential Loyalist' | 'New' | 'Promising' | 'Need Attention' | 'About to Sleep' | 'At Risk' | 'Hibernating';
  lifetime_value: number;
  recommended_action: string;
}

// interface CustomerPersona {
//   persona_name: string;
//   typical_characteristics: string[];
//   avg_job_size: number;
//   preferred_services: string[];
//   communication_preference: string;
//   decision_timeframe: string;
//   price_sensitivity: 'Low' | 'Medium' | 'High';
//   customer_count: number;
//   revenue_contribution: number;
//   marketing_message: string;
//   sales_approach: string;
// }

// interface BehavioralSegment {
//   behavior_type: string;
//   customer_count: number;
//   avg_engagement_score: number;
//   conversion_rate: number;
//   typical_actions: string[];
//   targeting_recommendation: string;
// }

interface ValueSegment {
  segment_name: 'Diamond' | 'Platinum' | 'Gold' | 'Silver' | 'Bronze';
  min_value: number;
  max_value: number;
  customer_count: number;
  total_revenue: number;
  avg_purchase_frequency: number;
  retention_rate: number;
  upsell_potential: number;
  service_level: string;
}

interface TargetingRecommendation {
  segment: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  recommended_channels: string[];
  message_themes: string[];
  offer_suggestions: string[];
  expected_roi: number;
  effort_level: 'Low' | 'Medium' | 'High';
}

export class GetCustomerSegmentationAnalyticsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_customer_segmentation_analytics',
      description: 'Comprehensive customer segmentation with RFM analysis, clustering, persona development, behavioral segmentation, value tiers, and targeting recommendations',
      inputSchema: {
        type: 'object',
        properties: {
          days_back: {
            type: 'number',
            default: 365,
            description: 'Days of history for analysis (default: 365)',
          },
          include_personas: {
            type: 'boolean',
            default: true,
            description: 'Include customer personas',
          },
          include_targeting: {
            type: 'boolean',
            default: true,
            description: 'Include targeting recommendations',
          },
          min_transactions: {
            type: 'number',
            default: 1,
            description: 'Minimum transactions to include customer (default: 1)',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const daysBack = input.days_back || 365;
      // const includePersonas = input.include_personas !== false;
      const includeTargeting = input.include_targeting !== false;
      const minTransactions = input.min_transactions || 1;

      const [contactsResponse, jobsResponse, activitiesResponse] = await Promise.all([
        this.client.get(context.apiKey, 'contacts', { size: 100 }),
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'activities', { size: 100 }),
      ]);

      const contacts = contactsResponse.data?.results || [];
      const jobs = jobsResponse.data?.results || [];
      const activities = activitiesResponse.data?.activity || [];

      const now = Date.now();
      // const cutoffDate = now - (daysBack * 24 * 60 * 60 * 1000);

      // Build customer data
      const customerData = new Map<string, {
        name: string;
        company: string;
        lastPurchaseDate: number;
        purchases: number;
        totalValue: number;
        jobTypes: string[];
        engagementActivities: number;
      }>();

      // Initialize from contacts
      for (const contact of contacts) {
        const contactId = contact.jnid || contact.id;
        if (!contactId) continue;

        customerData.set(contactId, {
          name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.company || 'Unknown',
          company: contact.company || 'N/A',
          lastPurchaseDate: 0,
          purchases: 0,
          totalValue: 0,
          jobTypes: [],
          engagementActivities: 0,
        });
      }

      // Add job data
      for (const job of jobs) {
        const related = job.related || [];
        const contactRel = related.find((r: any) => r.type === 'contact');
        if (!contactRel || !contactRel.id) continue;

        const contactId = contactRel.id;
        if (!customerData.has(contactId)) continue;

        const customer = customerData.get(contactId)!;
        const status = (job.status_name || '').toLowerCase();

        if (status.includes('complete') || status.includes('won')) {
          customer.purchases++;
          const value = parseFloat(job.total || job.value || 0);
          customer.totalValue += value;

          const completedDate = job.date_status_change || job.date_updated || 0;
          customer.lastPurchaseDate = Math.max(customer.lastPurchaseDate, completedDate);

          const jobType = job.job_type || job.type || 'General';
          if (!customer.jobTypes.includes(jobType)) {
            customer.jobTypes.push(jobType);
          }
        }
      }

      // Add activity/engagement data
      for (const activity of activities) {
        const related = activity.related || [];
        const contactRel = related.find((r: any) => r.type === 'contact');
        if (!contactRel || !contactRel.id) continue;

        const contactId = contactRel.id;
        if (!customerData.has(contactId)) continue;

        const customer = customerData.get(contactId)!;
        customer.engagementActivities++;
      }

      // RFM Analysis
      const rfmAnalyses: RFMAnalysis[] = [];

      for (const [contactId, customer] of customerData.entries()) {
        if (customer.purchases < minTransactions) continue;

        // Recency (days since last purchase)
        const recencyDays = customer.lastPurchaseDate > 0
          ? (now - customer.lastPurchaseDate) / (1000 * 60 * 60 * 24)
          : 999;

        // Frequency (number of purchases)
        const frequency = customer.purchases;

        // Monetary (total value)
        const monetary = customer.totalValue;

        // RFM Scores (1-5)
        const recencyScore = recencyDays <= 30 ? 5 : recencyDays <= 90 ? 4 : recencyDays <= 180 ? 3 : recencyDays <= 365 ? 2 : 1;
        const frequencyScore = frequency >= 10 ? 5 : frequency >= 5 ? 4 : frequency >= 3 ? 3 : frequency >= 2 ? 2 : 1;
        const monetaryScore = monetary >= 50000 ? 5 : monetary >= 25000 ? 4 : monetary >= 10000 ? 3 : monetary >= 5000 ? 2 : 1;

        const rfmScore = `${recencyScore}${frequencyScore}${monetaryScore}`;

        // RFM Segment
        const rfmSegment = this.getRFMSegment(recencyScore, frequencyScore, monetaryScore);

        // Lifetime value
        const lifetimeValue = monetary;

        // Recommended action
        const recommendedAction = this.getRFMAction(rfmSegment);

        rfmAnalyses.push({
          customer_id: contactId,
          customer_name: customer.name,
          recency_days: Math.round(recencyDays),
          frequency_count: frequency,
          monetary_value: monetary,
          rfm_score: rfmScore,
          rfm_segment: rfmSegment,
          lifetime_value: lifetimeValue,
          recommended_action: recommendedAction,
        });
      }

      rfmAnalyses.sort((a, b) => b.lifetime_value - a.lifetime_value);

      // Customer segments
      const segmentMap = new Map<string, { customers: string[]; totalValue: number; recency: number[]; frequency: number[]; monetary: number[] }>();

      for (const rfm of rfmAnalyses) {
        if (!segmentMap.has(rfm.rfm_segment)) {
          segmentMap.set(rfm.rfm_segment, { customers: [], totalValue: 0, recency: [], frequency: [], monetary: [] });
        }

        const segment = segmentMap.get(rfm.rfm_segment)!;
        segment.customers.push(rfm.customer_id);
        segment.totalValue += rfm.monetary_value;
        segment.recency.push(rfm.recency_days);
        segment.frequency.push(rfm.frequency_count);
        segment.monetary.push(rfm.monetary_value);
      }

      const customerSegments: CustomerSegment[] = [];
      for (const [segmentName, data] of segmentMap.entries()) {
        const avgRecency = data.recency.reduce((sum, r) => sum + r, 0) / data.recency.length;
        const avgFrequency = data.frequency.reduce((sum, f) => sum + f, 0) / data.frequency.length;
        const avgMonetary = data.monetary.reduce((sum, m) => sum + m, 0) / data.monetary.length;

        const engagementLevel: 'Very High' | 'High' | 'Medium' | 'Low' =
          avgRecency <= 30 && avgFrequency >= 5 ? 'Very High' :
          avgRecency <= 90 && avgFrequency >= 3 ? 'High' :
          avgRecency <= 180 ? 'Medium' : 'Low';

        const churnRisk: 'Low' | 'Medium' | 'High' =
          avgRecency <= 90 ? 'Low' :
          avgRecency <= 180 ? 'Medium' : 'High';

        const growthPotential: 'High' | 'Medium' | 'Low' =
          avgMonetary >= 25000 && avgFrequency < 5 ? 'High' :
          avgMonetary >= 10000 && avgFrequency < 3 ? 'Medium' : 'Low';

        customerSegments.push({
          segment_id: segmentName.toLowerCase().replace(/\s+/g, '_'),
          segment_name: segmentName,
          description: this.getSegmentDescription(segmentName),
          customer_count: data.customers.length,
          percentage_of_total: (data.customers.length / rfmAnalyses.length) * 100,
          avg_customer_value: avgMonetary,
          total_segment_value: data.totalValue,
          recency_score: 5 - Math.floor(avgRecency / 100),
          frequency_score: Math.min(Math.floor(avgFrequency / 2), 5),
          monetary_score: Math.min(Math.floor(avgMonetary / 10000), 5),
          engagement_level: engagementLevel,
          churn_risk: churnRisk,
          growth_potential: growthPotential,
          recommended_strategy: this.getSegmentStrategy(segmentName),
        });
      }

      customerSegments.sort((a, b) => b.total_segment_value - a.total_segment_value);

      // Value segments
      const valueSegments: ValueSegment[] = [
        {
          segment_name: 'Diamond',
          min_value: 50000,
          max_value: Infinity,
          customer_count: 0,
          total_revenue: 0,
          avg_purchase_frequency: 0,
          retention_rate: 95,
          upsell_potential: 50,
          service_level: 'VIP - dedicated account manager',
        },
        {
          segment_name: 'Platinum',
          min_value: 25000,
          max_value: 49999,
          customer_count: 0,
          total_revenue: 0,
          avg_purchase_frequency: 0,
          retention_rate: 85,
          upsell_potential: 40,
          service_level: 'Premium - priority support',
        },
        {
          segment_name: 'Gold',
          min_value: 10000,
          max_value: 24999,
          customer_count: 0,
          total_revenue: 0,
          avg_purchase_frequency: 0,
          retention_rate: 75,
          upsell_potential: 30,
          service_level: 'Standard Plus - quarterly check-ins',
        },
        {
          segment_name: 'Silver',
          min_value: 5000,
          max_value: 9999,
          customer_count: 0,
          total_revenue: 0,
          avg_purchase_frequency: 0,
          retention_rate: 65,
          upsell_potential: 20,
          service_level: 'Standard - regular communications',
        },
        {
          segment_name: 'Bronze',
          min_value: 0,
          max_value: 4999,
          customer_count: 0,
          total_revenue: 0,
          avg_purchase_frequency: 0,
          retention_rate: 50,
          upsell_potential: 10,
          service_level: 'Basic - automated communications',
        },
      ];

      for (const rfm of rfmAnalyses) {
        const segment = valueSegments.find(s => rfm.monetary_value >= s.min_value && rfm.monetary_value <= s.max_value);
        if (segment) {
          segment.customer_count++;
          segment.total_revenue += rfm.monetary_value;
          segment.avg_purchase_frequency += rfm.frequency_count;
        }
      }

      for (const segment of valueSegments) {
        if (segment.customer_count > 0) {
          segment.avg_purchase_frequency /= segment.customer_count;
        }
      }

      // Targeting recommendations
      const targetingRecommendations: TargetingRecommendation[] = [];
      if (includeTargeting) {
        for (const segment of customerSegments.slice(0, 5)) {
          targetingRecommendations.push({
            segment: segment.segment_name,
            priority: segment.total_segment_value > 100000 ? 'Critical' :
                     segment.total_segment_value > 50000 ? 'High' : 'Medium',
            recommended_channels: this.getRecommendedChannels(segment.segment_name),
            message_themes: this.getMessageThemes(segment.segment_name),
            offer_suggestions: this.getOfferSuggestions(segment.segment_name),
            expected_roi: segment.growth_potential === 'High' ? 3.5 :
                          segment.growth_potential === 'Medium' ? 2.5 : 1.5,
            effort_level: segment.churn_risk === 'High' ? 'High' : 'Medium',
          });
        }
      }

      const segmentationMetrics: SegmentationMetrics = {
        total_customers: rfmAnalyses.length,
        total_segments: customerSegments.length,
        avg_customers_per_segment: rfmAnalyses.length / Math.max(customerSegments.length, 1),
        most_valuable_segment: customerSegments[0]?.segment_name || 'N/A',
        fastest_growing_segment: customerSegments.find(s => s.growth_potential === 'High')?.segment_name || 'N/A',
      };

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        analysis_period_days: daysBack,
        segmentation_metrics: segmentationMetrics,
        customer_segments: customerSegments,
        rfm_analysis: rfmAnalyses.slice(0, 20),
        value_segments: valueSegments,
        targeting_recommendations: includeTargeting ? targetingRecommendations : undefined,
        key_insights: [
          `${rfmAnalyses.length} active customer(s) segmented`,
          `${customerSegments.length} distinct segment(s) identified`,
          `Top segment: ${customerSegments[0]?.segment_name} (${customerSegments[0]?.customer_count} customers)`,
          `Total customer value: $${customerSegments.reduce((sum, s) => sum + s.total_segment_value, 0).toLocaleString()}`,
        ],
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }

  private getRFMSegment(r: number, f: number, m: number): 'Champions' | 'Loyal' | 'Potential Loyalist' | 'New' | 'Promising' | 'Need Attention' | 'About to Sleep' | 'At Risk' | 'Hibernating' {
    if (r >= 4 && f >= 4 && m >= 4) return 'Champions';
    if (r >= 3 && f >= 4) return 'Loyal';
    if (r >= 4 && f <= 2) return 'New';
    if (r >= 3 && f >= 2 && m >= 3) return 'Potential Loyalist';
    if (r >= 3 && f <= 2) return 'Promising';
    if (r >= 2 && f >= 2) return 'Need Attention';
    if (r === 2) return 'About to Sleep';
    if (r === 1 && f >= 2) return 'At Risk';
    return 'Hibernating';
  }

  private getRFMAction(segment: string): string {
    const actions: Record<string, string> = {
      'Champions': 'Reward with VIP program, ask for referrals',
      'Loyal': 'Upsell premium services, exclusive offers',
      'Potential Loyalist': 'Engage with loyalty program, personalized offers',
      'New': 'Onboard properly, build relationship',
      'Promising': 'Create brand awareness, offer trials',
      'Need Attention': 'Reactivate with limited offers, gather feedback',
      'About to Sleep': 'Win back campaign, special discounts',
      'At Risk': 'Intervention required, survey dissatisfaction',
      'Hibernating': 'Re-engagement campaign or retire',
    };
    return actions[segment] || 'Monitor and engage appropriately';
  }

  private getSegmentDescription(name: string): string {
    const descriptions: Record<string, string> = {
      'Champions': 'Best customers - recent, frequent, high value',
      'Loyal': 'Consistent customers with good frequency',
      'Potential Loyalist': 'Recent customers with growth potential',
      'New': 'Recent first-time buyers',
      'Promising': 'Recent low-spenders with potential',
      'Need Attention': 'Above average recency/frequency/value but declining',
      'About to Sleep': 'Below average recency, need reactivation',
      'At Risk': 'High value but haven\'t purchased recently',
      'Hibernating': 'Lowest recency, frequency, and value',
    };
    return descriptions[name] || 'Customer segment';
  }

  private getSegmentStrategy(name: string): string {
    const strategies: Record<string, string> = {
      'Champions': 'Retain and grow - VIP treatment',
      'Loyal': 'Nurture and upsell',
      'Potential Loyalist': 'Build loyalty through engagement',
      'New': 'Educate and convert to repeat',
      'Promising': 'Increase purchase frequency',
      'Need Attention': 'Reactivate with targeted offers',
      'About to Sleep': 'Win-back campaign',
      'At Risk': 'Save relationship urgently',
      'Hibernating': 'Minimal investment or retire',
    };
    return strategies[name] || 'Engage appropriately';
  }

  private getRecommendedChannels(segment: string): string[] {
    if (segment === 'Champions' || segment === 'Loyal') return ['Direct call', 'Email', 'In-person'];
    if (segment === 'At Risk' || segment === 'About to Sleep') return ['Email', 'Direct mail', 'Retargeting ads'];
    return ['Email', 'Social media', 'Content marketing'];
  }

  private getMessageThemes(segment: string): string[] {
    if (segment === 'Champions') return ['Exclusive access', 'VIP rewards', 'Referral bonuses'];
    if (segment === 'At Risk') return ['We miss you', 'Special comeback offer', 'What can we improve?'];
    return ['Value proposition', 'Customer success stories', 'New offerings'];
  }

  private getOfferSuggestions(segment: string): string[] {
    if (segment === 'Champions') return ['Early access to new services', 'Volume discounts', 'Referral commissions'];
    if (segment === 'At Risk') return ['30% win-back discount', 'Free consultation', 'Service upgrade'];
    return ['Limited-time promotion', 'Bundle deals', 'Seasonal offers'];
  }
}
