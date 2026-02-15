"use client";

import { useCallback, useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAccount, useSignMessage } from "wagmi";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  Send,
  TrendingDown,
  ChevronDown,
} from "lucide-react";
import {
  addRemittanceTransaction,
  checkSpendingLimit,
  type RemittanceTransaction,
  updateRemittanceTransaction,
} from "@/lib/remittance-store";
import { SpendingLimitsCard } from "@/components/remittance/spending-limits";
import { RecurringTransfers } from "@/components/remittance/recurring-transfers";
import { TransferHistory } from "@/components/remittance/transfer-history";
import { TransferReceipt } from "@/components/remittance/receipt";

type RemittanceToken = "cUSD" | "cEUR" | "cREAL";

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
    fromToken: RemittanceToken;
    toToken: RemittanceToken;
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
  lastMile?: {
    localCurrency: string;
    symbol: string;
    name: string;
    fxRate: number;
    localAmount: string;
    chain: string;
  } | null;
  meta?: {
    quoteQuality?: "live" | "fallback";
    executionSource?: "mento_onchain";
    referenceFxSource?: "live_reference" | "cached_reference" | "static_reference";
  };
  warnings?: string[];
}

type ExecStep = "idle" | "building" | "done";

const TOKENS: Array<{ value: RemittanceToken; label: string }> = [
  { value: "cUSD", label: "cUSD (US Dollar stablecoin)" },
  { value: "cEUR", label: "cEUR (Euro stablecoin)" },
  { value: "cREAL", label: "cREAL (Brazilian Real stablecoin)" },
];

const DESTINATIONS = [
  { country: "Nigeria", fiat: "NGN" },
  { country: "Kenya", fiat: "KES" },
  { country: "Philippines", fiat: "PHP" },
  { country: "Senegal", fiat: "XOF" },
  { country: "Brazil", fiat: "BRL" },
  { country: "Mexico", fiat: "MXN" },
  { country: "France", fiat: "EUR" },
] as const;

function isAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

function isValidRecipient(value: string): boolean {
  const v = value.trim();
  return isAddress(v) || v.endsWith(".eth");
}

function toFiatFromToken(token: RemittanceToken): "USD" | "EUR" | "BRL" {
  if (token === "cEUR") return "EUR";
  if (token === "cREAL") return "BRL";
  return "USD";
}

function toTokenForDestination(fiat: string): RemittanceToken {
  if (fiat === "EUR") return "cEUR";
  if (fiat === "BRL") return "cREAL";
  return "cUSD";
}

