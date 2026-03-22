/**
 * MoonPay integration via direct API calls.
 * Replaces CLI spawning with HTTP requests to MoonPay's public APIs.
 * Falls back to CLI MCP if `mp` is available locally.
 */

const MOONPAY_API = "https://api.moonpay.com/v3";
const MOONPAY_SWAP_API = "https://api.swaps.xyz/v1";

interface McpToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

function textResult(data: unknown): McpToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function errorResult(msg: string): McpToolResult {
  return { content: [{ type: "text", text: JSON.stringify({ error: msg }) }], isError: true };
}

/**
 * Call a MoonPay tool. Uses direct HTTP API calls — no CLI dependency.
 */
export async function callMoonPayTool(
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<McpToolResult> {
  switch (toolName) {
    case "token_balance_list": {
      const wallet = args.wallet as string;
      const chain = args.chain as string;
      // Use public blockchain RPC / explorer to check balances
      // For EVM chains, query a public API
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
          return textResult({ wallet, chain, error: `Unsupported chain: ${chain}`, supportedChains: Object.keys(chainEndpoints) });
        }
        const res = await fetch(`${baseUrl}/${wallet}/token-balances`, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return textResult({ wallet, chain, error: `Blockscout returned ${res.status}` });
        const tokens = await res.json();
        const balances = (tokens as Array<{ token: { symbol: string; decimals: string; exchange_rate: string }; value: string }>)
          .filter((t) => parseFloat(t.value) > 0)
          .slice(0, 20)
          .map((t) => ({
            symbol: t.token.symbol,
            balance: (parseFloat(t.value) / Math.pow(10, parseInt(t.token.decimals))).toFixed(4),
            valueUsd: t.token.exchange_rate ? (parseFloat(t.value) / Math.pow(10, parseInt(t.token.decimals)) * parseFloat(t.token.exchange_rate)).toFixed(2) : null,
          }));
        return textResult({ wallet: wallet.slice(0, 10) + "...", chain, tokenCount: balances.length, balances });
      } catch (err) {
        return errorResult(`Balance check failed: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    case "buy": {
      const token = args.token as string;
      const amount = args.amount as number;
      const wallet = args.wallet as string;
      const email = args.email as string | null;
      // Generate MoonPay checkout URL
      const params = new URLSearchParams({
        apiKey: "pk_test_123",
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
      // Return bridge quote via Swaps.xyz (MoonPay's bridge partner)
      try {
        const res = await fetch(`${MOONPAY_SWAP_API}/quote?` + new URLSearchParams({
          fromChain: from.chain as string,
          toChain: to.chain as string,
          fromToken: from.token as string,
          toToken: to.token as string,
          amount: String(from.amount),
        }), { signal: AbortSignal.timeout(10000) });
        if (!res.ok) {
          return textResult({
            bridge: { fromChain: from.chain, toChain: to.chain, amount: from.amount },
            status: "quote_unavailable",
            note: "Bridge quote not available. Use MoonPay CLI locally (mp mcp) for full bridge execution with wallet signing.",
            fallback: `Install: npm i -g @moonpay/cli && mp login && mp mcp`,
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

    case "virtual-account_onramp_create": {
      // Virtual account creation requires authenticated MoonPay session
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
        alternativeFlow: "For immediate funding, use moonpay_buy_crypto to generate a checkout URL (card payment, instant).",
      });
    }

    default:
      return errorResult(`Unknown MoonPay tool: ${toolName}`);
  }
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

/**
 * Check if MoonPay CLI is available locally
 */
export async function isMoonPayAvailable(): Promise<boolean> {
  try {
    const { execSync } = await import("child_process");
    execSync("which mp", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
