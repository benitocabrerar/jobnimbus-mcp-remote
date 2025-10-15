/**
 * Tool Registry - 73 TOOLS (2025-01-14 Phase 3 Part 1 Optimization Complete)
 *
 * REMOVED (Archived - 11 tools):
 * - AnalyzeDuplicateContactsTool, AnalyzeDuplicateJobsTool
 * - AnalyzePricingAnomaliesTool, GetPricingOptimizationTool
 * - GetCompetitiveIntelligenceTool, GetUpsellOpportunitiesTool
 * - GetSystemInfoTool, WebhookMonitoringTool, GetFileStorageAnalyticsTool
 * - GetWebhooksTool, BulkImportContactsTool, ValidateContactInformationTool
 *
 * REMOVED (Experimental - 7 tools):
 * - AnalyzePublicAdjusterPipelineTool, GetCustomerLifetimeValueTool
 * - GetSupplierComparisonTool, GetInventoryManagementAnalyticsTool
 * - GetQualityControlAnalyticsTool, GetSmartSchedulingTool
 * - GetCustomerJourneyAnalyticsTool
 *
 * REMOVED (Phase 1 Optimization - 12 tools):
 * - Quick Status Tools: get_leads, get_pending_approval, get_lost_jobs, get_in_progress,
 *   get_completed, get_paid_closed, get_estimating, get_signed_contracts, get_scheduled,
 *   get_appointments, get_invoiced, get_deposits
 * - Replaced by: search_jobs_by_status(status, limit) - single consolidated tool
 * - See: src/tools/archived/jobs/quick-status/README.md for migration guide
 *
 * REMOVED (Phase 1 Optimization Part 2 - 2 redundant tools):
 * - AnalyzeJobAttachmentsTool: Replaced by get_job_attachments_distribution
 * - SearchInsuranceJobsTool: Replaced by search_jobs_enhanced
 * - See: src/tools/archived/redundant/README.md for migration guide
 *
 * REMOVED (Phase 2 Part 1 - 10 low-value analytics tools):
 * - Communication & Conversion (5): get_communication_analytics, get_conversion_funnel_analytics,
 *   get_resource_allocation_analytics, get_customer_satisfaction_analytics, get_time_tracking_analytics
 * - Project & Operations (5): get_project_management_analytics, get_marketing_campaign_analytics,
 *   get_financial_forecasting_analytics, get_customer_segmentation_analytics, get_operational_efficiency_analytics
 * - Reason: Generic business intelligence, not construction-industry specific
 * - See: src/tools/archived/analytics/low-value/README.md for alternatives
 *
 * REMOVED (Phase 2 Part 2 - 7 territory/job analytics tools consolidated into 3):
 * - Territory Analytics (3 tools → 1): get_optimal_door_routes, get_territory_heat_maps, get_jobs_distribution
 *   → Replaced by: get_territory_analytics(analysis_type='routes'|'heatmaps'|'distribution')
 * - Door Sales (2 tools → 1): get_door_knocking_scripts_by_area, get_seasonal_door_timing
 *   → Replaced by: get_door_sales_analytics(analysis_type='scripts'|'timing')
 * - Job Analytics (2 tools → 1): get_job_summary, get_estimates_with_addresses
 *   → Replaced by: get_job_analytics(analysis_type='summary'|'estimates_geo')
 * - Kept standalone: get_activities_analytics (already comprehensive)
 * - See: src/tools/archived/analytics/territory-job/README.md for migration guide
 *
 * COMMENTED OUT (Not yet implemented - 13 tools):
 * - Payment tools (2): get_payments, create_payment
 * - Account tools (11): get_account_settings, get_users, get_uoms, create_workflow,
 *   create_status, create_lead_source, create_custom_field, create_file_type,
 *   create_task_type, create_activity_type, create_location
 *
 * 2025-01-14 ENHANCEMENT - WorkOrders API (5 tools):
 * - get_work_order: Retrieve specific work order by JNID
 * - get_work_orders: Retrieve all work orders with pagination
 * - create_work_order: Create new work order
 * - update_work_order: Update existing work order
 * - delete_work_order: Soft delete work order
 *
 * 2025-01-14 ENHANCEMENT - Budgets (Legacy):
 * - get_budgets: Retrieve budgets from legacy endpoint (GET /api1/budgets)
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
 *
 * REMOVED (Phase 3 Part 1 - 3 materials tracking tools consolidated into 1):
 * - Materials Tracking (3 tools → 1): analyze_material_costs, get_material_usage_report, get_material_inventory_insights
 *   → Replaced by: get_materials_tracking(analysis_type='costs'|'usage'|'inventory')
 * - Kept standalone: get_estimate_materials (estimate-specific analysis)
 * - See: src/tools/archived/materials/tracking/README.md for migration guide
 *
 * OPTIMIZATION PROGRESS:
 * - Phase 1 Complete: 103 → 89 tools (13.6% reduction)
 * - Phase 2 Part 1 Complete: 89 → 79 tools (11.2% additional reduction)
 * - Phase 2 Part 2 Complete: 79 → 75 tools (5.1% additional reduction)
 * - Phase 3 Part 1 Complete: 75 → 73 tools (2.7% additional reduction)
 * - Total Reduction: 103 → 73 tools (29.1% overall reduction)
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

// Consolidated status search tool (Phase 1 Optimization: 13 → 1 tool)
import { SearchJobsByStatusTool } from './jobs/searchJobsByStatus.js';

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

// Job & Territory Analytics - CONSOLIDATED (Phase 2 Part 2: 8 → 4 tools)
import { GetTerritoryAnalyticsTool } from './analytics/getTerritoryAnalytics.js';
import { GetDoorSalesAnalyticsTool } from './analytics/getDoorSalesAnalytics.js';
import { GetJobAnalyticsTool } from './analytics/getJobAnalytics.js';
import { GetActivitiesAnalyticsTool } from './analytics/getActivitiesAnalytics.js';
// ARCHIVED (Phase 2 Part 2): GetJobSummaryTool, GetOptimalDoorRoutesTool, GetTerritoryHeatMapsTool,
// GetJobsDistributionTool, GetDoorKnockingScriptsByAreaTool, GetSeasonalDoorTimingTool, GetEstimatesWithAddressesTool
// See: src/tools/archived/analytics/territory-job/README.md for migration guide

// Task & User Productivity
import { GetTaskManagementAnalyticsTool } from './analytics/getTaskManagementAnalytics.js';
import { GetUserProductivityAnalyticsTool } from './analytics/getUserProductivityAnalytics.js';
import { GetLeadScoringAnalyticsTool } from './analytics/getLeadScoringAnalytics.js';

// ARCHIVED (Phase 2 Part 1): Communication & Conversion (5 tools)
// - GetCommunicationAnalyticsTool, GetConversionFunnelAnalyticsTool,
// - GetResourceAllocationAnalyticsTool, GetCustomerSatisfactionAnalyticsTool,
// - GetTimeTrackingAnalyticsTool
// See: src/tools/archived/analytics/low-value/README.md

// ARCHIVED (Phase 2 Part 1): Project & Operations (5 tools)
// - GetProjectManagementAnalyticsTool, GetMarketingCampaignAnalyticsTool,
// - GetFinancialForecastingAnalyticsTool, GetCustomerSegmentationAnalyticsTool,
// - GetOperationalEfficiencyAnalyticsTool
// See: src/tools/archived/analytics/low-value/README.md

// Sales & Competition
import { GetSalesVelocityAnalyticsTool } from './analytics/getSalesVelocityAnalytics.js';
import { GetCompetitiveAnalysisAnalyticsTool } from './analytics/getCompetitiveAnalysisAnalytics.js';

// ===== SYSTEM TOOLS =====
import { GetUsersTool } from './users/getUsers.js';
import { GetTasksTool } from './tasks/getTasks.js';
import { GetTaskTool } from './tasks/getTask.js';
import { UpdateTaskTool } from './tasks/updateTask.js';
import { FetchByHandleTool } from './system/fetchByHandle.js';

// ===== ATTACHMENTS TOOLS =====
import { GetAttachmentsTool } from './attachments/getAttachments.js';
import { GetFileByIdTool } from './attachments/getFileById.js';
// ARCHIVED (Phase 1 Part 2): AnalyzeJobAttachmentsTool - Replaced by GetJobAttachmentsDistributionTool
import { GetJobAttachmentsDistributionTool } from './attachments/getJobAttachmentsDistribution.js';

// ===== BUSINESS INTELLIGENCE =====
// ARCHIVED (Phase 1 Part 2): SearchInsuranceJobsTool - Replaced by SearchJobsEnhancedTool

// ===== MATERIALS TOOLS =====

// Material Tracking - CONSOLIDATED (Phase 3 Part 1: 4 → 2 tools)
import { GetEstimateMaterialsTool } from './materials/getEstimateMaterials.js';
import { GetMaterialsTrackingTool } from './materials/getMaterialsTracking.js';
// ARCHIVED (Phase 3 Part 1): AnalyzeMaterialCostsTool, GetMaterialUsageReportTool, GetMaterialInventoryInsightsTool
// See: src/tools/archived/materials/tracking/README.md for migration guide

// Material Calculations
import { CalculateRoofingMaterialsTool } from './materials/calculateRoofingMaterials.js';
import { CalculateSidingMaterialsTool } from './materials/calculateSidingMaterials.js';
import { EstimateMaterialsFromJobTool } from './materials/estimateMaterialsFromJob.js';
import { CalculateWasteFactorsTool } from './materials/calculateWasteFactors.js';
import { OptimizeMaterialOrdersTool } from './materials/optimizeMaterialOrders.js';
import { GetMaterialSpecificationsTool } from './materials/getMaterialSpecifications.js';
import { CompareMaterialAlternativesTool } from './materials/compareMaterialAlternatives.js';

// ===== INVOICES & FINANCIALS =====
import { GetInvoicesTool } from './invoices/getInvoices.js';
import { GetConsolidatedFinancialsTool } from './financials/getConsolidatedFinancials.js';

// ===== BUDGETS (LEGACY) =====
import { GetBudgetsTool } from './budgets/getBudgets.js';

// ===== PRODUCTS =====
import { GetProductTool } from './products/getProduct.js';
import { GetProductsTool } from './products/getProducts.js';

// ===== MATERIAL ORDERS =====
import { GetMaterialOrderTool } from './materialorders/getMaterialOrder.js';
import { GetMaterialOrdersTool } from './materialorders/getMaterialOrders.js';
import { CreateMaterialOrderTool } from './materialorders/createMaterialOrder.js';
import { UpdateMaterialOrderTool } from './materialorders/updateMaterialOrder.js';
import { DeleteMaterialOrderTool } from './materialorders/deleteMaterialOrder.js';

// ===== WORK ORDERS =====
import { GetWorkOrderTool } from './workorders/getWorkOrder.js';
import { GetWorkOrdersTool } from './workorders/getWorkOrders.js';
import { CreateWorkOrderTool } from './workorders/createWorkOrder.js';
import { UpdateWorkOrderTool } from './workorders/updateWorkOrder.js';
import { DeleteWorkOrderTool } from './workorders/deleteWorkOrder.js';

// ===== PAYMENTS (COMMENTED OUT - Files not yet implemented) =====
// import { GetPaymentsTool } from './payments/getPayments.js';
// import { CreatePaymentTool } from './payments/createPayment.js';

// ===== ACCOUNT SETTINGS & CONFIGURATION (COMMENTED OUT - Files not yet implemented) =====
// import { GetAccountSettingsTool } from './account/getAccountSettings.js';
// import { GetUsersTool as GetAccountUsersTool } from './account/getUsers.js';
// import { GetUomsTool } from './account/getUoms.js';
// import { CreateWorkflowTool } from './account/createWorkflow.js';
// import { CreateStatusTool } from './account/createStatus.js';
// import { CreateLeadSourceTool } from './account/createLeadSource.js';
// import { CreateCustomFieldTool } from './account/createCustomField.js';
// import { CreateFileTypeTool } from './account/createFileType.js';
// import { CreateTaskTypeTool } from './account/createTaskType.js';
// import { CreateActivityTypeTool } from './account/createActivityType.js';
// import { CreateLocationTool } from './account/createLocation.js';

// Generic tool generator for remaining tools
import { createGenericTool, ALL_TOOLS_CONFIG } from './allToolsGenerator.js';

/**
 * Registry of all available tools
 */
