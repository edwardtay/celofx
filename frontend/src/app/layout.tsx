import type { Metadata } from "next";
import { Instrument_Serif, Outfit, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import { Toaster } from "sonner";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "CeloFX — Autonomous FX Agent",
  description: "AI agent that analyzes forex markets and auto-trades Mento stablecoins on Celo. ERC-8004 verified, x402 micropayments.",
  openGraph: {
    title: "CeloFX — Autonomous FX Agent",
    description: "AI agent that trades Mento stablecoins based on real-time FX analysis. ERC-8004 verified on Celo.",
    siteName: "CeloFX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CeloFX — Autonomous FX Agent",
    description: "AI agent that trades Mento stablecoins on Celo. ERC-8004 + x402.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${instrumentSerif.variable} ${outfit.variable} ${jetbrainsMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
