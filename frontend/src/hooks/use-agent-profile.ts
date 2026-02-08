"use client";

import { useReadContract } from "wagmi";
import {
  IDENTITY_REGISTRY_ADDRESS,
  REPUTATION_REGISTRY_ADDRESS,
  identityRegistryAbi,
  reputationRegistryAbi,
} from "@/config/contracts";
import { celoAlfajores } from "wagmi/chains";

const AGENT_ID = BigInt(process.env.NEXT_PUBLIC_AGENT_ID || "1");

export function useAgentTokenURI() {
  return useReadContract({
    address: IDENTITY_REGISTRY_ADDRESS,
    abi: identityRegistryAbi,
    functionName: "tokenURI",
    args: [AGENT_ID],
    chainId: celoAlfajores.id,
  });
}

export function useAgentOwner() {
  return useReadContract({
    address: IDENTITY_REGISTRY_ADDRESS,
    abi: identityRegistryAbi,
    functionName: "ownerOf",
    args: [AGENT_ID],
    chainId: celoAlfajores.id,
  });
}

export function useAgentWallet() {
  return useReadContract({
    address: IDENTITY_REGISTRY_ADDRESS,
    abi: identityRegistryAbi,
    functionName: "getAgentWallet",
    args: [AGENT_ID],
    chainId: celoAlfajores.id,
  });
}

export function useReputationSummary() {
  return useReadContract({
    address: REPUTATION_REGISTRY_ADDRESS,
    abi: reputationRegistryAbi,
    functionName: "getSummary",
    args: [AGENT_ID, [], "", ""],
    chainId: celoAlfajores.id,
  });
}

export function useReputationFeedback() {
  return useReadContract({
    address: REPUTATION_REGISTRY_ADDRESS,
    abi: reputationRegistryAbi,
    functionName: "readAllFeedback",
    args: [AGENT_ID, [], "", "", false],
    chainId: celoAlfajores.id,
  });
}

export function useAgentId() {
  return AGENT_ID;
}
