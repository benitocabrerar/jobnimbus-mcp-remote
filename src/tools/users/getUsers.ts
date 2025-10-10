/**
 * Get Users Tool
 * Retrieve system users/team members from JobNimbus
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { compactUser, compactArray } from '../../utils/compactData.js';

interface GetUsersInput {
  from?: number;
  size?: number;
  include_full_details?: boolean;
}

interface User {
  jnid?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  [key: string]: any;
}

export class GetUsersTool extends BaseTool<GetUsersInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_users',
      description: 'Get system users and permissions from JobNimbus',
      inputSchema: {
        type: 'object',
        properties: {
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
          },
          size: {
            type: 'number',
            description: 'Number of records to retrieve (default: 50, max: 100)',
          },
          include_full_details: {
            type: 'boolean',
            description: 'Return full user details. Default: false (compact mode with only essential fields). Set to true for complete user objects.',
          },
        },
      },
    };
  }

  async execute(input: GetUsersInput, context: ToolContext): Promise<any> {
    const fromIndex = input.from || 0;
    const requestedSize = Math.min(input.size || 50, 100);

    // Fetch users from JobNimbus API
    const params: any = {
      from: fromIndex,
      size: requestedSize,
    };

    const result = await this.client.get(context.apiKey, 'users', params);
    const users: User[] = result.data?.results || result.data || [];

    // Apply compaction if not requesting full details
    const resultUsers = input.include_full_details
      ? users
      : compactArray(users, compactUser);

    return {
      count: users.length,
      from: fromIndex,
      size: requestedSize,
      has_more: users.length === requestedSize,
      compact_mode: !input.include_full_details,
      results: resultUsers,
    };
  }
}
