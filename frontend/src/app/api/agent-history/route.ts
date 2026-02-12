import { NextResponse } from "next/server";

// Celo Blockscout API — free, no key needed
const BLOCKSCOUT_API = "https://explorer.celo.org/mainnet/api";
const AGENT_ADDRESS = "0x6652AcDc623b7CCd52E115161d84b949bAf3a303";

let cache: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 2 * 60 * 1000; // 2 min

interface BlockscoutTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  isError: string;
  functionName?: string;
  input: string;
  gasUsed: string;
  gasPrice: string;
  blockNumber: string;
}

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    // Fetch both normal txs and token transfers
    const [txRes, tokenRes] = await Promise.all([
      fetch(
        `${BLOCKSCOUT_API}?module=account&action=txlist&address=${AGENT_ADDRESS}&sort=desc&page=1&offset=25`
      ).then((r) => r.json()),
      fetch(
        `${BLOCKSCOUT_API}?module=account&action=tokentx&address=${AGENT_ADDRESS}&sort=desc&page=1&offset=25`
      ).then((r) => r.json()),
    ]);

    const txs: BlockscoutTx[] =
      txRes.status === "1" && Array.isArray(txRes.result)
        ? txRes.result
        : [];

    const tokenTxs = tokenRes.status === "1" && Array.isArray(tokenRes.result)
      ? tokenRes.result
      : [];

    // Classify transactions
    const classified = txs.map((tx) => {
      const isSwap =
        tx.input?.startsWith("0x") &&
        tx.input.length > 10 &&
        (tx.to?.toLowerCase() === "0x777a8255ca72412f0d706dc03c9d1987306b4cad" || // Mento Broker
          tx.functionName?.includes("swap"));
      const isApproval = tx.functionName?.includes("approve") || tx.input?.startsWith("0x095ea7b3");
      const isSent = tx.from?.toLowerCase() === AGENT_ADDRESS.toLowerCase();

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        timestamp: parseInt(tx.timeStamp) * 1000,
        success: tx.isError === "0",
        type: isSwap ? "swap" : isApproval ? "approval" : isSent ? "send" : "receive",
        gasUsed: tx.gasUsed,
        blockNumber: tx.blockNumber,
      };
    });

    // Token transfer summary
    const tokenSummary = tokenTxs.slice(0, 10).map((t: Record<string, string>) => ({
      hash: t.hash,
      tokenSymbol: t.tokenSymbol || "Unknown",
      from: t.from,
      to: t.to,
      value: t.value
        ? (parseFloat(t.value) / 1e18).toFixed(4)
        : "0",
      timestamp: parseInt(t.timeStamp) * 1000,
    }));

    const result = {
      address: AGENT_ADDRESS,
      totalTxs: txs.length,
      swapCount: classified.filter((t) => t.type === "swap").length,
      successRate:
        txs.length > 0
          ? parseFloat(
              ((classified.filter((t) => t.success).length / txs.length) * 100).toFixed(1)
            )
          : 100,
      transactions: classified.slice(0, 15),
      tokenTransfers: tokenSummary,
      blockscoutUrl: `https://explorer.celo.org/mainnet/address/${AGENT_ADDRESS}`,
      timestamp: Date.now(),
    };

    cache = { data: result, timestamp: Date.now() };
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch agent history",
      },
      { status: 500 }
    );
  }
}
