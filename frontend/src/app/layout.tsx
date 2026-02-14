import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "./providers";
import { Toaster } from "sonner";
import "./globals.css";

const instrumentSerif = localFont({
  src: "../../public/fonts/instrument-serif-400.woff2",
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const outfit = localFont({
  src: "../../public/fonts/outfit-variable.woff2",
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "../../public/fonts/jetbrains-mono-variable.woff2",
  variable: "--font-mono",
  display: "swap",
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
