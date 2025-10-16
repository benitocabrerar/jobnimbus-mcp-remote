/**
 * Create Payment Tool - Create new payment in JobNimbus
 * Based on official JobNimbus API documentation
 *
 * Endpoint: POST /api2/v2/payments
 *
 * Note: This endpoint uses API v2 (different from GET which uses v1)
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface PaymentInvoiceInput {
  invoice_id: string;
  amount: number;
}

interface CreatePaymentInput {
  // Required fields
  type: 'payment';
  total: number;
  date_payment: number;
  method_id: number;
  related: Array<{ id: string; type: string }>;

  // Optional fields
  reference?: string;
  credit?: number;
  transaction_id?: string;
  external_record_id?: string;
  date_created?: number;
  date_updated?: number;
  is_active?: boolean;
  is_archived?: boolean;
  invoices?: PaymentInvoiceInput[];
  location_id?: number;
  owners?: Array<{ id: string }>;
  sales_rep?: string;
  surcharge?: number;
}

export class CreatePaymentTool extends BaseTool<CreatePaymentInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'create_payment',
      description: 'Payments: create, apply to invoices, set method and reference',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: 'Must be "payment" - Required',
            enum: ['payment'],
          },
          total: {
            type: 'number',
            description: 'Total payment amount - Required',
          },
          date_payment: {
            type: 'number',
            description: 'Unix timestamp of payment date - Required',
          },
          method_id: {
            type: 'number',
            description: 'Payment method ID (1=Cash, 2=Check, 3=Credit Card, etc.) - Required',
          },
          related: {
            type: 'array',
            description: 'Array of related entities (invoices, jobs, contacts) - Required. Must have at least one entry.',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Entity JNID - Required' },
                type: { type: 'string', description: 'Entity type (invoice, job, contact) - Required' },
              },
              required: ['id', 'type'],
            },
          },
          reference: {
            type: 'string',
            description: 'Payment reference number (check number, transaction ID, etc.)',
          },
          credit: {
            type: 'number',
            description: 'Credit amount (default: 0)',
          },
          transaction_id: {
            type: 'string',
            description: 'External transaction ID from payment processor',
          },
          external_record_id: {
            type: 'string',
            description: 'External system record ID for integration',
          },
          date_created: {
            type: 'number',
            description: 'Unix timestamp of creation date (defaults to current time)',
          },
          date_updated: {
            type: 'number',
            description: 'Unix timestamp of last update (defaults to current time)',
          },
          is_active: {
            type: 'boolean',
            description: 'Whether the payment is active (default: true)',
          },
          is_archived: {
            type: 'boolean',
            description: 'Whether the payment is archived (default: false)',
          },
          invoices: {
            type: 'array',
            description: 'Array of invoice payment allocations',
            items: {
              type: 'object',
              properties: {
                invoice_id: { type: 'string', description: 'Invoice JNID - Required' },
                amount: { type: 'number', description: 'Amount applied to this invoice - Required' },
              },
              required: ['invoice_id', 'amount'],
            },
          },
          location_id: {
            type: 'number',
            description: 'Location ID (typically 1 for primary location)',
          },
          owners: {
            type: 'array',
            description: 'Array of owner objects with id property',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'User JNID' },
              },
              required: ['id'],
            },
          },
          sales_rep: {
            type: 'string',
            description: 'Sales representative user JNID',
          },
          surcharge: {
            type: 'number',
            description: 'Surcharge amount (for credit card fees, etc.)',
          },
        },
        required: ['type', 'total', 'date_payment', 'method_id', 'related'],
      },
    };
  }

  async execute(input: CreatePaymentInput, context: ToolContext): Promise<any> {
    try {
      // Build request body
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const requestBody: any = {
        // Required fields
        type: 'payment',
        total: input.total,
        date_payment: input.date_payment,
        method_id: input.method_id,
        related: input.related,

        // Dates
        date_created: input.date_created || currentTimestamp,
        date_updated: input.date_updated || currentTimestamp,

        // Optional fields with defaults
        is_active: input.is_active ?? true,
        is_archived: input.is_archived ?? false,
        credit: input.credit || 0,
        reference: input.reference || null,
        transaction_id: input.transaction_id || null,
        external_record_id: input.external_record_id || null,
        surcharge: input.surcharge || null,
      };

      // Add location if provided
      if (input.location_id !== undefined) {
        requestBody.location = { id: input.location_id };
      }

      // Add optional fields if provided
      if (input.owners) {
        requestBody.owners = input.owners;
      }

      if (input.sales_rep) {
        requestBody.sales_rep = input.sales_rep;
      }

      if (input.invoices) {
        requestBody.invoices = input.invoices.map((inv) => ({
          invoice_id: inv.invoice_id,
          amount: inv.amount,
          created_by: null, // Will be set by JobNimbus API based on API key
          date_created: currentTimestamp,
          is_active: true,
        }));
      }

      // Call JobNimbus API v2
      const response = await this.client.post(
        context.apiKey,
        'v2/payments',
        requestBody
      );

      return {
        success: true,
        message: 'Payment created successfully',
        data: response.data,
        summary: {
          jnid: response.data.jnid,
          total: input.total.toFixed(2),
          date_payment: new Date(input.date_payment * 1000).toISOString(),
          method_id: input.method_id,
          reference: input.reference || 'N/A',
          invoices_count: input.invoices?.length || 0,
          related_count: input.related.length,
        },
        _metadata: {
          api_endpoint: 'POST /api2/v2/payments',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create payment',
        _metadata: {
          api_endpoint: 'POST /api2/v2/payments',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export default new CreatePaymentTool();
