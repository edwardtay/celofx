import { NextResponse } from "next/server";
import { AGENT_POLICY, hashPolicy, getDecisionLog } from "@/lib/agent-policy";

export async function GET() {
  return NextResponse.json({
    policy: AGENT_POLICY,
    policyHash: hashPolicy(),
    decisions: getDecisionLog().map((d) => ({
      hash: d.hash,
      orderId: d.orderId,
      action: d.action,
      timestamp: d.timestamp,
      currentRate: d.currentRate,
      targetRate: d.targetRate,
      momentum: d.momentum,
      urgency: d.urgency,
    })),
    verification: {
      howToVerify: "keccak256(abi.encodePacked(orderId, action, reasoning, timestamp)) == hash",
      policyIntegrity: "keccak256(abi.encodePacked(JSON.stringify(policy))) == policyHash",
    },
  });
}
