/**
 * Tool Registry - 97 TOOLS (2025-01-15 Enhancement: Added complete Estimates API coverage)
 *
 * REMOVED (Archived - 11 tools):
 * - AnalyzeDuplicateContactsTool, AnalyzeDuplicateJobsTool
 * - AnalyzePricingAnomaliesTool, GetPricingOptimizationTool
 * - GetCompetitiveIntelligenceTool, GetUpsellOpportunitiesTool
 * - GetSystemInfoTool, GetWebhookMonitoringTool, GetFileStorageAnalyticsTool
 * - GetWebhooksTool, BulkImportContactsTool, ValidateContactInformationTool
 *
 * REMOVED (Experimental - 7 tools):
 * - AnalyzePublicAdjusterPipelineTool, GetCustomerLifetimeValueTool
 * - GetSupplierComparisonTool, GetInventoryManagementAnalyticsTool
 * - GetQualityControlAnalyticsTool, GetSmartSchedulingTool
 * - GetCustomerJourneyAnalyticsTool
 *
 * 2025-01-14 ENHANCEMENT - Task Management Tools:
 * - get_task: Retrieve specific task by JNID with full details
 * - update_task: Update or soft-delete tasks with 17+ parameters
 * - get_tasks: ENHANCED with 9 filters + cache integration
 *
 * Previous verified changes:
 * - get_invoices: VERIFIED WORKING (new endpoint)
 * - get_attachments: Uses /files endpoint (documents/orders don't exist)
 * - get_file_by_id: NEW tool for GET /files/<jnid>
 */

import { BaseTool } from './baseTool.js';
import { MCPToolDefinition } from '../types/index.js';

// ===== CORE CRUD TOOLS =====
import { GetJobsTool } from './jobs/getJobs.js';
import { SearchJobsTool } from './jobs/searchJobs.js';
import { SearchJobsEnhancedTool } from './jobs/searchJobsEnhanced.js';
import { GetJobTool } from './jobs/getJob.js';
import { SearchJobNotesTool } from './jobs/searchJobNotes.js';
import { GetJobTasksTool } from './jobs/getJobTasks.js';

// Quick status search tools (13 tools)
import { SearchJobsByStatusTool } from './jobs/searchJobsByStatus.js';
import {
  GetLeadsTool,
  GetPendingApprovalTool,
  GetLostJobsTool,
  GetInProgressTool,
  GetCompletedTool,
  GetPaidClosedTool,
  GetEstimatingTool,
  GetSignedContractsTool,
  GetScheduledTool,
  GetAppointmentsTool,
  GetInvoicedTool,
  GetDepositsTool,
} from './jobs/quickStatusTools.js';

import { GetContactsTool } from './contacts/getContacts.js';
import { GetContactTool } from './contacts/getContact.js';
import { SearchContactsTool } from './contacts/searchContacts.js';
import { CreateContactTool } from './contacts/createContact.js';
import { GetEstimatesTool } from './estimates/getEstimates.js';
import { GetEstimateTool } from './estimates/getEstimate.js';
import { CreateEstimateTool } from './estimates/createEstimate.js';
import { UpdateEstimateTool } from './estimates/updateEstimate.js';
import { DeleteEstimateTool } from './estimates/deleteEstimate.js';
import { GetActivitiesTool } from './activities/getActivities.js';
import { GetActivityTool } from './activities/getActivity.js';
import { CreateActivityTool } from './activities/createActivity.js';
import { GetCalendarActivities } from './activities/getCalendarActivities.js';
import { GetTimelineData } from './activities/getTimelineData.js';
import { ValidateApiKeyTool } from './system/validateApiKey.js';

// ===== ANALYTICS TOOLS =====

// Insurance & Retail Pipeline
import { AnalyzeInsurancePipelineTool } from './analytics/analyzeInsurancePipeline.js';
import { AnalyzeRetailPipelineTool } from './analytics/analyzeRetailPipeline.js';
import { AnalyzeServicesRepairPipelineTool } from './analytics/analyzeServicesRepairPipeline.js';

