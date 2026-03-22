/**
 * MoonPay integration — CLI MCP as primary action layer, HTTP fallback.
 *
 * When the MoonPay CLI (`mp`) is installed, we spawn `mp mcp` as a
 * child process and communicate via JSON-RPC over stdio.  If the CLI
 * is not available (Docker, CI, etc.) we fall back to direct HTTP
 * requests against MoonPay's public APIs.
 */

import { spawn, execSync } from "child_process";

const MOONPAY_SWAP_API = "https://api.swaps.xyz/v1";

export interface McpToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

function textResult(data: unknown): McpToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function errorResult(msg: string): McpToolResult {
  return { content: [{ type: "text", text: JSON.stringify({ error: msg }) }], isError: true };
}

// ---------------------------------------------------------------------------
// CLI availability check
// ---------------------------------------------------------------------------

let cliAvailableCache: boolean | null = null;

export async function isMoonPayAvailable(): Promise<boolean> {
  if (cliAvailableCache !== null) return cliAvailableCache;
  try {
    execSync("which mp", { stdio: "ignore" });
    cliAvailableCache = true;
  } catch {
    cliAvailableCache = false;
  }
  return cliAvailableCache;
}

// ---------------------------------------------------------------------------
// CLI MCP transport — spawn `mp mcp` and talk JSON-RPC over stdio
// ---------------------------------------------------------------------------

async function callMoonPayViaCli(
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<McpToolResult> {
  return new Promise<McpToolResult>((resolve, reject) => {
    const child = spawn("mp", ["mcp"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("MoonPay CLI MCP timed out after 30s"));
    }, 30_000);

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0 && !stdout) {
        reject(new Error(`mp mcp exited ${code}: ${stderr}`));
        return;
      }

      try {
        // The MCP server may return multiple JSON-RPC responses separated
        // by newlines. We look for the tools/call result.
        const lines = stdout.trim().split("\n").filter(Boolean);
        for (const line of lines) {
          const msg = JSON.parse(line);
          if (msg.result?.content) {
            resolve(msg.result as McpToolResult);
            return;
          }
          if (msg.error) {
            reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            return;
          }
        }
        // If we didn't find a structured result, wrap raw stdout
        resolve(textResult({ raw: stdout }));
      } catch {
        resolve(textResult({ raw: stdout }));
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    // Send JSON-RPC initialize
    const initMsg = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "celofx", version: "1.0.0" },
      },
    });

    // Send tools/call
    const callMsg = JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    });

    child.stdin.write(initMsg + "\n");
    child.stdin.write(callMsg + "\n");
    child.stdin.end();
  });
}

// ---------------------------------------------------------------------------
// HTTP fallback — direct API calls, no CLI required
// ---------------------------------------------------------------------------

