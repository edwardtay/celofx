"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Menu, X } from "lucide-react";

type NavLink = {
  href: string;
  label: string;
};

const primaryLinks: NavLink[] = [
  { href: "/", label: "Overview" },
  { href: "/arbitrage", label: "Arbitrage" },
  { href: "/remittance", label: "Remittance" },
  { href: "/developers", label: "Developers" },
];

const allLinks = [...primaryLinks];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  function NavItem({ link }: { link: NavLink }) {
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
          {allLinks.map((link) => (
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
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
