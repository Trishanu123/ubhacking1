"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { EstimateRefiner, BillRateRefiner } from "./estimate-refiner";
import { AnalysisRefinementsSchema, type AnalysisRefinements, type MeasureRefinement } from "@/lib/types/refinement";
import { readAppSession } from "@/lib/client/session-storage";
import { refineAnalysis } from "@/lib/analytics/refinement";
import { CompanyResults } from "./company-results";
import { useCompanySearch } from "./use-company-search";
import { companyLocation, locationLabel } from "@/lib/companies/types";
import type { Analysis } from "@/lib/types/analysis";
import { num, usd, years } from "@/lib/format";
import { cn } from "@/lib/utils";
import { simpleUpgradeName } from "@/lib/results/summarize";
import { buildInstallerContext, fallbackInstallerAdvice } from "@/lib/wny/advice";
import { COST_CATALOG } from "@/lib/wny/costs";
import { InstallerAlternatives } from "@/components/analysis/installer-alternatives";
import { combineSelection } from "@/lib/wny/selection";
import { planningInput, type InstallerAdvice, type MoneyRange, type PricedUpgrade } from "@/lib/wny/types";

const SURFACE = "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7";
// Round only presentation, not the financial calculations. These are allowances, not quotes.
const approximateMoney = (value: number) => usd(Math.round(value / (Math.abs(value) >= 1000 ? 100 : 10)) * (Math.abs(value) >= 1000 ? 100 : 10));
const moneyRange = (range: { low: number; high: number }) => `${approximateMoney(range.low)}–${approximateMoney(range.high)}`;
const expectedPayback = (r: PricedUpgrade) => r.estimate.payback.typical == null ? "No bill-saving payback" : years(r.estimate.payback.typical);
const paybackRange = (r: PricedUpgrade) => r.estimate.payback.low == null ? "No positive-savings payback scenario" : r.estimate.payback.high == null ? `From ${num(r.estimate.payback.low, 1)} years; not recovered in the low-savings scenario` : `${num(r.estimate.payback.low, 1)}–${num(r.estimate.payback.high, 1)} years`;

function energyText(electricity: number, gas: number) {
  return `${num(Math.abs(electricity))} kWh ${electricity < 0 ? "more electricity" : "electricity saved"} · ${num(Math.abs(gas))} therms ${gas < 0 ? "more gas" : "gas saved"} / year`;
}

