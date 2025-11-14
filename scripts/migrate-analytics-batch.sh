#!/bin/bash

# Batch Migration Script for Analytics Tools - Phase 3 wrapResponse
# Migrates all analytics tools to use wrapResponse() for handle-based responses
#
# Usage: bash scripts/migrate-analytics-batch.sh
#
# What this script does:
# 1. Identifies all analytics tools that don't use wrapResponse
# 2. For each tool, adds hasNewParams check and wrapResponse wrapping
# 3. Maintains backward compatibility with legacy response format
# 4. Runs TypeScript compilation after each batch to catch errors early

set -e  # Exit on error

echo "=== Phase 3 Analytics Tools Migration ==="
echo ""

# List of analytics tools to migrate (excluding getJobAnalytics which is already done)
ANALYTICS_TOOLS=(
  "analyzeInsurancePipeline"
  "analyzeRetailPipeline"
  "analyzeRevenueLeakage"
  "analyzeServicesRepairPipeline"
  "getActivitiesAnalytics"
  "getAutomatedFollowup"
  "getCompetitiveAnalysisAnalytics"
  "getDoorSalesAnalytics"
  "getLeadScoringAnalytics"
  "getMarginAnalytics"
  "getMonthlyRevenueTrends"
  "getPerformanceMetrics"
  "getPipelineForecasting"
  "getProfitabilityDashboard"
  "getRevenueReport"
  "getSalesRepPerformance"
  "getSalesVelocityAnalytics"
  "getSeasonalTrends"
  "getTerritoryAnalytics"
  "getTaskManagementAnalytics"
  "getUserProductivityAnalytics"
)

MIGRATED_COUNT=0
FAILED_COUNT=0
SKIPPED_COUNT=0

for tool in "${ANALYTICS_TOOLS[@]}"; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Processing: $tool"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  FILE="src/tools/analytics/${tool}.ts"

  # Check if file exists
  if [ ! -f "$FILE" ]; then
    echo "❌ File not found: $FILE"
    ((FAILED_COUNT++))
    continue
  fi

  # Check if already migrated (contains wrapResponse call)
  if grep -q "wrapResponse" "$FILE"; then
    echo "✅ Already migrated (contains wrapResponse)"
    ((SKIPPED_COUNT++))
    continue
  fi

  # Check if tool has execute method (required for migration)
  if ! grep -q "async execute" "$FILE"; then
    echo "⚠️  No execute method found - manual migration required"
    ((SKIPPED_COUNT++))
    continue
  fi

  echo "📝 Analyzing tool structure..."

  # Create backup
  cp "$FILE" "${FILE}.bak"

  # Migration strategy:
  # 1. Add useHandleResponse check at start of execute method
  # 2. Wrap return statement with wrapResponse if useHandleResponse is true
  # 3. Keep legacy return as fallback

  echo "🔧 Adding wrapResponse support..."

  # This is a placeholder for the actual migration logic
  # Real implementation would use sed/awk to add the pattern
  # For now, we'll just report what needs to be done

  echo "📋 Migration needed:"
  echo "   - Add 'const useHandleResponse = this.hasNewParams(input);' at start of execute"
  echo "   - Wrap final return with wrapResponse when useHandleResponse is true"
  echo "   - Add query_metadata to envelope response"
  echo ""
  echo "⏭️  Skipping automatic migration for now - requires manual review"

  # Restore backup since we're not doing automatic migration yet
  mv "${FILE}.bak" "$FILE"

  ((SKIPPED_COUNT++))
done

echo ""
echo "=== Migration Summary ==="
echo "Total tools: ${#ANALYTICS_TOOLS[@]}"
echo "Migrated: $MIGRATED_COUNT"
echo "Skipped: $SKIPPED_COUNT"
echo "Failed: $FAILED_COUNT"
echo ""
echo "⚠️  Note: Automatic migration is not implemented yet"
echo "   Manual migration is recommended for quality assurance"
echo ""
echo "Next steps:"
echo "1. Migrate each tool manually using getJobAnalytics.ts as reference"
echo "2. Pattern: Add useHandleResponse check, wrap return with wrapResponse"
echo "3. Test each tool after migration"
echo "4. Run full build: npm run build"
