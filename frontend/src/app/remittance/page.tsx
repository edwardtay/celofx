"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  ArrowRight,
  Loader2,
  DollarSign,
  Globe,
  TrendingDown,
  CheckCircle2,
  MessageSquare,
  Clock,
  MapPin,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import {
  useAccount,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from "wagmi";

interface Provider {
  name: string;
  pct: number;
  fee: string;
  receive: string;
  time: string;
  highlight: boolean;
}

interface RemittanceResult {
  parsed: {
    fromToken: string;
    toToken: string;
    amount: number;
    corridor: string;
    recipientCountry: string | null;
    language: string;
  };
  quote: {
    rate: number;
    amountOut: string;
    exchangeId: string;
    sameToken: boolean;
  };
  providers: Provider[];
  savings: {
    amount: string;
    pct: string;
    vs: string;
  };
  strings: {
    saving: string;
    via: string;
    instantly: string;
  };
}

interface SwapTxData {
  approvalTx: { to: string; data: string };
  swapTx: { to: string; data: string };
  summary: {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    expectedOut: string;
    rate: number;
  };
}

type ExecStep =
  | "idle"
  | "building"
  | "approving"
  | "swapping"
  | "done";

const QUICK_ACTIONS = [
  { label: "\u{1F1F5}\u{1F1ED} Philippines", message: "Send $50 to my family in the Philippines" },
  { label: "\u{1F1F3}\u{1F1EC} Nigeria", message: "Send $100 to Nigeria" },
  { label: "\u{1F1F8}\u{1F1F3} S\u00e9n\u00e9gal", message: "Envoyer 200 euros au S\u00e9n\u00e9gal" },
  { label: "\u{1F1E7}\u{1F1F7} Brasil", message: "Transferir 500 reais para euros" },
  { label: "\u{1F1F2}\u{1F1FD} M\u00e9xico", message: "Enviar 100 d\u00f3lares a M\u00e9xico" },
  { label: "\u{1F1F0}\u{1F1EA} Kenya", message: "Send $75 to Kenya" },
];

export default function RemittancePage() {
  const { isConnected } = useAccount();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RemittanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Execution state
  const [execStep, setExecStep] = useState<ExecStep>("idle");
  const [execError, setExecError] = useState<string | null>(null);
  const [txData, setTxData] = useState<SwapTxData | null>(null);

  // Approval tx
  const {
    sendTransaction: sendApproval,
    data: approveHash,
    reset: resetApproval,
    isPending: approvalPending,
  } = useSendTransaction();

  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Swap tx
  const {
    sendTransaction: sendSwap,
    data: swapHash,
    reset: resetSwap,
    isPending: swapPending,
  } = useSendTransaction();

  const { isSuccess: swapConfirmed } = useWaitForTransactionReceipt({
    hash: swapHash,
  });

  // After approval confirmed → send swap
  useEffect(() => {
    if (approveConfirmed && execStep === "approving" && txData) {
      setExecStep("swapping");
      sendSwap({
        to: txData.swapTx.to as `0x${string}`,
        data: txData.swapTx.data as `0x${string}`,
      });
    }
  }, [approveConfirmed, execStep, txData, sendSwap]);

  // After swap confirmed → done
  useEffect(() => {
    if (swapConfirmed && execStep === "swapping") {
      setExecStep("done");
    }
  }, [swapConfirmed, execStep]);

  const handleSubmit = async () => {
    if (!message.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setExecStep("idle");
    setExecError(null);
    setTxData(null);
    resetApproval();
    resetSwap();

    try {
      const res = await fetch("/api/remittance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Something went wrong");
        return;
      }

      setResult(json);
    } catch {
      setError("Network error \u2014 please try again");
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!result || result.quote.sameToken) return;

    setExecStep("building");
    setExecError(null);

    try {
      // Fetch tx data from swap quote API
      const res = await fetch("/api/swap/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromToken: result.parsed.fromToken,
          toToken: result.parsed.toToken,
          amount: String(result.parsed.amount),
          slippage: 1,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to build swap");
      }

      const data: SwapTxData = await res.json();
      setTxData(data);

      // Send approval tx
      setExecStep("approving");
      sendApproval({
        to: data.approvalTx.to as `0x${string}`,
        data: data.approvalTx.data as `0x${string}`,
      });
    } catch (err) {
      setExecError(
        err instanceof Error ? err.message : "Execution failed"
      );
      setExecStep("idle");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChipClick = (text: string) => {
    setMessage(text);
    setResult(null);
    setError(null);
    setExecStep("idle");
    setExecError(null);
  };

  const isExecuting = execStep === "building" || execStep === "approving" || execStep === "swapping";

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 px-6 py-6 max-w-3xl mx-auto w-full space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display tracking-tight">Remittance</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">
            Send money across borders using Celo stablecoins. Describe your
            transfer in any language.
          </p>
        </div>

        {/* Chat Input */}
        <Card className="gap-0 py-0">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-start gap-2">
              <MessageSquare className="size-4 text-muted-foreground mt-2.5 shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Send $50 to the Philippines..."
                    disabled={loading}
                    className="flex-1 px-3 py-2.5 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !message.trim()}
                    className="px-4 py-2.5 text-sm font-medium bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowRight className="size-4" />
                    )}
                  </button>
                </div>

                {/* Quick action chips */}
                <div className="flex flex-wrap gap-2">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => handleChipClick(action.message)}
                      disabled={loading}
                      className="px-3 py-1.5 text-xs font-medium border rounded-full hover:bg-accent transition-colors disabled:opacity-50"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <div className="border border-red-200 bg-red-50 rounded-lg p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Route visualization */}
            <Card className="gap-0 py-0">
              <CardContent className="py-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Transfer Route</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                  >
                    {result.parsed.corridor}
                  </Badge>
                  {result.parsed.recipientCountry && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1"
                    >
                      <MapPin className="size-2.5" />
                      {result.parsed.recipientCountry}
                    </Badge>
                  )}
                </div>

                {/* Amount flow */}
                <div className="flex items-center justify-center gap-4 py-3">
                  <div className="text-center">
                    <p className="text-2xl font-mono font-bold">
                      {result.parsed.amount} {result.parsed.fromToken}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Sending
                    </p>
                  </div>
                  <ArrowRight className="size-5 text-muted-foreground shrink-0" />
                  <div className="text-center">
                    <p className="text-2xl font-mono font-bold text-emerald-600">
                      {result.quote.amountOut} {result.parsed.toToken}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Receiving
                    </p>
                  </div>
                </div>

                {/* Rate */}
                {!result.quote.sameToken && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <span>
                      1 {result.parsed.fromToken} ={" "}
                      {result.quote.rate.toFixed(4)} {result.parsed.toToken}
                    </span>
                    <span className="text-muted-foreground/50">|</span>
                    <span>Mento Broker (on-chain)</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Fee comparison */}
            <Card className="gap-0 py-0">
              <CardContent className="py-4 space-y-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Fee Comparison</span>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  {/* Header */}
                  <div className="grid grid-cols-4 gap-px bg-muted text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    <div className="bg-background px-3 py-2">Provider</div>
                    <div className="bg-background px-3 py-2 text-right">Fee</div>
                    <div className="bg-background px-3 py-2 text-right">
                      You receive
                    </div>
                    <div className="bg-background px-3 py-2 text-right">
                      Speed
                    </div>
                  </div>

                  {/* Provider rows */}
                  {result.providers.map((p) => (
                    <div key={p.name} className="grid grid-cols-4 gap-px bg-muted">
                      <div
                        className={`px-3 py-2.5 flex items-center gap-2 ${
                          p.highlight ? "bg-emerald-50" : "bg-background"
                        }`}
                      >
                        {p.highlight && (
                          <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                        )}
                        <span
                          className={`text-sm ${
                            p.highlight
                              ? "font-medium text-emerald-900"
                              : "text-muted-foreground"
                          }`}
                        >
                          {p.name}
                        </span>
                      </div>
                      <div
                        className={`px-3 py-2.5 text-right ${
                          p.highlight ? "bg-emerald-50" : "bg-background"
                        }`}
                      >
                        <span
                          className={`text-sm font-mono ${
                            p.highlight
                              ? "font-medium text-emerald-700"
                              : p.pct > 3
                                ? "text-red-600 line-through decoration-red-400/50"
                                : "text-muted-foreground"
                          }`}
                        >
                          ${p.fee}
                        </span>
                        <span
                          className={`text-[10px] ml-1 ${
                            p.highlight
                              ? "text-emerald-600"
                              : p.pct > 3
                                ? "text-red-500"
                                : "text-muted-foreground"
                          }`}
                        >
                          ({p.pct}%)
                        </span>
                      </div>
                      <div
                        className={`px-3 py-2.5 text-right ${
                          p.highlight ? "bg-emerald-50" : "bg-background"
                        }`}
                      >
                        <span
                          className={`text-sm font-mono ${
                            p.highlight
                              ? "font-bold text-emerald-700"
                              : "text-muted-foreground"
                          }`}
                        >
                          {p.receive} {result.parsed.toToken}
                        </span>
                      </div>
                      <div
                        className={`px-3 py-2.5 text-right flex items-center justify-end gap-1 ${
                          p.highlight ? "bg-emerald-50" : "bg-background"
                        }`}
                      >
                        <Clock
                          className={`size-3 ${
                            p.highlight
                              ? "text-emerald-600"
                              : "text-muted-foreground"
                          }`}
                        />
                        <span
                          className={`text-[11px] ${
                            p.highlight
                              ? "text-emerald-700 font-medium"
                              : "text-muted-foreground"
                          }`}
                        >
                          {p.time}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Savings highlight */}
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <TrendingDown className="size-4 text-emerald-600 shrink-0" />
                  <p className="text-sm text-emerald-800">
                    {result.strings.saving}{" "}
                    <span className="font-mono font-bold">
                      ${result.savings.amount}
                    </span>{" "}
                    vs {result.savings.vs} ({result.savings.pct}% lower fees) \u2014{" "}
                    {result.strings.instantly.toLowerCase()}{" "}
                    {result.strings.via}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Execute */}
            <Card className="gap-0 py-0">
              <CardContent className="py-4 space-y-3">
                {execStep === "done" && swapHash ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 py-2 text-emerald-700">
                      <CheckCircle2 className="size-5" />
                      <span className="text-sm font-medium">
                        Transfer confirmed on-chain
                      </span>
                    </div>
                    <a
                      href={`https://celoscan.io/tx/${swapHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <span className="font-mono text-xs">
                        {swapHash.slice(0, 10)}...{swapHash.slice(-8)}
                      </span>
                      <ExternalLink className="size-3.5" />
                    </a>
                    {approveHash && (
                      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                        <span>Approval:</span>
                        <a
                          href={`https://celoscan.io/tx/${approveHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono hover:text-foreground transition-colors"
                        >
                          {approveHash.slice(0, 10)}...{approveHash.slice(-8)}
                        </a>
                      </div>
                    )}
                  </div>
                ) : result.quote.sameToken ? (
                  <div className="text-center py-2">
                    <p className="text-sm text-muted-foreground">
                      Same-token corridor ({result.parsed.corridor}) \u2014 no on-chain swap needed.
                      Send {result.parsed.fromToken} directly to your recipient.
                    </p>
                  </div>
                ) : isConnected ? (
                  <div className="space-y-3">
                    <button
                      onClick={handleExecute}
                      disabled={isExecuting || approvalPending || swapPending}
                      className="w-full px-4 py-3 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {execStep === "building" ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Building transaction...
                        </>
                      ) : execStep === "approving" ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Approve {result.parsed.fromToken} spend...
                        </>
                      ) : execStep === "swapping" ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Swapping via Mento Broker...
                        </>
                      ) : (
                        <>
                          <Send className="size-4" />
                          Execute Transfer via Mento
                        </>
                      )}
                    </button>

                    {/* Progress steps */}
                    {isExecuting && (
                      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                        <span className={execStep === "building" ? "text-foreground font-medium" : approveConfirmed ? "text-emerald-600" : ""}>
                          {approveConfirmed ? "\u2713" : "1."} Build
                        </span>
                        <ChevronRight className="size-3" />
                        <span className={execStep === "approving" ? "text-foreground font-medium" : approveConfirmed ? "text-emerald-600" : ""}>
                          {approveConfirmed ? "\u2713" : "2."} Approve
                        </span>
                        <ChevronRight className="size-3" />
                        <span className={execStep === "swapping" ? "text-foreground font-medium" : ""}>
                          3. Swap
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    disabled
                    className="w-full px-4 py-3 text-sm font-medium bg-muted text-muted-foreground rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Send className="size-4" />
                    Connect wallet to execute
                  </button>
                )}

                {execError && (
                  <p className="text-sm text-red-600 text-center">{execError}</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
