#!/bin/bash

# Phase 3 Migration Analysis Script
# Analiza cuántos tools están migrados a wrapResponse por categoría

echo "=== Phase 3 Migration Status ==="
echo ""
echo "Category           | Total | Migrated | Pending | % Complete"
echo "-------------------|-------|----------|---------|------------"

TOTAL_TOOLS=0
TOTAL_MIGRATED=0

for dir in src/tools/*/; do
  category=$(basename "$dir")

  # Skip special directories
  if [ "$category" = "archived" ] || [ "$category" = "experimental" ]; then
    continue
  fi

  # Count tools in category (excluding baseTool, index, generator)
  total=$(find "$dir" -name "*.ts" \
    -not -name "baseTool.ts" \
    -not -name "index.ts" \
    -not -name "*Generator.ts" \
    -not -name "allTools*" | wc -l)

  # Count migrated tools (those using wrapResponse)
  migrated=$(find "$dir" -name "*.ts" \
    -not -name "baseTool.ts" \
    -not -name "index.ts" \
    -not -name "*Generator.ts" \
    -not -name "allTools*" \
    -exec grep -l "wrapResponse" {} \; 2>/dev/null | wc -l)

  pending=$((total - migrated))

  if [ $total -gt 0 ]; then
    percent=$((migrated * 100 / total))
    printf "%-18s | %5d | %8d | %7d | %3d%%\n" "$category" "$total" "$migrated" "$pending" "$percent"

    TOTAL_TOOLS=$((TOTAL_TOOLS + total))
    TOTAL_MIGRATED=$((TOTAL_MIGRATED + migrated))
  fi
done

echo "-------------------|-------|----------|---------|------------"
TOTAL_PENDING=$((TOTAL_TOOLS - TOTAL_MIGRATED))
TOTAL_PERCENT=$((TOTAL_MIGRATED * 100 / TOTAL_TOOLS))
printf "%-18s | %5d | %8d | %7d | %3d%%\n" "TOTAL" "$TOTAL_TOOLS" "$TOTAL_MIGRATED" "$TOTAL_PENDING" "$TOTAL_PERCENT"

echo ""
echo "=== Migration Priority ==="
echo ""
echo "HIGH PRIORITY (most used):"
echo "  - analytics tools (17 tools pending)"
echo "  - jobs tools (check status)"
echo "  - estimates tools (check status)"
echo ""
echo "MEDIUM PRIORITY:"
echo "  - materials tools"
echo "  - invoices tools"
echo "  - tasks tools"
echo ""
echo "LOW PRIORITY:"
echo "  - experimental tools"
echo "  - archived tools (skip)"
echo ""
