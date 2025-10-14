/**
 * Batch Analytics Tools - 6 herramientas con lógica completa
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

// Similarity function
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1.0;
  const editDist = editDistance(longer, shorter);
  return (longer.length - editDist) / parseFloat(String(longer.length));
}

function editDistance(s1: string, s2: string): number {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j;
      else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1))
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

// 1. ANALYZE DUPLICATE CONTACTS
export class AnalyzeDuplicateContactsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'analyze_duplicate_contacts',
      description: 'Identify and analyze duplicate contacts',
      inputSchema: { type: 'object', properties: {} },
    };
  }

  async execute(_input: any, context: ToolContext): Promise<any> {
    const response = await this.client.get(context.apiKey, 'contacts', { size: 100 });
    const contacts = response.data?.results || [];

    const duplicates: any[] = [];
    const checked = new Set<string>();

    for (let i = 0; i < contacts.length; i++) {
      if (checked.has(contacts[i].jnid)) continue;

      const group: any[] = [contacts[i]];
      for (let j = i + 1; j < contacts.length; j++) {
        if (checked.has(contacts[j].jnid)) continue;

        const name1 = (contacts[i].display_name || contacts[i].first_name || '').toLowerCase();
        const name2 = (contacts[j].display_name || contacts[j].first_name || '').toLowerCase();
        const email1 = (contacts[i].email || '').toLowerCase();
        const email2 = (contacts[j].email || '').toLowerCase();
        const phone1 = (contacts[i].phone || '').replace(/\D/g, '');
        const phone2 = (contacts[j].phone || '').replace(/\D/g, '');

        if ((email1 && email1 === email2) ||
            (phone1 && phone1 === phone2) ||
            (name1 && name2 && calculateSimilarity(name1, name2) > 0.85)) {
          group.push(contacts[j]);
          checked.add(contacts[j].jnid);
        }
      }

      if (group.length > 1) {
        duplicates.push({
          match_type: 'name/email/phone',
          count: group.length,
          contacts: group.map(c => ({ id: c.jnid, name: c.display_name || c.first_name })),
        });
        checked.add(contacts[i].jnid);
      }
    }

    return {
      total_contacts: contacts.length,
      duplicate_groups: duplicates.length,
      total_duplicates: duplicates.reduce((sum, d) => sum + d.count, 0),
      duplicates: duplicates.slice(0, 20),
      recommendations: [
        `Merge ${duplicates.length} duplicate groups`,
        'Set up automatic duplicate detection',
      ],
    };
  }
}

// 2. ANALYZE DUPLICATE JOBS
export class AnalyzeDuplicateJobsTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'analyze_duplicate_jobs',
      description: 'Identify and analyze duplicate jobs',
      inputSchema: { type: 'object', properties: {} },
    };
  }

  async execute(_input: any, context: ToolContext): Promise<any> {
    const response = await this.client.get(context.apiKey, 'jobs', { size: 100 });
    const jobs = response.data?.results || [];

    const duplicates: any[] = [];
    const checked = new Set<string>();

    for (let i = 0; i < jobs.length; i++) {
      if (checked.has(jobs[i].jnid)) continue;

      const group: any[] = [jobs[i]];
      const addr1 = (jobs[i].address_line1 || '').toLowerCase();

      for (let j = i + 1; j < jobs.length; j++) {
        if (checked.has(jobs[j].jnid)) continue;

        const addr2 = (jobs[j].address_line1 || '').toLowerCase();

        if (addr1 && addr1 === addr2) {
          group.push(jobs[j]);
          checked.add(jobs[j].jnid);
        }
      }

      if (group.length > 1) {
        duplicates.push({
          match_type: 'address',
          count: group.length,
          jobs: group.map(j => ({ id: j.jnid, number: j.number })),
        });
        checked.add(jobs[i].jnid);
      }
    }

    return {
      total_jobs: jobs.length,
      duplicate_groups: duplicates.length,
      duplicates: duplicates.slice(0, 15),
    };
  }
}

// 3-6. PRICING & INTEL TOOLS
export class AnalyzePricingAnomaliesTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'analyze_pricing_anomalies',
      description: 'Detect pricing anomalies',
      inputSchema: { type: 'object', properties: {} },
    };
  }

  async execute(_input: any, context: ToolContext): Promise<any> {
    const response = await this.client.get(context.apiKey, 'estimates', { size: 100 });
    const values = (response.data?.results || [])
      .map((e: any) => parseFloat(e.total || 0))
      .filter((v: number) => v > 0);

    if (values.length === 0) {
      return { anomalies: [] };
    }

    const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum: number, val: number) => sum + Math.pow(val - avg, 2), 0) / values.length
    );

    const anomalies = values.filter((v: number) => Math.abs(v - avg) > 2 * stdDev);

    return {
      total_estimates: values.length,
      average_value: avg,
      anomalies_detected: anomalies.length,
      anomalies: anomalies.slice(0, 10),
    };
  }
}

export class GetPricingOptimizationTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_pricing_optimization',
      description: 'Pricing optimization recommendations',
      inputSchema: { type: 'object', properties: {} },
    };
  }

  async execute(_input: any, context: ToolContext): Promise<any> {
    const response = await this.client.get(context.apiKey, 'estimates', { size: 100 });
    const values = (response.data?.results || [])
      .map((e: any) => parseFloat(e.total || 0))
      .filter((v: number) => v > 0)
      .sort((a: number, b: number) => a - b);

    const p50 = values[Math.floor(values.length * 0.5)] || 0;
    const p75 = values[Math.floor(values.length * 0.75)] || 0;

    return {
      pricing_tiers: {
        budget: `$0 - $${p50.toFixed(0)}`,
        premium: `$${p75.toFixed(0)}+`,
      },
      recommendations: [`50% of deals under $${p50.toFixed(0)}`],
    };
  }
}

export class GetCompetitiveIntelligenceTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_competitive_intelligence',
      description: 'Competitive analysis',
      inputSchema: { type: 'object', properties: {} },
    };
  }

  async execute(_input: any, context: ToolContext): Promise<any> {
    const response = await this.client.get(context.apiKey, 'jobs', { size: 100 });
    const lost = (response.data?.results || []).filter((j: any) =>
      (j.status_name || '').toLowerCase().includes('lost')
    );

    return {
      total_lost_jobs: lost.length,
      insights: [`${lost.length} jobs lost`],
    };
  }
}

export class GetUpsellOpportunitiesTool extends BaseTool<any, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_upsell_opportunities',
      description: 'Identify upselling opportunities',
      inputSchema: { type: 'object', properties: {} },
    };
  }

  async execute(_input: any, context: ToolContext): Promise<any> {
    const response = await this.client.get(context.apiKey, 'jobs', { size: 100 });
    const completed = (response.data?.results || []).filter((j: any) =>
      (j.status_name || '').toLowerCase().includes('complete')
    );

    return {
      total_opportunities: completed.length,
      estimated_value: completed.length * 2500,
    };
  }
}
