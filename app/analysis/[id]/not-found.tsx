import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold">Analysis not found</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        This report is not in the current session. Without Supabase configured, analyses live in memory and are lost
        after restart. Run a new analysis or the demo.
      </p>
      <p className="mt-6">
        <Link className="underline" href="/analyze?demo=1">
          Try the demo
        </Link>
      </p>
    </main>
  );
}
