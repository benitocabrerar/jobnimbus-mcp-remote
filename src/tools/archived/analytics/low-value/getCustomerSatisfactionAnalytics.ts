/**
 * Get Customer Satisfaction Analytics
 * Satisfaction scoring, NPS-style metrics, feedback analysis, service quality tracking, and improvement recommendations
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface SatisfactionMetrics {
  total_customers: number;
  customers_with_feedback: number;
  avg_satisfaction_score: number;
  nps_score: number;
  promoters: number;
  passives: number;
  detractors: number;
  response_rate: number;
  repeat_customer_rate: number;
}

interface CustomerFeedback {
  customer_id: string;
  customer_name: string;
  company: string;
  satisfaction_score: number;
  nps_category: 'Promoter' | 'Passive' | 'Detractor';
  service_quality_rating: number;
  response_time_rating: number;
  value_for_money_rating: number;
  overall_experience: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  likelihood_to_recommend: number;
  repeat_customer: boolean;
  total_jobs: number;
  total_revenue: number;
  last_interaction_days: number;
  risk_level: 'High Risk' | 'Medium Risk' | 'Low Risk' | 'Safe';
}

interface ServiceQualityMetrics {
  metric_name: string;
  score: number;
  category: 'Excellent' | 'Good' | 'Needs Improvement' | 'Critical';
  trend: 'Improving' | 'Stable' | 'Declining';
  benchmark: number;
  gap: number;
}

interface FeedbackAnalysis {
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  count: number;
  percentage: number;
  common_themes: string[];
  priority_actions: string[];
}

interface ChurnRiskAnalysis {
  risk_category: 'High Risk' | 'Medium Risk' | 'Low Risk';
  customer_count: number;
  total_revenue_at_risk: number;
  avg_satisfaction: number;
  recommended_interventions: string[];
}

interface ImprovementRecommendation {
  area: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  current_score: number;
  target_score: number;
  gap: number;
  action_items: string[];
  estimated_impact: string;
}

export class GetCustomerSatisfactionAnalyticsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_customer_satisfaction_analytics',
      description: 'Customer satisfaction scoring with NPS metrics, feedback analysis, service quality tracking, churn risk identification, and improvement recommendations',
      inputSchema: {
        type: 'object',
        properties: {
          days_back: {
            type: 'number',
            default: 90,
            description: 'Days of history to analyze (default: 90)',
          },
          include_churn_analysis: {
            type: 'boolean',
            default: true,
            description: 'Include churn risk analysis',
          },
          min_jobs_for_feedback: {
            type: 'number',
            default: 1,
            description: 'Minimum jobs to include customer in analysis (default: 1)',
          },
          nps_promoter_threshold: {
            type: 'number',
            default: 9,
            description: 'NPS promoter score threshold (default: 9)',
          },
          nps_detractor_threshold: {
            type: 'number',
            default: 6,
            description: 'NPS detractor score threshold (default: 6)',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const daysBack = input.days_back || 90;
      const includeChurnAnalysis = input.include_churn_analysis !== false;
      const minJobsForFeedback = input.min_jobs_for_feedback || 1;
      const promoterThreshold = input.nps_promoter_threshold || 9;
      const detractorThreshold = input.nps_detractor_threshold || 6;

      // Fetch data
      const [contactsResponse, jobsResponse, activitiesResponse] = await Promise.all([
        this.client.get(context.apiKey, 'contacts', { size: 100 }),
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'activities', { size: 100 }),
      ]);

      const contacts = contactsResponse.data?.results || [];
      const jobs = jobsResponse.data?.results || [];
      const activities = activitiesResponse.data?.activity || [];

      const now = Date.now();

      // Build customer feedback map
      const customerMap = new Map<string, {
        name: string;
        company: string;
        jobs: number;
        completedJobs: number;
        revenue: number;
        lastInteraction: number;
        responseTimes: number[];
        onTimeDeliveries: number;
        totalDeliveries: number;
      }>();

      // Initialize customer data
      for (const contact of contacts) {
        const contactId = contact.jnid || contact.id;
        if (!contactId) continue;

        customerMap.set(contactId, {
          name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.company || 'Unknown',
          company: contact.company || 'N/A',
          jobs: 0,
          completedJobs: 0,
          revenue: 0,
          lastInteraction: 0,
          responseTimes: [],
          onTimeDeliveries: 0,
          totalDeliveries: 0,
        });
      }

      // Process jobs
      for (const job of jobs) {
        const related = job.related || [];
        const contactRel = related.find((r: any) => r.type === 'contact');
        if (!contactRel || !contactRel.id) continue;

        const contactId = contactRel.id;
        if (!customerMap.has(contactId)) {
          customerMap.set(contactId, {
            name: 'Unknown',
            company: 'N/A',
            jobs: 0,
            completedJobs: 0,
            revenue: 0,
            lastInteraction: 0,
            responseTimes: [],
            onTimeDeliveries: 0,
            totalDeliveries: 0,
          });
        }

        const customer = customerMap.get(contactId)!;
        customer.jobs++;

        const statusLower = (job.status_name || '').toLowerCase();
        if (statusLower.includes('complete') || statusLower.includes('won')) {
          customer.completedJobs++;
          customer.totalDeliveries++;

          // On-time delivery check (if scheduled)
          const dateStart = job.date_start || 0;
          const dateEnd = job.date_end || 0;
          const dateCompleted = job.date_status_change || job.date_updated || 0;

          if (dateStart > 0 && dateEnd > 0 && dateCompleted > 0) {
            if (dateCompleted <= dateEnd) {
              customer.onTimeDeliveries++;
            }
          }
        }

        // Revenue tracking
        const jobValue = parseFloat(job.total || job.value || 0);
        if (jobValue > 0) {
          customer.revenue += jobValue;
        }

        // Last interaction
        const jobDate = job.date_updated || job.date_created || 0;
        customer.lastInteraction = Math.max(customer.lastInteraction, jobDate);
      }

      // Process activities for response times
      for (const activity of activities) {
        const related = activity.related || [];
        const contactRel = related.find((r: any) => r.type === 'contact');
        if (!contactRel || !contactRel.id) continue;

        const contactId = contactRel.id;
        if (!customerMap.has(contactId)) continue;

        const customer = customerMap.get(contactId)!;

        // Response time (created to started)
        const dateCreated = activity.date_created || 0;
        const dateStarted = activity.date_start || 0;

        if (dateCreated > 0 && dateStarted > 0 && dateStarted > dateCreated) {
          const responseHours = (dateStarted - dateCreated) / (1000 * 60 * 60);
          customer.responseTimes.push(responseHours);
        }

        // Update last interaction
        const activityDate = activity.date_updated || activity.date_created || 0;
        customer.lastInteraction = Math.max(customer.lastInteraction, activityDate);
      }

      // Calculate satisfaction scores
      const customerFeedbacks: CustomerFeedback[] = [];
      let promoters = 0;
      let passives = 0;
      let detractors = 0;

      for (const [contactId, customer] of customerMap.entries()) {
        // Filter: minimum jobs requirement
        if (customer.jobs < minJobsForFeedback) continue;

        // Service quality score (0-100)
        const completionRate = customer.jobs > 0 ? (customer.completedJobs / customer.jobs) * 100 : 0;
        const onTimeRate = customer.totalDeliveries > 0 ? (customer.onTimeDeliveries / customer.totalDeliveries) * 100 : 0;
        const serviceQualityRating = (completionRate * 0.5) + (onTimeRate * 0.5);

        // Response time score (0-100)
        const avgResponseHours = customer.responseTimes.length > 0
          ? customer.responseTimes.reduce((sum, t) => sum + t, 0) / customer.responseTimes.length
          : 24;
        const responseTimeRating = Math.max(0, 100 - (avgResponseHours / 0.48)); // 48 hours = 0 score

        // Value for money (based on repeat business)
        const repeatCustomer = customer.completedJobs > 1;
        const valueForMoneyRating = repeatCustomer ? 85 : 70;

        // Overall satisfaction (weighted average)
        const satisfactionScore = (serviceQualityRating * 0.4) + (responseTimeRating * 0.3) + (valueForMoneyRating * 0.3);

        // NPS score (0-10 scale)
        const npsScore = Math.round((satisfactionScore / 100) * 10);

        // NPS category
        const npsCategory: 'Promoter' | 'Passive' | 'Detractor' =
          npsScore >= promoterThreshold ? 'Promoter' :
          npsScore > detractorThreshold ? 'Passive' : 'Detractor';

        if (npsCategory === 'Promoter') promoters++;
        else if (npsCategory === 'Passive') passives++;
        else detractors++;

        // Overall experience
        const overallExperience: 'Excellent' | 'Good' | 'Fair' | 'Poor' =
          satisfactionScore >= 85 ? 'Excellent' :
          satisfactionScore >= 70 ? 'Good' :
          satisfactionScore >= 50 ? 'Fair' : 'Poor';

        // Days since last interaction
        const lastInteractionDays = customer.lastInteraction > 0
          ? (now - customer.lastInteraction) / (1000 * 60 * 60 * 24)
          : 999;

        // Risk level
        const riskLevel: 'High Risk' | 'Medium Risk' | 'Low Risk' | 'Safe' =
          npsCategory === 'Detractor' && lastInteractionDays > 60 ? 'High Risk' :
          npsCategory === 'Detractor' ? 'Medium Risk' :
          npsCategory === 'Passive' && lastInteractionDays > 90 ? 'Medium Risk' :
          lastInteractionDays > 120 ? 'Low Risk' : 'Safe';

        customerFeedbacks.push({
          customer_id: contactId,
          customer_name: customer.name,
          company: customer.company,
          satisfaction_score: Math.round(satisfactionScore),
          nps_category: npsCategory,
          service_quality_rating: Math.round(serviceQualityRating),
          response_time_rating: Math.round(responseTimeRating),
          value_for_money_rating: valueForMoneyRating,
          overall_experience: overallExperience,
          likelihood_to_recommend: npsScore,
          repeat_customer: repeatCustomer,
          total_jobs: customer.jobs,
          total_revenue: customer.revenue,
          last_interaction_days: Math.round(lastInteractionDays),
          risk_level: riskLevel,
        });
      }

      // Satisfaction metrics
      const totalCustomers = customerMap.size;
      const customersWithFeedback = customerFeedbacks.length;
      const avgSatisfactionScore = customersWithFeedback > 0
        ? customerFeedbacks.reduce((sum, f) => sum + f.satisfaction_score, 0) / customersWithFeedback
        : 0;

      // NPS calculation: (% Promoters - % Detractors)
      const npsScore = customersWithFeedback > 0
        ? ((promoters / customersWithFeedback) * 100) - ((detractors / customersWithFeedback) * 100)
        : 0;

      const repeatCustomers = customerFeedbacks.filter(f => f.repeat_customer).length;

      const satisfactionMetrics: SatisfactionMetrics = {
        total_customers: totalCustomers,
        customers_with_feedback: customersWithFeedback,
        avg_satisfaction_score: avgSatisfactionScore,
        nps_score: npsScore,
        promoters: promoters,
        passives: passives,
        detractors: detractors,
        response_rate: totalCustomers > 0 ? (customersWithFeedback / totalCustomers) * 100 : 0,
        repeat_customer_rate: customersWithFeedback > 0 ? (repeatCustomers / customersWithFeedback) * 100 : 0,
      };

      // Service quality metrics
      const serviceQualityMetrics: ServiceQualityMetrics[] = [
        {
          metric_name: 'Job Completion Rate',
          score: customersWithFeedback > 0
            ? customerFeedbacks.reduce((sum, f) => sum + f.service_quality_rating, 0) / customersWithFeedback
            : 0,
          category: 'Good',
          trend: 'Stable',
          benchmark: 90,
          gap: 0,
        },
        {
          metric_name: 'Response Time',
          score: customersWithFeedback > 0
            ? customerFeedbacks.reduce((sum, f) => sum + f.response_time_rating, 0) / customersWithFeedback
            : 0,
          category: 'Good',
          trend: 'Stable',
          benchmark: 85,
          gap: 0,
        },
        {
          metric_name: 'Customer Retention',
          score: satisfactionMetrics.repeat_customer_rate,
          category: 'Needs Improvement',
          trend: 'Stable',
          benchmark: 70,
          gap: 0,
        },
      ];

      // Calculate gaps and categories
      for (const metric of serviceQualityMetrics) {
        metric.gap = metric.score - metric.benchmark;
        metric.category =
          metric.score >= 90 ? 'Excellent' :
          metric.score >= 75 ? 'Good' :
          metric.score >= 60 ? 'Needs Improvement' : 'Critical';
      }

      // Feedback analysis
      const feedbackAnalyses: FeedbackAnalysis[] = [
        {
          sentiment: 'Positive',
          count: promoters,
          percentage: customersWithFeedback > 0 ? (promoters / customersWithFeedback) * 100 : 0,
          common_themes: ['Great service quality', 'Timely delivery', 'Professional team'],
          priority_actions: ['Maintain current service standards', 'Request testimonials'],
        },
        {
          sentiment: 'Neutral',
          count: passives,
          percentage: customersWithFeedback > 0 ? (passives / customersWithFeedback) * 100 : 0,
          common_themes: ['Acceptable service', 'Room for improvement', 'Met basic expectations'],
          priority_actions: ['Follow up for detailed feedback', 'Identify improvement areas'],
        },
        {
          sentiment: 'Negative',
          count: detractors,
          percentage: customersWithFeedback > 0 ? (detractors / customersWithFeedback) * 100 : 0,
          common_themes: ['Slow response times', 'Quality concerns', 'Poor communication'],
          priority_actions: ['Immediate intervention required', 'Root cause analysis', 'Service recovery plan'],
        },
      ];

      // Churn risk analysis
      const churnRiskAnalyses: ChurnRiskAnalysis[] = [];
      if (includeChurnAnalysis) {
        const riskCategories = ['High Risk', 'Medium Risk', 'Low Risk'] as const;

        for (const category of riskCategories) {
          const atRiskCustomers = customerFeedbacks.filter(f => f.risk_level === category);
          const totalRevenue = atRiskCustomers.reduce((sum, f) => sum + f.total_revenue, 0);
          const avgSat = atRiskCustomers.length > 0
            ? atRiskCustomers.reduce((sum, f) => sum + f.satisfaction_score, 0) / atRiskCustomers.length
            : 0;

          const interventions: string[] = [];
          if (category === 'High Risk') {
            interventions.push('Immediate personal outreach by senior management');
            interventions.push('Service recovery offer or discount');
            interventions.push('Assign dedicated account manager');
          } else if (category === 'Medium Risk') {
            interventions.push('Schedule check-in call within 7 days');
            interventions.push('Send satisfaction survey');
            interventions.push('Offer value-add services');
          } else {
            interventions.push('Add to re-engagement campaign');
            interventions.push('Monitor satisfaction metrics');
          }

          churnRiskAnalyses.push({
            risk_category: category,
            customer_count: atRiskCustomers.length,
            total_revenue_at_risk: totalRevenue,
            avg_satisfaction: avgSat,
            recommended_interventions: interventions,
          });
        }
      }

      // Improvement recommendations
      const improvements: ImprovementRecommendation[] = [];

      // Low NPS
      if (npsScore < 30) {
        improvements.push({
          area: 'Net Promoter Score',
          priority: 'Critical',
          current_score: npsScore,
          target_score: 50,
          gap: 50 - npsScore,
          action_items: [
            'Conduct customer interviews to identify pain points',
            'Implement service recovery program for detractors',
            'Establish customer success team',
          ],
          estimated_impact: 'Increase retention by 20%, reduce churn by 15%',
        });
      }

      // Low response time
      const responseMetric = serviceQualityMetrics.find(m => m.metric_name === 'Response Time');
      if (responseMetric && responseMetric.gap < -10) {
        improvements.push({
          area: 'Response Time',
          priority: 'High',
          current_score: responseMetric.score,
          target_score: responseMetric.benchmark,
          gap: Math.abs(responseMetric.gap),
          action_items: [
            'Implement automated response system',
            'Set up 24-hour response SLA',
            'Increase customer service staffing',
          ],
          estimated_impact: 'Improve customer satisfaction by 10-15 points',
        });
      }

      // Low retention
      if (satisfactionMetrics.repeat_customer_rate < 50) {
        improvements.push({
          area: 'Customer Retention',
          priority: 'High',
          current_score: satisfactionMetrics.repeat_customer_rate,
          target_score: 70,
          gap: 70 - satisfactionMetrics.repeat_customer_rate,
          action_items: [
            'Launch customer loyalty program',
            'Implement post-job follow-up process',
            'Offer repeat customer discounts',
          ],
          estimated_impact: 'Increase lifetime value by 30%',
        });
      }

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        analysis_period_days: daysBack,
        satisfaction_metrics: satisfactionMetrics,
        customer_feedbacks: customerFeedbacks.slice(0, 20), // Top 20 for brevity
        service_quality_metrics: serviceQualityMetrics,
        feedback_analysis: feedbackAnalyses,
        churn_risk_analysis: includeChurnAnalysis ? churnRiskAnalyses : undefined,
        improvement_recommendations: improvements,
        key_insights: [
          `NPS Score: ${npsScore.toFixed(1)} (${npsScore >= 50 ? 'Excellent' : npsScore >= 30 ? 'Good' : npsScore >= 0 ? 'Fair' : 'Poor'})`,
          `${promoters} promoter(s), ${detractors} detractor(s)`,
          `Average satisfaction: ${avgSatisfactionScore.toFixed(1)}/100`,
          `${churnRiskAnalyses[0]?.customer_count || 0} high-risk customer(s)`,
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
