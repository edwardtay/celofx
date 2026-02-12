"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { getCachedSignals, getCachedTrades, getCachedOrders } from "@/lib/local-cache";

type NavLink = {
  href: string;
  label: string;
  countKey?: "signals" | "trades" | "orders";
};

const primaryLinks: NavLink[] = [
  { href: "/", label: "Dashboard" },
  { href: "/signals", label: "Signals", countKey: "signals" },
  { href: "/trades", label: "Trades", countKey: "trades" },
  { href: "/orders", label: "Orders", countKey: "orders" },
  { href: "/vault", label: "Vault" },
];

const moreLinks: NavLink[] = [
  { href: "/developers", label: "Developers" },
  { href: "/security", label: "Security" },
  { href: "/premium", label: "Premium" },
  { href: "/agent", label: "Agent" },
];

const allLinks = [...primaryLinks, ...moreLinks];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
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

  // Close "More" dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    if (moreOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [moreOpen]);

  const isMoreActive = moreLinks.some((l) => pathname === l.href);

  function NavItem({ link }: { link: NavLink }) {
    const count = link.countKey ? counts[link.countKey] : 0;
    return (
      <Link
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
  }

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
            {primaryLinks.map((link) => (
              <NavItem key={link.href} link={link} />
            ))}

            {/* More dropdown */}
            <div ref={moreRef} className="relative">
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1",
                  isMoreActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                More
                <ChevronDown className={cn("size-3.5 transition-transform", moreOpen && "rotate-180")} />
              </button>
              {moreOpen && (
                <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[160px] z-50">
                  {moreLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "block px-3 py-2 text-sm transition-colors",
                        pathname === link.href
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      )}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
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
          {allLinks.map((link) => {
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
