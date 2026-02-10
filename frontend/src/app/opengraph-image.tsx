import { ImageResponse } from "next/og";

export const alt = "CeloFX — Autonomous FX Agent";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#f8f5f0",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "6px",
            display: "flex",
          }}
        >
          <div style={{ flex: 1, background: "#10b981" }} />
          <div style={{ flex: 1, background: "#f59e0b" }} />
          <div style={{ flex: 1, background: "#ef4444" }} />
          <div style={{ flex: 1, background: "#8b5cf6" }} />
        </div>

        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "80px",
            height: "80px",
            borderRadius: "16px",
            background: "#1a1510",
            color: "#f5f0eb",
            fontSize: "42px",
            fontWeight: 700,
            marginBottom: "24px",
          }}
        >
          FX
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: "64px",
            fontWeight: 700,
            color: "#1a1510",
            letterSpacing: "-2px",
            marginBottom: "8px",
          }}
        >
          CeloFX
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: "28px",
            color: "#6b5d4e",
            marginBottom: "32px",
          }}
        >
          Autonomous FX Agent
        </div>

        {/* Live stats */}
        <div
          style={{
            display: "flex",
            gap: "24px",
            marginBottom: "32px",
          }}
        >
          {[
            { label: "On-Chain Swaps", value: "3", color: "#10b981" },
            { label: "Cumulative P&L", value: "+0.88%", color: "#10b981" },
            { label: "Markets", value: "4", color: "#3b82f6" },
            { label: "Signals", value: "8", color: "#8b5cf6" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "12px 20px",
                borderRadius: "12px",
                border: "1px solid #e5ddd4",
                background: "#ffffff",
              }}
            >
              <div style={{ fontSize: "28px", fontWeight: 700, color: s.color }}>
                {s.value}
              </div>
              <div style={{ fontSize: "13px", color: "#8b7d6e" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom tagline */}
        <div
          style={{
            fontSize: "16px",
            color: "#8b7d6e",
          }}
        >
          FX Arbitrage Agent · ERC-8004 · Mento Broker · x402 · Celo mainnet
        </div>
      </div>
    ),
    { ...size }
  );
}
