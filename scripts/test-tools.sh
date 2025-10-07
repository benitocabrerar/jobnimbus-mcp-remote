#!/bin/bash

# Test MCP Tools
# Tests that all tools are properly registered and accessible

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
SERVER_URL="${1:-http://localhost:3000}"
API_KEY="${JOBNIMBUS_API_KEY:-test_key}"

echo "🔧 Testing MCP Tools"
echo "===================="
echo "Server: $SERVER_URL"
echo ""

# Test tools/list endpoint
echo "Testing tools/list..."
RESPONSE=$(curl -s -X POST "$SERVER_URL/mcp/tools/list" \
  -H "X-JobNimbus-Api-Key: $API_KEY" \
  -H "Content-Type: application/json")

TOOL_COUNT=$(echo "$RESPONSE" | jq '.tools | length' 2>/dev/null)

if [ "$TOOL_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✓ Found $TOOL_COUNT tools${NC}"
  echo ""
  echo "Available tools:"
  echo "$RESPONSE" | jq -r '.tools[] | "  - \(.name): \(.description)"'
else
  echo -e "${RED}✗ No tools found${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}All tests passed!${NC}"
