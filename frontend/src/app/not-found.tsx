import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default function NotFound() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <p className="text-6xl font-display tracking-tight">404</p>
          <p className="text-muted-foreground">This page does not exist.</p>
          <Link
            href="/"
            className="inline-block text-sm font-medium underline underline-offset-4 hover:text-foreground/80 transition-colors"
          >
            Back to dashboard
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
