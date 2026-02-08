"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, Loader2, Zap } from "lucide-react";

export function AgentStatus() {
  const [analyzing, setAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);
  const [signalCount, setSignalCount] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/agent/analyze", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setLastAnalysis(new Date().toLocaleTimeString());
        setSignalCount(data.signalCount);
        queryClient.invalidateQueries({ queryKey: ["signals"] });
      }
    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Card className="gap-0 py-0">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-emerald-500" />
              <span className="text-sm font-medium">Agent Status</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {lastAnalysis && (
              <div className="text-xs text-muted-foreground">
                Last run: {lastAnalysis}
                {signalCount !== null && ` · ${signalCount} signals`}
              </div>
            )}
            <Button
              size="sm"
              onClick={runAnalysis}
              disabled={analyzing}
              className="gap-1.5"
            >
              {analyzing ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Zap className="size-3.5" />
                  Run Analysis
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
