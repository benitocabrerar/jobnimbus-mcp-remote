/**
 * Tool Registry - ALL 58 TOOLS
 */

import { BaseTool } from './baseTool.js';
import { MCPToolDefinition } from '../types/index.js';

// Basic tools
import { GetJobsTool } from './jobs/getJobs.js';
import { SearchJobsTool } from './jobs/searchJobs.js';
import { GetJobTool } from './jobs/getJob.js';
import { GetContactsTool } from './contacts/getContacts.js';
import { SearchContactsTool } from './contacts/searchContacts.js';
import { CreateContactTool } from './contacts/createContact.js';
import { GetEstimatesTool } from './estimates/getEstimates.js';
import { GetActivitiesTool } from './activities/getActivities.js';
import { CreateActivityTool } from './activities/createActivity.js';
import { GetCalendarActivities } from './activities/getCalendarActivities.js';
import { GetTimelineData } from './activities/getTimelineData.js';
import { GetSystemInfoTool } from './system/getSystemInfo.js';
import { ValidateApiKeyTool } from './system/validateApiKey.js';

// Analytics tools - Comprehensive implementations
import { AnalyzeInsurancePipelineTool } from './analytics/analyzeInsurancePipeline.js';
import { AnalyzeRetailPipelineTool } from './analytics/analyzeRetailPipeline.js';
import { GetSalesRepPerformanceTool } from './analytics/getSalesRepPerformance.js';
import { GetPerformanceMetricsTool } from './analytics/getPerformanceMetrics.js';
import { GetAutomatedFollowupTool } from './analytics/getAutomatedFollowup.js';
import { GetRevenueReportTool } from './analytics/getRevenueReport.js';
import { GetMarginAnalysisTool } from './analytics/getMarginAnalysis.js';
import { AnalyzeRevenueLeakageTool } from './analytics/analyzeRevenueLeakage.js';
import { GetCustomerLifetimeValueTool } from './analytics/getCustomerLifetimeValue.js';
import { GetProfitabilityDashboardTool } from './analytics/getProfitabilityDashboard.js';
import {
  AnalyzeDuplicateContactsTool,
  AnalyzeDuplicateJobsTool,
  AnalyzePricingAnomaliesTool,
  GetPricingOptimizationTool,
  GetCompetitiveIntelligenceTool,
  GetUpsellOpportunitiesTool,
} from './analytics/batchAnalyticsTools.js';

// Comprehensive analytics tools (Batch 1 - 5 tools)
import { AnalyzeServicesRepairPipelineTool } from './analytics/analyzeServicesRepairPipeline.js';
import { AnalyzePublicAdjusterPipelineTool } from './analytics/analyzePublicAdjusterPipeline.js';
import { GetSeasonalTrendsTool } from './analytics/getSeasonalTrends.js';
import { GetPipelineForecastingTool } from './analytics/getPipelineForecasting.js';
import { GetSmartSchedulingTool } from './analytics/getSmartScheduling.js';

// Comprehensive analytics tools (Batch 2 - 5 tools)
import { GetJobSummaryTool } from './analytics/getJobSummary.js';
import { GetOptimalDoorRoutesTool } from './analytics/getOptimalDoorRoutes.js';
import { GetTerritoryHeatMapsTool } from './analytics/getTerritoryHeatMaps.js';
import { GetActivitiesAnalyticsTool } from './analytics/getActivitiesAnalytics.js';
import { BulkImportContactsTool } from './analytics/getBulkImportContacts.js';

// Comprehensive analytics tools (Batch 3 - 5 tools)
import { GetJobsDistributionTool } from './analytics/getJobsDistribution.js';
import { GetDoorKnockingScriptsByAreaTool } from './analytics/getDoorKnockingScriptsByArea.js';
import { GetSeasonalDoorTimingTool } from './analytics/getSeasonalDoorTiming.js';
import { GetEstimatesWithAddressesTool } from './analytics/getEstimatesWithAddresses.js';
import { ValidateContactInformationTool } from './analytics/validateContactInformation.js';

