/**
 * Fetch By Handle Tool
 *
 * Retrieves stored response data using a handle.
 * Handles are generated when responses exceed 25 KB threshold.
 *
 * Usage:
 * ```
 * const result = await fetchByHandle({
 *   handle: "jn:jobs:1729012345:abc12345",
 *   fields: "jnid,number,status",
 *   verbosity: "detailed"
 * });
 * ```
 *
 * @author Backend Architecture Team
 * @version 1.0.0
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext, BaseToolInput } from '../../types/index.js';
import { handleStorage } from '../../services/handleStorage.js';
import { ResponseBuilder } from '../../utils/responseBuilder.js';
import { formatSize } from '../../config/response.js';

interface FetchByHandleInput extends BaseToolInput {
  handle: string;
}

export class FetchByHandleTool extends BaseTool<FetchByHandleInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'fetch_by_handle',
      description: 'System: retrieve stored responses, handle expiration, field selection',
      inputSchema: {
        type: 'object',
        properties: {
          handle: {
            type: 'string',
            description: 'Handle string from a previous tool response (format: jn:entity:timestamp:hash)',
          },
          fields: {
            type: 'string',
            description: 'Optional: Comma-separated field names to include (e.g., "jnid,number,status")',
          },
          verbosity: {
            type: 'string',
            description: 'Optional: Verbosity level (summary, compact, detailed, raw). Default: compact',
            enum: ['summary', 'compact', 'detailed', 'raw'],
          },
        },
        required: ['handle'],
      },
    };
  }

  async execute(input: FetchByHandleInput, context: ToolContext): Promise<any> {
    // Validate handle format
    if (!input.handle || !input.handle.startsWith('jn:')) {
      return {
        success: false,
        error: 'Invalid handle format',
        message: 'Handle must start with "jn:" and follow format: jn:entity:timestamp:hash',
        provided: input.handle,
      };
    }

    // Retrieve from storage
    const stored = await handleStorage.retrieve(input.handle);

    if (!stored) {
      return {
        success: false,
        error: 'Handle not found or expired',
        message: 'The requested handle does not exist or has expired (15 minute TTL)',
        handle: input.handle,
        suggestion: 'Re-run the original query to get a new handle',
      };
    }

    // Extract data and metadata
    const { data, metadata } = stored;

    // Calculate age
    const now = Date.now();
    const ageSeconds = Math.floor((now - metadata.created_at) / 1000);
    const expiresIn = Math.floor((metadata.expires_at - now) / 1000);

    // Apply field selection if requested
    let resultData = data;
    if (input.fields) {
      resultData = ResponseBuilder.selectFields(data, input.fields.split(','));
    }

    // Apply verbosity if requested
    if (input.verbosity && input.verbosity !== metadata.verbosity) {
      const maxFields = input.verbosity === 'summary' ? 5 :
                        input.verbosity === 'compact' ? 15 :
                        input.verbosity === 'detailed' ? 50 : Infinity;

      resultData = ResponseBuilder.applyVerbosity(resultData, input.verbosity, maxFields);
    }

    // Return with metadata
    return {
      success: true,
      data: resultData,
      handle_metadata: {
        handle: input.handle,
        tool_name: metadata.tool_name,
        instance: metadata.instance,
        original_verbosity: metadata.verbosity,
        applied_verbosity: input.verbosity || metadata.verbosity,
        size: formatSize(metadata.size_bytes),
        age_seconds: ageSeconds,
        expires_in_seconds: Math.max(0, expiresIn),
        created_at: new Date(metadata.created_at).toISOString(),
        expires_at: new Date(metadata.expires_at).toISOString(),
        field_selection_applied: !!input.fields,
        selected_fields: input.fields ? input.fields.split(',') : undefined,
      },
      _note: expiresIn < 300 ? 'Handle expires in less than 5 minutes' : undefined,
    };
  }
}

export default new FetchByHandleTool();
