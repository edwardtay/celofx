/**
 * Check current 8004scan score and ranking for Agent #10.
 *
 * Usage:
 *   npx tsx scripts/check-8004scan-score.ts
 */

const SCORE_URL = "https://www.8004scan.io/api/v1/agents/scores/v5/42220/10";
const AGENT_URL = "https://www.8004scan.io/api/v1/agents/42220/10";
const LEADERBOARD_URL = "https://www.8004scan.io/api/v1/agents/leaderboard?chain_id=42220&page=1&page_size=5";

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}

async function main() {
  const [score, agent, leaderboard] = await Promise.all([
    fetchJson(SCORE_URL),
    fetchJson(AGENT_URL),
    fetchJson(LEADERBOARD_URL),
  ]);

  console.log("8004scan snapshot");
  console.log(`- total score: ${score.total_score}`);
  console.log(`- service score: ${(score.service as { score: number }).score}`);
  console.log(`- engagement score: ${(score.engagement as { score: number }).score}`);
  console.log(`- publisher score: ${(score.publisher as { score: number }).score}`);
  console.log(`- compliance score: ${(score.compliance as { score: number }).score}`);
  console.log(`- momentum score: ${(score.momentum as { score: number }).score}`);

  console.log("\nCompatibility fields currently indexed");
  const fieldSources = (agent.field_sources ?? {}) as Record<string, unknown>;
  for (const key of [
    "x402_supported",
    "mcp_server",
    "a2a_endpoint",
    "agent_wallet",
    "agent_wallet_chain_id",
    "capabilities",
    "tags",
    "categories",
  ]) {
    console.log(`- ${key}: ${String(fieldSources[key] ?? "null")}`);
  }

  console.log("\nLeaderboard top 5");
  const items = (leaderboard.items ?? []) as Array<Record<string, unknown>>;
  for (const item of items) {
    console.log(`- #${item.rank} ${item.name}: ${item.total_score}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

