"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import {
  Loader2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

const CHAINS = [
  { id: "ethereum", name: "ETH" },
  { id: "base", name: "Base" },
  { id: "polygon", name: "Polygon" },
  { id: "arbitrum", name: "Arbitrum" },
  { id: "optimism", name: "OP" },
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
  { code: "usdc", label: "USDC (ETH)" },
  { code: "usdc_polygon", label: "USDC (Polygon)" },
  { code: "eth", label: "ETH" },
  { code: "eth_base", label: "ETH (Base)" },
];

interface Balance { symbol: string; balance: string; valueUsd: string | null }

export default function PortfolioPage() {
  const { address } = useAccount();
  const agentWallet = "0x6652AcDc623b7CCd52E115161d84b949bAf3a303";
  const wallet = address || agentWallet;

  const [chain, setChain] = useState("base");
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loadingBal, setLoadingBal] = useState(false);

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

  const fetchBalances = async () => {
    setLoadingBal(true);
    try {
      const res = await fetch(`/api/moonpay/balances?wallet=${wallet}&chain=${chain}`);
      const data = await res.json();
      setBalances(data.balances || []);
    } catch { setBalances([]); }
    setLoadingBal(false);
  };

  useEffect(() => { fetchBalances(); }, [chain, wallet]);

  const doSwap = async () => {
    if (!swapFrom || !swapTo) return;
    setSwapping(true);
    setSwapRes(null);
    try {
      const res = await fetch("/api/moonpay/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chain, fromToken: swapFrom, toToken: swapTo, amount: parseFloat(swapAmt), wallet: "celofx" }),
      });
      setSwapRes(await res.json());
    } catch (e) { setSwapRes({ error: e instanceof Error ? e.message : "Failed" }); }
    setSwapping(false);
  };

  const doBridge = async () => {
    if (!bridgeToken) return;
    setBridging(true);
    setBridgeRes(null);
    try {
      const res = await fetch("/api/moonpay/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromChain: bridgeChain, fromToken: bridgeToken, amount: parseFloat(bridgeAmt), toChain: "celo" }),
      });
      setBridgeRes(await res.json());
    } catch (e) { setBridgeRes({ error: e instanceof Error ? e.message : "Failed" }); }
    setBridging(false);
  };

  const openBuy = () => {
    window.open(
      `https://buy.moonpay.com?apiKey=pk_live_BT2OYpOuBti65FmHtwMn6ElIPk9YGuJ&currencyCode=${buyToken}&baseCurrencyAmount=${buyAmount}&walletAddress=${wallet}&theme=dark`,
      "_blank"
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 space-y-6">
        <h1 className="text-2xl font-display tracking-tight">Portfolio</h1>

        {/* Chain tabs + Balances */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {CHAINS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setChain(c.id)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    chain === c.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <button onClick={fetchBalances} disabled={loadingBal} className="p-1.5 rounded-md hover:bg-accent">
              {loadingBal ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5 text-muted-foreground" />}
            </button>
          </div>

          <div className="text-xs font-mono text-muted-foreground truncate">{wallet}</div>

          {loadingBal ? (
            <div className="py-4 text-center text-xs text-muted-foreground">Loading...</div>
          ) : balances.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">No tokens on {chain}</div>
          ) : (
            <div className="space-y-1">
              {balances.map((b, i) => (
                <div key={i} className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-sm font-medium">{b.symbol}</span>
                  <div className="text-right">
                    <span className="text-sm font-mono">{b.balance}</span>
                    {b.valueUsd && <span className="text-xs text-muted-foreground ml-2">${b.valueUsd}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Buy */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">Buy</h3>
            <select value={buyToken} onChange={(e) => setBuyToken(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-xs">
              {BUY_TOKENS.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </select>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                <input type="number" value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)}
                  className="w-full rounded-md border bg-background pl-6 pr-3 py-1.5 text-xs font-mono" />
              </div>
              <button onClick={openBuy}
                className="px-4 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1">
                Buy <ExternalLink className="size-3" />
              </button>
            </div>
          </div>

          {/* Swap */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">Swap on {CHAINS.find(c => c.id === chain)?.name}</h3>
            <select value={swapFrom} onChange={(e) => setSwapFrom(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-xs">
              <option value="">From...</option>
              {(TOKENS[chain] || []).map((t) => <option key={t.address} value={t.address}>{t.symbol}</option>)}
            </select>
            <select value={swapTo} onChange={(e) => setSwapTo(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-xs">
              <option value="">To...</option>
              {(TOKENS[chain] || []).map((t) => <option key={t.address} value={t.address}>{t.symbol}</option>)}
            </select>
            <div className="flex gap-2">
              <input type="number" value={swapAmt} onChange={(e) => setSwapAmt(e.target.value)}
                className="flex-1 rounded-md border bg-background px-3 py-1.5 text-xs font-mono" />
              <button onClick={doSwap} disabled={!swapFrom || !swapTo || swapping}
                className="px-4 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1">
                {swapping ? <Loader2 className="size-3 animate-spin" /> : "Swap"}
              </button>
            </div>
            {swapRes && (
              <div className={`rounded-md p-2 text-[10px] font-mono ${swapRes.error ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-700"}`}>
                {swapRes.error ? String(swapRes.error) : `Status: ${swapRes.status || "ready"}`}
              </div>
            )}
          </div>

          {/* Bridge to Celo */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">Bridge → Celo</h3>
            <select value={bridgeChain} onChange={(e) => setBridgeChain(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-xs">
              {CHAINS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={bridgeToken} onChange={(e) => setBridgeToken(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-xs">
              <option value="">Token...</option>
              {(TOKENS[bridgeChain] || []).map((t) => <option key={t.address} value={t.address}>{t.symbol}</option>)}
            </select>
            <div className="flex gap-2">
              <input type="number" value={bridgeAmt} onChange={(e) => setBridgeAmt(e.target.value)}
                className="flex-1 rounded-md border bg-background px-3 py-1.5 text-xs font-mono" />
              <button onClick={doBridge} disabled={!bridgeToken || bridging}
                className="px-4 py-1.5 text-xs font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 inline-flex items-center gap-1">
                {bridging ? <Loader2 className="size-3 animate-spin" /> : "Bridge"}
              </button>
            </div>
            {bridgeRes && (
              <div className={`rounded-md p-2 text-[10px] font-mono ${bridgeRes.error ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-700"}`}>
                {bridgeRes.error ? String(bridgeRes.error) : bridgeRes.status === "quote_unavailable"
                  ? "Bridge requires MoonPay CLI wallet. Install: npm i -g @moonpay/cli"
                  : `Status: ${bridgeRes.status || "ready"}`}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
