/**
 * Auto-generate all remaining tools
 * This creates simple pass-through tools for all JobNimbus MCP functionality
 */

import { BaseTool } from './baseTool.js';
import { MCPToolDefinition, ToolContext } from '../types/index.js';

/**
 * Generic Tool Factory
 * Creates tools dynamically based on configuration
 */
export function createGenericTool(config: {
  name: string;
  description: string;
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  inputSchema?: any;
}): any {
  return class extends BaseTool<any, any> {
    get definition(): MCPToolDefinition {
      return {
        name: config.name,
        description: config.description,
        inputSchema: config.inputSchema || {
          type: 'object',
          properties: {},
        },
      };
    }

    async execute(input: any, context: ToolContext): Promise<any> {
      const endpoint = config.endpoint || config.name.replace(/_/g, '/');
      const method = config.method || 'GET';

      if (method === 'GET') {
        const result = await this.client.get(context.apiKey, endpoint, input);
        return result.data;
      } else if (method === 'POST') {
        const result = await this.client.post(context.apiKey, endpoint, input);
        return result.data;
      }

      return { success: false, error: 'Method not supported' };
    }
  };
}

/**
 * All tool definitions
 */
export const ALL_TOOLS_CONFIG = [
  // Analytics
  {
    name: 'analyze_services_repair_pipeline',
    description: 'AI-powered Services & Repair pipeline optimization',
    inputSchema: {
      type: 'object',
      properties: {
        time_window_days: { type: 'number' },
        analysis_depth: { type: 'string' },
      },
    },
  },
  {
    name: 'analyze_public_adjuster_pipeline',
    description: 'AI-powered Public Adjuster pipeline optimization',
    inputSchema: {
      type: 'object',
      properties: {
        time_window_days: { type: 'number' },
        analysis_depth: { type: 'string' },
      },
    },
  },
  {
    name: 'analyze_duplicate_contacts',
    description: 'Identify and analyze duplicate contacts',
  },
  {
    name: 'analyze_duplicate_jobs',
    description: 'Identify and analyze duplicate jobs',
  },
  {
    name: 'analyze_pricing_anomalies',
    description: 'Detect pricing anomalies and inconsistencies',
  },
  {
    name: 'analyze_revenue_leakage',
    description: 'Identify potential revenue leakage points',
  },

  // Performance & Revenue
  {
    name: 'get_sales_rep_performance',
    description: 'Detailed performance analytics per sales representative',
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', description: 'Analysis period' },
      },
    },
  },
  {
    name: 'get_revenue_report',
    description: 'Comprehensive revenue reporting and analysis',
  },
  {
    name: 'get_margin_analysis',
    description: 'Profit margin analysis by job type and sales rep',
  },
  {
    name: 'get_pricing_optimization',
    description: 'Pricing optimization recommendations',
  },
  {
    name: 'get_profitability_dashboard',
    description: 'Real-time profitability and KPI dashboard',
    inputSchema: {
      type: 'object',
      properties: {
        dashboard_type: { type: 'string', enum: ['executive', 'operational', 'detailed'] },
      },
    },
  },
  {
    name: 'get_performance_metrics',
    description: 'Comprehensive performance metrics dashboard',
  },

  // Advanced Analytics
  {
    name: 'get_activities_analytics',
    description: 'Enhanced activity analysis',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Days to analyze' },
      },
    },
  },
  {
    name: 'get_competitive_intelligence',
    description: 'Competitive analysis and market insights',
  },
  {
    name: 'get_customer_lifetime_value',
    description: 'Calculate customer lifetime value metrics',
  },
  {
    name: 'get_upsell_opportunities',
    description: 'Identify upselling opportunities',
  },
  {
    name: 'get_job_summary',
    description: 'Detailed job summary analytics',
  },
  {
    name: 'get_jobs_distribution',
    description: 'Geographic distribution analysis of jobs',
  },

  // Door-to-Door & Territory
  {
    name: 'get_optimal_door_routes',
    description: 'Calculate optimal door-to-door sales routes',
    inputSchema: {
      type: 'object',
      properties: {
        territory: { type: 'string', description: 'Territory to analyze' },
      },
    },
  },
  {
    name: 'get_territory_heat_maps',
    description: 'Generate territory heat maps for sales optimization',
  },
  {
    name: 'get_door_knocking_scripts_by_area',
    description: 'Get customized door knocking scripts by area',
    inputSchema: {
      type: 'object',
      properties: {
        area: { type: 'string', description: 'Area to get scripts for' },
      },
    },
  },
  {
    name: 'get_seasonal_door_timing',
    description: 'Optimal timing for door-to-door sales by season',
  },

  // Forecasting & Planning
  {
    name: 'get_seasonal_trends',
    description: 'Seasonal demand patterns and planning recommendations',
    inputSchema: {
      type: 'object',
      properties: {
        years_to_analyze: { type: 'number' },
        include_forecasts: { type: 'boolean' },
      },
    },
  },
  {
    name: 'get_pipeline_forecasting',
    description: 'Predict quarterly revenue and conversion rates',
    inputSchema: {
      type: 'object',
      properties: {
        forecast_months: { type: 'number' },
      },
    },
  },

  // Automation
  {
    name: 'get_automated_followup',
    description: 'Smart follow-up scheduling and automation',
    inputSchema: {
      type: 'object',
      properties: {
        priority_level: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    },
  },
  {
    name: 'get_smart_scheduling',
    description: 'AI-powered appointment optimization',
    inputSchema: {
      type: 'object',
      properties: {
        time_window: { type: 'number', description: 'Days to optimize within' },
      },
    },
  },

  // Data & Utilities
  {
    name: 'get_estimates_with_addresses',
    description: 'Estimates with geographic address data',
  },
  {
    name: 'get_timeline_data',
    description: 'Timeline data for project scheduling',
  },
  {
    name: 'get_calendar_activities',
    description: 'Get calendar activities and scheduling',
  },
  {
    name: 'get_tasks',
    description: 'Retrieve tasks from JobNimbus',
  },
  {
    name: 'get_users',
    description: 'Get system users and permissions',
  },
  {
    name: 'get_webhooks',
    description: 'Get webhook configurations',
  },
  {
    name: 'get_attachments',
    description: 'Get file attachments and documents',
  },

  // Contacts & Validation
  {
    name: 'validate_contact_information',
    description: 'Comprehensive contact validation',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'Contact ID to validate' },
      },
      required: ['contact_id'],
    },
  },
  {
    name: 'bulk_import_contacts',
    description: 'Import multiple contacts efficiently',
    method: 'POST' as const,
    inputSchema: {
      type: 'object',
      properties: {
        contacts: { type: 'array', description: 'Array of contact objects' },
        validate_duplicates: { type: 'boolean' },
      },
      required: ['contacts'],
    },
  },
];
