"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Analysis } from "@/lib/types/analysis";
import { InstallerResults as AnalysisReport } from "@/components/analysis/installer-results";
import { ReportSkeleton } from "@/components/analysis/report-skeleton";
import { cacheAnalysis, readCachedAnalysis } from "@/lib/client/analysis-cache";

export function AnalysisLoader({
  id,
  initial,
  debug,
}: {
  id: string;
  initial: Analysis | null;
  debug?: boolean;
}) {
  const [analysis, setAnalysis] = useState<Analysis | null>(initial);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (analysis) {
      cacheAnalysis(analysis);
      return;
    }
    const cached = readCachedAnalysis(id);
    if (cached) {
      void Promise.resolve(cached).then(setAnalysis);
      return;
    }
    void fetch(`/api/analysis/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.analysis) setAnalysis(json.analysis);
        else setMissing(true);
      })
      .catch(() => setMissing(true));
  }, [analysis, id]);

  if (analysis) return <AnalysisReport key={analysis.id} analysis={analysis} debug={debug} />;
  if (missing) {
    return (
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Analysis not found</h1>
        <p className="mt-3 text-sm text-slate-500">
          This report is not in the current session. Run a new analysis or the demo.
        </p>
        <p className="mt-6">
          <Link className="text-sm font-medium text-slate-900 underline underline-offset-4" href="/analyze?demo=1">
            Try the demo
          </Link>
        </p>
      </main>
    );
  }
  return <ReportSkeleton />;
}