// Comprehensive analytics tools (Batch 4 - 5 tools)
import { GetTaskManagementAnalyticsTool } from './analytics/getTaskManagementAnalytics.js';
import { GetUserProductivityAnalyticsTool } from './analytics/getUserProductivityAnalytics.js';
import { GetWebhookMonitoringTool } from './analytics/getWebhookMonitoring.js';
import { GetFileStorageAnalyticsTool } from './analytics/getFileStorageAnalytics.js';
import { GetLeadScoringAnalyticsTool } from './analytics/getLeadScoringAnalytics.js';

// Comprehensive analytics tools (Batch 5 - 5 tools)
import { GetCommunicationAnalyticsTool } from './analytics/getCommunicationAnalytics.js';
import { GetConversionFunnelAnalyticsTool } from './analytics/getConversionFunnelAnalytics.js';
import { GetResourceAllocationAnalyticsTool } from './analytics/getResourceAllocationAnalytics.js';
import { GetCustomerSatisfactionAnalyticsTool } from './analytics/getCustomerSatisfactionAnalytics.js';
import { GetTimeTrackingAnalyticsTool } from './analytics/getTimeTrackingAnalytics.js';

// Comprehensive analytics tools (Batch 6 - 5 tools)
import { GetProjectManagementAnalyticsTool } from './analytics/getProjectManagementAnalytics.js';
import { GetMarketingCampaignAnalyticsTool } from './analytics/getMarketingCampaignAnalytics.js';
import { GetFinancialForecastingAnalyticsTool } from './analytics/getFinancialForecastingAnalytics.js';
import { GetCustomerSegmentationAnalyticsTool } from './analytics/getCustomerSegmentationAnalytics.js';
import { GetOperationalEfficiencyAnalyticsTool } from './analytics/getOperationalEfficiencyAnalytics.js';

// Comprehensive analytics tools (Batch 7 - 5 tools)
import { GetSalesVelocityAnalyticsTool } from './analytics/getSalesVelocityAnalytics.js';
import { GetCompetitiveAnalysisAnalyticsTool } from './analytics/getCompetitiveAnalysisAnalytics.js';
import { GetCustomerJourneyAnalyticsTool } from './analytics/getCustomerJourneyAnalytics.js';
import { GetInventoryManagementAnalyticsTool } from './analytics/getInventoryManagementAnalytics.js';
import { GetQualityControlAnalyticsTool } from './analytics/getQualityControlAnalytics.js';

import {
  GetTasksTool,
  GetUsersTool,
  GetWebhooksTool,
  GetTimelineDataTool2,
  GetCalendarActivitiesTool2,
} from './analytics/simplifiedBatchTools.js';

// Attachments tools
import { GetAttachmentsTool } from './attachments/getAttachments.js';
import { AnalyzeJobAttachmentsTool } from './attachments/analyzeJobAttachments.js';

// Generic tool generator for remaining tools
import { createGenericTool, ALL_TOOLS_CONFIG } from './allToolsGenerator.js';

/**
 * Registry of all available tools
 */
export class ToolRegistry {
  private tools = new Map<string, BaseTool>();