// Financial Analytics
import { GetSalesRepPerformanceTool } from './analytics/getSalesRepPerformance.js';
import { GetPerformanceMetricsTool } from './analytics/getPerformanceMetrics.js';
import { GetAutomatedFollowupTool } from './analytics/getAutomatedFollowup.js';
import { GetRevenueReportTool } from './analytics/getRevenueReport.js';
import { GetMarginAnalysisTool } from './analytics/getMarginAnalysis.js';
import { AnalyzeRevenueLeakageTool } from './analytics/analyzeRevenueLeakage.js';
import { GetProfitabilityDashboardTool } from './analytics/getProfitabilityDashboard.js';

// Performance & Forecasting
import { GetSeasonalTrendsTool } from './analytics/getSeasonalTrends.js';
import { GetPipelineForecastingTool } from './analytics/getPipelineForecasting.js';

// Job & Territory Analytics
import { GetJobSummaryTool } from './analytics/getJobSummary.js';
import { GetOptimalDoorRoutesTool } from './analytics/getOptimalDoorRoutes.js';
import { GetTerritoryHeatMapsTool } from './analytics/getTerritoryHeatMaps.js';
import { GetActivitiesAnalyticsTool } from './analytics/getActivitiesAnalytics.js';
import { GetJobsDistributionTool } from './analytics/getJobsDistribution.js';
import { GetDoorKnockingScriptsByAreaTool } from './analytics/getDoorKnockingScriptsByArea.js';
import { GetSeasonalDoorTimingTool } from './analytics/getSeasonalDoorTiming.js';
import { GetEstimatesWithAddressesTool } from './analytics/getEstimatesWithAddresses.js';

// Task & User Productivity
import { GetTaskManagementAnalyticsTool } from './analytics/getTaskManagementAnalytics.js';
import { GetUserProductivityAnalyticsTool } from './analytics/getUserProductivityAnalytics.js';
import { GetLeadScoringAnalyticsTool } from './analytics/getLeadScoringAnalytics.js';

// Communication & Conversion
import { GetCommunicationAnalyticsTool } from './analytics/getCommunicationAnalytics.js';
import { GetConversionFunnelAnalyticsTool } from './analytics/getConversionFunnelAnalytics.js';
import { GetResourceAllocationAnalyticsTool } from './analytics/getResourceAllocationAnalytics.js';
import { GetCustomerSatisfactionAnalyticsTool } from './analytics/getCustomerSatisfactionAnalytics.js';
import { GetTimeTrackingAnalyticsTool } from './analytics/getTimeTrackingAnalytics.js';

// Project & Operations
import { GetProjectManagementAnalyticsTool } from './analytics/getProjectManagementAnalytics.js';
import { GetMarketingCampaignAnalyticsTool } from './analytics/getMarketingCampaignAnalytics.js';
import { GetFinancialForecastingAnalyticsTool } from './analytics/getFinancialForecastingAnalytics.js';
import { GetCustomerSegmentationAnalyticsTool } from './analytics/getCustomerSegmentationAnalytics.js';
import { GetOperationalEfficiencyAnalyticsTool } from './analytics/getOperationalEfficiencyAnalytics.js';

// Sales & Competition
import { GetSalesVelocityAnalyticsTool } from './analytics/getSalesVelocityAnalytics.js';
import { GetCompetitiveAnalysisAnalyticsTool } from './analytics/getCompetitiveAnalysisAnalytics.js';

// ===== SYSTEM TOOLS =====
import { GetUsersTool } from './users/getUsers.js';
import { GetTasksTool } from './tasks/getTasks.js';
import { GetTaskTool } from './tasks/getTask.js';
import { UpdateTaskTool } from './tasks/updateTask.js';

// ===== ATTACHMENTS TOOLS =====
import { GetAttachmentsTool } from './attachments/getAttachments.js';
import { GetFileByIdTool } from './attachments/getFileById.js';
import { AnalyzeJobAttachmentsTool } from './attachments/analyzeJobAttachments.js';
import { GetJobAttachmentsDistributionTool } from './attachments/getJobAttachmentsDistribution.js';

// ===== BUSINESS INTELLIGENCE =====
import { SearchInsuranceJobsTool } from './business/searchInsuranceJobs.js';

// ===== MATERIALS TOOLS =====