export function InstallerResults({ analysis: originalAnalysis }: { analysis: Analysis; debug?: boolean }) {
  const [refinements, setRefinements] = useState<AnalysisRefinements>({ measures: {} });
  const analysis = useMemo(() => refineAnalysis(originalAnalysis, refinements), [originalAnalysis, refinements]);
  const refinementKey = `retropilot:estimate-inputs:${originalAnalysis.id}`;
  useEffect(() => {
    try {
      const saved = readAppSession(`estimate-inputs:${originalAnalysis.id}`, value => AnalysisRefinementsSchema.safeParse(JSON.parse(value)).success);
      if (saved) {
        const parsed = AnalysisRefinementsSchema.parse(JSON.parse(saved));
        refineAnalysis(originalAnalysis, parsed);
        void Promise.resolve().then(() => setRefinements(parsed));
      }
    } catch { /* Ignore invalid or unavailable session storage; retain original estimates. */ }
  }, [originalAnalysis, refinementKey]);
  function updateRefinements(next: AnalysisRefinements) {
    const parsed = AnalysisRefinementsSchema.parse(next);
    refineAnalysis(originalAnalysis, parsed);
    setRefinements(parsed);
    try { sessionStorage.setItem(refinementKey, JSON.stringify(parsed)); } catch { /* Session remains usable without persistence. */ }
  }
  function updateMeasure(id: string, value: MeasureRefinement) {
    const measures = { ...refinements.measures };
    if (Object.keys(value).length) measures[id] = value; else delete measures[id];
    updateRefinements({ ...refinements, measures });
  }
  const input = useMemo(() => planningInput(analysis), [analysis]);
  const county = "";
  const location = useMemo(() => companyLocation(analysis.building), [analysis]);
  const { entries: companyEntries, search: searchCompanies, prefix: companyPrefix } = useCompanySearch(input, location, refinements);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${analysis.id}:${county}:${attempt}:${JSON.stringify(input)}`;
  const context = useMemo(() => buildInstallerContext(input, county || null), [input, county]);
  const fallback = useMemo(() => fallbackInstallerAdvice(context), [context]);
  const [response, setResponse] = useState<{ key: string; advice: InstallerAdvice; error: string | null } | null>(null);
  const advice = response?.key === key ? response.advice : fallback;
  const loading = response?.key !== key;
  const upgrades = context.upgrades;
  const top = upgrades.find(r => r.id === advice.top?.upgradeId);
  const active = upgrades.find(r => r.id === activeId) ?? top ?? upgrades[0];
  const companyEntry = (id: string) => companyEntries[id]?.key === `${companyPrefix}:${id}` ? companyEntries[id] : undefined;
  const topId = top?.id;
  useEffect(() => {
    if (!loading && topId) void searchCompanies(topId);
  }, [loading, topId, searchCompanies]);
  function openUpgrade(id: string) {
    setActiveId(id);
    setPanelOpen(true);
    void searchCompanies(id);
  }
  const activeUpgradeId = active?.id;
  useEffect(() => {
    if (panelOpen && activeUpgradeId) void searchCompanies(activeUpgradeId);
  }, [panelOpen, activeUpgradeId, searchCompanies]);
  const combined = useMemo(() => combineSelection(analysis, selectedIds, upgrades), [analysis, selectedIds, upgrades]);

  useEffect(() => {
    if (!input.recommendations.length) return;
    const controller = new AbortController();
    void fetch("/api/recommendations/installers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysisId: input.id, county: county || null, snapshot: input, refinements }), signal: controller.signal,
    }).then(async res => {
      if (!res.ok) throw new Error("The installer comparison could not load. Showing a rule-based comparison.");
      const body = await res.json();
      if (!controller.signal.aborted) setResponse({ key, advice: body.advice, error: null });
    }).catch(() => {
      if (!controller.signal.aborted) setResponse({ key, advice: fallback, error: "The installer comparison could not load. Your estimates are still available below." });
    });
    return () => controller.abort();
  }, [input, county, key, fallback, refinements]);

  function toggle(id: string) {
    const next = selectedIds.includes(id) ? selectedIds.filter(existing => existing !== id) : [...selectedIds, id];
    try { combineSelection(analysis, next, upgrades); setSelectedIds(next); setSelectionError(null); }
    catch (error) { setSelectionError(error instanceof Error ? error.message : "These upgrades cannot be combined."); }
  }

  if (!upgrades.length) return <main className="mx-auto max-w-3xl px-4 py-16"><h1 className="text-2xl font-semibold text-slate-900">No upgrades to compare yet</h1><p className="mt-3 text-sm text-slate-500">This analysis did not identify any upgrade options. Add more building or utility information and run a new analysis.</p></main>;

  return <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div><h1 className="text-2xl font-semibold tracking-tight text-slate-900">Your recommended upgrades</h1><p className="mt-2 text-sm text-slate-500">{analysis.isDemo ? "Demo estimates · " : ""}Expected estimates use your building and bill data. Add equipment details or a quote to replace assumptions.</p></div>
      <p className="max-w-sm text-sm text-slate-500">Company search near <span className="font-medium text-slate-800">{locationLabel(location)}</span></p>
    </div>
    <BillRateRefiner key={`${refinements.electricityRate}:${refinements.gasRate}`} values={refinements} onApply={rates => updateRefinements({ ...refinements, ...rates })} />
    {top && <section aria-labelledby="top-upgrade-title" className={cn(SURFACE, "border-emerald-200 bg-emerald-50/40")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-800"><Sparkles className="size-4" />{!loading && advice.method === "ai" ? "AI Top Recommendation" : "Top recommendation"}</p>
        <span role="status" className="inline-flex items-center gap-1.5 text-xs text-slate-500">{loading ? <><Loader2 className="size-3 animate-spin" /> Comparing upgrades…</> : advice.method === "ai" ? "AI-ranked from supplied data" : "Not AI-ranked · rule-based"}</span>
      </div>
      <h2 id="top-upgrade-title" className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{simpleUpgradeName(top)}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{advice.top?.reason}</p>
      <dl className="mt-6 grid gap-5 sm:grid-cols-3"><Stat label="Expected yearly savings" value={`${usd(top.estimatedAnnualSavings)}/year`} /><CostStat label="Estimated after incentives" range={top.estimate.net} /><Stat label="Expected time to recover cost" value={expectedPayback(top)} /></dl>
      <div className="mt-5 border-t border-emerald-100 pt-4"><h3 className="mb-3 text-sm font-medium text-slate-700">AI installer comparison near your property</h3><CompanyResults entry={companyEntry(top.id)} compact onRetry={() => void searchCompanies(top.id, "retry")} /></div>
      <Button type="button" variant="outline" className="mt-5 rounded-xl bg-white" onClick={() => openUpgrade(top.id)}>View companies & prices <ArrowRight className="size-4" /></Button>
    </section>}
    {response?.key === key && response.error && <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p>{response.error}</p><Button type="button" size="sm" variant="outline" onClick={() => setAttempt(v => v + 1)}>Try again</Button></div>}
    {!loading && advice.method === "deterministic" && !response?.error && <p role="status" className="mt-4 text-xs leading-5 text-slate-500">{advice.notice}</p>}

    <section aria-labelledby="upgrade-options" className="mt-9">
      <h2 id="upgrade-options" className="text-lg font-semibold text-slate-900">Compare upgrades</h2>
      <p className="mt-1 text-sm text-slate-500">Select an upgrade to open its companies, AI comparison and pricing in the side panel. Check boxes to combine compatible upgrades.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {upgrades.map(r => <article key={r.id} className={cn("rounded-2xl border bg-white p-5 shadow-sm", active?.id === r.id ? "border-slate-700 ring-1 ring-slate-700" : "border-slate-200")}>
          <button id={`upgrade-card-${r.id}`} type="button" aria-haspopup="dialog" aria-pressed={active?.id === r.id && panelOpen} onClick={() => openUpgrade(r.id)} className="w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-500">
            <h3 className="font-semibold text-slate-900">{simpleUpgradeName(r)}</h3>
            <dl className="mt-4 space-y-3"><Stat label={r.estimatedAnnualSavings < 0 ? "Yearly bill savings (negative = higher bills)" : "Expected yearly bill savings"} value={`${usd(r.estimatedAnnualSavings)}/year`} small /><CostStat label="Estimated installed cost" range={r.estimate.installed} small /><Stat label="Expected time to recover cost" value={expectedPayback(r)} small /></dl>
            <p className="mt-3 text-xs leading-5 text-slate-500">{energyText(r.annualElectricitySavingsKwh, r.annualGasSavingsTherms)}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-slate-700">Companies & prices <ArrowRight className="size-3" /></span>
          </button>
          <label className="mt-4 flex cursor-pointer items-center gap-2 border-t border-slate-100 pt-4 text-sm text-slate-600"><input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggle(r.id)} className="size-4 accent-slate-900" />Include in my package<span className="sr-only">: {simpleUpgradeName(r)}</span></label>
        </article>)}
      </div>
      {selectionError && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{selectionError}</p>}
      {combined.count > 0 && <section aria-label="Your combined upgrades" className={cn(SURFACE, "mt-5")} aria-live="polite"><div className="flex items-center justify-between gap-4"><h3 className="flex items-center gap-2 font-semibold text-slate-900"><Check className="size-4" />Your package · {combined.count} upgrade{combined.count === 1 ? "" : "s"}</h3><Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedIds([]); setSelectionError(null); }}>Clear</Button></div><dl className="mt-5 grid gap-5 sm:grid-cols-3"><Stat label="Expected yearly bill savings" value={`${usd(combined.annualSavings)}/year`} /><CostStat label="Estimated after incentives" range={combined.net} /><Stat label="Expected time to recover cost" value={years(combined.paybackYears)} /></dl><p className="mt-4 text-xs leading-5 text-slate-500">{energyText(combined.annualElectricitySavingsKwh, combined.annualGasSavingsTherms)}. {combined.count > 1 ? "Includes the existing overlap reduction; solar offsets only the electricity left after other upgrades." : "A single upgrade has no package overlap reduction."} Negative savings mean added use or higher bills. Costs assume separate scopes; ask contractors to quote the combined project.</p><details className="mt-4 text-xs text-slate-500"><summary className="cursor-pointer font-medium text-slate-700">Package planning ranges</summary><p className="mt-2">Yearly savings: {moneyRange(combined.savingsRange)}. Installed cost: {moneyRange(combined.installed)}. Cost after incentives: {moneyRange(combined.net)}. These propagate the selected upgrades’ scenario ranges, not a validated accuracy percentage.</p></details></section>}
    </section>

    <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
      <SheetContent className="[&>button:last-child]:fixed [&>button:last-child]:z-10 [&>button:last-child]:bg-white [&>button:last-child]:shadow-sm max-sm:[&>button:last-child]:top-[calc(8dvh+1rem)] max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:h-[92dvh] max-sm:rounded-t-2xl max-sm:border-t max-sm:data-[state=open]:slide-in-from-bottom max-sm:data-[state=closed]:slide-out-to-bottom sm:max-w-2xl" onCloseAutoFocus={e => { e.preventDefault(); if (active) document.getElementById(`upgrade-card-${active.id}`)?.focus(); }}>
      {active && <div className="p-5 pt-14 sm:p-7 sm:pt-14">
      <SheetTitle className="text-xl">{simpleUpgradeName(active)}</SheetTitle><SheetDescription className="mt-2">AI company comparison near {locationLabel(location)}</SheetDescription><p className="mt-2 text-xs text-slate-500">{active.name}</p>
      <dl className="mt-6 grid gap-5 sm:grid-cols-2"><Stat label="Expected yearly bill savings" value={`${usd(active.estimatedAnnualSavings)}/year`} /><CostStat label="Estimated installed cost" range={active.estimate.installed} /><CostStat label="Estimated after incentives" range={active.estimate.net} /><Stat label="Time to recover cost" value={expectedPayback(active)} /></dl>
      <EstimateRefiner key={active.id} id={active.id} category={active.category} value={refinements.measures[active.id]} onApply={value => updateMeasure(active.id, value)} />
      <p className="mt-4 text-sm text-slate-600">{energyText(active.annualElectricitySavingsKwh, active.annualGasSavingsTherms)}</p>
      <p className="mt-3 text-xs leading-5 text-slate-500">Estimate, get quotes to confirm. Incentives are unconfirmed planning estimates. Negative savings mean an increase in bills or energy use.</p>
      <details className="mt-5 rounded-xl bg-slate-50 p-4"><summary className="cursor-pointer text-sm font-medium text-slate-700">Cost sources, sizing and assumptions</summary><div className="mt-3 space-y-3 text-xs leading-5 text-slate-500"><p>Expected values are point estimates, not a guarantee of accuracy. Savings planning range: {moneyRange(active.savingsRange)}/year. Installed cost range: {moneyRange(active.estimate.installed)}. Net cost range: {moneyRange(active.estimate.net)}. Payback scenarios: {paybackRange(active)}. The low/high payback scenarios vary both costs and savings; an unknown upper bound means the low-savings scenario does not recover the cost. These are not statistical confidence intervals.</p><p>Estimated incentive range: {moneyRange(active.estimate.incentives)}. {active.estimate.notes.join(" ")}</p><ul className="list-disc space-y-2 pl-4">{active.estimate.components.map(c => <li key={c.catalogId}>{COST_CATALOG.entries.find(e => e.id === c.catalogId)?.label}: {num(c.quantity, 1)} {c.unit} (sizing estimate).</li>)}</ul>{active.estimate.sources.map(s => <div key={s.label}><a href={s.url} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">{s.label} reference <ExternalLink className="inline size-3" /></a><p>Source date: {s.date ?? "TODO: verify numeric cost source"} · Reviewed {s.reviewed}</p><p>{s.note}</p></div>)}</div></details>
      <div className="mt-7 border-t border-slate-100 pt-6"><h3 className="mb-4 font-semibold text-slate-900">Companies that can install this</h3>
        <CompanyResults entry={companyEntry(active.id)} onRetry={() => void searchCompanies(active.id, "retry")} onMore={() => void searchCompanies(active.id, "more")} />
        {companyEntry(active.id)?.status === "error" && <div className="mt-5"><InstallerAlternatives systems={active.systems} county={null} state={analysis.building.state} /></div>}
      </div>
      </div>}
      </SheetContent>
    </Sheet>
    <p className="mt-6 text-xs leading-6 text-slate-500">Costs are provisional planning ranges, not verified Buffalo quotes. Verify current incentives, equipment sizing, licenses and insurance. Get at least 3 comparable quotes. Published prices are not property-specific quotes. Company listings do not imply endorsement. Costs and savings may change after an on-site assessment.</p>
  </main>;
}
function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return <div><dt className="text-xs text-slate-500">{label}</dt><dd className={cn("mt-1 font-semibold tracking-tight text-slate-900", small ? "text-base" : "text-lg")}>{value}</dd></div>;
}
function CostStat({ label, range, small }: { label: string; range: MoneyRange; small?: boolean }) {
  return <div><dt className="text-xs text-slate-500">{label}</dt><dd className={cn("mt-1 font-semibold tracking-tight text-slate-900", small ? "text-base" : "text-lg")}>{approximateMoney(range.typical)}<span className="mt-1 block text-xs font-normal tracking-normal text-slate-500">Planning estimate · range in details</span></dd></div>;
}
