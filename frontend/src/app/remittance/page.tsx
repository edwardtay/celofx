"use client";

import { useState } from "react";
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
} from "lucide-react";
import { useAccount } from "wagmi";

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

const QUICK_ACTIONS = [
  { label: "🇵🇭 Philippines", message: "Send $50 to my family in the Philippines" },
  { label: "🇳🇬 Nigeria", message: "Send $100 to Nigeria" },
  { label: "🇸🇳 Sénégal", message: "Envoyer 200 euros au Sénégal" },
  { label: "🇧🇷 Brasil", message: "Transferir 500 reais para euros" },
  { label: "🇲🇽 México", message: "Enviar 100 dólares a México" },
  { label: "🇰🇪 Kenya", message: "Send $75 to Kenya" },
];

export default function RemittancePage() {
  const { isConnected } = useAccount();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RemittanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executed, setExecuted] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setExecuted(false);

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
      setError("Network error — please try again");
    } finally {
      setLoading(false);
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
    setExecuted(false);
  };

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

                {/* Quick action chips — multi-corridor */}
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

            {/* Fee comparison — 5 providers */}
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

                  {/* Provider rows — dynamic */}
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
                              : !p.highlight && p.pct > 3
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
                    vs {result.savings.vs} ({result.savings.pct}% lower fees) —{" "}
                    {result.strings.instantly.toLowerCase()}{" "}
                    {result.strings.via}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Execute button */}
            <Card className="gap-0 py-0">
              <CardContent className="py-4">
                {executed ? (
                  <div className="flex items-center justify-center gap-2 py-2 text-emerald-700">
                    <CheckCircle2 className="size-5" />
                    <span className="text-sm font-medium">
                      Transfer submitted
                    </span>
                  </div>
                ) : isConnected ? (
                  <button
                    onClick={() => setExecuted(true)}
                    className="w-full px-4 py-3 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Send className="size-4" />
                    Execute Transfer via Mento
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full px-4 py-3 text-sm font-medium bg-muted text-muted-foreground rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Send className="size-4" />
                    Connect wallet to execute
                  </button>
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
