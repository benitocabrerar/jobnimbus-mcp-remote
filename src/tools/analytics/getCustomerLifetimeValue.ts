/**
 * Get Customer Lifetime Value - Calculate CLV metrics
 * Analyzes repeat business, customer retention, and long-term value
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface CustomerCLV {
  customer_id: string;
  customer_name: string;
  total_jobs: number;
  total_revenue: number;
  avg_deal_size: number;
  first_job_date: string;
  last_job_date: string;
  customer_tenure_days: number;
  repeat_customer: boolean;
  clv_score: number;
  clv_tier: 'Diamond' | 'Platinum' | 'Gold' | 'Silver' | 'Bronze';
  estimated_lifetime_value: number;
  next_purchase_probability: number;
}

export class GetCustomerLifetimeValueTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_customer_lifetime_value',
      description: 'Calculate customer lifetime value metrics',
      inputSchema: {
        type: 'object',
        properties: {
          min_jobs: {
            type: 'number',
            default: 1,
            description: 'Minimum jobs to include customer',
          },
          tier_focus: {
            type: 'string',
            enum: ['all', 'high_value', 'repeat_customers'],
            default: 'all',
            description: 'Focus on specific customer segment',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    try {
      const minJobs = input.min_jobs || 1;
      const tierFocus = input.tier_focus || 'all';

      // Fetch data
      const [jobsResponse, estimatesResponse, contactsResponse] = await Promise.all([
        this.client.get(context.apiKey, 'jobs', { size: 100 }),
        this.client.get(context.apiKey, 'estimates', { size: 100 }),
        this.client.get(context.apiKey, 'contacts', { size: 100 }),
      ]);

      const jobs = jobsResponse.data?.results || [];
      const estimates = estimatesResponse.data?.results || [];
      const contacts = contactsResponse.data?.results || [];

      // Build contact lookup
      const contactLookup = new Map<string, any>();
      for (const contact of contacts) {
        if (contact.jnid) {
          contactLookup.set(contact.jnid, contact);
        }
      }

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

      // Analyze CLV by customer
      const customerData = new Map<string, {
        name: string;
        jobs: any[];
        revenue: number;
        firstJobDate: number;
        lastJobDate: number;
      }>();

      for (const job of jobs) {
        if (!job.jnid) continue;

        // Get primary contact
        const primaryContact = job.primary_contact || job.related?.find((r: any) => r.type === 'contact')?.id;
        if (!primaryContact) continue;

        const contactInfo = contactLookup.get(primaryContact);
        const customerName = contactInfo?.display_name || contactInfo?.first_name || 'Unknown Customer';

        // Calculate job revenue
        const jobEstimates = estimatesByJob.get(job.jnid) || [];
        let jobRevenue = 0;

        for (const estimate of jobEstimates) {
          const statusName = (estimate.status_name || '').toLowerCase();
          const isSigned = estimate.date_signed > 0;
          const isApproved = isSigned || statusName === 'approved' || statusName === 'signed';

          if (isApproved) {
            jobRevenue += parseFloat(estimate.total || 0) || 0;
          }
        }

        if (jobRevenue === 0) continue;

        // Track customer data
        if (!customerData.has(primaryContact)) {
          customerData.set(primaryContact, {
            name: customerName,
            jobs: [],
            revenue: 0,
            firstJobDate: job.date_created || 0,
            lastJobDate: job.date_created || 0,
          });
        }

        const customer = customerData.get(primaryContact)!;
        customer.jobs.push(job);
        customer.revenue += jobRevenue;
        customer.firstJobDate = Math.min(customer.firstJobDate, job.date_created || 0);
        customer.lastJobDate = Math.max(customer.lastJobDate, job.date_created || 0);
      }

      // Calculate CLV metrics
      const now = Date.now();
      const customerCLVs: CustomerCLV[] = [];
      let totalRevenue = 0;
      let totalCustomers = 0;

      for (const [customerId, data] of customerData.entries()) {
        if (data.jobs.length < minJobs) continue;

        const totalJobs = data.jobs.length;
        const avgDealSize = data.revenue / totalJobs;
        const tenureDays = Math.floor((data.lastJobDate - data.firstJobDate) / (1000 * 60 * 60 * 24));
        const isRepeat = totalJobs > 1;

        // Calculate CLV score (0-100)
        let clvScore = 0;
        clvScore += Math.min(data.revenue / 1000, 50); // Revenue component (max 50 points)
        clvScore += Math.min(totalJobs * 10, 30); // Repeat business (max 30 points)
        clvScore += Math.min(tenureDays / 30, 20); // Tenure (max 20 points)

        // Determine tier
        let tier: 'Diamond' | 'Platinum' | 'Gold' | 'Silver' | 'Bronze';
        if (clvScore >= 80) tier = 'Diamond';
        else if (clvScore >= 60) tier = 'Platinum';
        else if (clvScore >= 40) tier = 'Gold';
        else if (clvScore >= 20) tier = 'Silver';
        else tier = 'Bronze';

        // Estimate lifetime value (projected)
        const monthlyRate = tenureDays > 30 ? (totalJobs / (tenureDays / 30)) : totalJobs;
        const estimatedLifetimeValue = avgDealSize * monthlyRate * 24; // 2-year projection

        // Next purchase probability
        const daysSinceLastJob = Math.floor((now - data.lastJobDate) / (1000 * 60 * 60 * 24));
        let nextPurchaseProbability = 0;
        if (isRepeat) {
          if (daysSinceLastJob < 90) nextPurchaseProbability = 0.7;
          else if (daysSinceLastJob < 180) nextPurchaseProbability = 0.5;
          else if (daysSinceLastJob < 365) nextPurchaseProbability = 0.3;
          else nextPurchaseProbability = 0.1;
        } else {
          if (daysSinceLastJob < 90) nextPurchaseProbability = 0.4;
          else if (daysSinceLastJob < 180) nextPurchaseProbability = 0.2;
          else nextPurchaseProbability = 0.1;
        }

        // Filter by tier focus
        if (tierFocus === 'high_value' && (tier === 'Bronze' || tier === 'Silver')) continue;
        if (tierFocus === 'repeat_customers' && !isRepeat) continue;

        customerCLVs.push({
          customer_id: customerId,
          customer_name: data.name,
          total_jobs: totalJobs,
          total_revenue: data.revenue,
          avg_deal_size: avgDealSize,
          first_job_date: new Date(data.firstJobDate).toISOString(),
          last_job_date: new Date(data.lastJobDate).toISOString(),
          customer_tenure_days: tenureDays,
          repeat_customer: isRepeat,
          clv_score: Math.round(clvScore),
          clv_tier: tier,
          estimated_lifetime_value: estimatedLifetimeValue,
          next_purchase_probability: nextPurchaseProbability,
        });

        totalRevenue += data.revenue;
        totalCustomers += 1;
      }

      // Sort by CLV score
      customerCLVs.sort((a, b) => b.clv_score - a.clv_score);

      // Calculate summary stats
      const repeatCustomers = customerCLVs.filter(c => c.repeat_customer).length;
      const avgCLV = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;
      const tierCounts = {
        Diamond: customerCLVs.filter(c => c.clv_tier === 'Diamond').length,
        Platinum: customerCLVs.filter(c => c.clv_tier === 'Platinum').length,
        Gold: customerCLVs.filter(c => c.clv_tier === 'Gold').length,
        Silver: customerCLVs.filter(c => c.clv_tier === 'Silver').length,
        Bronze: customerCLVs.filter(c => c.clv_tier === 'Bronze').length,
      };

      return {
        data_source: 'Live JobNimbus API data',
        analysis_timestamp: new Date().toISOString(),
        filters: {
          min_jobs: minJobs,
          tier_focus: tierFocus,
        },
        summary: {
          total_customers: totalCustomers,
          repeat_customers: repeatCustomers,
          repeat_rate: totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0,
          total_lifetime_value: totalRevenue,
          average_clv: avgCLV,
          tier_distribution: tierCounts,
        },
        top_customers: customerCLVs.slice(0, 20),
        insights: this.generateInsights(customerCLVs, repeatCustomers, totalCustomers),
        retention_strategies: this.generateRetentionStrategies(customerCLVs, tierCounts),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'Failed',
      };
    }
  }

  private generateInsights(customers: CustomerCLV[], repeatCount: number, totalCount: number): string[] {
    const insights: string[] = [];

    // Top performers
    if (customers.length > 0) {
      const top = customers[0];
      insights.push(
        `Top customer: ${top.customer_name} with CLV score of ${top.clv_score} ($${top.total_revenue.toFixed(2)} from ${top.total_jobs} jobs)`
      );
    }

    // Repeat rate
    const repeatRate = totalCount > 0 ? (repeatCount / totalCount) * 100 : 0;
    insights.push(
      `${repeatRate.toFixed(1)}% of customers are repeat clients (${repeatCount}/${totalCount})`
    );

    // High-value customers
    const highValue = customers.filter(c => c.clv_tier === 'Diamond' || c.clv_tier === 'Platinum');
    if (highValue.length > 0) {
      const highValueRevenue = highValue.reduce((sum, c) => sum + c.total_revenue, 0);
      const totalRevenue = customers.reduce((sum, c) => sum + c.total_revenue, 0);
      const percentage = totalRevenue > 0 ? (highValueRevenue / totalRevenue) * 100 : 0;
      insights.push(
        `Top-tier customers (${highValue.length}) generate ${percentage.toFixed(1)}% of total revenue`
      );
    }

    // At-risk customers
    const atRisk = customers.filter(c => c.next_purchase_probability < 0.3 && c.repeat_customer);
    if (atRisk.length > 0) {
      insights.push(
        `${atRisk.length} repeat customers at risk of churn (low next-purchase probability)`
      );
    }

    return insights;
  }

  private generateRetentionStrategies(customers: CustomerCLV[], tierCounts: any): string[] {
    const strategies: string[] = [];

    // Diamond/Platinum retention
    if (tierCounts.Diamond + tierCounts.Platinum > 0) {
      strategies.push(
        `VIP Program: Create exclusive benefits for ${tierCounts.Diamond + tierCounts.Platinum} top-tier customers`
      );
    }

    // Re-engagement
    const inactive = customers.filter(c => c.next_purchase_probability < 0.3).length;
    if (inactive > 0) {
      strategies.push(
        `Re-engagement Campaign: Target ${inactive} inactive customers with special offers`
      );
    }

    // Repeat customer growth
    const singleBuyers = customers.filter(c => !c.repeat_customer).length;
    if (singleBuyers > 0) {
      strategies.push(
        `Convert Single Buyers: Implement follow-up program for ${singleBuyers} one-time customers`
      );
    }

    // Tier upgrading
    if (tierCounts.Silver + tierCounts.Bronze > 0) {
      strategies.push(
        `Tier Upgrade: Develop growth strategies to move ${tierCounts.Silver + tierCounts.Bronze} lower-tier customers up`
      );
    }

    // Loyalty program
    const repeatCustomers = customers.filter(c => c.repeat_customer).length;
    if (repeatCustomers > 10) {
      strategies.push(
        `Loyalty Rewards: Launch referral program for ${repeatCustomers} repeat customers`
      );
    }

    return strategies;
  }
}
