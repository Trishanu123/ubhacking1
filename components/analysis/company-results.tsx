"use client";

import { ExternalLink, Loader2, Phone, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRICE_UNITS, type FoundCompany } from "@/lib/companies/types";
import { usd } from "@/lib/format";
import type { CompanySearchEntry } from "./use-company-search";

export function CompanyResults({ entry, compact = false, onRetry, onMore }: {
  entry?: CompanySearchEntry; compact?: boolean; onRetry: () => void; onMore?: () => void;
}) {
  const result = entry?.result;
  const loading = !entry || entry.status === "loading";
  return <div className="space-y-4" aria-live="polite">
    {loading && <div role="status" className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-600"><Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" /><div><p className="font-medium text-slate-800">{entry?.more ? "Finding more companies…" : "AI is finding installers for your property…"}</p><p className="mt-1 text-xs leading-5 text-slate-500">Searching company websites, local coverage and published prices. This can take a minute or two. You can explore other upgrades while it works.</p></div></div>}
    {entry?.status === "error" && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm text-amber-900">{entry.error}</p><Button type="button" variant="outline" size="sm" className="mt-3 rounded-lg bg-white" onClick={onRetry}>Retry live search</Button></div>}
    {result && <>
      <p className={`text-sm leading-6 text-slate-600 ${compact ? "line-clamp-2" : ""}`}>{result.summary}</p>
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4"><p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Sparkles className="size-4 text-emerald-700" />{result.pricing.label}</p>{result.pricing.companyId && <p className="mt-1 text-sm font-medium text-slate-800">{result.companies.find(c => c.id === result.pricing.companyId)?.name}</p>}<p className="mt-2 text-xs leading-5 text-slate-600">{result.pricing.explanation}</p></div>
      {!result.companies.length && <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-600">No source-supported companies were found in this search. Retry or search the wider region below. Your upgrade estimates remain available.</div>}
      <ul className="space-y-3">{(compact ? result.companies.slice(0, 3) : result.companies).map(company => <li key={company.id}><CompanyCard company={company} compact={compact} firstCall={company.id === result.bestMatchId} lowestPublished={company.id === result.pricing.companyId} /></li>)}</ul>
      {!compact && <>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{result.companies.length} compan{result.companies.length === 1 ? "y" : "ies"} found · Searched {new Date(result.searchedAt).toLocaleDateString("en-US")}</p>{onMore && <Button type="button" variant="outline" className="rounded-xl" disabled={loading || result.companies.length >= 40} onClick={onMore}><Search className="size-4" />Find more companies</Button>}</div>
        <p className="text-xs leading-5 text-slate-500">{result.coverageNote}</p>
      </>}
    </>}
  </div>;
}
function CompanyCard({ company: c, compact, firstCall, lowestPublished }: { company: FoundCompany; compact: boolean; firstCall: boolean; lowestPublished: boolean }) {
  const pricing = c.pricing;
  const published = pricing.status === "published";
  return <article className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="text-sm font-semibold text-slate-900">{c.name}</h4>{firstCall && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">AI suggested first call</span>}</div>
    <p className="mt-2 text-sm leading-6 text-slate-600">{c.reason}</p>
    <p className="mt-2 text-xs font-medium text-slate-700">{published ? `${usd(pricing.low!, pricing.low! < 10 ? 2 : 0)}–${usd(pricing.high!, pricing.high! < 10 ? 2 : 0)} ${PRICE_UNITS[pricing.unit]} · published rate` : "Price: request a property-specific quote"}{lowestPublished ? " · lowest published starting rate found" : ""}</p>
    {!compact && <>
      <dl className="mt-3 space-y-3 text-xs leading-5 text-slate-500"><div><dt className="font-medium text-slate-700">Location and coverage</dt><dd>{c.serviceArea} {c.coverage === "nearby_confirm" && <span className="font-medium text-amber-700">Confirm travel to your property.</span>}</dd></div><div><dt className="font-medium text-slate-700">Installation services</dt><dd>{c.services.join(" · ")}</dd></div><div><dt className="font-medium text-slate-700">Your building type</dt><dd>{c.buildingFit === "published_match" ? "Relevant building work is described in the sources. Confirm capacity and scope." : "Ask the company to confirm experience with your building type and project size."}</dd></div>{c.credentials.length > 0 && <div><dt className="font-medium text-slate-700">Company-published credentials</dt><dd>{c.credentials.join(" · ")}. Confirm current status directly.</dd></div>}</dl>
      {published && <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600"><p>{pricing.scope}</p><p className="mt-1">{pricing.evidence}</p><p className="mt-1">{pricing.installed ? "Installation is described in this published scope." : "Installation is not confirmed in this published scope."} This is not a quote for your property.</p>{pricing.sourceUrl && <a href={pricing.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block underline underline-offset-4">Published pricing source</a>}</div>}
      {c.caveats.length > 0 && <p className="mt-3 text-xs leading-5 text-slate-500">{c.caveats.join(" ")}</p>}
    </>}
    <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700"><a href={c.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">Visit website <ExternalLink className="size-3" /></a>{c.phone && <a href={`tel:${c.phone.replace(/[^+\d]/g, "")}`} className="inline-flex items-center gap-1 underline underline-offset-4"><Phone className="size-3" />{c.phone}</a>}</div>
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">{(compact ? c.sources.slice(0, 1) : c.sources).map((source, i) => <a key={source} href={source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">Source {i + 1} <ExternalLink className="size-3" /></a>)}</div>
  </article>;
}
