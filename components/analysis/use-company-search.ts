"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalysisRefinements } from "@/lib/types/refinement";
import type { PlanningInput } from "@/lib/wny/types";
import { searchLocation, type CompanyLocation, type CompanySearchResult } from "@/lib/companies/types";
import { priceConclusion } from "@/lib/companies/grounding";

export interface CompanySearchEntry {
  key: string; status: "loading" | "ready" | "error";
  result?: CompanySearchResult; error?: string; more?: boolean;
}
export function useCompanySearch(input: PlanningInput, location: CompanyLocation, refinements: AnalysisRefinements) {
  const [entries, setEntries] = useState<Record<string, CompanySearchEntry>>({});
  const saved = useRef(new Map<string, CompanySearchResult>());
  const pending = useRef(new Map<string, AbortController>());
  const mounted = useRef(true);
  const prefix = `${input.id}:${searchLocation(location)}:${JSON.stringify(input)}`;
  useEffect(() => {
    mounted.current = true;
    const requests = pending.current;
    return () => { mounted.current = false; for (const controller of requests.values()) controller.abort(); requests.clear(); };
  }, []);
  const search = useCallback(async (upgradeId: string, mode: "initial" | "retry" | "more" = "initial") => {
    const key = `${prefix}:${upgradeId}`;
    const previous = saved.current.get(key);
    if (pending.current.has(key) || (mode === "initial" && previous)) return;
    const controller = new AbortController();
    pending.current.set(key, controller);
    setEntries(rows => ({ ...rows, [upgradeId]: { key, status: "loading", result: previous, more: mode === "more" } }));
    try {
      const res = await fetch("/api/recommendations/companies", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ analysisId: input.id, upgradeId, snapshot: input, location, refinements, widen: mode === "more",
          excludeWebsites: mode === "more" ? previous?.companies.map(c => c.website).slice(0, 40) ?? [] : [] }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Company search could not finish. Please retry.");
      let result = body.result as CompanySearchResult;
      if (result.method !== "ai_web_search" || result.upgradeId !== upgradeId || !Array.isArray(result.companies)) throw new Error("Company search returned an unreadable result. Please retry.");
      if (mode === "more" && previous) {
        const companies = [...new Map([...previous.companies, ...result.companies].map(c => [c.id, c])).values()].map((c, i) => ({ ...c, rank: i + 1 }));
        result = { ...result, companies, bestMatchId: previous.bestMatchId || result.bestMatchId,
          pricing: priceConclusion(companies), sources: [...new Set([...previous.sources, ...result.sources])],
          summary: result.companies.length ? `Found additional companies. ${companies.length} source-supported companies are shown across your searches.` : `No additional source-supported companies were found. Your ${companies.length} previous results are kept below.` };
      }
      saved.current.set(key, result);
      if (mounted.current && !controller.signal.aborted) setEntries(rows => ({ ...rows, [upgradeId]: { key, status: "ready", result } }));
    } catch (error) {
      if (mounted.current && !controller.signal.aborted) setEntries(rows => ({ ...rows, [upgradeId]: { key, status: "error", result: previous, error: error instanceof Error ? error.message : "Company search failed. Please retry." } }));
    } finally { pending.current.delete(key); }
  }, [input, location, prefix, refinements]);
  return { entries, search, prefix };
}
