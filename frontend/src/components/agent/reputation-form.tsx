"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWriteContract, useAccount } from "wagmi";
import {
  REPUTATION_REGISTRY_ADDRESS,
  reputationRegistryAbi,
} from "@/config/contracts";
import { useAgentId } from "@/hooks/use-agent-profile";
import { Star, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

export function ReputationForm() {
  const [score, setScore] = useState(0);
  const [hoverScore, setHoverScore] = useState(0);
  const [comment, setComment] = useState("");
  const { isConnected } = useAccount();
  const agentId = useAgentId();
  const { writeContract, isPending } = useWriteContract();

  const handleSubmit = () => {
    if (score === 0) return;
    // ERC-8004 giveFeedback: score maps to value (1-5 scale, 0 decimals)
    // tag1 = "quality", tag2 = comment text, endpoint = app URL
    writeContract({
      address: REPUTATION_REGISTRY_ADDRESS,
      abi: reputationRegistryAbi,
      functionName: "giveFeedback",
      args: [
        agentId,
        BigInt(score * 20), // Scale 1-5 → 20-100
        0, // valueDecimals (integer)
        "quality", // tag1
        comment.trim() || "signal-accuracy", // tag2
        typeof window !== "undefined" ? window.location.origin : "", // endpoint
        "", // feedbackURI
        ZERO_BYTES32, // feedbackHash
      ],
    });
  };

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Connect your wallet to leave feedback
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Leave Feedback</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground mb-2">Rating</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setScore(s)}
                onMouseEnter={() => setHoverScore(s)}
                onMouseLeave={() => setHoverScore(0)}
                className="p-0.5"
              >
                <Star
                  className={cn(
                    "size-5 transition-colors",
                    (hoverScore || score) >= s
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted"
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">Comment</p>
          <Input
            placeholder="How was the agent's analysis?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={score === 0 || isPending}
          className="w-full gap-1.5"
        >
          <Send className="size-3.5" />
          {isPending ? "Submitting..." : "Submit Feedback"}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Feedback is recorded on-chain via ERC-8004 Reputation Registry
        </p>
      </CardContent>
    </Card>
  );
}
