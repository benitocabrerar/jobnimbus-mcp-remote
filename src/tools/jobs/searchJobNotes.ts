/**
 * Search Job Notes Tool
 * Search for text in job notes, description, and comments
 * Supports @mention search for finding user assignments
 */

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

interface SearchJobNotesInput {
  query: string;
  include_description?: boolean;
  include_notes?: boolean;
  search_mentions?: boolean; // Search for @username patterns
  size?: number;
  from?: number;
}

interface JobMatch {
  jnid: string;
  number: string;
  name?: string;
  matched_in: string[]; // Which fields matched: 'description', 'notes', 'mention'
  matched_text: string[];
  job_data: any;
}

export class SearchJobNotesTool extends BaseTool<SearchJobNotesInput, any> {
  get definition(): MCPToolDefinition {
    return {
      name: 'search_job_notes',
      description: 'Search for text in job notes, descriptions, and comments. Supports @mention search to find user assignments (e.g., @JuanVillavicencio). Searches across all jobs in the system.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (text to find in notes/description). Can include @username to find mentions.',
          },
          include_description: {
            type: 'boolean',
            description: 'Search in job description field (default: true)',
          },
          include_notes: {
            type: 'boolean',
            description: 'Search in job notes/comments field (default: true)',
          },
          search_mentions: {
            type: 'boolean',
            description: 'Enable @mention pattern matching (default: true if query starts with @)',
          },
          size: {
            type: 'number',
            description: 'Maximum number of matching jobs to return (default: 50, max: 200)',
          },
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
          },
        },
        required: ['query'],
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
      mentions.push(match[1]); // Extract username without @
    }

    return mentions;
  }

  /**
   * Check if text contains query (case-insensitive)
   */
  private textContains(text: string | undefined | null, query: string): boolean {
    if (!text) return false;
    return text.toLowerCase().includes(query.toLowerCase());
  }

  /**
   * Extract relevant snippet from matched text
   */
  private extractSnippet(text: string, query: string, contextLength: number = 100): string {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) return text.substring(0, 200) + '...';

    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + query.length + contextLength);

    let snippet = text.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet;
  }

  /**
   * Search in a single job's data
   */
  private searchJob(job: any, query: string, config: SearchJobNotesInput): JobMatch | null {
    const matchedIn: string[] = [];
    const matchedText: string[] = [];

    const includeDescription = config.include_description !== false;
    const includeNotes = config.include_notes !== false;
    const searchMentions = config.search_mentions !== false && query.startsWith('@');

    // Search in description
    if (includeDescription && this.textContains(job.description, query)) {
      matchedIn.push('description');
      matchedText.push(this.extractSnippet(job.description, query));
    }

    // Search in notes field (if exists)
    if (includeNotes && this.textContains(job.notes, query)) {
      matchedIn.push('notes');
      matchedText.push(this.extractSnippet(job.notes, query));
    }

    // Search for mentions
    if (searchMentions) {
      const queryUser = query.substring(1).toLowerCase(); // Remove @ and lowercase

      // Check description for mentions
      if (job.description) {
        const mentions = this.extractMentions(job.description);
        if (mentions.some(m => m.toLowerCase() === queryUser)) {
          if (!matchedIn.includes('description')) {
            matchedIn.push('mention_in_description');
            matchedText.push(this.extractSnippet(job.description, query));
          }
        }
      }

      // Check notes for mentions
      if (job.notes) {
        const mentions = this.extractMentions(job.notes);
        if (mentions.some(m => m.toLowerCase() === queryUser)) {
          if (!matchedIn.includes('notes')) {
            matchedIn.push('mention_in_notes');
            matchedText.push(this.extractSnippet(job.notes, query));
          }
        }
      }
    }

    if (matchedIn.length === 0) return null;

    return {
      jnid: job.jnid,
      number: job.number || job.display_number || 'N/A',
      name: job.name || job.display_name,
      matched_in: matchedIn,
      matched_text: matchedText,
      job_data: job,
    };
  }

  async execute(input: SearchJobNotesInput, context: ToolContext): Promise<any> {
    const requestedSize = Math.min(input.size || 50, 200);
    const startFrom = input.from || 0;

    // Fetch all jobs in batches
    const batchSize = 100;
    const maxIterations = 100; // Maximum 10,000 jobs
    let allJobs: any[] = [];
    let offset = 0;
    let iteration = 0;

    console.log(`[SearchJobNotes] Starting search for: "${input.query}"`);

    while (iteration < maxIterations) {
      const response = await this.client.get(context.apiKey, 'jobs', {
        size: batchSize,
        from: offset,
      });

      const batch = response.data?.results || [];
      if (batch.length === 0) break;

      allJobs = allJobs.concat(batch);
      offset += batchSize;
      iteration++;

      if (batch.length < batchSize) break;
    }

    console.log(`[SearchJobNotes] Fetched ${allJobs.length} jobs total`);

    // Search in all jobs
    const matches: JobMatch[] = [];
    for (const job of allJobs) {
      const match = this.searchJob(job, input.query, input);
      if (match) {
        matches.push(match);
      }

      // Stop if we have enough matches
      if (matches.length >= startFrom + requestedSize) {
        break;
      }
    }

    console.log(`[SearchJobNotes] Found ${matches.length} matches`);

    // Paginate results
    const paginatedMatches = matches.slice(startFrom, startFrom + requestedSize);

    return {
      query: input.query,
      total_jobs_searched: allJobs.length,
      total_matches: matches.length,
      returned_matches: paginatedMatches.length,
      from: startFrom,
      size: requestedSize,
      has_more: startFrom + paginatedMatches.length < matches.length,
      search_config: {
        include_description: input.include_description !== false,
        include_notes: input.include_notes !== false,
        search_mentions: input.search_mentions !== false && input.query.startsWith('@'),
      },
      matches: paginatedMatches,
    };
  }
}
