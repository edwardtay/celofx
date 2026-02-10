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
import { Star, Send, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

export function ReputationForm() {
  const [score, setScore] = useState(0);
  const [hoverScore, setHoverScore] = useState(0);
  const [comment, setComment] = useState("");
  const { isConnected } = useAccount();
  const agentId = useAgentId();
  const [submitted, setSubmitted] = useState(false);
  const { writeContract, isPending, isSuccess, isError } = useWriteContract();

  const handleSubmit = () => {
    if (score === 0) return;
    writeContract(
      {
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
      },
      {
        onSuccess: () => {
          setSubmitted(true);
          setScore(0);
          setComment("");
        },
      }
    );
  };

  if (!isConnected) {
    return (
      <Card>
        <CardContent className="py-6 text-center space-y-2">
          <Star className="size-5 mx-auto text-muted-foreground" />
          <p className="text-sm font-medium">Rate this agent</p>
          <p className="text-xs text-muted-foreground">
            Connect your wallet on Celo to rate this agent — your feedback is stored permanently on-chain
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rate FX Arbitrage Agent</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Your feedback is recorded permanently on-chain. It shapes this agent&apos;s reputation score and is visible to all users.
        </p>
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
                aria-label={`Rate ${s} out of 5 stars`}
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
            placeholder="e.g., BTC long call was spot on"
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

        {submitted && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="size-3.5" />
            Feedback submitted on-chain!
          </div>
        )}
        {isError && (
          <p className="text-xs text-red-600 text-center">
            Transaction failed — make sure your wallet is connected to Celo Mainnet
          </p>
        )}
        <p className="text-xs text-muted-foreground text-center">
          Feedback is recorded on-chain via ERC-8004 Reputation Registry
        </p>
      </CardContent>
    </Card>
  );
}
