/**
 * Get Users Tool - Retrieve account users/team members
 * Based on official JobNimbus API documentation
 *
 * Endpoint: GET /api1/account/users
 *
 * Note: This endpoint retrieves all users in the JobNimbus account.
 * Note: The 'id' field in the response is the user's contact JNID.
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { withCache } from '../../services/cacheService.js';
import { CACHE_PREFIXES, getTTL } from '../../config/cache.js';

interface GetUsersInput {
  // No input parameters required
}

interface User {
  first_name: string;
  last_name: string;
  image_url: string;
  id: string; // User's contact JNID
  calendar_color: string;
  email: string;
  is_active: boolean; // Whether user is active or disabled
}

interface UsersResponse {
  users: User[];
  date_updated: number; // Last time this document was updated (user added, updated, modified)
}

export class GetUsersTool extends BaseTool<GetUsersInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_users',
      description: 'Account: team members, contact JNIDs, active status, calendar colors',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    };
  }

  async execute(input: GetUsersInput, context: ToolContext): Promise<any> {
    // Wrap with cache layer
    return await withCache(
      {
        entity: CACHE_PREFIXES.ACCOUNT,
        operation: CACHE_PREFIXES.LIST,
        identifier: 'users',
      },
      getTTL('ACCOUNT_USERS'),
      async () => {
        try {
          // Call JobNimbus API
          const response = await this.client.get(
            context.apiKey,
            'account/users'
          );

          const usersData: UsersResponse = response.data;
          const users = usersData.users || [];

          // Calculate statistics
          const activeUsers = users.filter((u) => u.is_active);
          const inactiveUsers = users.filter((u) => !u.is_active);

          return {
            success: true,
            data: {
              users: users.map((user) => ({
                id: user.id, // User's contact JNID
                first_name: user.first_name,
                last_name: user.last_name,
                full_name: `${user.first_name} ${user.last_name}`,
                email: user.email,
                is_active: user.is_active,
                calendar_color: user.calendar_color,
                image_url: user.image_url || null,
              })),
              date_updated: usersData.date_updated,
              date_updated_iso: usersData.date_updated
                ? new Date(usersData.date_updated * 1000).toISOString()
                : null,
            },
            summary: {
              total_users: users.length,
              active_users: activeUsers.length,
              inactive_users: inactiveUsers.length,
              last_updated: usersData.date_updated
                ? new Date(usersData.date_updated * 1000).toISOString()
                : null,
            },
            _metadata: {
              api_endpoint: 'GET /api1/account/users',
              note: 'The "id" field is the user\'s contact JNID',
              cached: false,
              timestamp: new Date().toISOString(),
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to retrieve users',
            _metadata: {
              api_endpoint: 'GET /api1/account/users',
              timestamp: new Date().toISOString(),
            },
          };
        }
      }
    );
  }
}

export default new GetUsersTool();
