import { ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Agent #4 on Celo</span>
        <div className="flex items-center gap-4">
          <a
            href="https://celoscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Identity Registry
            <ExternalLink className="size-3" />
          </a>
          <a
            href="https://celoscan.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Reputation Registry
            <ExternalLink className="size-3" />
          </a>
          <a
            href="https://github.com/edwardtay/AAA"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
          >
            GitHub
            <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    </footer>
  );
}
