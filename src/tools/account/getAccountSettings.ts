/**
 * Get Account Settings Tool - Retrieve account configuration
 * Based on official JobNimbus API documentation
 *
 * Endpoint: GET /api1/account/settings
 *
 * Note: This endpoint retrieves comprehensive account configuration including:
 * - Workflows (contacts, jobs, workorders with statuses)
 * - File types (attachment categories)
 * - Task types
 * - Activity types
 * - Lead sources
 * - Custom fields
 * - And more account-wide settings
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetAccountSettingsInput {
  field?: string;
}

interface WorkflowStatus {
  id: number;
  name: string;
  is_lead: boolean;
  is_closed: boolean;
  is_active: boolean;
  is_archived: boolean;
  send_to_quickbooks: boolean;
  force_mobile_sync: boolean;
  order: number;
  profile_ids: number[];
}

interface Workflow {
  id: number;
  order: number;
  object_type: string;
  name: string;
  is_sub_contractor: boolean;
  is_supplier: boolean;
  is_active: boolean;
  can_access_by_all: boolean;
  is_vendor: boolean;
  icon: string | null;
  status: WorkflowStatus[];
}

interface FileType {
  FileTypeId: number;
  TypeName: string;
  IsActive: boolean;
}

interface TaskType {
  TaskTypeId: number;
  TypeName: string;
  DefaultName: string;
  Icon: string;
  HideFromTaskList: boolean;
  HideFromCalendarView: boolean;
  IsActive: boolean;
}

interface ActivityType {
  ActivityTypeId: number;
  TypeName: string;
  ShowInJobShare: boolean;
  IsActive: boolean;
}

interface LeadSource {
  JobSourceId: number;
  SourceName: string;
  IsActive: boolean;
}

interface AccountSettings {
  workflows?: Workflow[];
  fileTypes?: FileType[];
  taskTypes?: TaskType[];
  activityTypes?: ActivityType[];
  sources?: LeadSource[];
  [key: string]: any;
}

export class GetAccountSettingsTool extends BaseTool<GetAccountSettingsInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_account_settings',
      description: 'Account: configuration, workflows, file types, activity/task types',
      inputSchema: {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            description: 'Optional: Retrieve specific field from settings (e.g., "groups", "workflows", "fileTypes", "taskTypes", "activityTypes", "sources"). If omitted, returns all settings.',
          },
        },
      },
    };
  }

  async execute(input: GetAccountSettingsInput, context: ToolContext): Promise<any> {
    const field = input.field || 'all';

    // Build cache key
    const cacheKey = field;

    // Wrap with cache layer
    return await withCache(
      {
        entity: CACHE_PREFIXES.ACCOUNT,
        operation: CACHE_PREFIXES.GET,
        identifier: cacheKey,
      },
      getTTL('ACCOUNT_SETTINGS'),
      async () => {
        try {
          // Build endpoint with optional field parameter
          const endpoint = input.field
            ? `account/settings?field=${input.field}`
            : 'account/settings';

          // Call JobNimbus API
          const response = await this.client.get(
            context.apiKey,
            endpoint
          );

          const settings: AccountSettings = response.data;

          // Build structured response
          const structuredResponse: any = {
            success: true,
            data: settings,
            summary: {},
            _metadata: {
              api_endpoint: `GET /api1/${endpoint}`,
              field_requested: input.field || 'all',
              cached: false,
              timestamp: new Date().toISOString(),
            },
          };

          // Add summary statistics based on what's in the response
          if (settings.workflows && Array.isArray(settings.workflows)) {
            structuredResponse.summary.workflows_count = settings.workflows.length;
            structuredResponse.summary.total_statuses = settings.workflows.reduce(
              (sum, w) => sum + (w.status?.length || 0),
              0
            );
          }

          if (settings.fileTypes && Array.isArray(settings.fileTypes)) {
            structuredResponse.summary.file_types_count = settings.fileTypes.length;
            structuredResponse.summary.active_file_types = settings.fileTypes.filter(
              (ft) => ft.IsActive
            ).length;
          }

          if (settings.taskTypes && Array.isArray(settings.taskTypes)) {
            structuredResponse.summary.task_types_count = settings.taskTypes.length;
            structuredResponse.summary.active_task_types = settings.taskTypes.filter(
              (tt) => tt.IsActive
            ).length;
          }

          if (settings.activityTypes && Array.isArray(settings.activityTypes)) {
            structuredResponse.summary.activity_types_count = settings.activityTypes.length;
            structuredResponse.summary.active_activity_types = settings.activityTypes.filter(
              (at) => at.IsActive
            ).length;
          }

          if (settings.sources && Array.isArray(settings.sources)) {
            structuredResponse.summary.lead_sources_count = settings.sources.length;
            structuredResponse.summary.active_lead_sources = settings.sources.filter(
              (s) => s.IsActive
            ).length;
          }

          return structuredResponse;
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to retrieve account settings',
            _metadata: {
              api_endpoint: 'GET /api1/account/settings',
              timestamp: new Date().toISOString(),
            },
          };
        }
      }
    );
  }
}

export default new GetAccountSettingsTool();
