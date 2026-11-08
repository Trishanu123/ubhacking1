import Link from "next/link";
import { DISCLAIMER, PRODUCT_NAME } from "@/lib/constants";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary text-[11px] font-semibold tracking-tight text-primary-foreground">
            W
          </span>
          <span className="text-sm font-semibold tracking-tight">{PRODUCT_NAME}</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/analyze" className="text-muted-foreground hover:text-foreground">
            Analyze
          </Link>
          <Link href="/analyze?demo=1" className="text-muted-foreground hover:text-foreground">
            Demo
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6 text-xs leading-relaxed text-muted-foreground">
        {DISCLAIMER}
      </div>
    </footer>
  );
}