async function callMoonPayViaHttp(
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<McpToolResult> {
  switch (toolName) {
    case "token_balance_list": {
      const wallet = args.wallet as string;
      const chain = args.chain as string;
      try {
        const chainEndpoints: Record<string, string> = {
          ethereum: "https://eth.blockscout.com/api/v2/addresses",
          base: "https://base.blockscout.com/api/v2/addresses",
          polygon: "https://polygon.blockscout.com/api/v2/addresses",
          arbitrum: "https://arbitrum.blockscout.com/api/v2/addresses",
          optimism: "https://optimism.blockscout.com/api/v2/addresses",
        };
        const baseUrl = chainEndpoints[chain];
        if (!baseUrl) {
          return textResult({
            wallet,
            chain,
            error: `Unsupported chain: ${chain}`,
            supportedChains: Object.keys(chainEndpoints),
          });
        }
        const res = await fetch(`${baseUrl}/${wallet}/token-balances`, {
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return textResult({ wallet, chain, error: `Blockscout returned ${res.status}` });
        const tokens = await res.json();
        const balances = (
          tokens as Array<{
            token: { symbol: string; decimals: string; exchange_rate: string };
            value: string;
          }>
        )
          .filter((t) => parseFloat(t.value) > 0)
          .slice(0, 20)
          .map((t) => ({
            symbol: t.token.symbol,
            balance: (parseFloat(t.value) / Math.pow(10, parseInt(t.token.decimals))).toFixed(4),
            valueUsd: t.token.exchange_rate
              ? (
                  (parseFloat(t.value) / Math.pow(10, parseInt(t.token.decimals))) *
                  parseFloat(t.token.exchange_rate)
                ).toFixed(2)
              : null,
          }));
        return textResult({
          wallet: wallet.slice(0, 10) + "...",
          chain,
          tokenCount: balances.length,
          balances,
        });
      } catch (err) {
        return errorResult(`Balance check failed: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    case "buy": {
      const token = args.token as string;
      const amount = args.amount as number;
      const wallet = args.wallet as string;
      const email = args.email as string | null;
      const params = new URLSearchParams({
        apiKey: "pk_live_BT2OYpOuBti65FmHtwMn6ElIPk9YGuJ",
        currencyCode: token,
        baseCurrencyAmount: String(amount),
        walletAddress: wallet,
      });
      if (email) params.set("email", email);
      const checkoutUrl = `https://buy.moonpay.com?${params.toString()}`;
      return textResult({
        success: true,
        checkoutUrl,
        token,
        amountUsd: amount,
        wallet,
        instructions: `Open this URL to complete the purchase: ${checkoutUrl}`,
        note: "User completes payment in browser. Crypto is sent to the wallet address after payment confirmation.",
      });
    }

    case "token_bridge": {
      const from = args.from as Record<string, unknown>;
      const to = args.to as Record<string, unknown>;
      try {
        const res = await fetch(
          `${MOONPAY_SWAP_API}/quote?` +
            new URLSearchParams({
              fromChain: from.chain as string,
              toChain: to.chain as string,
              fromToken: from.token as string,
              toToken: to.token as string,
              amount: String(from.amount),
            }),
          { signal: AbortSignal.timeout(10000) },
        );
        if (!res.ok) {
          return textResult({
            bridge: { fromChain: from.chain, toChain: to.chain, amount: from.amount },
            status: "quote_unavailable",
            note: "Bridge quote not available. Use MoonPay CLI locally (mp mcp) for full bridge execution with wallet signing.",
            fallback: "Install: npm i -g @moonpay/cli && mp login && mp mcp",
          });
        }
        const quote = await res.json();
        return textResult({ bridge: quote, status: "quote_ready" });
      } catch {
        return textResult({
          bridge: { fromChain: from.chain, toChain: to.chain, amount: from.amount },
          status: "quote_unavailable",
          note: "Bridge requires MoonPay CLI for local wallet signing. Install: npm i -g @moonpay/cli",
        });
      }
    }

    case "token_swap": {
      const wallet = args.wallet as string;
      const chain = args.chain as string;
      const from = args.from as Record<string, unknown>;
      const to = args.to as Record<string, unknown>;
      return textResult({
        swap: { wallet, chain, from, to },
        status: "requires_cli",
        note: "Token swaps require MoonPay CLI for local wallet signing.",
        setupInstructions: [
          "1. Install MoonPay CLI: npm i -g @moonpay/cli",
          "2. Login: mp login",
          `3. Swap: mp swap --chain ${chain} --from ${from.token} --to ${to.token} --amount ${from.amount}`,
        ],
      });
    }

    case "virtual-account_onramp_create": {
      return textResult({
        onramp: {
          fiat: args.fiat,
          stablecoin: args.stablecoin,
          chain: args.chain,
          wallet: args.wallet,
        },
        status: "requires_auth",
        setupInstructions: [
          "1. Install MoonPay CLI: npm i -g @moonpay/cli",
          "2. Login: mp login --email user@example.com",
          "3. Verify: mp verify --email user@example.com --code <code>",
          "4. Create virtual account: mp virtual-account create",
          "5. Complete KYC: mp virtual-account kyc continue",
          `6. Register wallet: mp virtual-account wallet register --wallet ${args.wallet} --chain ${args.chain}`,
          `7. Create on-ramp: mp virtual-account onramp create --name "${args.name}" --fiat ${args.fiat} --stablecoin ${args.stablecoin} --wallet ${args.wallet} --chain ${args.chain}`,
        ],
        note: "Once created, you receive a bank account (IBAN/ACH). Fiat deposits auto-convert to stablecoin and send to your registered wallet.",
        alternativeFlow:
          "For immediate funding, use moonpay_buy_crypto to generate a checkout URL (card payment, instant).",
      });
    }

    default:
      return errorResult(`Unknown MoonPay tool: ${toolName}`);
  }
}

// ---------------------------------------------------------------------------
// Public API — try CLI first, HTTP fallback
// ---------------------------------------------------------------------------

/**
 * Call a MoonPay tool. Prefers the MoonPay CLI MCP (`mp mcp`) for full
 * wallet-signing capabilities, falling back to HTTP when unavailable.
 */
export async function callMoonPayTool(
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<McpToolResult> {
  // Try MoonPay CLI MCP first (primary action layer)
  if (await isMoonPayAvailable()) {
    try {
      return await callMoonPayViaCli(toolName, args);
    } catch {
      // Fall through to HTTP
    }
  }
  // HTTP fallback for Docker environments
  return callMoonPayViaHttp(toolName, args);
}

/**
 * Extract text content from MCP tool result
 */
export function extractMcpText(result: McpToolResult): string {
  return result.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}
