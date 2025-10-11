/**
 * Quick Status Search Tools
 * Pre-configured searches for common job statuses
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { SearchJobsByStatusTool } from './searchJobsByStatus.js';

// Base class for quick status tools
abstract class QuickStatusTool extends BaseTool<any, any> {
  protected statusToSearch: string;
  protected toolName: string;
  protected toolDescription: string;

  constructor(toolName: string, status: string, description: string) {
    super();
    this.toolName = toolName;
    this.statusToSearch = status;
    this.toolDescription = description;
  }

  get definition(): MCPToolDefinition {
    return {
      name: this.toolName,
      description: this.toolDescription,
      inputSchema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum jobs to return (default: 20, max: 50)',
          },
        },
      },
    };
  }

  async execute(input: any, context: ToolContext): Promise<any> {
    const searchTool = new SearchJobsByStatusTool();
    return await searchTool.execute(
      {
        status: this.statusToSearch,
        limit: input.limit || 20,
        include_full_details: false,
      },
      context
    );
  }
}

// Get Leads - New potential customers
export class GetLeadsTool extends QuickStatusTool {
  constructor() {
    super(
      'get_leads',
      'Lead',
      'Get all jobs in "Lead" status - new potential customers'
    );
  }
}

// Get Pending Approval - Waiting for customer decision
export class GetPendingApprovalTool extends QuickStatusTool {
  constructor() {
    super(
      'get_pending_approval',
      'Pending Customer Aproval',
      'Get all jobs pending customer approval - waiting for customer decision'
    );
  }
}

// Get Lost Jobs - Jobs we didn't win
export class GetLostJobsTool extends QuickStatusTool {
  constructor() {
    super(
      'get_lost_jobs',
      'Lost',
      'Get all lost jobs - opportunities we didn\'t win'
    );
  }
}

// Get In Progress - Active work
export class GetInProgressTool extends QuickStatusTool {
  constructor() {
    super(
      'get_in_progress',
      'Jobs In Progress',
      'Get all jobs currently in progress - active work'
    );
  }
}

// Get Completed - Finished work
export class GetCompletedTool extends QuickStatusTool {
  constructor() {
    super(
      'get_completed',
      'Job Completed',
      'Get all completed jobs - finished work'
    );
  }
}

// Get Paid & Closed - Successfully closed
export class GetPaidClosedTool extends QuickStatusTool {
  constructor() {
    super(
      'get_paid_closed',
      'Paid & Closed',
      'Get all paid and closed jobs - successfully completed and paid'
    );
  }
}

// Get Estimating - Working on quotes
export class GetEstimatingTool extends QuickStatusTool {
  constructor() {
    super(
      'get_estimating',
      'Estimating',
      'Get all jobs in estimating phase - preparing quotes'
    );
  }
}

// Get Signed Contracts - Ready to start
export class GetSignedContractsTool extends QuickStatusTool {
  constructor() {
    super(
      'get_signed_contracts',
      'Signed Contract',
      'Get all jobs with signed contracts - ready to schedule'
    );
  }
}

// Get Scheduled - Jobs scheduled to start
export class GetScheduledTool extends QuickStatusTool {
  constructor() {
    super(
      'get_scheduled',
      'Job Schedule',
      'Get all scheduled jobs - ready to begin work'
    );
  }
}

// Get Appointments - Meetings scheduled
export class GetAppointmentsTool extends QuickStatusTool {
  constructor() {
    super(
      'get_appointments',
      'Appointment Scheduled',
      'Get all jobs with appointments scheduled'
    );
  }
}

// Get Invoiced - Awaiting payment
export class GetInvoicedTool extends QuickStatusTool {
  constructor() {
    super(
      'get_invoiced',
      'Invoiced',
      'Get all invoiced jobs - awaiting payment'
    );
  }
}

// Get Deposits - Deposit received
export class GetDepositsTool extends QuickStatusTool {
  constructor() {
    super(
      'get_deposits',
      'Deposit',
      'Get all jobs with deposit received'
    );
  }
}
