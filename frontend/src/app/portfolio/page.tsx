"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Loader2, RefreshCw, ExternalLink, ArrowDown } from "lucide-react";

const CHAINS = [
  { id: "ethereum", short: "ETH" },
  { id: "base", short: "BASE" },
  { id: "polygon", short: "POLY" },
  { id: "arbitrum", short: "ARB" },
  { id: "optimism", short: "OP" },
];

const TOKENS: Record<string, Array<{ symbol: string; address: string }>> = {
  ethereum: [
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
    { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
  ],
  base: [
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
    { symbol: "WETH", address: "0x4200000000000000000000000000000000000006" },
  ],
  polygon: [
    { symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },
    { symbol: "WETH", address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619" },
  ],
  arbitrum: [
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
    { symbol: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" },
  ],
  optimism: [
    { symbol: "USDC", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" },
    { symbol: "WETH", address: "0x4200000000000000000000000000000000000006" },
  ],
};

const BUY_TOKENS = [
  { code: "usdc_base", label: "USDC (Base)" },
  { code: "usdc", label: "USDC (Ethereum)" },
  { code: "usdc_polygon", label: "USDC (Polygon)" },
  { code: "eth", label: "ETH" },
  { code: "eth_base", label: "ETH (Base)" },
];

type Tab = "buy" | "swap" | "bridge";
interface Balance { symbol: string; balance: string; valueUsd: string | null }
interface AgentHolding { symbol: string; balance: number; valueUsd: number }

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();

  // Agent state
  const [agentHoldings, setAgentHoldings] = useState<AgentHolding[]>([]);
  const [agentTotal, setAgentTotal] = useState(0);
  const [agentLoading, setAgentLoading] = useState(true);

  // User state
  const [chain, setChain] = useState("base");
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loadingBal, setLoadingBal] = useState(false);
  const [tab, setTab] = useState<Tab>("buy");

  const [buyToken, setBuyToken] = useState("usdc_base");
  const [buyAmount, setBuyAmount] = useState("50");
  const [swapFrom, setSwapFrom] = useState("");
  const [swapTo, setSwapTo] = useState("");
  const [swapAmt, setSwapAmt] = useState("10");
  const [swapping, setSwapping] = useState(false);
  const [swapRes, setSwapRes] = useState<Record<string, unknown> | null>(null);
  const [bridgeChain, setBridgeChain] = useState("base");
  const [bridgeToken, setBridgeToken] = useState("");
  const [bridgeAmt, setBridgeAmt] = useState("10");
  const [bridging, setBridging] = useState(false);
  const [bridgeRes, setBridgeRes] = useState<Record<string, unknown> | null>(null);

  // Fetch agent holdings from track record
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/agent/track-record");
        const data = await res.json();
        const perf = data.performance || {};
        // Agent holds tokens on Celo — show from vault/portfolio
        const vaultRes = await fetch("/api/vault/portfolio");
        const vault = await vaultRes.json();
        const holdings = (vault.holdings || []).map((h: { token: string; balance: number; valueCusd: number }) => ({
          symbol: h.token,
          balance: h.balance,
          valueUsd: h.valueCusd,
        }));
        setAgentHoldings(holdings);
        setAgentTotal(vault.totalValueCusd || 0);
        setAgentLoading(false);
      } catch {
        setAgentHoldings([]);
        setAgentLoading(false);
      }
    })();
  }, []);

  // Fetch user balances
  const fetchBalances = useCallback(async () => {
    if (!address) return;
    setLoadingBal(true);
    try {
      const res = await fetch(`/api/moonpay/balances?wallet=${address}&chain=${chain}`);
      const data = await res.json();
      setBalances(data.balances || []);
    } catch { setBalances([]); }
    setLoadingBal(false);
  }, [address, chain]);

  useEffect(() => { if (address) fetchBalances(); }, [fetchBalances, address]);

  const userTotal = balances.reduce((sum, b) => sum + (b.valueUsd ? parseFloat(b.valueUsd) : 0), 0);

  const doSwap = async () => {
    if (!swapFrom || !swapTo) return;
    setSwapping(true); setSwapRes(null);
    try {
      const res = await fetch("/api/moonpay/swap", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain, fromToken: swapFrom, toToken: swapTo, amount: parseFloat(swapAmt), wallet: "celofx" }),
      });
      setSwapRes(await res.json());
    } catch (e) { setSwapRes({ error: e instanceof Error ? e.message : "Failed" }); }
    setSwapping(false);
  };

  const doBridge = async () => {
    if (!bridgeToken) return;
    setBridging(true); setBridgeRes(null);
    try {
      const res = await fetch("/api/moonpay/bridge", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromChain: bridgeChain, fromToken: bridgeToken, amount: parseFloat(bridgeAmt), toChain: "celo" }),
      });
      setBridgeRes(await res.json());
    } catch (e) { setBridgeRes({ error: e instanceof Error ? e.message : "Failed" }); }
    setBridging(false);
  };

  const openBuy = () => {
    window.open(
      `https://buy.moonpay.com?apiKey=pk_live_BT2OYpOuBti65FmHtwMn6ElIPk9YGuJ&currencyCode=${buyToken}&baseCurrencyAmount=${buyAmount}&walletAddress=${address || ""}&theme=dark`,
      "_blank"
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 space-y-6">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* LEFT: Agent Portfolio (always visible) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Agent #10 · Celo</p>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Agent Holdings</p>
              <p className="text-2xl font-display tracking-tight mt-1">
                ${agentTotal.toFixed(2)}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono mt-1 truncate">
                0x6652AcDc623b7CCd52E115161d84b949bAf3a303
              </p>

              {agentLoading ? (
                <div className="py-4 flex justify-center"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
              ) : agentHoldings.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-4">No holdings</p>
              ) : (
                <div className="mt-4 space-y-0 divide-y divide-border/50">
                  {agentHoldings.map((h, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-full bg-accent flex items-center justify-center text-[9px] font-bold">{h.symbol.slice(0, 2)}</div>
                        <span className="text-sm">{h.symbol}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm tabular-nums">{h.balance.toFixed(4)}</p>
                        <p className="text-[10px] text-muted-foreground">${h.valueUsd.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <a href="/api/agent/track-record" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground mt-3 transition-colors">
                Track record <ExternalLink className="size-2.5" />
              </a>
            </div>
          </div>

          {/* RIGHT: User Portfolio (connect wallet) */}
          <div className="space-y-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Your Wallet</p>

            {!isConnected ? (
              <div className="rounded-xl border bg-card p-8 flex flex-col items-center gap-4">
                <p className="text-sm text-muted-foreground text-center">Connect wallet to manage your multi-chain portfolio</p>
                <ConnectButton />
              </div>
            ) : (
              <>
                {/* User balances */}
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-display tracking-tight">
                        ${userTotal > 0 ? userTotal.toFixed(2) : "0.00"}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">{address}</p>
                    </div>
                    <button onClick={fetchBalances} disabled={loadingBal} className="p-2 rounded-lg hover:bg-accent transition-colors">
                      {loadingBal ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : <RefreshCw className="size-3.5 text-muted-foreground" />}
                    </button>
                  </div>

                  <div className="flex gap-1.5 mt-3">
                    {CHAINS.map((c) => (
                      <button key={c.id} onClick={() => setChain(c.id)}
                        className={`px-2.5 py-1 text-[10px] rounded-full transition-all ${
                          chain === c.id ? "bg-foreground text-background font-medium" : "bg-accent/60 text-muted-foreground hover:bg-accent"
                        }`}>
                        {c.short}
                      </button>
                    ))}
                  </div>

                  {loadingBal ? (
                    <div className="py-4 flex justify-center"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
                  ) : balances.length === 0 ? (
                    <p className="text-xs text-muted-foreground mt-4 text-center">No tokens on {chain}</p>
                  ) : (
                    <div className="mt-3 divide-y divide-border/50">
                      {balances.map((b, i) => (
                        <div key={i} className="flex items-center justify-between py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="size-7 rounded-full bg-accent flex items-center justify-center text-[9px] font-bold">{b.symbol.slice(0, 2)}</div>
                            <span className="text-sm">{b.symbol}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm tabular-nums">{b.balance}</p>
                            {b.valueUsd && <p className="text-[10px] text-muted-foreground">${b.valueUsd}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action tabs */}
                <div className="rounded-xl border bg-card overflow-hidden">
                  <div className="flex border-b border-border/50">
                    {(["buy", "swap", "bridge"] as Tab[]).map((t) => (
                      <button key={t} onClick={() => setTab(t)}
                        className={`flex-1 py-2.5 text-[10px] uppercase tracking-wider transition-colors relative ${
                          tab === t ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                        }`}>
                        {t === "bridge" ? "Bridge → Celo" : t}
                        {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />}
                      </button>
                    ))}
                  </div>

                  <div className="p-4">
                    {tab === "buy" && (
                      <div className="space-y-3">
                        <select value={buyToken} onChange={(e) => setBuyToken(e.target.value)}
                          className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm">
                          {BUY_TOKENS.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                        </select>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <input type="number" value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)}
                            className="w-full rounded-lg border bg-background pl-7 pr-3 py-2.5 text-lg tabular-nums" />
                        </div>
                        <div className="flex gap-1.5">
                          {["25", "50", "100", "250"].map((a) => (
                            <button key={a} onClick={() => setBuyAmount(a)}
                              className={`flex-1 py-1 text-[10px] rounded-md ${buyAmount === a ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/50"}`}>
                              ${a}
                            </button>
                          ))}
                        </div>
                        <button onClick={openBuy}
                          className="w-full py-2.5 text-sm font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2">
                          Buy with MoonPay <ExternalLink className="size-3.5" />
                        </button>
                      </div>
                    )}

                    {tab === "swap" && (
                      <div className="space-y-2">
                        <div className="rounded-lg border bg-background p-3">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">From</p>
                          <div className="flex gap-2">
                            <input type="number" value={swapAmt} onChange={(e) => setSwapAmt(e.target.value)}
                              className="flex-1 bg-transparent text-lg tabular-nums outline-none" placeholder="0" />
                            <select value={swapFrom} onChange={(e) => setSwapFrom(e.target.value)}
                              className="rounded-md border bg-accent/50 px-2 py-1 text-xs min-w-[70px] text-center">
                              <option value="">—</option>
                              {(TOKENS[chain] || []).map((t) => <option key={t.address} value={t.address}>{t.symbol}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-center -my-0.5 relative z-10">
                          <div className="size-6 rounded-full border bg-card flex items-center justify-center">
                            <ArrowDown className="size-3 text-muted-foreground" />
                          </div>
                        </div>
                        <div className="rounded-lg border bg-background p-3">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">To</p>
                          <div className="flex gap-2">
                            <div className="flex-1 text-lg text-muted-foreground">—</div>
                            <select value={swapTo} onChange={(e) => setSwapTo(e.target.value)}
                              className="rounded-md border bg-accent/50 px-2 py-1 text-xs min-w-[70px] text-center">
                              <option value="">—</option>
                              {(TOKENS[chain] || []).map((t) => <option key={t.address} value={t.address}>{t.symbol}</option>)}
                            </select>
                          </div>
                        </div>
                        <button onClick={doSwap} disabled={!swapFrom || !swapTo || swapping}
                          className="w-full py-2.5 text-sm font-medium rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-30 inline-flex items-center justify-center gap-2">
                          {swapping ? <Loader2 className="size-4 animate-spin" /> : "Swap"}
                        </button>
                        {swapRes && (
                          <div className={`rounded-lg p-2 text-[10px] ${swapRes.error ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                            {swapRes.error ? String(swapRes.error) : `Status: ${swapRes.status || "ready"}`}
                          </div>
                        )}
                      </div>
                    )}

                    {tab === "bridge" && (
                      <div className="space-y-2">
                        <div className="rounded-lg border bg-background p-3">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">From</p>
                          <div className="flex gap-2">
                            <input type="number" value={bridgeAmt} onChange={(e) => setBridgeAmt(e.target.value)}
                              className="flex-1 bg-transparent text-lg tabular-nums outline-none" placeholder="0" />
                            <select value={bridgeToken} onChange={(e) => setBridgeToken(e.target.value)}
                              className="rounded-md border bg-accent/50 px-2 py-1 text-xs min-w-[70px] text-center">
                              <option value="">—</option>
                              {(TOKENS[bridgeChain] || []).map((t) => <option key={t.address} value={t.address}>{t.symbol}</option>)}
                            </select>
                          </div>
                          <select value={bridgeChain} onChange={(e) => setBridgeChain(e.target.value)}
                            className="mt-1 bg-transparent text-[10px] text-muted-foreground">
                            {CHAINS.map((c) => <option key={c.id} value={c.id}>on {c.short}</option>)}
                          </select>
                        </div>
                        <div className="flex justify-center -my-0.5 relative z-10">
                          <div className="size-6 rounded-full border bg-card flex items-center justify-center">
                            <ArrowDown className="size-3 text-muted-foreground" />
                          </div>
                        </div>
                        <div className="rounded-lg border bg-background p-3">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">To</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 text-lg text-muted-foreground">—</div>
                            <span className="text-xs font-medium">cUSD on Celo</span>
                          </div>
                        </div>
                        <button onClick={doBridge} disabled={!bridgeToken || bridging}
                          className="w-full py-2.5 text-sm font-medium rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-30 inline-flex items-center justify-center gap-2">
                          {bridging ? <Loader2 className="size-4 animate-spin" /> : "Bridge to Celo"}
                        </button>
                        {bridgeRes && (
                          <div className={`rounded-lg p-2 text-[10px] ${bridgeRes.error ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                            {bridgeRes.error ? String(bridgeRes.error)
                              : bridgeRes.status === "quote_unavailable" ? "Requires MoonPay CLI wallet"
                              : `Status: ${bridgeRes.status || "ready"}`}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
