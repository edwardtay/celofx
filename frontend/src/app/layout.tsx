import type { Metadata } from "next";
import { Instrument_Serif, Outfit, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import { siteConfig } from "@/config/site";
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
  title: "AAA — Alpha Acceleration Agent",
  description: "Cross-market alpha analyst scanning crypto, stocks, forex, and commodities. Registered on-chain via ERC-8004, monetized via x402 micropayments on Celo.",
  openGraph: {
    title: "AAA — Alpha Acceleration Agent",
    description: "AI-powered cross-market trading signals. Verifiable identity via ERC-8004, pay-per-signal via x402 on Celo.",
    siteName: "AAA",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AAA — Alpha Acceleration Agent",
    description: "AI-powered cross-market trading signals. ERC-8004 + x402 on Celo.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${instrumentSerif.variable} ${outfit.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
