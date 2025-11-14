/**
 * Get Job Tasks Tool
 * Retrieve tasks, notes, and comments for a specific job
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface GetJobTasksInput {
  job_id: string;
  include_activities?: boolean;
  include_notes?: boolean;
  parse_mentions?: boolean;
}

interface ParsedNote {
  date: string;
  author?: string;
  text: string;
  mentions: string[]; // @username mentions found
  raw: string;
}

export class GetJobTasksTool extends BaseTool<GetJobTasksInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'get_job_tasks',
      description: 'Get job tasks, notes, activities, and @mentions',
      inputSchema: {
        type: 'object',
        properties: {
          job_id: {
            type: 'string',
            description: 'Job ID or number',
          },
          include_activities: {
            type: 'boolean',
            description: 'Include activities',
          },
          include_notes: {
            type: 'boolean',
            description: 'Include notes',
          },
          parse_mentions: {
            type: 'boolean',
            description: 'Parse @mentions',
          },
        },
        required: ['job_id'],
      },
    };
  }

  /**
   * Extract mentions from text (e.g., @JuanVillavicencio)
   */
  private extractMentions(text: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }

    return [...new Set(mentions)]; // Remove duplicates
  }

  /**
   * Parse notes into structured format
   */
  private parseNotes(notesText: string, parseMentions: boolean): ParsedNote[] {
    if (!notesText) return [];

    // Split by date pattern (MM/DD/YYYY)
    const datePattern = /(\d{1,2}\/\d{1,2}\/\d{4})/g;
    const parts = notesText.split(datePattern);

    const parsed: ParsedNote[] = [];
    let currentDate: string | null = null;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;

      // Check if this is a date
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(part)) {
        currentDate = part;
        continue;
      }

      // This is note text
      if (currentDate) {
        const mentions = parseMentions ? this.extractMentions(part) : [];

        parsed.push({
          date: currentDate,
          text: part,
          mentions,
          raw: `${currentDate} - ${part}`,
        });

        currentDate = null;
      } else {
        // Note without date
        const mentions = parseMentions ? this.extractMentions(part) : [];

        parsed.push({
          date: 'Unknown',
          text: part,
          mentions,
          raw: part,
        });
      }
    }

    return parsed;
  }

  /**
   * Search for job by number when direct JNID lookup fails
   */
  private async searchJobByNumber(jobNumber: string, context: ToolContext): Promise<any> {
    const batchSize = 100;
    const maxIterations = 50;
    let offset = 0;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      const response = await this.client.get(context.apiKey, 'jobs', {
        size: batchSize,
        from: offset,
      });

      const jobs = response.data?.results || [];
      if (jobs.length === 0) break;

      const found = jobs.find(
        (j: any) =>
          String(j.number) === String(jobNumber) ||
          String(j.display_number) === String(jobNumber)
      );

      if (found) return found;

      offset += batchSize;
      if (jobs.length < batchSize) break;
    }

    return null;
  }

  async execute(input: GetJobTasksInput, context: ToolContext): Promise<any> {
    // Check if using new handle-based parameters for response optimization
    const useHandleResponse = this.hasNewParams(input);

    const includeActivities = input.include_activities !== false;
    const includeNotes = input.include_notes !== false;
    const parseMentions = input.parse_mentions !== false;

    // 1. Get the job
    let job: any;
    try {
      const result = await this.client.get(context.apiKey, `jobs/${input.job_id}`);
      job = result.data;
    } catch (error: any) {
      if (error.statusCode === 404 || error.status === 404) {
        // Try searching by job number
        job = await this.searchJobByNumber(input.job_id, context);
        if (!job) {
          throw new Error(`Job not found: ${input.job_id}`);
        }
      } else {
        throw error;
      }
    }

    const response: any = {
      job_id: job.jnid,
      job_number: job.number || job.display_number,
      job_name: job.name || job.display_name,
      job_status: job.status_name,
    };

    // 2. Parse notes/description
    if (includeNotes) {
      const allText = [job.description, job.notes].filter(Boolean).join('\n\n');

      response.notes = {
        raw_description: job.description || '',
        raw_notes: job.notes || '',
        parsed_notes: this.parseNotes(allText, parseMentions),
      };

      if (parseMentions) {
        response.all_mentions = this.extractMentions(allText);
      }
    }

    // 3. Get activities related to this job
    if (includeActivities) {
      try {
        const activitiesResponse = await this.client.get(context.apiKey, 'activities', {
          size: 100,
        });

        const allActivities = activitiesResponse.data?.activity || [];

        // Filter activities related to this job
        const jobActivities = allActivities.filter((activity: any) => {
          // Check if primary is this job
          if (activity.primary?.id === job.jnid) return true;

          // Check if job is in related
          if (activity.related && Array.isArray(activity.related)) {
            return activity.related.some((rel: any) => rel.id === job.jnid);
          }

          return false;
        });

        response.activities = {
          count: jobActivities.length,
          items: jobActivities.map((act: any) => ({
            type: act.type,
            date_created: act.date_created,
            date_start: act.date_start,
            date_end: act.date_end,
            description: act.description,
            created_by_name: act.created_by_name,
          })),
        };
      } catch (error) {
        response.activities = {
          error: 'Failed to fetch activities',
          count: 0,
          items: [],
        };
      }
    }

    // Use handle-based response if requested
    if (useHandleResponse) {
      const totalItems = (response.notes?.parsed_notes?.length || 0) +
                        (response.activities?.count || 0);

      const envelope = await this.wrapResponse([response], input, context, {
        entity: 'job_tasks',
        maxRows: totalItems,
        pageInfo: {
          current_page: 1,
          total_pages: 1,
          has_more: false,
        },
      });

      return {
        ...envelope,
        query_metadata: {
          job_id: input.job_id,
          job_jnid: job.jnid,
          job_number: job.number || job.display_number,
          job_status: job.status_name,
          notes_count: response.notes?.parsed_notes?.length || 0,
          activities_count: response.activities?.count || 0,
          mentions_count: response.all_mentions?.length || 0,
          includes_activities: includeActivities,
          includes_notes: includeNotes,
          parsed_mentions: parseMentions,
          data_freshness: 'real-time',
        },
      };
    }

    // Fallback to legacy response
    return response;
  }
}
