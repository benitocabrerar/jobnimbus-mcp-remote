/**
 * Create Custom Field Tool - Create new custom field in JobNimbus account
 * Based on official JobNimbus API documentation
 *
 * Endpoint: POST /api1/account/customfield
 *
 * Note: The token used must have an access profile level with access to the account settings page.
 * If a custom field with that name already exists, the API will return the existing custom field.
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface CreateCustomFieldInput {
  title: string;
  object_type: 'contact' | 'job' | 'workorder';
  type: 'date' | 'double' | 'long' | 'string' | 'boolean' | 'dropdown';
  is_required?: boolean;
  is_currency?: boolean;
  options?: string[];
}

export class CreateCustomFieldTool extends BaseTool<CreateCustomFieldInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'create_custom_field',
      description: 'Account: create custom field, data types, dropdowns, currency support',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Custom field title/UI name - Required (e.g., "Claim Number", "Project Budget")',
          },
          object_type: {
            type: 'string',
            description: 'Object type where field will appear - Required',
            enum: ['contact', 'job', 'workorder'],
          },
          type: {
            type: 'string',
            description: 'Custom field data type - Required',
            enum: ['date', 'double', 'long', 'string', 'boolean', 'dropdown'],
          },
          is_required: {
            type: 'boolean',
            description: 'Whether field is required (default: false)',
          },
          is_currency: {
            type: 'boolean',
            description: 'Whether field is currency (only valid for type=double, default: false)',
          },
          options: {
            type: 'array',
            description: 'Dropdown options (required if type=dropdown). Array of string values.',
            items: {
              type: 'string',
            },
          },
        },
        required: ['title', 'object_type', 'type'],
      },
    };
  }

  async execute(input: CreateCustomFieldInput, context: ToolContext): Promise<any> {
    try {
      // Validate dropdown type has options
      if (input.type === 'dropdown' && (!input.options || input.options.length === 0)) {
        return {
          success: false,
          error: 'Options array is required for dropdown type custom fields',
          _metadata: {
            api_endpoint: 'POST /api1/account/customfield',
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Build request body
      const requestBody: any = {
        title: input.title,
        object_type: input.object_type,
        type: input.type,
        is_required: input.is_required ?? false,
      };

      // Add is_currency only for double type
      if (input.type === 'double') {
        requestBody.is_currency = input.is_currency ?? false;
      }

      // Add options for dropdown type
      if (input.type === 'dropdown' && input.options) {
        requestBody.options = input.options;
      }

      // Call JobNimbus API
      const response = await this.client.post(
        context.apiKey,
        'account/customfield',
        requestBody
      );

      return {
        success: true,
        message: 'Custom field created successfully',
        data: response.data,
        summary: {
          title: input.title,
          field: response.data.field,
          type: input.type,
          object_type: input.object_type,
          is_required: response.data.is_required,
          is_currency: response.data.is_currency || false,
          options_count: input.options?.length || 0,
        },
        _metadata: {
          api_endpoint: 'POST /api1/account/customfield',
          note: 'If custom field already exists, returns existing field',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create custom field',
        _metadata: {
          api_endpoint: 'POST /api1/account/customfield',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export default new CreateCustomFieldTool();
