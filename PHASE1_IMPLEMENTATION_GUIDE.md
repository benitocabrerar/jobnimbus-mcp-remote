# Phase 1: Handle-Based Response System - Implementation Guide

## Implementation Summary

Phase 1 has been successfully implemented with the following core components:

### ✅ Completed Components

1. **Response Configuration** (`src/config/response.ts`)
   - Verbosity levels: summary, compact, detailed, raw
   - Size limits: 25 KB hard limit
   - Pagination defaults
   - Handle storage TTL: 15 minutes

2. **Type Definitions** (`src/types/index.ts`)
   - `VerbosityLevel` type
   - `ResponseEnvelope<T>` interface
   - `StoredResult` interface
   - `BaseToolInput` interface
   - `PageInfo` and `ResponseMetadata` interfaces

3. **HandleStorageService** (`src/services/handleStorage.ts`)
   - Redis-backed storage for large payloads
   - Automatic handle generation: `jn:entity:timestamp:hash`
   - TTL management (15 min default)
   - Periodic cleanup of expired handles
   - Metadata tracking

4. **ResponseBuilder** (`src/utils/responseBuilder.ts`)
   - Automatic size detection and handle storage
   - Verbosity-based field selection
   - Text truncation
   - Array sampling
   - Summary generation

5. **BaseTool Enhancement** (`src/tools/baseTool.ts`)
   - `wrapResponse()` method for automatic optimization
   - `hasNewParams()` helper for backward compatibility
   - Error handling with ResponseEnvelope

6. **fetchByHandle Tool** (`src/tools/system/fetchByHandle.ts`)
   - Retrieves stored data by handle
   - Supports field selection and verbosity override
   - Returns metadata (age, expiry, size)

## Build Status

```bash
npm run build
# ✅ SUCCESS - 0 errors, 0 warnings
```

## How to Modify Existing Tools

### Example 1: Modify getJobs to use handle-based responses

**Before (current):**
```typescript
async execute(input: GetJobsInput, context: ToolContext): Promise<any> {
  // ... fetch and process jobs ...
  return {
    count: jobs.length,
    results: jobs, // Could be 50+ jobs with full details = 200+ KB
  };
}
```

**After (with handle support):**
```typescript
interface GetJobsInput extends BaseToolInput {
  from?: number;
  size?: number;
  // ... existing params ...
}

async execute(input: GetJobsInput, context: ToolContext): Promise<any> {
  // ... fetch and process jobs ...

  const rawResponse = {
    count: jobs.length,
    total_filtered: filteredJobs.length,
    results: jobs,
  };

  // Wrap with handle logic (automatically stores if > 25 KB)
  return await this.wrapResponse(rawResponse, input, context, {
    entity: 'jobs',
    maxRows: 20,  // Only show 20 jobs in summary
    pageInfo: {
      has_more: hasMore,
      current_page: currentPage,
      total_pages: totalPages,
    },
  });
}
```

### Example 2: Modify getJob to support field selection

**Before:**
```typescript
async execute(input: GetJobInput, context: ToolContext): Promise<any> {
  const job = await this.client.get(context.apiKey, `jobs/${input.job_id}`);

  return {
    success: true,
    data: job, // Returns ALL 50+ fields
  };
}
```

**After:**
```typescript
interface GetJobInput extends BaseToolInput {
  job_id: string;
  verify_attachments?: boolean;
}

async execute(input: GetJobInput, context: ToolContext): Promise<any> {
  const job = await this.client.get(context.apiKey, `jobs/${input.job_id}`);

  const response = {
    success: true,
    data: job,
  };

  // Wrap with handle logic
  return await this.wrapResponse(response, input, context, {
    entity: 'jobs',
  });
}
```

### Example 3: Add new parameters to tool definitions

```typescript
get definition(): MCPToolDefinition {
  return {
    name: 'get_jobs',
    description: 'Retrieve jobs...',
    inputSchema: {
      type: 'object',
      properties: {
        // Existing parameters
        from: { type: 'number', description: '...' },
        size: { type: 'number', description: '...' },

        // NEW: Add BaseToolInput parameters
        verbosity: {
          type: 'string',
          description: 'Response verbosity (summary|compact|detailed|raw). Default: compact',
          enum: ['summary', 'compact', 'detailed', 'raw'],
        },
        fields: {
          type: 'string',
          description: 'Comma-separated fields to include (e.g., "jnid,number,status")',
        },
        page_size: {
          type: 'number',
          description: 'Number of results per page (default: 20, max: 100)',
        },
      },
    },
  };
}
```

## Expected Results