// Material Tracking
import { GetEstimateMaterialsTool } from './materials/getEstimateMaterials.js';
import { AnalyzeMaterialCostsTool } from './materials/analyzeMaterialCosts.js';
import { GetMaterialUsageReportTool } from './materials/getMaterialUsageReport.js';
import { GetMaterialInventoryInsightsTool } from './materials/getMaterialInventoryInsights.js';

// Material Calculations
import { CalculateRoofingMaterialsTool } from './materials/calculateRoofingMaterials.js';
import { CalculateSidingMaterialsTool } from './materials/calculateSidingMaterials.js';
import { EstimateMaterialsFromJobTool } from './materials/estimateMaterialsFromJob.js';
import { CalculateWasteFactorsTool } from './materials/calculateWasteFactors.js';
import { OptimizeMaterialOrdersTool } from './materials/optimizeMaterialOrders.js';
import { GetMaterialSpecificationsTool } from './materials/getMaterialSpecifications.js';
import { CompareMaterialAlternativesTool } from './materials/compareMaterialAlternatives.js';

// ===== INVOICES =====
import { GetInvoicesTool } from './invoices/getInvoices.js';

// ===== PRODUCTS =====
import { GetProductTool } from './products/getProduct.js';
import { GetProductsTool } from './products/getProducts.js';

// ===== MATERIAL ORDERS =====
import { GetMaterialOrderTool } from './materialorders/getMaterialOrder.js';
import { GetMaterialOrdersTool } from './materialorders/getMaterialOrders.js';
import { CreateMaterialOrderTool } from './materialorders/createMaterialOrder.js';
import { UpdateMaterialOrderTool } from './materialorders/updateMaterialOrder.js';
import { DeleteMaterialOrderTool } from './materialorders/deleteMaterialOrder.js';

// Generic tool generator for remaining tools
import { createGenericTool, ALL_TOOLS_CONFIG } from './allToolsGenerator.js';

/**
 * Registry of all available tools
 */
export class ToolRegistry {
  private tools = new Map<string, BaseTool>();

