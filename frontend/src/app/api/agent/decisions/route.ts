import { getDecisionLog, verifyDecision, getAgentStatus, getVolumeLog, AGENT_POLICY, hashPolicy } from "@/lib/agent-policy";
import type { AgentDecision } from "@/lib/agent-policy";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hash = url.searchParams.get("hash");

  const decisions = getDecisionLog();
  const status = getAgentStatus();

  // Single decision lookup by hash
  if (hash) {
    const match = decisions.find((d) => d.hash === hash);
    if (!match) {
      return Response.json({ error: "Decision hash not found", hash }, { status: 404 });
    }
    return Response.json({
      decision: match,
      verified: true,
      verifiedAt: Date.now(),
    });
  }

  // Full audit log
  return Response.json({
    agentStatus: status,
    policyHash: hashPolicy(),
    policy: {
      maxSwapPerTx: AGENT_POLICY.permissions.maxSwapPerTx,
      maxDailyVolume: AGENT_POLICY.permissions.maxDailyVolume,
      minProfitableSpread: AGENT_POLICY.permissions.minProfitableSpread,
      allowedTokens: AGENT_POLICY.permissions.allowedTokens.map((t) => t.symbol),
      allowedProtocols: AGENT_POLICY.permissions.allowedProtocols.map((p) => p.name),
    },
    volumeLog: getVolumeLog(),
    decisions: decisions.map((d) => ({
      hash: d.hash,
      orderId: d.orderId,
      action: d.action,
      timestamp: d.timestamp,
      currentRate: d.currentRate,
      targetRate: d.targetRate,
      momentum: d.momentum,
      urgency: d.urgency,
    })),
    totalDecisions: decisions.length,
    howToVerify: {
      description: "Each decision hash = keccak256(abi.encodePacked(orderId, action, reasoning, timestamp)). Provide the full decision to /api/agent/decisions?verify=true to verify.",
      endpoint: "GET /api/agent/decisions?hash=0x...",
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId, action, reasoning, timestamp } = body as AgentDecision & { expectedHash?: string };
    const expectedHash = body.expectedHash as string;

    if (!orderId || !action || !reasoning || !timestamp || !expectedHash) {
      return Response.json(
        { error: "Missing fields. Required: orderId, action, reasoning, timestamp, expectedHash" },
        { status: 400 }
      );
    }

    const decision: AgentDecision = {
      orderId,
      action,
      reasoning,
      timestamp,
      currentRate: body.currentRate || 0,
      targetRate: body.targetRate || 0,
      momentum: body.momentum || "n/a",
      urgency: body.urgency || "n/a",
    };

    const isValid = verifyDecision(decision, expectedHash);

    return Response.json({
      valid: isValid,
      expectedHash,
      decision: { orderId, action, timestamp },
      message: isValid
        ? "Decision hash matches — this decision was committed before execution."
        : "Hash mismatch — the provided data does not match the expected hash.",
    });
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
