#!/bin/bash

# Health Check Script
# Tests if the MCP server is running and healthy

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVER_URL="${1:-http://localhost:3000}"
HEALTH_ENDPOINT="/health"

echo "🏥 Health Check - JobNimbus MCP Server"
echo "======================================="
echo "Server URL: $SERVER_URL"
echo ""

# Test health endpoint
echo -n "Testing health endpoint... "
RESPONSE=$(curl -s "$SERVER_URL$HEALTH_ENDPOINT")

if [ $? -eq 0 ]; then
  STATUS=$(echo "$RESPONSE" | jq -r '.status' 2>/dev/null)

  if [ "$STATUS" = "healthy" ]; then
    echo -e "${GREEN}✓ HEALTHY${NC}"

    VERSION=$(echo "$RESPONSE" | jq -r '.version' 2>/dev/null)
    UPTIME=$(echo "$RESPONSE" | jq -r '.uptime' 2>/dev/null)

    echo "Version: $VERSION"
    echo "Uptime: $((UPTIME / 1000))s"
    exit 0
  else
    echo -e "${RED}✗ UNHEALTHY${NC}"
    echo "Status: $STATUS"
    exit 1
  fi
else
  echo -e "${RED}✗ FAILED${NC}"
  echo "Could not connect to server"
  exit 1
fi