  constructor() {
    // === CORE CRUD TOOLS (29 tools) === [Updated: +4 Estimates tools]
    this.registerTool(new ValidateApiKeyTool());
    this.registerTool(new GetJobsTool());
    this.registerTool(new SearchJobsTool());
    this.registerTool(new SearchJobsEnhancedTool());
    this.registerTool(new GetJobTool());
    this.registerTool(new SearchJobNotesTool());
    this.registerTool(new GetJobTasksTool());

    // Quick Status Tools (13 tools)
    this.registerTool(new SearchJobsByStatusTool());
    this.registerTool(new GetLeadsTool());
    this.registerTool(new GetPendingApprovalTool());
    this.registerTool(new GetLostJobsTool());
    this.registerTool(new GetInProgressTool());
    this.registerTool(new GetCompletedTool());
    this.registerTool(new GetPaidClosedTool());
    this.registerTool(new GetEstimatingTool());
    this.registerTool(new GetSignedContractsTool());
    this.registerTool(new GetScheduledTool());
    this.registerTool(new GetAppointmentsTool());
    this.registerTool(new GetInvoicedTool());
    this.registerTool(new GetDepositsTool());

    // Contacts, Estimates, Activities
    this.registerTool(new GetContactsTool());
    this.registerTool(new GetContactTool());
    this.registerTool(new SearchContactsTool());
    this.registerTool(new CreateContactTool());

    // Estimates (5 tools - Complete CRUD coverage)
    this.registerTool(new GetEstimatesTool());
    this.registerTool(new GetEstimateTool());
    this.registerTool(new CreateEstimateTool());
    this.registerTool(new UpdateEstimateTool());
    this.registerTool(new DeleteEstimateTool());

    this.registerTool(new GetActivitiesTool());
    this.registerTool(new GetActivityTool());
    this.registerTool(new CreateActivityTool());
    this.registerTool(new GetCalendarActivities());
    this.registerTool(new GetTimelineData());

    // === ANALYTICS TOOLS (35 tools) ===

    // Insurance & Retail
    this.registerTool(new AnalyzeInsurancePipelineTool());
    this.registerTool(new AnalyzeRetailPipelineTool());
    this.registerTool(new AnalyzeServicesRepairPipelineTool());

    // Financial
    this.registerTool(new GetSalesRepPerformanceTool());
    this.registerTool(new GetPerformanceMetricsTool());
    this.registerTool(new GetAutomatedFollowupTool());
    this.registerTool(new GetRevenueReportTool());
    this.registerTool(new GetMarginAnalysisTool());
    this.registerTool(new AnalyzeRevenueLeakageTool());
    this.registerTool(new GetProfitabilityDashboardTool());

    // Performance & Forecasting
    this.registerTool(new GetSeasonalTrendsTool());
    this.registerTool(new GetPipelineForecastingTool());

    // Job & Territory
    this.registerTool(new GetJobSummaryTool());
    this.registerTool(new GetOptimalDoorRoutesTool());
    this.registerTool(new GetTerritoryHeatMapsTool());
    this.registerTool(new GetActivitiesAnalyticsTool());
    this.registerTool(new GetJobsDistributionTool());
    this.registerTool(new GetDoorKnockingScriptsByAreaTool());
    this.registerTool(new GetSeasonalDoorTimingTool());
    this.registerTool(new GetEstimatesWithAddressesTool());

    // Task & User
    this.registerTool(new GetTaskManagementAnalyticsTool());
    this.registerTool(new GetUserProductivityAnalyticsTool());
    this.registerTool(new GetLeadScoringAnalyticsTool());

    // Communication & Conversion
    this.registerTool(new GetCommunicationAnalyticsTool());
    this.registerTool(new GetConversionFunnelAnalyticsTool());
    this.registerTool(new GetResourceAllocationAnalyticsTool());
    this.registerTool(new GetCustomerSatisfactionAnalyticsTool());
    this.registerTool(new GetTimeTrackingAnalyticsTool());

    // Project & Operations
    this.registerTool(new GetProjectManagementAnalyticsTool());
    this.registerTool(new GetMarketingCampaignAnalyticsTool());
    this.registerTool(new GetFinancialForecastingAnalyticsTool());
    this.registerTool(new GetCustomerSegmentationAnalyticsTool());
    this.registerTool(new GetOperationalEfficiencyAnalyticsTool());

    // Sales & Competition
    this.registerTool(new GetSalesVelocityAnalyticsTool());
    this.registerTool(new GetCompetitiveAnalysisAnalyticsTool());

    // === SYSTEM TOOLS (4 tools) ===
    this.registerTool(new GetTasksTool());
    this.registerTool(new GetTaskTool());
    this.registerTool(new UpdateTaskTool());
    this.registerTool(new GetUsersTool());

    // === ATTACHMENTS (4 tools) ===
    this.registerTool(new GetAttachmentsTool());
    this.registerTool(new GetFileByIdTool());
    this.registerTool(new AnalyzeJobAttachmentsTool());
    this.registerTool(new GetJobAttachmentsDistributionTool());

    // === BUSINESS INTELLIGENCE (1 tool) ===
    this.registerTool(new SearchInsuranceJobsTool());

    // === MATERIALS (11 tools) ===

    // Material Tracking
    this.registerTool(new GetEstimateMaterialsTool());
    this.registerTool(new AnalyzeMaterialCostsTool());
    this.registerTool(new GetMaterialUsageReportTool());
    this.registerTool(new GetMaterialInventoryInsightsTool());

    // Material Calculations
    this.registerTool(new CalculateRoofingMaterialsTool());
    this.registerTool(new CalculateSidingMaterialsTool());
    this.registerTool(new EstimateMaterialsFromJobTool());
    this.registerTool(new CalculateWasteFactorsTool());
    this.registerTool(new OptimizeMaterialOrdersTool());
    this.registerTool(new GetMaterialSpecificationsTool());
    this.registerTool(new CompareMaterialAlternativesTool());

    // === INVOICES (1 tool) ===
    this.registerTool(new GetInvoicesTool());

    // === PRODUCTS (2 tools) ===
    this.registerTool(new GetProductTool());
    this.registerTool(new GetProductsTool());

    // === MATERIAL ORDERS (5 tools) ===
    this.registerTool(new GetMaterialOrderTool());
    this.registerTool(new GetMaterialOrdersTool());
    this.registerTool(new CreateMaterialOrderTool());
    this.registerTool(new UpdateMaterialOrderTool());
    this.registerTool(new DeleteMaterialOrderTool());

    // === GENERIC TOOLS ===
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
