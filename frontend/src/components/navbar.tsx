"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/signals", label: "Signals" },
  { href: "/premium", label: "Premium" },
  { href: "/agent", label: "Agent" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
      <div className="flex items-center gap-8">
        <Link href="/" className="font-display text-xl tracking-tight">
          {siteConfig.name}
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md transition-colors",
                pathname === link.href
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <ConnectButton showBalance={false} />
    </header>
  );
}
