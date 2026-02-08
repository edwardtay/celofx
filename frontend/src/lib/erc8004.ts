import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import {
  IDENTITY_REGISTRY_ADDRESS,
  REPUTATION_REGISTRY_ADDRESS,
  identityRegistryAbi,
  reputationRegistryAbi,
} from "@/config/contracts";

export const publicClient = createPublicClient({
  chain: celo,
  transport: http(),
});

export async function getAgentURI(agentId: bigint): Promise<string> {
  return publicClient.readContract({
    address: IDENTITY_REGISTRY_ADDRESS,
    abi: identityRegistryAbi,
    functionName: "tokenURI",
    args: [agentId],
  });
}

export async function getAgentOwner(agentId: bigint): Promise<string> {
  return publicClient.readContract({
    address: IDENTITY_REGISTRY_ADDRESS,
    abi: identityRegistryAbi,
    functionName: "ownerOf",
    args: [agentId],
  }) as Promise<string>;
}

export async function getReputationSummary(
  agentId: bigint
): Promise<{ count: bigint; summaryValue: bigint; summaryValueDecimals: number }> {
  const [count, summaryValue, summaryValueDecimals] = (await publicClient.readContract({
    address: REPUTATION_REGISTRY_ADDRESS,
    abi: reputationRegistryAbi,
    functionName: "getSummary",
    args: [agentId, [], "", ""],
  })) as [bigint, bigint, number];
  return { count, summaryValue, summaryValueDecimals };
}

export async function getAllFeedback(agentId: bigint) {
  return publicClient.readContract({
    address: REPUTATION_REGISTRY_ADDRESS,
    abi: reputationRegistryAbi,
    functionName: "readAllFeedback",
    args: [agentId, [], "", "", false],
  });
}
