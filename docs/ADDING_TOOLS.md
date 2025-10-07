# 🛠️ Adding New MCP Tools

This guide shows you how to add new tools to the JobNimbus MCP server.

## 🚀 Quick Start (10 minutes)

### Step 1: Create Tool File

Choose a category (or create new):
- `src/tools/jobs/` - Job-related tools
- `src/tools/contacts/` - Contact-related tools
- `src/tools/analytics/` - Analytics tools
- `src/tools/estimates/` - Estimate tools

Create your tool file:

```bash
# Example: Create a new estimates tool
touch src/tools/estimates/getEstimates.ts
```

### Step 2: Implement Tool Class

```typescript
// src/tools/estimates/getEstimates.ts

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';

/**
 * Input type for this tool
 */
interface GetEstimatesInput {
  from?: number;
  size?: number;
  status?: string;
}

/**
 * Get Estimates Tool
 */
export class GetEstimatesTool extends BaseTool<GetEstimatesInput, any> {
  /**
   * Tool definition (shown to Claude)
   */
  get definition(): MCPToolDefinition {
    return {
      name: 'get_estimates',
      description: 'Retrieve estimates from JobNimbus with pagination and filtering',
      inputSchema: {
        type: 'object',
        properties: {
          from: {
            type: 'number',
            description: 'Starting index for pagination (default: 0)',
          },
          size: {
            type: 'number',
            description: 'Number of records (default: 50, max: 100)',
          },
          status: {
            type: 'string',
            description: 'Filter by status (optional)',
            enum: ['pending', 'approved', 'rejected'],
          },
        },
      },
    };
  }

  /**
   * Execute the tool
   */
  async execute(input: GetEstimatesInput, context: ToolContext): Promise<any> {
    // Build query parameters
    const params: any = {
      from: input.from || 0,
      size: Math.min(input.size || 50, 100),
    };

    if (input.status) {
      params.status = input.status;
    }

    // Call JobNimbus API using the client's API key
    const result = await this.client.get(
      context.apiKey,
      'estimates',
      params
    );

    return result.data;
  }
}
```

### Step 3: Register Tool

Edit `src/tools/index.ts`:

```typescript
// Add import
import { GetEstimatesTool } from './estimates/getEstimates.js';

export class ToolRegistry {
  private tools = new Map<string, BaseTool>();

  constructor() {
    this.registerTool(new GetJobsTool());
    this.registerTool(new SearchJobsTool());
    this.registerTool(new GetContactsTool());
    this.registerTool(new GetEstimatesTool());  // ← Add this
  }

  // ... rest of the class
}
```

### Step 4: Test Locally

```bash
npm run dev
```

Test with curl:

```bash
curl -X POST http://localhost:3000/mcp/tools/list \
  -H "X-JobNimbus-Api-Key: your_api_key" \
  -H "Content-Type: application/json"
```

Should include your new tool in the response.

Test execution:

```bash
curl -X POST http://localhost:3000/mcp/tools/call \
  -H "X-JobNimbus-Api-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "get_estimates",
    "arguments": { "size": 10 }
  }'
```

### Step 5: Deploy

```bash
git add .
git commit -m "feat: add get_estimates tool"
git push origin main
```

GitHub Actions will automatically deploy to Render.

---

## 📖 Complete Example: Complex Tool

Here's a more complex tool with validation and error handling:

