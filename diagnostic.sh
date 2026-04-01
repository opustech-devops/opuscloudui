#!/bin/bash
# API Authentication Diagnostic Script
# Tests various CloudStack API authentication scenarios

set -e

API_BASE="http://localhost:3001/client/api"
# Set these env vars before running: export CS_API_KEY=... CS_SECRET=...
OLD_KEY="${CS_API_KEY:-}"
OLD_SECRET="${CS_SECRET:-}"

if [ -z "$OLD_KEY" ] || [ -z "$OLD_SECRET" ]; then
  echo "ERRO: defina CS_API_KEY e CS_SECRET como variáveis de ambiente."
  exit 1
fi

echo "================================================"
echo "CloudStack API Authentication Diagnostic"
echo "================================================"
echo ""

# Test 1: No auth
echo "[1] Request without authentication:"
echo "URL: $API_BASE?command=listZones&response=json"
curl -s "$API_BASE?command=listZones&response=json" | jq '.[] | keys' 2>/dev/null || echo "Failed to parse"
echo ""

# Test 2: Check if API key parameter alone works
echo "[2] Request with API key parameter only:"
curl -s "$API_BASE?command=listZones&apiKey=$OLD_KEY&response=json&signature=invalid" | jq '.[] | .errortext' 2>/dev/null || echo "JSON parse failed"
echo ""

# Test 3: Try listApis to see what commands are available
echo "[3] List available APIs (no auth):"
curl -s "$API_BASE?command=listApis&response=json" | jq '.listapisresponse | keys' 2>/dev/null || echo "Failed"
echo ""

# Test 4: Check CloudStack version/info
echo "[4] Check if there's a list capability endpoint:"
curl -s "$API_BASE?command=listCapabilities&response=json" | jq '.[] | .errortext' 2>/dev/null || echo "Failed"
echo ""

echo "================================================"
echo "Summary:"
echo "- All requests return 401: Suggests auth is broken globally"
echo "- Check if CloudStack server is in a special mode"
echo "- Verify apiKey and secretKey are valid"
echo "================================================"
