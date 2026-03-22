"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import {
  Wallet,
  ArrowRightLeft,
  ArrowDownToLine,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";

const CHAINS = [
  { id: "ethereum", name: "Ethereum", color: "#627EEA" },
  { id: "base", name: "Base", color: "#0052FF" },
  { id: "polygon", name: "Polygon", color: "#8247E5" },
  { id: "arbitrum", name: "Arbitrum", color: "#28A0F0" },
  { id: "optimism", name: "Optimism", color: "#FF0420" },
];

const POPULAR_TOKENS: Record<string, Array<{ symbol: string; address: string }>> = {
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

interface Balance {
  symbol: string;
  balance: string;
  valueUsd: string | null;
}

export default function PortfolioPage() {
  const [wallet, setWallet] = useState("0x6652AcDc623b7CCd52E115161d84b949bAf3a303");
  const [selectedChain, setSelectedChain] = useState("base");
  const [balances, setBalances] = useState<Balance[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [buyAmount, setBuyAmount] = useState("50");
  const [buyToken, setBuyToken] = useState("usdc_base");
  const [swapFrom, setSwapFrom] = useState("");
  const [swapTo, setSwapTo] = useState("");
  const [swapAmount, setSwapAmount] = useState("10");
  const [swapResult, setSwapResult] = useState<string | null>(null);
  const [bridgeFrom, setBridgeFrom] = useState("base");
  const [bridgeToken, setBridgeToken] = useState("");
  const [bridgeAmount, setBridgeAmount] = useState("10");
  const [bridgeResult, setBridgeResult] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const checkBalances = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/moonpay/balances?wallet=${wallet}&chain=${selectedChain}`);
      const data = await res.json();
      setBalances(data.balances || []);
    } catch {
      setBalances([]);
    }
    setLoading(false);
  };

  const executeBuy = () => {
    const url = `https://buy.moonpay.com?apiKey=pk_live_BT2OYpOuBti65FmHtwMn6ElIPk9YGuJ&currencyCode=${buyToken}&baseCurrencyAmount=${buyAmount}&walletAddress=${wallet}&theme=dark`;
    window.open(url, "_blank");
  };

  const executeSwap = async () => {
    setActionLoading("swap");
    try {
      const res = await fetch("/api/moonpay/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain: selectedChain,
          fromToken: swapFrom,
          toToken: swapTo,
          amount: parseFloat(swapAmount),
          wallet: "celofx",
        }),
      });
      const data = await res.json();
      setSwapResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setSwapResult(`Error: ${err instanceof Error ? err.message : "unknown"}`);
    }
    setActionLoading(null);
  };

  const executeBridge = async () => {
    setActionLoading("bridge");
    try {
      const res = await fetch("/api/moonpay/bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromChain: bridgeFrom,
          fromToken: bridgeToken,
          amount: parseFloat(bridgeAmount),
          toChain: "celo",
        }),
      });
      const data = await res.json();
      setBridgeResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setBridgeResult(`Error: ${err instanceof Error ? err.message : "unknown"}`);
    }
    setActionLoading(null);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-display tracking-tight">Multi-Chain Portfolio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Powered by MoonPay CLI MCP Server — check balances, buy, swap, and bridge across chains
          </p>
        </div>

        {/* Wallet Input */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <label className="text-xs font-medium text-muted-foreground">Wallet Address</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm font-mono"
                placeholder="0x..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Chain Selector + Balances */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Balances via MoonPay</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                moonpay-cli-mcp
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {CHAINS.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => { setSelectedChain(chain.id); setBalances(null); }}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    selectedChain === chain.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {chain.name}
                </button>
              ))}
            </div>
            <button
              onClick={checkBalances}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              Check Balances
            </button>
            {balances !== null && (
              <div className="rounded-md border p-3 space-y-1">
                {balances.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No tokens found on {selectedChain}</p>
                ) : (
                  balances.map((b, i) => (
                    <div key={i} className="flex justify-between text-xs font-mono">
                      <span>{b.symbol}</span>
                      <span>{b.balance} {b.valueUsd ? `($${b.valueUsd})` : ""}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Buy */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="size-4 text-emerald-500" />
                <span className="text-sm font-medium">Buy Crypto</span>
              </div>
              <p className="text-xs text-muted-foreground">Fiat on-ramp via MoonPay checkout</p>
              <select
                value={buyToken}
                onChange={(e) => setBuyToken(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
              >
                <option value="usdc_base">USDC on Base</option>
                <option value="usdc">USDC on Ethereum</option>
                <option value="usdc_polygon">USDC on Polygon</option>
                <option value="usdc_arbitrum">USDC on Arbitrum</option>
                <option value="eth">ETH</option>
                <option value="eth_base">ETH on Base</option>
                <option value="sol">SOL</option>
              </select>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  className="flex-1 rounded-md border bg-background px-3 py-1.5 text-xs font-mono"
                  placeholder="USD amount"
                />
                <button
                  onClick={executeBuy}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Buy <ExternalLink className="size-3" />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Swap */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="size-4 text-blue-500" />
                <span className="text-sm font-medium">Swap</span>
              </div>
              <p className="text-xs text-muted-foreground">Swap tokens on {selectedChain} via MoonPay</p>
              <select
                value={swapFrom}
                onChange={(e) => setSwapFrom(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
              >
                <option value="">From token...</option>
                {(POPULAR_TOKENS[selectedChain] || []).map((t) => (
                  <option key={t.address} value={t.address}>{t.symbol}</option>
                ))}
              </select>
              <select
                value={swapTo}
                onChange={(e) => setSwapTo(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
              >
                <option value="">To token...</option>
                {(POPULAR_TOKENS[selectedChain] || []).map((t) => (
                  <option key={t.address} value={t.address}>{t.symbol}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={swapAmount}
                  onChange={(e) => setSwapAmount(e.target.value)}
                  className="flex-1 rounded-md border bg-background px-3 py-1.5 text-xs font-mono"
                  placeholder="Amount"
                />
                <button
                  onClick={executeSwap}
                  disabled={!swapFrom || !swapTo || actionLoading === "swap"}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading === "swap" ? <Loader2 className="size-3 animate-spin" /> : "Swap"}
                </button>
              </div>
              {swapResult && (
                <pre className="text-[10px] font-mono bg-muted rounded p-2 overflow-auto max-h-32">{swapResult}</pre>
              )}
            </CardContent>
          </Card>

          {/* Bridge */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="size-4 text-purple-500 rotate-90" />
                <span className="text-sm font-medium">Bridge to Celo</span>
              </div>
              <p className="text-xs text-muted-foreground">Move stablecoins to Celo for trading</p>
              <select
                value={bridgeFrom}
                onChange={(e) => setBridgeFrom(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
              >
                {CHAINS.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={bridgeToken}
                onChange={(e) => setBridgeToken(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-xs"
              >
                <option value="">Select token...</option>
                {(POPULAR_TOKENS[bridgeFrom] || []).map((t) => (
                  <option key={t.address} value={t.address}>{t.symbol}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={bridgeAmount}
                  onChange={(e) => setBridgeAmount(e.target.value)}
                  className="flex-1 rounded-md border bg-background px-3 py-1.5 text-xs font-mono"
                  placeholder="Amount"
                />
                <button
                  onClick={executeBridge}
                  disabled={!bridgeToken || actionLoading === "bridge"}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {actionLoading === "bridge" ? <Loader2 className="size-3 animate-spin" /> : "Bridge"}
                </button>
              </div>
              {bridgeResult && (
                <pre className="text-[10px] font-mono bg-muted rounded p-2 overflow-auto max-h-32">{bridgeResult}</pre>
              )}
            </CardContent>
          </Card>
        </div>

        {/* MoonPay CLI Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium">MoonPay CLI MCP Server Integration</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  All actions route through MoonPay CLI tools: token_balance_list, buy, token_swap, token_bridge.
                  CLI-first architecture with HTTP fallback for Docker environments.
                </p>
              </div>
              <a
                href="https://www.npmjs.com/package/@moonpay/cli"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                @moonpay/cli <ExternalLink className="size-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
