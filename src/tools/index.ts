/**
 * Tool Registry - ALL 48 TOOLS
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

// Analytics tools
import { AnalyzeInsurancePipelineTool } from './analytics/analyzeInsurancePipeline.js';
import { AnalyzeRetailPipelineTool } from './analytics/analyzeRetailPipeline.js';

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
