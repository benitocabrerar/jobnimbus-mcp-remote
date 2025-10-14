/**
 * Get Activity Tool - Get specific activity by JNID
 * Based on official JobNimbus API documentation
 *
 * Endpoint: GET /api1/activities/<jnid>
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetActivityInput {
  jnid: string;
}

interface ActivityLocation {
  id: number;
  parent_id?: number | null;
  name?: string;
}

interface ActivityPrimary {
  new_status?: number;
  id: string;
  name?: string;
  type?: string;
  number?: string;
  email?: string | null;
  subject?: string | null;
}

interface ActivityOwner {
  id: string;
}

interface ActivityRelated {
  id: string;
  type?: string;
  name?: string;
  number?: string;
}

/**
 * Complete Activity interface matching JobNimbus API
 * Based on official JobNimbus API documentation
 */
interface Activity {
  // Core identifiers
  jnid: string;
  type: string;
  customer?: string;

  // Location
  location: ActivityLocation;

  // Primary entity (what the activity is about)
  primary?: ActivityPrimary;

  // Status
  is_active: boolean;
  is_archived: boolean;
  is_editable: boolean;
  is_status_change?: boolean;

  // Content
  note?: string;
  record_type_name?: string;

  // Relationships
  owners: ActivityOwner[];
  related: ActivityRelated[];

  // Metadata
  created_by: string;
  created_by_name: string;
  date_created: number;
  date_updated: number;

  // Scheduling (for scheduled activities)
  date_start?: number;
  date_end?: number;
  all_day?: boolean;

  // Additional fields
  title?: string;
  description?: string;
  priority?: number;
  record_type?: number;
  status?: number;
  status_name?: string;

  // Allow additional fields from API
  [key: string]: any;
}

export class GetActivityTool extends BaseTool<GetActivityInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_activity',
      description: 'Retrieve a specific activity by JNID from JobNimbus. Returns complete activity information including type, note, primary entity, related entities, ownership, status, scheduling dates, and metadata. Use this to get detailed information about a specific activity, task, or note.',
      inputSchema: {
        type: 'object',
        properties: {
          jnid: {
            type: 'string',
            description: 'Activity JNID (unique identifier) - Required',
          },
        },
        required: ['jnid'],
      },
    };
  }

  /**
   * Format Unix timestamp to ISO 8601
   */
  private formatDate(timestamp: number): string | null {
    if (!timestamp || timestamp === 0) return null;
    return new Date(timestamp * 1000).toISOString();
  }

  async execute(input: GetActivityInput, context: ToolContext): Promise<any> {
    // Wrap with cache layer
    return await withCache(
      {
        entity: CACHE_PREFIXES.ACTIVITIES,
        operation: CACHE_PREFIXES.GET,
        identifier: input.jnid,
      },
      getTTL('ACTIVITY_DETAIL'),
      async () => {
        try {
          // Call JobNimbus API
          const response = await this.client.get(
            context.apiKey,
            `activities/${input.jnid}`
          );

          const activity: Activity = response.data;

          // Format response with all fields explicitly mapped
          return {
            success: true,
            data: {
              // Core identifiers
              jnid: activity.jnid,
              type: activity.type,
              customer: activity.customer || null,

              // Primary entity
              primary: activity.primary || null,
              primary_id: activity.primary?.id || null,
              primary_name: activity.primary?.name || null,
              primary_type: activity.primary?.type || null,
              primary_number: activity.primary?.number || null,
              primary_new_status: activity.primary?.new_status || null,

              // Content
              note: activity.note || null,
              title: activity.title || null,
              description: activity.description || null,
              record_type: activity.record_type || null,
              record_type_name: activity.record_type_name || null,

              // Status
              is_active: activity.is_active ?? true,
              is_archived: activity.is_archived ?? false,
              is_editable: activity.is_editable ?? true,
              is_status_change: activity.is_status_change ?? false,
              status: activity.status || null,
              status_name: activity.status_name || null,
              priority: activity.priority || null,

              // Location
              location: activity.location,

              // Relationships
              owners: activity.owners || [],
              owners_count: activity.owners?.length || 0,
              related: activity.related || [],
              related_count: activity.related?.length || 0,

              // Scheduling
              date_start: this.formatDate(activity.date_start || 0),
              date_start_unix: activity.date_start || null,
              date_end: this.formatDate(activity.date_end || 0),
              date_end_unix: activity.date_end || null,
              all_day: activity.all_day ?? false,

              // Metadata
              created_by: activity.created_by,
              created_by_name: activity.created_by_name,
              date_created: this.formatDate(activity.date_created),
              date_created_unix: activity.date_created,
              date_updated: this.formatDate(activity.date_updated),
              date_updated_unix: activity.date_updated,

              _metadata: {
                api_endpoint: 'GET /api1/activities/<jnid>',
                field_coverage: 'complete',
                cached: false,
                timestamp: new Date().toISOString(),
              },
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to retrieve activity',
            jnid: input.jnid,
            _metadata: {
              api_endpoint: 'GET /api1/activities/<jnid>',
              timestamp: new Date().toISOString(),
            },
          };
        }
      }
    );
  }
}

export default new GetActivityTool();