```typescript
// src/tools/analytics/insurancePipeline.ts

import { BaseTool } from '../baseTool.js';
import { MCPToolDefinition, ToolContext } from '../../types/index.js';
import { ValidationError } from '../../utils/errors.js';

interface AnalyzeInsurancePipelineInput {
  time_window_days?: number;
  analysis_depth?: 'quick' | 'standard' | 'deep' | 'ultra';
  include_predictions?: boolean;
}

interface PipelineAnalysis {
  summary: {
    total_jobs: number;
    total_value: number;
    conversion_rate: number;
  };
  stages: Array<{
    name: string;
    count: number;
    value: number;
  }>;
  predictions?: {
    next_30_days: number;
    confidence: number;
  };
}

export class AnalyzeInsurancePipelineTool extends BaseTool<
  AnalyzeInsurancePipelineInput,
  PipelineAnalysis
> {
  get definition(): MCPToolDefinition {
    return {
      name: 'analyze_insurance_pipeline',
      description: 'AI-powered insurance pipeline analysis with predictions',
      inputSchema: {
        type: 'object',
        properties: {
          time_window_days: {
            type: 'number',
            description: 'Days to analyze (default: 90, max: 365)',
            default: 90,
          },
          analysis_depth: {
            type: 'string',
            description: 'Analysis depth level',
            enum: ['quick', 'standard', 'deep', 'ultra'],
            default: 'ultra',
          },
          include_predictions: {
            type: 'boolean',
            description: 'Include ML-based predictions',
            default: true,
          },
        },
      },
    };
  }

  /**
   * Validate input before execution
   */
  protected validateInput(input: AnalyzeInsurancePipelineInput): void {
    if (input.time_window_days) {
      if (input.time_window_days < 1 || input.time_window_days > 365) {
        throw new ValidationError('time_window_days must be between 1 and 365');
      }
    }
  }

  async execute(
    input: AnalyzeInsurancePipelineInput,
    context: ToolContext
  ): Promise<PipelineAnalysis> {
    // Validate input
    this.validateInput(input);

    // Set defaults
    const timeWindow = input.time_window_days || 90;
    const depth = input.analysis_depth || 'ultra';
    const includePredictions = input.include_predictions !== false;

    // Get jobs from JobNimbus
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - timeWindow);

    const jobsResult = await this.client.get(
      context.apiKey,
      'jobs',
      {
        date_from: dateFrom.toISOString().split('T')[0],
        size: 100,
      }
    );

    const jobs = jobsResult.data || [];

    // Analyze pipeline
    const analysis = this.analyzePipeline(jobs, depth);

    // Add predictions if requested
    if (includePredictions) {
      analysis.predictions = this.generatePredictions(jobs);
    }

    return analysis;
  }

  /**
   * Private helper: Analyze pipeline
   */
  private analyzePipeline(jobs: any[], depth: string): PipelineAnalysis {
    // Count jobs by stage
    const stageGroups = new Map<string, any[]>();

    for (const job of jobs) {
      const stage = job.stage || 'Unknown';
      if (!stageGroups.has(stage)) {
        stageGroups.set(stage, []);
      }
      stageGroups.get(stage)!.push(job);
    }

    // Build stages array
    const stages = Array.from(stageGroups.entries()).map(([name, jobsInStage]) => ({
      name,
      count: jobsInStage.length,
      value: jobsInStage.reduce((sum, j) => sum + (j.value || 0), 0),
    }));

    // Calculate summary
    const total_jobs = jobs.length;
    const total_value = jobs.reduce((sum, j) => sum + (j.value || 0), 0);
    const won_jobs = jobs.filter(j => j.stage === 'Won').length;
    const conversion_rate = total_jobs > 0 ? won_jobs / total_jobs : 0;

    return {
      summary: {
        total_jobs,
        total_value,
        conversion_rate,
      },
      stages,
    };
  }

  /**
   * Private helper: Generate predictions
   */
  private generatePredictions(jobs: any[]): PipelineAnalysis['predictions'] {
    // Simple prediction: average of last 30 days
    const recent = jobs.filter(j => {
      const createdDate = new Date(j.created_at);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return createdDate >= thirtyDaysAgo;
    });

    const avgValue = recent.reduce((sum, j) => sum + (j.value || 0), 0) / (recent.length || 1);

    return {
      next_30_days: Math.round(avgValue * recent.length),
      confidence: recent.length > 10 ? 0.8 : 0.5,
    };
  }
}
```

---

## 🎨 Tool Patterns

### Pattern 1: Simple GET

```typescript
async execute(input, context) {
  return this.client.get(context.apiKey, 'endpoint', input);
}
```

### Pattern 2: POST with Body

```typescript
async execute(input, context) {
  return this.client.post(context.apiKey, 'endpoint', input);
}
```

### Pattern 3: Multiple API Calls

```typescript
async execute(input, context) {
  const jobs = await this.client.get(context.apiKey, 'jobs');
  const contacts = await this.client.get(context.apiKey, 'contacts');

  return { jobs, contacts };
}
```

### Pattern 4: Data Transformation

```typescript
async execute(input, context) {
  const result = await this.client.get(context.apiKey, 'jobs');

  // Transform data
  return result.data.map(job => ({
    id: job.jnid,
    name: job.display_name,
    value: job.total,
  }));
}
```

---

## ✅ Best Practices

1. **Type Safety**: Always define input/output types
2. **Validation**: Validate input in `validateInput()`
3. **Pagination**: Respect max limits (usually 100)
4. **Error Handling**: Let errors bubble up (handled by middleware)
5. **Documentation**: Clear descriptions in `definition`
6. **Defaults**: Provide sensible defaults
7. **Performance**: Minimize API calls when possible

---

## 🧪 Testing Your Tool

### Manual Test Script

Create `scripts/test-tool.ts`:

```typescript
import { GetEstimatesTool } from '../src/tools/estimates/getEstimates.js';

const tool = new GetEstimatesTool();

const context = {
  apiKey: process.env.JOBNIMBUS_API_KEY!,
  instance: 'stamford' as const,
  clientId: 'test-client',
};

const result = await tool.execute({ size: 5 }, context);

console.log(JSON.stringify(result, null, 2));
```

Run:
```bash
JOBNIMBUS_API_KEY=your_key tsx scripts/test-tool.ts
```

---

## 📚 Common JobNimbus Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/jobs` | GET | Get jobs |
| `/jobs/search` | GET | Search jobs |
| `/contacts` | GET | Get contacts |
| `/estimates` | GET | Get estimates |
| `/activities` | GET | Get activities |
| `/tasks` | GET | Get tasks |
| `/users` | GET | Get users |

See JobNimbus API docs for full list.

---

## 🚀 Next Steps

1. Create your tool using the template
2. Test locally
3. Register in tool registry
4. Test with Claude Desktop
5. Deploy to production
6. Share with team!

**Time to add a tool: ~10 minutes** ⚡
