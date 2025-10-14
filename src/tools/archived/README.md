# Archived Tools

**Last Updated**: January 14, 2025
**Status**: DEPRECATED / NO LONGER MAINTAINED

This folder contains tools that have been archived due to:
- No real business value
- High maintenance overhead
- Overlap with other tools
- Rarely used functionality

## Archived Tools (7 files)

### Data Quality & Duplication (6 tools)
1. **batchAnalyticsTools.ts** - Contains:
   - `AnalyzeDuplicateContactsTool` - No real business value
   - `AnalyzeDuplicateJobsTool` - Maintenance overhead
   - `AnalyzePricingAnomaliesTool` - Rarely used
   - `GetPricingOptimizationTool` - Overlaps with margin analysis
   - `GetCompetitiveIntelligenceTool` - No real data source
   - `GetUpsellOpportunitiesTool` - Overlaps with CLV

### System Monitoring (3 tools)
2. **getSystemInfo.ts** - Internal/debug only, not production value
3. **getWebhookMonitoring.ts** - Technical monitoring, not business critical
4. **getFileStorageAnalytics.ts** - Technical monitoring, not business critical
5. **simplifiedBatchTools.ts** - Contains duplicate `GetWebhooksTool`

### Contact Management (2 tools)
6. **getBulkImportContacts.ts** - One-time use, manual process preferred
7. **validateContactInformation.ts** - Overlaps with data quality batch

## Migration Path

If you need functionality from these tools, consider:
- **Duplicate detection**: Use manual review or external tools
- **System monitoring**: Use Render dashboard or logs
- **Bulk imports**: Use JobNimbus native import or manual CSV upload
- **Contact validation**: Use address validation services

## Restoration

To restore a tool:
1. Move file back to original location
2. Add registration back to `src/tools/index.ts`
3. Update imports
4. Test thoroughly before deploying

---
**Do not use these tools in production**