### Before (Old System)
```json
// getJobs response: 89 KB (50 jobs, full details)
{
  "count": 50,
  "results": [
    { /* 50+ fields per job */ },
    { /* 50+ fields per job */ },
    // ... 48 more jobs
  ]
}
```

### After (New System)
```json
// getJobs response: 8 KB (5 jobs summary + handle)
{
  "status": "partial",
  "summary": {
    "count": 50,
    "results": [
      { "jnid": "mex...", "number": "1820", "status": "Active", "date_created": "..." },
      { "jnid": "mfp...", "number": "1821", "status": "Lead", "date_created": "..." },
      // Only 5 most recent jobs
    ]
  },
  "result_handle": "jn:jobs:1729012345:abc12345",
  "page_info": {
    "has_more": true,
    "total": 50,
    "current_page": 1,
    "total_pages": 3
  },
  "metadata": {
    "verbosity": "compact",
    "size_bytes": 8192,
    "field_count": 15,
    "row_count": 5,
    "expires_in_sec": 900,
    "tool_name": "get_jobs",
    "timestamp": "2025-10-14T23:45:00Z"
  }
}
```

### Retrieve Full Data
```typescript
// Use fetch_by_handle to get complete data
const fullData = await fetchByHandle({
  handle: "jn:jobs:1729012345:abc12345",
  fields: "jnid,number,status,date_created,sales_rep_name", // Optional
  verbosity: "detailed" // Optional
});
```

## Testing Checklist

- [ ] **Small response (< 25 KB)**: Returns directly without handle
- [ ] **Large response (> 25 KB)**: Creates handle and returns summary
- [ ] **Verbosity levels**:
  - [ ] summary: 5 fields max
  - [ ] compact: 15 fields (default)
  - [ ] detailed: 50 fields
  - [ ] raw: all fields
- [ ] **Field selection**: `fields="jnid,number,status"` returns only those fields
- [ ] **fetchByHandle**: Retrieves stored data correctly
- [ ] **Handle expiration**: Handles expire after 15 minutes
- [ ] **Error handling**: Invalid handles return proper error

## Next Steps (Phase 2)

1. Implement CursorPagination utility
2. Update remaining high-traffic tools:
   - `getActivities`
   - `getAttachments`
   - `getContacts`
   - `getEstimates`
3. Add metrics and logging
4. Performance testing with real data
5. Documentation updates

## Usage Examples

### Get jobs with summary verbosity
```typescript
const result = await getJobs({
  verbosity: 'summary',
  size: 20
});
// Returns: 5 fields max per job
```

### Get jobs with specific fields
```typescript
const result = await getJobs({
  fields: 'jnid,number,status,sales_rep_name',
  size: 50
});
// Returns: Only specified fields, even if size is large
```

### Get full job details
```typescript
const result = await getJob({
  job_id: '1820',
  verbosity: 'raw'
});
// Returns: All fields without truncation
```

## Performance Metrics (Expected)

- **Token Reduction**: 70-90% reduction in response sizes
- **Response Time**: < 100ms overhead for handle storage
- **Cache Hit Rate**: 80%+ for repeated queries
- **Memory Usage**: Minimal (Redis handles storage)

## Architecture Benefits

1. **Chat Saturation Prevention**: 25 KB hard limit
2. **Zero Functionality Loss**: All data available via handle
3. **Backward Compatible**: Old parameters still work
4. **Progressive Enhancement**: Tools can be migrated incrementally
5. **Type Safe**: Full TypeScript support
6. **Testable**: Clear interfaces and separation of concerns

## Files Created/Modified

### Created:
- `src/config/response.ts` - Response configuration
- `src/services/handleStorage.ts` - Handle storage service
- `src/utils/responseBuilder.ts` - Response builder utility
- `src/tools/system/fetchByHandle.ts` - Fetch by handle tool

### Modified:
- `src/types/index.ts` - Added new interfaces
- `src/tools/baseTool.ts` - Added wrapResponse method

### Not Modified (but should be in Phase 2):
- `src/tools/jobs/getJobs.ts` - Convert to use wrapResponse
- `src/tools/jobs/getJob.ts` - Convert to use wrapResponse
- `src/tools/activities/getActivities.ts` - Convert to use wrapResponse
- `src/tools/attachments/getAttachments.ts` - Convert to use wrapResponse
- `src/tools/contacts/getContacts.ts` - Convert to use wrapResponse

---

**Status**: ✅ Phase 1 Complete - Ready for Testing
**Build**: ✅ 0 Errors, 0 Warnings
**Next**: Modify existing tools and deploy to production
