# Archived: Quick Status Tools

**Date Archived:** 2025-01-14
**Reason:** Redundant wrapper tools - consolidation for token efficiency

## What Was Archived

12 quick status wrapper tools that were thin wrappers around `search_jobs_by_status`:

- `get_leads` → Use `search_jobs_by_status(status="Lead")`
- `get_pending_approval` → Use `search_jobs_by_status(status="Pending Customer Aproval")`
- `get_lost_jobs` → Use `search_jobs_by_status(status="Lost")`
- `get_in_progress` → Use `search_jobs_by_status(status="Jobs In Progress")`
- `get_completed` → Use `search_jobs_by_status(status="Job Completed")`
- `get_paid_closed` → Use `search_jobs_by_status(status="Paid & Closed")`
- `get_estimating` → Use `search_jobs_by_status(status="Estimating")`
- `get_signed_contracts` → Use `search_jobs_by_status(status="Signed Contract")`
- `get_scheduled` → Use `search_jobs_by_status(status="Job Schedule")`
- `get_appointments` → Use `search_jobs_by_status(status="Appointment Scheduled")`
- `get_invoiced` → Use `search_jobs_by_status(status="Invoiced")`
- `get_deposits` → Use `search_jobs_by_status(status="Deposit")`

## Why Archived

All 12 tools were simple wrappers that called `SearchJobsByStatusTool` with a hardcoded status parameter. This created:

- **12 redundant tool registrations** consuming token budget
- **Maintenance overhead** keeping 13 tools in sync
- **Discovery confusion** for users seeing duplicate functionality

## Replacement

Use the consolidated tool: **`search_jobs_by_status`**

```typescript
// Instead of: get_leads(limit=20)
search_jobs_by_status(status="Lead", limit=20)

// Instead of: get_pending_approval()
search_jobs_by_status(status="Pending Customer Aproval")

// Instead of: get_paid_closed(limit=50)
search_jobs_by_status(status="Paid & Closed", limit=50)
```

## Impact

- **Token Efficiency:** Reduced tool count by 12 (11% of total tools)
- **Maintenance:** Single tool to maintain instead of 13
- **Flexibility:** Users can search for any status, not just predefined ones

## Restoration

If these tools need to be restored, the file is preserved in this directory. To restore:

1. Move `quickStatusTools.ts` back to `src/tools/jobs/`
2. Add imports back to `src/tools/index.ts`
3. Register all 12 tools in the ToolRegistry constructor
4. Rebuild and deploy

**Note:** Consider the token efficiency cost before restoring.

## Migration Guide

Update any automation or documentation that references the old tool names:

| Old Tool Name | New Usage |
|---------------|-----------|
| `get_leads` | `search_jobs_by_status(status="Lead")` |
| `get_pending_approval` | `search_jobs_by_status(status="Pending Customer Aproval")` |
| `get_lost_jobs` | `search_jobs_by_status(status="Lost")` |
| `get_in_progress` | `search_jobs_by_status(status="Jobs In Progress")` |
| `get_completed` | `search_jobs_by_status(status="Job Completed")` |
| `get_paid_closed` | `search_jobs_by_status(status="Paid & Closed")` |
| `get_estimating` | `search_jobs_by_status(status="Estimating")` |
| `get_signed_contracts` | `search_jobs_by_status(status="Signed Contract")` |
| `get_scheduled` | `search_jobs_by_status(status="Job Schedule")` |
| `get_appointments` | `search_jobs_by_status(status="Appointment Scheduled")` |
| `get_invoiced` | `search_jobs_by_status(status="Invoiced")` |
| `get_deposits` | `search_jobs_by_status(status="Deposit")` |

## Related Changes

- **Phase 1 of MCP Tools Optimization Plan**
- **Tool count reduced from 103 to 91** (-12 tools)
- **See:** `MCP_Tools_Optimization_Plan.html` for full context