  constructor() {
    // Register manually implemented tools
    this.registerTool(new GetSystemInfoTool());
    this.registerTool(new ValidateApiKeyTool());
    this.registerTool(new GetJobsTool());
    this.registerTool(new SearchJobsTool());
    this.registerTool(new GetJobTool());
    this.registerTool(new GetContactsTool());
    this.registerTool(new SearchContactsTool());
    this.registerTool(new CreateContactTool());
    this.registerTool(new GetEstimatesTool());
    this.registerTool(new GetActivitiesTool());
    this.registerTool(new CreateActivityTool());
    this.registerTool(new GetCalendarActivities());
    this.registerTool(new GetTimelineData());
    this.registerTool(new AnalyzeInsurancePipelineTool());
    this.registerTool(new AnalyzeRetailPipelineTool());
    this.registerTool(new GetSalesRepPerformanceTool());
    this.registerTool(new GetPerformanceMetricsTool());
    this.registerTool(new GetAutomatedFollowupTool());
    this.registerTool(new GetRevenueReportTool());
    this.registerTool(new GetMarginAnalysisTool());
    this.registerTool(new AnalyzeRevenueLeakageTool());
    this.registerTool(new GetCustomerLifetimeValueTool());
    this.registerTool(new GetProfitabilityDashboardTool());
    this.registerTool(new AnalyzeDuplicateContactsTool());
    this.registerTool(new AnalyzeDuplicateJobsTool());
    this.registerTool(new AnalyzePricingAnomaliesTool());
    this.registerTool(new GetPricingOptimizationTool());
    this.registerTool(new GetCompetitiveIntelligenceTool());
    this.registerTool(new GetUpsellOpportunitiesTool());

    // Register comprehensive analytics tools (Batches 1-4)
    this.registerTool(new AnalyzeServicesRepairPipelineTool());
    this.registerTool(new AnalyzePublicAdjusterPipelineTool());
    this.registerTool(new GetSeasonalTrendsTool());
    this.registerTool(new GetPipelineForecastingTool());
    this.registerTool(new GetSmartSchedulingTool());
    this.registerTool(new GetJobSummaryTool());
    this.registerTool(new GetOptimalDoorRoutesTool());
    this.registerTool(new GetTerritoryHeatMapsTool());
    this.registerTool(new GetActivitiesAnalyticsTool());
    this.registerTool(new BulkImportContactsTool());
    this.registerTool(new GetJobsDistributionTool());
    this.registerTool(new GetDoorKnockingScriptsByAreaTool());
    this.registerTool(new GetSeasonalDoorTimingTool());
    this.registerTool(new GetEstimatesWithAddressesTool());
    this.registerTool(new ValidateContactInformationTool());
    this.registerTool(new GetTaskManagementAnalyticsTool());
    this.registerTool(new GetUserProductivityAnalyticsTool());
    this.registerTool(new GetWebhookMonitoringTool());
    this.registerTool(new GetFileStorageAnalyticsTool());
    this.registerTool(new GetLeadScoringAnalyticsTool());
    this.registerTool(new GetCommunicationAnalyticsTool());
    this.registerTool(new GetConversionFunnelAnalyticsTool());
    this.registerTool(new GetResourceAllocationAnalyticsTool());
    this.registerTool(new GetCustomerSatisfactionAnalyticsTool());
    this.registerTool(new GetTimeTrackingAnalyticsTool());
    this.registerTool(new GetProjectManagementAnalyticsTool());
    this.registerTool(new GetMarketingCampaignAnalyticsTool());
    this.registerTool(new GetFinancialForecastingAnalyticsTool());
    this.registerTool(new GetCustomerSegmentationAnalyticsTool());
    this.registerTool(new GetOperationalEfficiencyAnalyticsTool());
    this.registerTool(new GetSalesVelocityAnalyticsTool());
    this.registerTool(new GetCompetitiveAnalysisAnalyticsTool());
    this.registerTool(new GetCustomerJourneyAnalyticsTool());
    this.registerTool(new GetInventoryManagementAnalyticsTool());
    this.registerTool(new GetQualityControlAnalyticsTool());

    // Register remaining simplified tools
    this.registerTool(new GetTasksTool());
    this.registerTool(new GetUsersTool());
    this.registerTool(new GetWebhooksTool());
    this.registerTool(new GetAttachmentsTool());
    this.registerTool(new GetTimelineDataTool2());
    this.registerTool(new GetCalendarActivitiesTool2());

    // Register attachment analysis tools
    this.registerTool(new AnalyzeJobAttachmentsTool());

    // Register all generic tools
    for (const config of ALL_TOOLS_CONFIG) {
      const ToolClass = createGenericTool(config);
      this.registerTool(new ToolClass());
    }
  }

  /**
   * Register a tool
   */
  private registerTool(tool: BaseTool): void {
    this.tools.set(tool.definition.name, tool);
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tool definitions
   */
  getAllDefinitions(): MCPToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => tool.definition);
  }

  /**
   * Check if tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get tool count
   */
  getToolCount(): number {
    return this.tools.size;
  }
}

export default new ToolRegistry();
