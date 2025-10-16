/**
 * Create Location Tool - Create new location in multi-location account
 * Based on official JobNimbus API documentation
 *
 * Endpoint: POST /api1/account/location
 *
 * Note: The token used must have an access profile level with access to the account settings page.
 * If location with that name already exists, the API will return the existing location.
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface CreateLocationInput {
  name: string;
  address_line1?: string;
  address_line2?: string;
  code?: string;
  city?: string;
  zip?: string;
  phone?: string;
  is_active?: boolean;
}

export class CreateLocationTool extends BaseTool<CreateLocationInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'create_location',
      description: 'Account: create location, multi-location businesses, address/code/phone',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Location name - Required (e.g., "Headquarters", "North Branch", "West Office")',
          },
          address_line1: {
            type: 'string',
            description: 'Address line 1 - Optional',
          },
          address_line2: {
            type: 'string',
            description: 'Address line 2 - Optional',
          },
          code: {
            type: 'string',
            description: 'Location code - Optional (e.g., "HQ", "NB", "WO")',
          },
          city: {
            type: 'string',
            description: 'City - Optional',
          },
          zip: {
            type: 'string',
            description: 'ZIP/Postal code - Optional',
          },
          phone: {
            type: 'string',
            description: 'Phone number - Optional (e.g., "999-999-9999")',
          },
          is_active: {
            type: 'boolean',
            description: 'Whether location is active (default: true)',
          },
        },
        required: ['name'],
      },
    };
  }

  async execute(input: CreateLocationInput, context: ToolContext): Promise<any> {
    try {
      // Build request body
      const requestBody: any = {
        name: input.name,
        is_active: input.is_active ?? true,
      };

      // Add optional fields if provided
      if (input.address_line1) requestBody.address_line1 = input.address_line1;
      if (input.address_line2) requestBody.address_line2 = input.address_line2;
      if (input.code) requestBody.code = input.code;
      if (input.city) requestBody.city = input.city;
      if (input.zip) requestBody.zip = input.zip;
      if (input.phone) requestBody.phone = input.phone;

      // Call JobNimbus API
      const response = await this.client.post(
        context.apiKey,
        'account/location',
        requestBody
      );

      return {
        success: true,
        message: 'Location created successfully',
        data: response.data,
        summary: {
          id: response.data.id,
          name: input.name,
          code: response.data.code || null,
          is_active: response.data.is_active,
          has_address: !!(input.address_line1 || input.city || input.zip),
          has_phone: !!input.phone,
        },
        _metadata: {
          api_endpoint: 'POST /api1/account/location',
          note: 'If location already exists, returns existing location',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create location',
        _metadata: {
          api_endpoint: 'POST /api1/account/location',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export default new CreateLocationTool();
