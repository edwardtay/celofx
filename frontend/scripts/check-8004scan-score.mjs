#!/usr/bin/env node
import process from "node:process";

const SCORE_URL = "https://www.8004scan.io/api/v1/agents/scores/v5/42220/10";
const AGENT_URL = "https://www.8004scan.io/api/v1/agents/42220/10";
const LEADERBOARD_URL = "https://www.8004scan.io/api/v1/agents/leaderboard?chain_id=42220&page=1&page_size=5";

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return res.json();
}

async function main() {
  const [score, agent, board] = await Promise.all([
    fetchJson(SCORE_URL),
    fetchJson(AGENT_URL),
    fetchJson(LEADERBOARD_URL),
  ]);

  console.log("8004scan snapshot");
  console.log(`total: ${score.total_score}`);
  console.log(`engagement: ${score.engagement.score}`);
  console.log(`service: ${score.service.score}`);
  console.log(`publisher: ${score.publisher.score}`);
  console.log(`compliance: ${score.compliance.score}`);
  console.log(`momentum: ${score.momentum.score}`);

  console.log("\nfield_sources");
  const fs = agent.field_sources || {};
  for (const key of ["x402_supported", "mcp_server", "a2a_endpoint", "agent_wallet_chain_id", "capabilities", "tags", "categories"]) {
    console.log(`${key}: ${String(fs[key] ?? "null")}`);
  }

  console.log("\nleaderboard top 5");
  for (const item of board.items || []) {
    console.log(`#${item.rank} ${item.name}: ${item.total_score}`);
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

