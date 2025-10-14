/**
 * Mock BaseTool for testing
 * Provides minimal implementation needed for attachment tools
 */

import { MCPToolDefinition, ToolContext } from '../src/types/index.js';
import { JobNimbusClient } from '../src/services/jobNimbusClient.js';

export abstract class BaseTool<TInput = any, TOutput = any> {
  protected client: JobNimbusClient;

  constructor() {
    // Client will be injected in tests
    this.client = new JobNimbusClient();
  }

  abstract get definition(): MCPToolDefinition;
  abstract execute(input: TInput, context: ToolContext): Promise<TOutput>;
}