export class ToolRegistry {
  private tools = new Map<string, BaseTool>();

  constructor() {
    // === CORE CRUD TOOLS (17 tools) === [Phase 1 Optimization: Removed 12 quick status wrappers]
    this.registerTool(new ValidateApiKeyTool());
    this.registerTool(new GetJobsTool());
    this.registerTool(new SearchJobsTool());
    this.registerTool(new SearchJobsEnhancedTool());
    this.registerTool(new GetJobTool());
    this.registerTool(new SearchJobNotesTool());
    this.registerTool(new GetJobTasksTool());

    // Consolidated Status Search (Phase 1 Optimization: 13 → 1 tool)
    this.registerTool(new SearchJobsByStatusTool());

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

    // === ANALYTICS TOOLS (21 tools) === [Phase 2 Part 2: Consolidated territory/job analytics 8 → 4]

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

    // Job & Territory - CONSOLIDATED (Phase 2 Part 2: 8 → 4 tools)
    this.registerTool(new GetTerritoryAnalyticsTool());
    this.registerTool(new GetDoorSalesAnalyticsTool());
    this.registerTool(new GetJobAnalyticsTool());
    this.registerTool(new GetActivitiesAnalyticsTool());
    // ARCHIVED: GetJobSummaryTool, GetOptimalDoorRoutesTool, GetTerritoryHeatMapsTool,
    // GetJobsDistributionTool, GetDoorKnockingScriptsByAreaTool, GetSeasonalDoorTimingTool, GetEstimatesWithAddressesTool

    // Task & User
    this.registerTool(new GetTaskManagementAnalyticsTool());
    this.registerTool(new GetUserProductivityAnalyticsTool());
    this.registerTool(new GetLeadScoringAnalyticsTool());

    // ARCHIVED (Phase 2 Part 1): Communication & Conversion (5 tools removed)
    // - GetCommunicationAnalyticsTool, GetConversionFunnelAnalyticsTool,
    // - GetResourceAllocationAnalyticsTool, GetCustomerSatisfactionAnalyticsTool,
    // - GetTimeTrackingAnalyticsTool

    // ARCHIVED (Phase 2 Part 1): Project & Operations (5 tools removed)
    // - GetProjectManagementAnalyticsTool, GetMarketingCampaignAnalyticsTool,
    // - GetFinancialForecastingAnalyticsTool, GetCustomerSegmentationAnalyticsTool,
    // - GetOperationalEfficiencyAnalyticsTool

    // Sales & Competition
    this.registerTool(new GetSalesVelocityAnalyticsTool());
    this.registerTool(new GetCompetitiveAnalysisAnalyticsTool());

    // === SYSTEM TOOLS (5 tools) ===
    this.registerTool(new GetTasksTool());
    this.registerTool(new GetTaskTool());
    this.registerTool(new UpdateTaskTool());
    this.registerTool(new GetUsersTool());
    this.registerTool(new FetchByHandleTool());

    // === ATTACHMENTS (2 tools) === [Phase 1 Part 2: Removed analyze_job_attachments - redundant]
    this.registerTool(new GetAttachmentsTool());
    this.registerTool(new GetFileByIdTool());
    // ARCHIVED: AnalyzeJobAttachmentsTool - Replaced by GetJobAttachmentsDistributionTool
    this.registerTool(new GetJobAttachmentsDistributionTool());

    // === BUSINESS INTELLIGENCE (0 tools) === [Phase 1 Part 2: Removed search_insurance_jobs - redundant]
    // ARCHIVED: SearchInsuranceJobsTool - Replaced by SearchJobsEnhancedTool

    // === MATERIALS (9 tools) === [Phase 3 Part 1: Consolidated tracking 4 → 2]

    // Material Tracking - CONSOLIDATED (Phase 3 Part 1: 4 → 2 tools)
    this.registerTool(new GetEstimateMaterialsTool());
    this.registerTool(new GetMaterialsTrackingTool());
    // ARCHIVED: AnalyzeMaterialCostsTool, GetMaterialUsageReportTool, GetMaterialInventoryInsightsTool

    // Material Calculations
    this.registerTool(new CalculateRoofingMaterialsTool());
    this.registerTool(new CalculateSidingMaterialsTool());
    this.registerTool(new EstimateMaterialsFromJobTool());
    this.registerTool(new CalculateWasteFactorsTool());
    this.registerTool(new OptimizeMaterialOrdersTool());
    this.registerTool(new GetMaterialSpecificationsTool());
    this.registerTool(new CompareMaterialAlternativesTool());

    // === INVOICES & FINANCIALS (2 tools) ===
    this.registerTool(new GetInvoicesTool());
    this.registerTool(new GetConsolidatedFinancialsTool());

    // === BUDGETS - LEGACY (1 tool) ===
    this.registerTool(new GetBudgetsTool());

    // === PRODUCTS (2 tools) ===
    this.registerTool(new GetProductTool());
    this.registerTool(new GetProductsTool());

    // === MATERIAL ORDERS (5 tools) ===
    this.registerTool(new GetMaterialOrderTool());
    this.registerTool(new GetMaterialOrdersTool());
    this.registerTool(new CreateMaterialOrderTool());
    this.registerTool(new UpdateMaterialOrderTool());
    this.registerTool(new DeleteMaterialOrderTool());

    // === WORK ORDERS (5 tools) ===
    this.registerTool(new GetWorkOrderTool());
    this.registerTool(new GetWorkOrdersTool());
    this.registerTool(new CreateWorkOrderTool());
    this.registerTool(new UpdateWorkOrderTool());
    this.registerTool(new DeleteWorkOrderTool());

    // === PAYMENTS (2 tools - COMMENTED OUT - Not yet implemented) ===
    // this.registerTool(new GetPaymentsTool());
    // this.registerTool(new CreatePaymentTool());

    // === ACCOUNT SETTINGS & CONFIGURATION (11 tools - COMMENTED OUT - Not yet implemented) ===
    // this.registerTool(new GetAccountSettingsTool());
    // this.registerTool(new GetAccountUsersTool());
    // this.registerTool(new GetUomsTool());
    // this.registerTool(new CreateWorkflowTool());
    // this.registerTool(new CreateStatusTool());
    // this.registerTool(new CreateLeadSourceTool());
    // this.registerTool(new CreateCustomFieldTool());
    // this.registerTool(new CreateFileTypeTool());
    // this.registerTool(new CreateTaskTypeTool());
    // this.registerTool(new CreateActivityTypeTool());
    // this.registerTool(new CreateLocationTool());

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

  /**
   * Search tools by query string (name or description)
   * Used for MCP search_tools introspection
   */
  searchTools(query: string): MCPToolDefinition[] {
    if (!query || query.trim() === '') {
      return this.getAllDefinitions();
    }

    const lowerQuery = query.toLowerCase();
    return Array.from(this.tools.values())
      .filter((tool) => {
        const def = tool.definition;
        return (
          def.name.toLowerCase().includes(lowerQuery) ||
          def.description.toLowerCase().includes(lowerQuery)
        );
      })
      .map((tool) => tool.definition);
  }

  /**
   * Get tools by category/prefix
   * Useful for organizing tools in MCP clients
   */
  getToolsByCategory(): Record<string, MCPToolDefinition[]> {
    const categories: Record<string, MCPToolDefinition[]> = {
      'Core CRUD': [],
      'Quick Status': [],
      'Analytics': [],
      'Materials': [],
      'Attachments': [],
      'Business Intelligence': [],
      'System': [],
      'Other': [],
    };

    Array.from(this.tools.values()).forEach((tool) => {
      const name = tool.definition.name;
      const def = tool.definition;

      // Categorize based on tool name patterns
      if (
        name.startsWith('get_') ||
        name.startsWith('search_') ||
        name.startsWith('create_') ||
        name.startsWith('update_') ||
        name.startsWith('delete_')
      ) {
        if (name.includes('job') && !name.includes('analytics')) {
          categories['Core CRUD'].push(def);
        } else if (name.includes('contact')) {
          categories['Core CRUD'].push(def);
        } else if (name.includes('estimate')) {
          categories['Core CRUD'].push(def);
        } else if (name.includes('activity') || name.includes('calendar') || name.includes('timeline')) {
          categories['Core CRUD'].push(def);
        } else if (name.includes('task') && !name.includes('analytics')) {
          categories['System'].push(def);
        } else if (name.includes('material')) {
          categories['Materials'].push(def);
        } else if (name.includes('attachment') || name.includes('file')) {
          categories['Attachments'].push(def);
        } else {
          categories['Other'].push(def);
        }
      } else if (
        name.includes('lead') ||
        name.includes('pending') ||
        name.includes('lost') ||
        name.includes('progress') ||
        name.includes('completed') ||
        name.includes('paid') ||
        name.includes('estimating') ||
        name.includes('signed') ||
        name.includes('scheduled') ||
        name.includes('appointment') ||
        name.includes('invoiced') ||
        name.includes('deposit')
      ) {
        categories['Quick Status'].push(def);
      } else if (
        name.includes('analyze') ||
        name.includes('analytics') ||
        name.includes('performance') ||
        name.includes('report') ||
        name.includes('dashboard') ||
        name.includes('forecasting') ||
        name.includes('pipeline') ||
        name.includes('territory') ||
        name.includes('optimization')
      ) {
        categories['Analytics'].push(def);
      } else if (name.includes('insurance')) {
        categories['Business Intelligence'].push(def);
      } else if (name.includes('validate')) {
        categories['System'].push(def);
      } else {
        categories['Other'].push(def);
      }
    });

    return categories;
  }

  /**
   * Get all tool names (for quick lookup)
   */
  getAllToolNames(): string[] {
    return Array.from(this.tools.keys()).sort();
  }
}

export default new ToolRegistry();
