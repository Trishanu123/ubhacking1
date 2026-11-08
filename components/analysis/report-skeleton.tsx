import { Skeleton } from "@/components/ui/skeleton";

export function ReportSkeleton() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-14" aria-busy="true" aria-label="Loading report">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-80 max-w-full" />
      <Skeleton className="mt-2 h-4 w-56" />
      <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-sm md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white p-8">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-4 h-10 w-40" />
            <Skeleton className="mt-4 h-5 w-36 rounded-full" />
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm">
        <Skeleton className="h-5 w-44 rounded-full" />
        <Skeleton className="mt-4 h-7 w-72 max-w-full" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl" />
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
