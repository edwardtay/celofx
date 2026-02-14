#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://celofx.vercel.app}"

echo "Scan readiness check for ${BASE_URL}"
echo

check_url() {
  local label="$1"
  local url="$2"
  local expected="$3"
  local body
  body="$(curl -fsSL "$url")"
  if echo "$body" | grep -q "$expected"; then
    echo "[ok] ${label}: found '${expected}'"
  else
    echo "[fail] ${label}: missing '${expected}'"
    exit 1
  fi
}

check_url "MCP endpoint" "${BASE_URL}/api/mcp" "\"tools_count\""
check_url "MCP manifest" "${BASE_URL}/.well-known/mcp.json" "\"serverInfo\""
check_url "A2A card" "${BASE_URL}/.well-known/agent-card.json" "\"x402_supported\""
check_url "Agent alias" "${BASE_URL}/.well-known/agent.json" "\"protocols\""
check_url "Health endpoint" "${BASE_URL}/api/health" "\"status\""

echo
echo "All scanner-facing checks passed."
