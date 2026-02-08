"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, Loader2, Zap, CheckCircle2, AlertCircle } from "lucide-react";

const SCAN_STEPS = [
  "Scanning crypto markets...",
  "Scanning stock markets...",
  "Scanning forex pairs...",
  "Scanning commodities...",
  "Generating signals...",
];

export function AgentStatus() {
  const [analyzing, setAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);
  const [signalCount, setSignalCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanStep, setScanStep] = useState(0);
  const queryClient = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (analyzing) {
      setScanStep(0);
      intervalRef.current = setInterval(() => {
        setScanStep((s) => (s + 1) % SCAN_STEPS.length);
      }, 3000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [analyzing]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/analyze", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setLastAnalysis(new Date().toLocaleTimeString());
        setSignalCount(data.signalCount);
        queryClient.invalidateQueries({ queryKey: ["signals"] });
      } else {
        setError(data.error || "Analysis failed");
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      setError("Network error — check API key");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Card className="gap-0 py-0">
      <CardContent className="py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-emerald-500" />
              <span className="text-sm font-medium">Agent #4</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {analyzing && (
              <span className="text-xs text-muted-foreground animate-pulse">
                {SCAN_STEPS[scanStep]}
              </span>
            )}
            {!analyzing && lastAnalysis && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="size-3.5" />
                {lastAnalysis}
                {signalCount !== null && ` · ${signalCount} signals`}
              </div>
            )}
            {error && (
              <div className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertCircle className="size-3.5" />
                {error}
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
