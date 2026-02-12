"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { getCachedSignals, getCachedTrades, getCachedOrders } from "@/lib/local-cache";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/signals", label: "Signals", countKey: "signals" as const },
  { href: "/trades", label: "Trades", countKey: "trades" as const },
  { href: "/orders", label: "Orders", countKey: "orders" as const },
  { href: "/vault", label: "Vault" },
  { href: "/premium", label: "Premium" },
  { href: "/developers", label: "Developers" },
  { href: "/security", label: "Security" },
  { href: "/agent", label: "Agent" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [counts, setCounts] = useState<{ signals: number; trades: number; orders: number }>({ signals: 0, trades: 0, orders: 0 });

  useEffect(() => {
    const update = () => {
      setCounts({
        signals: getCachedSignals().length,
        trades: getCachedTrades().filter((t) => t.status === "confirmed").length,
        orders: getCachedOrders().filter((o) => o.status === "pending").length,
      });
    };
    update();
    const interval = setInterval(update, 5_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="border-b border-border bg-card">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-display text-xl tracking-tight">
            <Image
              src="/celofx-logo.png"
              alt="CeloFX"
              width={28}
              height={28}
              className="size-7 rounded"
            />
            {siteConfig.name}
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const count = link.countKey ? counts[link.countKey] : 0;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5",
                    pathname === link.href
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  {link.label}
                  {count > 0 && (
                    <span className="text-[10px] font-mono bg-muted-foreground/10 text-muted-foreground px-1.5 py-0.5 rounded-full leading-none">
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <ConnectButton showBalance={false} />
          <button
            className="md:hidden p-1.5 rounded-md hover:bg-accent"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav className="md:hidden px-6 pb-3 flex flex-col gap-1">
          {navLinks.map((link) => {
            const count = link.countKey ? counts[link.countKey] : 0;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-1.5",
                  pathname === link.href
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                {link.label}
                {count > 0 && (
                  <span className="text-[10px] font-mono bg-muted-foreground/10 text-muted-foreground px-1.5 py-0.5 rounded-full leading-none">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