export default function RemittancePage() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [amount, setAmount] = useState("100");
  const [fromToken, setFromToken] = useState<RemittanceToken>("cUSD");
  const [destinationCountry, setDestinationCountry] = useState("Nigeria");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RemittanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [execStep, setExecStep] = useState<ExecStep>("idle");
  const [execError, setExecError] = useState<string | null>(null);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [agentTxHashes, setAgentTxHashes] = useState<{
    approvalTxHash: string | null;
    swapTxHash: string | null;
    transferTxHash: string | null;
  }>({ approvalTxHash: null, swapTxHash: null, transferTxHash: null });

  const [limitWarning, setLimitWarning] = useState<string | null>(null);
  const [currentTxId, setCurrentTxId] = useState<string | null>(null);
  const [receiptTx, setReceiptTx] = useState<RemittanceTransaction | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const selectedDestination =
    DESTINATIONS.find((d) => d.country === destinationCountry) ?? DESTINATIONS[0];

  const handleQuote = async () => {
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Enter a valid amount greater than 0.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setExecStep("idle");
    setExecError(null);
    setLimitWarning(null);
    setReceiptTx(null);
    setCurrentTxId(null);
    setAgentTxHashes({ approvalTxHash: null, swapTxHash: null, transferTxHash: null });

    try {
      const toToken = toTokenForDestination(selectedDestination.fiat);
      const corridor = `${toFiatFromToken(fromToken)} → ${selectedDestination.fiat}`;

      const res = await fetch("/api/remittance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: {
            amount: amountNum,
            fromToken,
            toToken,
            recipientCountry: selectedDestination.country,
            corridor,
            language: "en",
          },
        }),
      });

      const json: RemittanceResult | { error?: string } = await res.json();
      if (!res.ok) {
        const rawError = String((json as { error?: string }).error || "Something went wrong");
        if (rawError.includes("RATE_LIMITED")) {
          setError("Reference quote service is busy. Retry in a few seconds; Mento settlement flow remains available.");
        } else {
          setError(rawError);
        }
        return;
      }

      const remittance = json as RemittanceResult;
      setResult(remittance);

      const limitCheck = checkSpendingLimit(remittance.parsed.amount);
      if (!limitCheck.allowed) setLimitWarning(limitCheck.reason);

      const txId = `rem-${Date.now()}`;
      const humanMessage = `Send ${amountNum} ${fromToken} to ${selectedDestination.country}`;
      setCurrentTxId(txId);
      addRemittanceTransaction({
        id: txId,
        timestamp: Date.now(),
        message: humanMessage,
        corridor: remittance.parsed.corridor,
        fromToken: remittance.parsed.fromToken,
        toToken: remittance.parsed.toToken,
        amount: remittance.parsed.amount,
        amountOut: remittance.quote.amountOut,
        rate: remittance.quote.rate,
        recipientCountry: remittance.parsed.recipientCountry,
        language: remittance.parsed.language,
        txHash: null,
        approvalHash: null,
        status: "quoted",
        fee: remittance.providers[0]?.fee || "0",
        savingsVs: remittance.savings.vs,
        savingsAmount: remittance.savings.amount,
      });
      setRefreshKey((k) => k + 1);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!result) return;
    if (limitWarning) {
      setExecError(limitWarning);
      return;
    }
    if (!isConnected || !address) {
      setExecError("Connect wallet to authorize this transfer.");
      return;
    }
    if (!isValidRecipient(recipientAddress)) {
      setExecError("Enter a valid recipient wallet (0x...) or ENS (.eth).");
      return;
    }

    setExecStep("building");
    setExecError(null);
    setAgentTxHashes({ approvalTxHash: null, swapTxHash: null, transferTxHash: null });

    try {
      const requester = address.toLowerCase();
      const timestamp = Date.now();
      const recipient = recipientAddress.trim().toLowerCase();
      const message = [
        "CeloFX Remittance Execute",
        `requester:${requester}`,
        `recipient:${recipient}`,
        `fromToken:${result.parsed.fromToken}`,
        `toToken:${result.parsed.toToken}`,
        `amount:${String(result.parsed.amount)}`,
        `corridor:${result.parsed.corridor}`,
        `timestamp:${timestamp}`,
      ].join("\n");
      const signature = await signMessageAsync({ message });

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
          requester,
          signature,
          timestamp,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Transfer failed");

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
    } catch (err) {
      setExecError(err instanceof Error ? err.message : "Execution failed");
      setExecStep("idle");
      if (currentTxId) {
        updateRemittanceTransaction(currentTxId, { status: "failed" });
        setRefreshKey((k) => k + 1);
      }
    }
  };

  const handleViewReceipt = useCallback((tx: RemittanceTransaction) => {
    setReceiptTx(tx);
  }, []);

  const finalTxHash = agentTxHashes.transferTxHash;
  const approvalTxHash = agentTxHashes.approvalTxHash;
  const intermediateSwapHash = agentTxHashes.swapTxHash;
  const isExecuting = execStep === "building";

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-5 sm:px-6">
        <div>
          <h1 className="text-2xl font-display tracking-tight">Send Money</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fast one-time transfers on Celo. Enter amount, destination, then send.
          </p>
        </div>

        <Card className="gap-0 py-0">
          <CardContent className="space-y-2 py-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">Access mode</span>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                EOA Signed
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              You authorize with wallet signature; CeloFX agent executes swap + transfer on Celo.
            </p>
            <details className="rounded-lg border px-3 py-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">Agent API mode</summary>
              <p className="mt-2 text-xs text-muted-foreground">
                For agent-to-agent use, call <code>/api/remittance/execute</code> with signed agent headers
                (HMAC/Bearer) instead of wallet signature.
              </p>
            </details>
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="space-y-3 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Amount</label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="100"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Send from</label>
                <select
                  value={fromToken}
                  onChange={(e) => setFromToken(e.target.value as RemittanceToken)}
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {TOKENS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Destination</label>
              <select
                value={destinationCountry}
                onChange={(e) => setDestinationCountry(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {DESTINATIONS.map((d) => (
                  <option key={d.country} value={d.country}>
                    {d.country}
                  </option>
                ))}
              </select>
              {selectedDestination.fiat !== "EUR" && selectedDestination.fiat !== "BRL" && (
                <p className="text-xs text-muted-foreground">
                  This destination settles in cUSD on Celo.
                </p>
              )}
            </div>

            <button
              onClick={handleQuote}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              Get Quote
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              Native execution path: Mento swap (if needed) + Celo transfer.
            </p>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}

        {receiptTx && <TransferReceipt tx={receiptTx} onClose={() => setReceiptTx(null)} />}

        {result && !receiptTx && (
          <div className="space-y-4">
            {limitWarning && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Spending limit reached</p>
                  <p className="mt-0.5 text-xs text-amber-700">{limitWarning}</p>
                </div>
              </div>
            )}

            {(result.meta?.quoteQuality === "fallback" || (result.warnings?.length ?? 0) > 0) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800 text-[10px]">
                    Reference Estimate
                  </Badge>
                  <p className="text-xs text-amber-800">
                    Local-fiat/reference inputs degraded. Mento execution remains native; final rate is set at execution.
                  </p>
                </div>
              </div>
            )}

            <Card className="gap-0 py-0">
              <CardContent className="space-y-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Globe className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Transfer route</span>
                  <Badge variant="outline" className="border-violet-200 bg-violet-50 text-[10px] text-violet-700">
                    Mento Native
                  </Badge>
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">
                    {result.parsed.corridor}
                  </Badge>
                  {result.parsed.recipientCountry && (
                    <Badge variant="outline" className="flex items-center gap-1 border-blue-200 bg-blue-50 text-[10px] text-blue-700">
                      <MapPin className="size-2.5" />
                      {result.parsed.recipientCountry}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-center gap-4 py-2">
                  <div className="text-center">
                    <p className="text-2xl font-mono font-bold">
                      {result.parsed.amount} {result.parsed.fromToken}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">You send</p>
                  </div>
                  <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-2xl font-mono font-bold text-emerald-600">
                      {result.quote.amountOut} {result.parsed.toToken}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Recipient gets</p>
                  </div>
                </div>

                {!result.quote.sameToken && (
                  <p className="text-center text-xs text-muted-foreground">
                    1 {result.parsed.fromToken} = {result.quote.rate.toFixed(4)} {result.parsed.toToken}
                  </p>
                )}

                {result.lastMile && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant="outline" className="border-blue-300 bg-blue-100 text-[10px] text-blue-800">
                        Informational only
                      </Badge>
                      <span className="text-xs text-blue-800">Local currency estimate</span>
                    </div>
                    <p className="text-sm text-blue-900">
                      About {result.lastMile.symbol}{result.lastMile.localAmount} {result.lastMile.localCurrency}
                    </p>
                    <p className="mt-1 text-[11px] text-blue-800">
                      Settlement is on Celo ({result.parsed.toToken}); local-fiat figure is a reference estimate.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <CardContent className="space-y-4 py-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Fee comparison</span>
                </div>

                <div className="space-y-2">
                  {result.providers.slice(0, 3).map((p) => (
                    <div key={p.name} className={`rounded-lg border p-3 ${p.highlight ? "border-emerald-200 bg-emerald-50" : ""}`}>
                      <div className="flex items-center justify-between text-sm">
                        <span className={p.highlight ? "font-semibold text-emerald-800" : "text-muted-foreground"}>{p.name}</span>
                        <span className="font-mono">${p.fee}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{p.receive} {result.parsed.toToken}</span>
                        <span className="inline-flex items-center gap-1"><Clock className="size-3" />{p.time}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <TrendingDown className="size-4 shrink-0 text-emerald-600" />
                  <p className="text-sm text-emerald-800">
                    {result.strings.saving} <span className="font-mono font-bold">${result.savings.amount}</span> vs {result.savings.vs} ({result.savings.pct}% lower fees)
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="gap-0 py-0">
              <CardContent className="space-y-3 py-4">
                <label className="text-xs text-muted-foreground">Recipient wallet (0x... or ENS .eth)</label>
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="0x... or vitalik.eth"
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />

                {execStep === "done" && finalTxHash ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 py-1 text-emerald-700">
                      <CheckCircle2 className="size-5" />
                      <span className="text-sm font-medium">Transfer complete</span>
                    </div>
                    <a
                      href={`https://celoscan.io/tx/${finalTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                      <span className="font-mono text-xs">{finalTxHash.slice(0, 10)}...{finalTxHash.slice(-8)}</span>
                      <ExternalLink className="size-3.5" />
                    </a>
                    {approvalTxHash && (
                      <p className="text-center text-xs text-muted-foreground">Approval: {approvalTxHash.slice(0, 10)}...{approvalTxHash.slice(-8)}</p>
                    )}
                    {intermediateSwapHash && (
                      <p className="text-center text-xs text-muted-foreground">Swap: {intermediateSwapHash.slice(0, 10)}...{intermediateSwapHash.slice(-8)}</p>
                    )}
                    <button
                      onClick={() => {
                        if (!currentTxId || !result) return;
                        setReceiptTx({
                          id: currentTxId,
                          timestamp: Date.now(),
                          message: `Send ${result.parsed.amount} ${result.parsed.fromToken} to ${result.parsed.recipientCountry ?? "recipient"}`,
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
                          status: "executed",
                          fee: result.providers[0]?.fee || "0",
                          savingsVs: result.savings.vs,
                          savingsAmount: result.savings.amount,
                        });
                      }}
                      className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-accent/40"
                    >
                      View receipt
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleExecute}
                      disabled={isExecuting || !!limitWarning}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {isExecuting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                      {isExecuting ? "Sending transfer..." : "Send now"}
                    </button>
                    <p className="text-center text-[11px] text-muted-foreground">Agentic mode: swap (if needed) + transfer in one flow.</p>
                    {execError && <p className="text-center text-sm text-red-600">{execError}</p>}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <details className="rounded-lg border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
            Spending limits
            <ChevronDown className="size-4 text-muted-foreground" />
          </summary>
          <div className="px-2 pb-2"><SpendingLimitsCard refreshKey={refreshKey} /></div>
        </details>

        <details className="rounded-lg border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
            Recurring transfers
            <ChevronDown className="size-4 text-muted-foreground" />
          </summary>
          <div className="px-2 pb-2">
            <RecurringTransfers
              pendingTransfer={
                result
                  ? {
                      message: `Send ${result.parsed.amount} ${result.parsed.fromToken} to ${result.parsed.recipientCountry ?? "recipient"}`,
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
          </div>
        </details>

        <details className="rounded-lg border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
            Transfer history
            <ChevronDown className="size-4 text-muted-foreground" />
          </summary>
          <div className="px-2 pb-2">
            <TransferHistory refreshKey={refreshKey} onViewReceipt={handleViewReceipt} />
          </div>
        </details>
      </main>
      <Footer />
    </div>
  );
}
