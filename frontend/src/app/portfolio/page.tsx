"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Loader2, RefreshCw, ExternalLink, ArrowDown, ArrowUpRight } from "lucide-react";

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

  const [agentHoldings, setAgentHoldings] = useState<AgentHolding[]>([]);
  const [agentTotal, setAgentTotal] = useState(0);
  const [agentStats, setAgentStats] = useState({ trades: 0, successRate: 0, pnl: 0 });
  const [agentLoading, setAgentLoading] = useState(true);

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

  useEffect(() => {
    (async () => {
      try {
        const [trackRes, vaultRes] = await Promise.all([
          fetch("/api/agent/track-record"),
          fetch("/api/vault/portfolio"),
        ]);
        const track = await trackRes.json();
        const vault = await vaultRes.json();
        const perf = track.performance || {};
        setAgentStats({ trades: perf.confirmedTrades || 0, successRate: perf.successRate || 0, pnl: track.profitability?.aggregate?.totalNetProfitUsd || 0 });
        const holdings = (vault.holdings || []).map((h: { token: string; balance: number; valueCusd: number }) => ({
          symbol: h.token, balance: h.balance, valueUsd: h.valueCusd,
        }));
        setAgentHoldings(holdings);
        setAgentTotal(vault.totalValueCusd || 0);
      } catch { setAgentHoldings([]); }
      setAgentLoading(false);
    })();
  }, []);

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
      "_blank",
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">

        {/* Agent stats bar */}
        <div className="rounded-xl border bg-card mb-5">
          <div className="flex items-stretch divide-x divide-border/50">
            <div className="flex-1 px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="size-1.5 rounded-full bg-emerald-500" />
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Agent #10</span>
              </div>
              <p className="text-xl tabular-nums">${agentLoading ? "—" : agentTotal.toFixed(2)}</p>
            </div>
            {agentHoldings.map((h) => (
              <div key={h.symbol} className="flex-1 px-5 py-4">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">{h.symbol}</p>
                <p className="text-sm tabular-nums">{h.balance.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">${h.valueUsd.toFixed(2)}</p>
              </div>
            ))}
            <div className="flex-1 px-5 py-4">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Trades</p>
              <p className="text-sm tabular-nums">{agentStats.trades}</p>
              <p className="text-[10px] text-emerald-600">{agentStats.successRate}% win</p>
            </div>
            <div className="flex-1 px-5 py-4">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">P&L</p>
              <p className={`text-sm tabular-nums ${agentStats.pnl >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                {agentStats.pnl >= 0 ? "+" : ""}${agentStats.pnl.toFixed(4)}
              </p>
              <a href="/api/agent/track-record" target="_blank" className="text-[9px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
                Details <ArrowUpRight className="size-2" />
              </a>
            </div>
          </div>
        </div>

        {/* Main content: user wallet */}
        {!isConnected ? (
          <div className="rounded-xl border bg-card p-12 flex flex-col items-center gap-5">
            <div className="text-center">
              <p className="text-lg font-display">Connect your wallet</p>
              <p className="text-xs text-muted-foreground mt-1">Buy, swap, and bridge tokens across chains</p>
            </div>
            <ConnectButton />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Left: balances (2 cols) */}
            <div className="lg:col-span-2 rounded-xl border bg-card overflow-hidden">
              <div className="px-5 pt-4 pb-3 flex items-center justify-between">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Your balance</p>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate max-w-[180px]">{address}</p>
                </div>
                <button onClick={fetchBalances} disabled={loadingBal} className="p-1.5 rounded-md hover:bg-accent transition-colors">
                  {loadingBal ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : <RefreshCw className="size-3 text-muted-foreground" />}
                </button>
              </div>

              <div className="flex gap-1 px-5 pb-3">
                {CHAINS.map((c) => (
                  <button key={c.id} onClick={() => setChain(c.id)}
                    className={`px-2 py-0.5 text-[9px] rounded-full transition-all ${
                      chain === c.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent"
                    }`}>
                    {c.short}
                  </button>
                ))}
              </div>

              <div className="border-t border-border/50">
                {loadingBal ? (
                  <div className="py-8 flex justify-center"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
                ) : balances.length === 0 ? (
                  <div className="py-8 text-center text-[10px] text-muted-foreground">No tokens on {chain}</div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {balances.map((b, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-accent/30 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className="size-6 rounded-full bg-accent flex items-center justify-center text-[8px] font-bold">{b.symbol.slice(0, 2)}</div>
                          <span className="text-xs">{b.symbol}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs tabular-nums">{b.balance}</p>
                          {b.valueUsd && <p className="text-[9px] text-muted-foreground">${b.valueUsd}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: actions (3 cols) */}
            <div className="lg:col-span-3 rounded-xl border bg-card overflow-hidden">
              <div className="flex border-b border-border/50">
                {(["buy", "swap", "bridge"] as Tab[]).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 py-3 text-[10px] uppercase tracking-widest transition-colors relative ${
                      tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}>
                    {t === "bridge" ? "Bridge → Celo" : t}
                    {tab === t && <span className="absolute bottom-0 inset-x-4 h-px bg-foreground" />}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {tab === "buy" && (
                  <div className="space-y-4 max-w-sm mx-auto">
                    <select value={buyToken} onChange={(e) => setBuyToken(e.target.value)}
                      className="w-full rounded-lg border bg-background px-4 py-3 text-sm">
                      {BUY_TOKENS.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                    </select>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">$</span>
                      <input type="number" value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)}
                        className="w-full rounded-lg border bg-background pl-9 pr-4 py-3 text-2xl tabular-nums" />
                    </div>
                    <div className="flex gap-1.5">
                      {["25", "50", "100", "250"].map((a) => (
                        <button key={a} onClick={() => setBuyAmount(a)}
                          className={`flex-1 py-1.5 text-[10px] rounded-md transition-colors ${buyAmount === a ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent"}`}>
                          ${a}
                        </button>
                      ))}
                    </div>
                    <button onClick={openBuy}
                      className="w-full py-3 text-sm rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2">
                      Buy with MoonPay <ExternalLink className="size-3.5" />
                    </button>
                  </div>
                )}

                {tab === "swap" && (
                  <div className="space-y-2 max-w-sm mx-auto">
                    <div className="rounded-lg border bg-background p-4">
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-2">Sell</p>
                      <div className="flex gap-3 items-center">
                        <input type="number" value={swapAmt} onChange={(e) => setSwapAmt(e.target.value)}
                          className="flex-1 bg-transparent text-2xl tabular-nums outline-none min-w-0" placeholder="0" />
                        <select value={swapFrom} onChange={(e) => setSwapFrom(e.target.value)}
                          className="rounded-lg border bg-accent/50 px-3 py-2 text-sm font-medium min-w-[90px]">
                          <option value="">Select</option>
                          {(TOKENS[chain] || []).map((t) => <option key={t.address} value={t.address}>{t.symbol}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-center -my-1 relative z-10">
                      <div className="size-7 rounded-full border-2 bg-card flex items-center justify-center">
                        <ArrowDown className="size-3 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="rounded-lg border bg-background p-4">
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-2">Buy</p>
                      <div className="flex gap-3 items-center">
                        <p className="flex-1 text-2xl text-muted-foreground/40">—</p>
                        <select value={swapTo} onChange={(e) => setSwapTo(e.target.value)}
                          className="rounded-lg border bg-accent/50 px-3 py-2 text-sm font-medium min-w-[90px]">
                          <option value="">Select</option>
                          {(TOKENS[chain] || []).map((t) => <option key={t.address} value={t.address}>{t.symbol}</option>)}
                        </select>
                      </div>
                    </div>
                    <button onClick={doSwap} disabled={!swapFrom || !swapTo || swapping}
                      className="w-full py-3 text-sm rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-20 transition-opacity inline-flex items-center justify-center gap-2 mt-2">
                      {swapping ? <Loader2 className="size-4 animate-spin" /> : "Swap"}
                    </button>
                    {swapRes && (
                      <div className={`rounded-lg p-3 text-xs ${swapRes.error ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-700"}`}>
                        {swapRes.error ? String(swapRes.error) : `Status: ${swapRes.status || "ready"}`}
                      </div>
                    )}
                  </div>
                )}

                {tab === "bridge" && (
                  <div className="space-y-2 max-w-sm mx-auto">
                    <div className="rounded-lg border bg-background p-4">
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-2">From</p>
                      <div className="flex gap-3 items-center">
                        <input type="number" value={bridgeAmt} onChange={(e) => setBridgeAmt(e.target.value)}
                          className="flex-1 bg-transparent text-2xl tabular-nums outline-none min-w-0" placeholder="0" />
                        <select value={bridgeToken} onChange={(e) => setBridgeToken(e.target.value)}
                          className="rounded-lg border bg-accent/50 px-3 py-2 text-sm font-medium min-w-[90px]">
                          <option value="">Token</option>
                          {(TOKENS[bridgeChain] || []).map((t) => <option key={t.address} value={t.address}>{t.symbol}</option>)}
                        </select>
                      </div>
                      <select value={bridgeChain} onChange={(e) => setBridgeChain(e.target.value)}
                        className="mt-2 bg-transparent text-[10px] text-muted-foreground cursor-pointer">
                        {CHAINS.map((c) => <option key={c.id} value={c.id}>on {c.short}</option>)}
                      </select>
                    </div>
                    <div className="flex justify-center -my-1 relative z-10">
                      <div className="size-7 rounded-full border-2 bg-card flex items-center justify-center">
                        <ArrowDown className="size-3 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="rounded-lg border bg-background p-4">
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-2">To</p>
                      <div className="flex gap-3 items-center">
                        <p className="flex-1 text-2xl text-muted-foreground/40">—</p>
                        <span className="text-sm font-medium px-3 py-2">cUSD</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">on Celo</p>
                    </div>
                    <button onClick={doBridge} disabled={!bridgeToken || bridging}
                      className="w-full py-3 text-sm rounded-lg bg-foreground text-background hover:opacity-90 disabled:opacity-20 transition-opacity inline-flex items-center justify-center gap-2 mt-2">
                      {bridging ? <Loader2 className="size-4 animate-spin" /> : "Bridge to Celo"}
                    </button>
                    {bridgeRes && (
                      <div className={`rounded-lg p-3 text-xs ${bridgeRes.error ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-700"}`}>
                        {bridgeRes.error ? String(bridgeRes.error)
                          : bridgeRes.status === "quote_unavailable" ? "Requires MoonPay CLI wallet for signing"
                          : `Status: ${bridgeRes.status || "ready"}`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
