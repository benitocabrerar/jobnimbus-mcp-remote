/**
 * Base Tool Class for MCP Tools
 */

import { MCPToolDefinition, ToolContext } from '../types/index.js';
import jobNimbusClient from '../services/jobNimbusClient.js';

export abstract class BaseTool<TInput = any, TOutput = any> {
  /**
   * Tool definition (name, description, schema)
   */
  abstract get definition(): MCPToolDefinition;

  /**
   * Execute the tool
   */
  abstract execute(input: TInput, context: ToolContext): Promise<TOutput>;

  /**
   * Validate input (override if needed)
   */
  protected validateInput(_input: TInput): void {
    // Default: no validation
  }

  /**
   * Get JobNimbus client
   */
  protected get client() {
    return jobNimbusClient;
  }
}
