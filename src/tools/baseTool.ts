/**
 * Base Tool Class for MCP Tools
 *
 * Enhanced with response wrapping and handle-based storage support.
 * All tools automatically benefit from:
 * - Verbosity-based field selection
 * - Automatic handle storage for large responses
 * - Size optimization and truncation
 * - Pagination support
 */

import {
  MCPToolDefinition,
  ToolContext,
  BaseToolInput,
  ResponseEnvelope,
} from '../types/index.js';
import jobNimbusClient from '../services/jobNimbusClient.js';
import { ResponseBuilder, ResponseBuilderOptions } from '../utils/responseBuilder.js';

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

  /**
   * Wrap response with handle logic (use in execute methods)
   *
   * This method automatically:
   * 1. Applies verbosity-based field selection
   * 2. Truncates long text fields
   * 3. Creates summary for large datasets
   * 4. Stores full data in Redis if size > 25 KB
   * 5. Returns handle for retrieval
   *
   * @param data - Raw response data
   * @param input - Tool input (for verbosity/fields params)
   * @param context - Tool context
   * @param options - Additional options
   * @returns Response envelope (may include handle)
   */
  protected async wrapResponse<T = any>(
    data: T,
    input: TInput & Partial<BaseToolInput>,
    context: ToolContext,
    options?: Partial<ResponseBuilderOptions>
  ): Promise<ResponseEnvelope<T>> {
    // OPTIMIZATION (Week 2-3): Force verbosity='compact' as default
    // Prevents chat saturation by limiting response size automatically
    const verbosity = input.verbosity || 'compact';

    const builderOptions: ResponseBuilderOptions = {
      verbosity,
      fields: input.fields,
      toolName: this.definition.name,
      context,
      ...options,
    };

    try {
      return await ResponseBuilder.build(data, builderOptions);
    } catch (error) {
      console.error(`[${this.definition.name}] Failed to wrap response:`, error);

      // Fallback: return error envelope (cast as any for type safety)
      return ResponseBuilder.buildError(
        error instanceof Error ? error : new Error(String(error)),
        this.definition.name,
        input.verbosity || 'compact'
      ) as ResponseEnvelope<T>;
    }
  }

  /**
   * Check if input has BaseToolInput parameters
   * Useful for backward compatibility checking
   */
  protected hasNewParams(input: any): boolean {
    return !!(
      input.verbosity ||
      input.fields ||
      input.cursor ||
      input.page_size !== undefined
    );
  }
}
