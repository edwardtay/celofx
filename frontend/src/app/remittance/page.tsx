"use client";

import { useState, useEffect, useCallback } from "react";
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
  AlertTriangle,
} from "lucide-react";
import {
  useAccount,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  addRemittanceTransaction,
  updateRemittanceTransaction,
  checkSpendingLimit,
  type RemittanceTransaction,
} from "@/lib/remittance-store";
import { TransferHistory } from "@/components/remittance/transfer-history";
import { RecurringTransfers } from "@/components/remittance/recurring-transfers";
import { SpendingLimitsCard } from "@/components/remittance/spending-limits";
import { TransferReceipt } from "@/components/remittance/receipt";

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
  | "transferring"
  | "done";

type ExecutionMode = "agent" | "wallet";

const QUICK_ACTIONS = [
  { label: "\u{1F1F3}\u{1F1EC} Nigeria", message: "Send $100 to Lagos, Nigeria" },
  { label: "\u{1F1F0}\u{1F1EA} Kenya", message: "Send $75 to Nairobi, Kenya" },
  { label: "\u{1F1F5}\u{1F1ED} Philippines", message: "Send $50 to my family in the Philippines" },
  { label: "\u{1F1F8}\u{1F1F3} S\u00e9n\u00e9gal", message: "Envoyer 200 euros au S\u00e9n\u00e9gal" },
  { label: "\u{1F1E7}\u{1F1F7} Brasil", message: "Transferir 500 reais para euros" },
  { label: "\u{1F1F2}\u{1F1FD} M\u00e9xico", message: "Enviar 100 d\u00f3lares a M\u00e9xico" },
];

function isAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

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
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("agent");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [agentTxHashes, setAgentTxHashes] = useState<{
    approvalTxHash: string | null;
    swapTxHash: string | null;
    transferTxHash: string | null;
  }>({ approvalTxHash: null, swapTxHash: null, transferTxHash: null });

  // Spending limit warning
  const [limitWarning, setLimitWarning] = useState<string | null>(null);

  // Current transaction ID for tracking
  const [currentTxId, setCurrentTxId] = useState<string | null>(null);

  // Receipt view
  const [receiptTx, setReceiptTx] = useState<RemittanceTransaction | null>(null);

  // Refresh key for child components
  const [refreshKey, setRefreshKey] = useState(0);

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
      // Update tx with approval hash
      if (currentTxId && approveHash) {
        updateRemittanceTransaction(currentTxId, {
          approvalHash: approveHash,
        });
      }
      setExecStep("swapping");
      sendSwap({
        to: txData.swapTx.to as `0x${string}`,
        data: txData.swapTx.data as `0x${string}`,
      });
    }
  }, [approveConfirmed, execStep, txData, sendSwap, currentTxId, approveHash]);

  // After swap confirmed → done, save to history
  useEffect(() => {
    if (swapConfirmed && execStep === "swapping") {
      setExecStep("done");
      if (currentTxId && swapHash) {
        updateRemittanceTransaction(currentTxId, {
          status: "executed",
          txHash: swapHash,
        });
        setRefreshKey((k) => k + 1);
      }
    }
  }, [swapConfirmed, execStep, currentTxId, swapHash]);

  const handleSubmit = async () => {
    if (!message.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setExecStep("idle");
    setExecError(null);
    setTxData(null);
    setAgentTxHashes({ approvalTxHash: null, swapTxHash: null, transferTxHash: null });
    setLimitWarning(null);
    setReceiptTx(null);
    setCurrentTxId(null);
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
        const rawError = String(json.error || "Something went wrong");
        if (rawError.includes("RATE_LIMITED")) {
          setError("Upstream quote service is busy. Please retry in a few seconds.");
        } else {
          setError(rawError);
        }
        return;
      }

      setResult(json);

      // Check spending limits
      const limitCheck = checkSpendingLimit(json.parsed.amount);
      if (!limitCheck.allowed) {
        setLimitWarning(limitCheck.reason);
      }

      // Save to history as "quoted"
      const txId = `rem-${Date.now()}`;
      setCurrentTxId(txId);
      addRemittanceTransaction({
        id: txId,
        timestamp: Date.now(),
        message: message.trim(),
        corridor: json.parsed.corridor,
        fromToken: json.parsed.fromToken,
        toToken: json.parsed.toToken,
        amount: json.parsed.amount,
        amountOut: json.quote.amountOut,
        rate: json.quote.rate,
        recipientCountry: json.parsed.recipientCountry,
        language: json.parsed.language,
        txHash: null,
        approvalHash: null,
        status: "quoted",
        fee: json.providers[0]?.fee || "0",
        savingsVs: json.savings.vs,
        savingsAmount: json.savings.amount,
      });
      setRefreshKey((k) => k + 1);
    } catch {
      setError("Network error \u2014 please try again");
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!result) return;

    // Block if spending limit exceeded
    if (limitWarning) {
      setExecError(limitWarning);
      return;
    }
    if (!isAddress(recipientAddress)) {
      setExecError("Enter a valid recipient wallet address (0x...)");
      return;
    }

    setExecStep("building");
    setExecError(null);
    setAgentTxHashes({ approvalTxHash: null, swapTxHash: null, transferTxHash: null });

    try {
      if (executionMode === "agent") {
        const res = await fetch("/api/remittance/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromToken: result.parsed.fromToken,
            toToken: result.parsed.toToken,
            amount: String(result.parsed.amount),
            recipientAddress: recipientAddress.trim(),
            corridor: result.parsed.corridor,
            slippage: 1,
          }),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Agentic execution failed");

        setAgentTxHashes({
          approvalTxHash: json.approvalTxHash ?? null,
          swapTxHash: json.swapTxHash ?? null,
          transferTxHash: json.transferTxHash ?? null,
        });
        setExecStep("done");

        if (currentTxId) {
          updateRemittanceTransaction(currentTxId, {
            status: "executed",
            txHash: json.transferTxHash ?? null,
            approvalHash: json.approvalTxHash ?? null,
          });
          setRefreshKey((k) => k + 1);
        }
        return;
      }

      if (result.quote.sameToken) {
        setExecError("Wallet mode currently supports swap routes only. Use Agentic mode for direct transfer.");
        setExecStep("idle");
        return;
      }

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
      if (currentTxId) {
        updateRemittanceTransaction(currentTxId, { status: "failed" });
        setRefreshKey((k) => k + 1);
      }
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
    setAgentTxHashes({ approvalTxHash: null, swapTxHash: null, transferTxHash: null });
    setLimitWarning(null);
    setReceiptTx(null);
  };

  const handleViewReceipt = useCallback((tx: RemittanceTransaction) => {
    setReceiptTx(tx);
  }, []);

  const isExecuting =
    execStep === "building" ||
    execStep === "approving" ||
    execStep === "swapping" ||
    execStep === "transferring";
  const finalTxHash = agentTxHashes.transferTxHash || swapHash || null;
  const approvalTxHash = agentTxHashes.approvalTxHash || approveHash || null;
  const intermediateSwapHash = agentTxHashes.swapTxHash || null;

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

        {/* Receipt overlay */}
        {receiptTx && (
          <TransferReceipt
            tx={receiptTx}
            onClose={() => setReceiptTx(null)}
          />
        )}

        {/* Results */}
        {result && !receiptTx && (
          <div className="space-y-4">
            {/* Spending limit warning */}
            {limitWarning && (
              <div className="flex items-start gap-2 border border-amber-200 bg-amber-50 rounded-lg p-3">
                <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Spending limit reached</p>
                  <p className="text-xs text-amber-700 mt-0.5">{limitWarning}</p>
                </div>
              </div>
            )}

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
                    <span>CeloFX native on-chain swap route</span>
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
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">
                    Recipient wallet (Celo EVM address)
                  </label>
                  <input
                    type="text"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2.5 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExecutionMode("agent")}
                      className={`px-2.5 py-1.5 text-xs rounded-full border ${
                        executionMode === "agent"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "text-muted-foreground"
                      }`}
                    >
                      Agentic (swap + transfer)
                    </button>
                    <button
                      type="button"
                      onClick={() => setExecutionMode("wallet")}
                      className={`px-2.5 py-1.5 text-xs rounded-full border ${
                        executionMode === "wallet"
                          ? "bg-blue-50 border-blue-200 text-blue-700"
                          : "text-muted-foreground"
                      }`}
                    >
                      Wallet (swap only)
                    </button>
                  </div>
                </div>

                {execStep === "done" && finalTxHash ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 py-2 text-emerald-700">
                      <CheckCircle2 className="size-5" />
                      <span className="text-sm font-medium">
                        Transfer confirmed on-chain
                      </span>
                    </div>
                    <a
                      href={`https://celoscan.io/tx/${finalTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <span className="font-mono text-xs">
                        {finalTxHash.slice(0, 10)}...{finalTxHash.slice(-8)}
                      </span>
                      <ExternalLink className="size-3.5" />
                    </a>
                    {approvalTxHash && (
                      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                        <span>Approval:</span>
                        <a
                          href={`https://celoscan.io/tx/${approvalTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono hover:text-foreground transition-colors"
                        >
                          {approvalTxHash.slice(0, 10)}...{approvalTxHash.slice(-8)}
                        </a>
                      </div>
                    )}
                    {intermediateSwapHash && (
                      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                        <span>Swap:</span>
                        <a
                          href={`https://celoscan.io/tx/${intermediateSwapHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono hover:text-foreground transition-colors"
                        >
                          {intermediateSwapHash.slice(0, 10)}...{intermediateSwapHash.slice(-8)}
                        </a>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        if (currentTxId) {
                          const tx = {
                            id: currentTxId,
                            timestamp: Date.now(),
                            message: message,
                            corridor: result.parsed.corridor,
                            fromToken: result.parsed.fromToken,
                            toToken: result.parsed.toToken,
                            amount: result.parsed.amount,
                            amountOut: result.quote.amountOut,
                            rate: result.quote.rate,
                            recipientCountry: result.parsed.recipientCountry,
                            language: result.parsed.language,
                            txHash: finalTxHash,
                            approvalHash: approvalTxHash,
                            status: "executed" as const,
                            fee: result.providers[0]?.fee || "0",
                            savingsVs: result.savings.vs,
                            savingsAmount: result.savings.amount,
                          };
                          setReceiptTx(tx);
                        }
                      }}
                      className="w-full text-center text-xs text-blue-600 hover:text-blue-700 transition-colors py-1"
                    >
                      View receipt
                    </button>
                  </div>
                ) : executionMode === "agent" ? (
                  <div className="space-y-3">
                    <button
                      onClick={handleExecute}
                      disabled={isExecuting || !!limitWarning}
                      className="w-full px-4 py-3 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {limitWarning ? (
                        <>
                          <AlertTriangle className="size-4" />
                          Limit exceeded
                        </>
                      ) : execStep === "building" ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Agent executing transfer...
                        </>
                      ) : (
                        <>
                          <Send className="size-4" />
                          Execute Agentic Remittance
                        </>
                      )}
                    </button>
                    <p className="text-[11px] text-muted-foreground text-center">
                      Agent mode executes swap (if needed) then transfer to recipient.
                    </p>
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
                      disabled={isExecuting || approvalPending || swapPending || !!limitWarning}
                      className="w-full px-4 py-3 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {limitWarning ? (
                        <>
                          <AlertTriangle className="size-4" />
                          Limit exceeded
                        </>
                      ) : execStep === "building" ? (
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
                          Swapping on Celo...
                        </>
                      ) : (
                        <>
                          <Send className="size-4" />
                          Execute Wallet Swap
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

        {/* Spending Limits */}
        <SpendingLimitsCard refreshKey={refreshKey} />

        {/* Recurring Transfers */}
        <RecurringTransfers
          pendingTransfer={
            result
              ? {
                  message,
                  corridor: result.parsed.corridor,
                  fromToken: result.parsed.fromToken,
                  toToken: result.parsed.toToken,
                  amount: result.parsed.amount,
                  recipientCountry: result.parsed.recipientCountry,
                }
              : null
          }
          refreshKey={refreshKey}
        />

        {/* Transfer History */}
        <TransferHistory
          refreshKey={refreshKey}
          onViewReceipt={handleViewReceipt}
        />
      </main>
      <Footer />
    </div>
  );
}
