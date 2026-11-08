"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Download,
  ExternalLink,
  Landmark,
  Plus,
  Star,
  Sparkles,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { AnalysisCharts } from "@/components/charts/analysis-charts";
import { BudgetPlanner } from "@/components/analysis/budget-planner";
import type { Analysis } from "@/lib/types/analysis";
import type { UpgradeMeasure } from "@/lib/types/contracts";
import type { Priority, Recommendation } from "@/lib/types/recommendation";
import { BUILDING_TYPE_LABELS } from "@/lib/types/building";
import { simpleUpgradeName, summarizeAnalysis } from "@/lib/results/summarize";
import { cn } from "@/lib/utils";
import { num, pct, usd, years } from "@/lib/format";

const SURFACE = "rounded-2xl border border-slate-200/80 bg-white shadow-sm";
const MICRO = "text-xs font-medium tracking-wider text-slate-500 uppercase";
const ENTER = "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500";

const PRIORITY_LABEL: Record<Priority, string> = { high: "High", medium: "Medium", explore: "Explore" };
const PRIORITY_STYLE: Record<Priority, string> = {
  high: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  medium: "bg-amber-50 text-amber-700 ring-amber-600/20",
  explore: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export function AnalysisReport({ analysis, debug }: { analysis: Analysis; debug?: boolean }) {
  const result = useMemo(() => summarizeAnalysis(analysis), [analysis]);
  const [openId, setOpenId] = useState<string | null>(null);
  const openRec = analysis.recommendations.find((r) => r.id === openId) ?? null;
  const { totals, topPick, others, baseline } = result;
  const b = analysis.building;

  const paybackScale = Math.max(
    10,
    ...others.map((m) => m.paybackYears ?? 0).filter((p) => Number.isFinite(p) && p <= 40),
  );

  const meta = [
    BUILDING_TYPE_LABELS[b.buildingType],
    b.buildingAreaSqFt ? `${num(b.buildingAreaSqFt)} sq ft` : null,
    b.yearBuilt ? `Built ${b.yearBuilt}` : null,
    baseline.hasGas ? "Electric + gas" : "All-electric",
  ].filter(Boolean);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      {/* Header */}
      <header className={cn("flex flex-wrap items-end justify-between gap-6", ENTER)}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={MICRO}>Retrofit plan</span>
            {result.isDemo && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                Demo data
              </span>
            )}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              Preliminary estimate
            </span>
          </div>
          <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {b.address}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">{meta.join("  ·  ")}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          {!result.isDemo && (
            <Button asChild variant="ghost" className="rounded-xl text-slate-600">
              <Link href="/analyze?step=energy">Edit inputs</Link>
            </Button>
          )}
          <Button variant="outline" className="rounded-xl" onClick={() => window.print()}>
            <Download className="size-4" /> Download report
          </Button>
          <Button asChild className="rounded-xl">
            <Link href="/analyze?new=1">
              <Plus className="size-4" /> New analysis
            </Link>
          </Button>
        </div>
      </header>

      <section aria-label="Plan summary" className={cn(SURFACE, "mt-8 p-6 sm:p-8", ENTER)}>
        <p className="text-sm text-slate-600">Your building could save around</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight text-emerald-600 sm:text-5xl">
          {usd(totals.annualSavings)} <span className="text-lg font-normal text-slate-500">a year</span>
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
          This estimate combines the upgrades in your full plan. Use your budget below to find a smaller package that works for you.
        </p>
        <div className="mt-6 grid gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <div><p className="text-sm text-slate-500">Estimated cost before rebates</p><p className="mt-1 text-xl font-semibold text-slate-900">{usd(totals.upfrontCost)}</p></div>
          <div><p className="text-sm text-slate-500">Time for savings to cover the cost</p><p className="mt-1 text-xl font-semibold text-slate-900">{totals.blendedPaybackYears == null ? "Not yet estimated" : `${num(totals.blendedPaybackYears, 1)} years`}</p><p className="mt-1 text-xs text-slate-500">Assumes estimated rebates are received.</p></div>
        </div>
        <p className="mt-5 text-xs leading-5 text-slate-500">A starting estimate, not a quote. Confirm costs, savings and rebate eligibility before making a decision.</p>
        <details className="mt-4 border-t border-slate-100 pt-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">See the cost and savings breakdown</summary>
          <div className="mt-4 grid gap-x-8 sm:grid-cols-2">
            <Row label="Current yearly energy bills" value={usd(baseline.annualEnergyCost)} />
            <Row label="Estimated bill reduction" value={pct(totals.shareOfBaseline)} />
            <Row label="Yearly savings range" value={`${usd(totals.savingsRange.low)}–${usd(totals.savingsRange.high)}`} />
            <Row label="Estimated rebates and incentives" value={usd(totals.incentives)} />
            <Row label="Cost after estimated incentives" value={usd(totals.netCost)} />
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">Payback divides the cost after estimated incentives by yearly savings. Incentives are planning estimates, not confirmed offers.</p>
        </details>
      </section>

      {topPick && (
        <section aria-label="Top recommendation" className={cn(SURFACE, "mt-6 p-6 sm:p-8", ENTER)}>
          <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700"><Star className="size-4" /> Start here</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-5">
            <div className="max-w-2xl">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">{simpleUpgradeName(topPick.measure)}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Could save about {usd(topPick.measure.annualSavings)} a year on its own. Estimated cost: {usd(topPick.measure.upfrontCost)} before rebates.</p>
            </div>
            <Button variant="outline" className="no-print rounded-xl" onClick={() => setOpenId(topPick.measure.id)}>See this upgrade <ArrowRight className="size-4" /></Button>
          </div>
        </section>
      )}

      <BudgetPlanner analysis={analysis} onViewMeasure={setOpenId} />

      {others.length > 0 && (
        <details className={cn(SURFACE, "mt-6 p-6 sm:p-8")}>
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">Explore {others.length} other upgrade options</summary>
          <p className="mt-3 text-sm text-slate-500">Open an upgrade for its costs and calculations. Alternatives may replace one another.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {others.map((m) => <OpportunityCard key={m.id} measure={m} scale={paybackScale} onOpen={() => setOpenId(m.id)} />)}
          </div>
        </details>
      )}

      {/* Next steps */}
      {analysis.nextSteps.length > 0 && (
        <section aria-label="Next steps" className={cn(SURFACE, "mt-6 p-6 sm:p-8")}>
          <p className={MICRO}>Next steps</p>
          <ol className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {analysis.nextSteps.map((s, i) => (
              <li key={s.title} className="flex gap-3 text-sm">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                  {i + 1}
                </span>
                <span className="text-slate-700">{s.title}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <details className="mt-6">
        <summary className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white px-6 py-5 text-sm font-medium text-slate-700">See charts, sources and how we worked this out</summary>
        <TechnicalDetails analysis={analysis} debug={debug} />
      </details>

      <Sheet open={openRec != null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent>{openRec && <MeasureDetail rec={openRec} analysis={analysis} />}</SheetContent>
      </Sheet>
    </main>
  );
}

function PriorityTag({ priority }: { priority: Priority }) {
  return (
    <span className={cn("inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", PRIORITY_STYLE[priority])}>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

function PaybackMeter({ value, scale }: { value: number | null; scale: number }) {
  const width = value == null ? 0 : Math.max(4, Math.min(100, (value / scale) * 100));
  const color = value == null ? "bg-slate-300" : value <= 5 ? "bg-emerald-500" : value <= 10 ? "bg-amber-400" : "bg-slate-400";
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">Payback</span>
        <span className="font-medium text-slate-700 tabular-nums">{value == null ? "No payback" : years(value)}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100" role="meter" aria-valuenow={value ?? 0} aria-valuemin={0} aria-valuemax={scale}>
        <div className={cn("h-full rounded-full transition-[width] duration-700", color)} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function OpportunityCard({ measure: m, scale, onOpen }: { measure: UpgradeMeasure; scale: number; onOpen: () => void }) {
  const saves = m.annualSavings > 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        SURFACE,
        "group flex flex-col gap-5 p-6 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        !m.includedInTotals && "bg-slate-50/60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium tracking-wider text-slate-400 uppercase">{m.categoryLabel}</p>
          <h3 className="mt-1 font-semibold tracking-tight text-slate-900">{m.name}</h3>
        </div>
        <PriorityTag priority={m.priority} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-slate-500">Annual savings</p>
          <p className={cn("mt-0.5 text-lg font-semibold tracking-tight tabular-nums", saves ? "text-emerald-600" : "text-slate-500")}>
            {saves ? `${usd(m.annualSavings)}/yr` : usd(m.annualSavings)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-1.5">
          <p className="text-xs text-slate-500">Net cost</p>
          <p className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900 tabular-nums">{usd(m.netCost)}</p>
        </div>
      </div>
      <PaybackMeter value={saves ? m.paybackYears : null} scale={scale} />
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{m.includedInTotals ? "Included in plan totals" : "Not in totals — alternative or net cost"}</span>
        <ArrowRight className="size-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
      </div>
    </button>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={cn("tabular-nums", strong ? "font-semibold text-slate-900" : "text-slate-700")}>{value}</span>
    </div>
  );
}

function MeasureDetail({ rec, analysis }: { rec: Recommendation; analysis: Analysis }) {
  const rationale = analysis.explanation.measureRationales.find((r) => r.id === rec.id)?.rationale;
  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8">
      <div className="pr-8">
        <p className={MICRO}>{rec.categoryLabel}</p>
        <SheetTitle className="mt-1.5 text-xl">{rec.name}</SheetTitle>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PriorityTag priority={rec.priority} />
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {rec.confidence} confidence
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {rec.complexity} complexity
          </span>
        </div>
        <SheetDescription className="mt-4 leading-relaxed">{rec.description}</SheetDescription>
      </div>

      <div>
        <p className={MICRO}>The math</p>
        <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200/80 px-4">
          <Row label="Upfront cost (typical)" value={usd(rec.estimatedCost)} />
          <Row label="− Modeled incentive" value={`−${usd(rec.incentives)}`} />
          <Row label="= Net cost" value={usd(rec.netCost)} strong />
          <Row label="Annual savings" value={`${usd(rec.estimatedAnnualSavings)}/yr`} strong />
          <Row label="Payback (net cost ÷ savings)" value={years(rec.paybackYears)} />
          <Row label="Simple ROI" value={rec.roiPercent == null ? "n/a" : `${num(rec.roiPercent)}%`} />
          <Row label={`Lifetime net (${rec.lifetimeYears} yrs)`} value={usd(rec.lifetimeSavings)} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Cost range {usd(rec.cost.low)}–{usd(rec.cost.high)} · savings range {usd(rec.savingsRange.low)}–{usd(rec.savingsRange.high)}/yr
        </p>
      </div>

      <div>
        <p className={MICRO}>Why it ranks here</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{rec.reason}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{rec.priorityReason}</p>
        {rationale && (
          <p className="mt-3 rounded-xl bg-indigo-50/70 p-3 text-sm leading-relaxed text-indigo-900">
            <Sparkles className="mr-1 inline size-3.5 text-indigo-500" />
            {rationale}
          </p>
        )}
      </div>

      <div>
        <p className={MICRO}>Calculation trace</p>
        <ol className="mt-2 space-y-2">
          {rec.calculation.map((c, i) => (
            <li key={`${i}-${c.label}`} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <p className="font-medium text-slate-700">{c.label}</p>
              <p className="mt-0.5 font-mono text-slate-500">
                {c.expression} = <span className="text-slate-900">{c.result}</span>
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <p className={MICRO}>Assumptions</p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-600">
          {rec.assumptions.map((x, i) => (
            <li key={`${i}-${x}`}>{x}</li>
          ))}
          <li>{rec.cost.basis}</li>
          <li>{rec.incentiveBasis}</li>
        </ul>
      </div>

      {rec.matchedPrograms.length > 0 && (
        <div>
          <p className={MICRO}>Matched programs</p>
          <ul className="mt-2 space-y-1.5">
            {rec.matchedPrograms.map((p) => (
              <li key={p.id}>
                <a
                  href={p.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-slate-700 underline-offset-4 hover:text-slate-900 hover:underline"
                >
                  {p.name} <span className="text-slate-400">· {p.provider}</span>
                  <ExternalLink className="size-3 text-slate-400" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-slate-200/80 p-4">
        <p className={MICRO}>Next step</p>
        <p className="mt-1.5 text-sm text-slate-700">{rec.nextStep}</p>
      </div>
    </div>
  );
}

function TechnicalDetails({ analysis, debug }: { analysis: Analysis; debug?: boolean }) {
  const e = analysis.energy;
  const sections: { id: string; title: string; body: React.ReactNode }[] = [
    {
      id: "disclaimer",
      title: "How to read these numbers",
      body: (
        <div className="space-y-3 text-slate-600">
          <p>{analysis.disclaimer}</p>
          <p>
            Plan totals apply a {pct(1 - analysis.financialSummary.interactiveEffectsFactor)} interactive-effects reduction
            because measures overlap; individual cards show stand-alone savings. Incentive dollars are planning shares of
            typical cost, applied only where a matching program exists — they are not quoted program values. Tax credits and
            deductions depend on tax status and must be confirmed with a tax professional.
          </p>
          {analysis.notices.length > 0 && (
            <ul className="list-disc space-y-1 pl-4">
              {analysis.notices.map((n, i) => (
                <li key={`${i}-${n}`}>{n}</li>
              ))}
            </ul>
          )}
          {analysis.explanation.caveats.length > 0 && (
            <ul className="list-disc space-y-1 pl-4">
              {analysis.explanation.caveats.map((c, i) => (
                <li key={`${i}-${c}`}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      ),
    },
    {
      id: "confidence",
      title: `Data confidence — ${analysis.confidence.level} (${Math.round(analysis.confidence.score * 100)}/100)`,
      body: (
        <ul className="grid gap-2 sm:grid-cols-2">
          {analysis.confidence.factors.map((f) => (
            <li key={f.label} className="flex gap-2 text-slate-600">
              <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", f.met ? "bg-emerald-500" : "bg-slate-300")} />
              <span>
                <span className="font-medium text-slate-800">{f.label}</span> — {f.detail}
              </span>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: "baseline",
      title: "Energy baseline",
      body: (
        <div className="grid gap-x-8 sm:grid-cols-2">
          <Row label="Electricity" value={`${num(e.electricityKwh)} kWh/yr (${e.provenance.electricityKwh})`} />
          <Row label="Electricity rate" value={`${usd(e.electricityRate, 3)}/kWh (${e.provenance.electricityRate})`} />
          <Row label="Natural gas" value={e.naturalGasTherms > 0 ? `${num(e.naturalGasTherms)} therms/yr (${e.provenance.naturalGasTherms})` : "None"} />
          {e.naturalGasTherms > 0 && <Row label="Gas rate" value={`${usd(e.gasRate, 2)}/therm (${e.provenance.gasRate})`} />}
          <Row label="Annual energy cost" value={usd(e.annualEnergyCost)} />
          <Row label="Site EUI" value={e.euiKbtuPerSqFt != null ? `${num(e.euiKbtuPerSqFt)} kBtu/sq ft` : "n/a"} />
          <Row label="Peak demand" value={`${num(e.peakDemandKw)} kW (${e.peakDemandProvenance})`} />
          <Row label="Emissions" value={`${num(e.annualCo2eTons, 1)} t CO₂e/yr`} />
        </div>
      ),
    },
    {
      id: "charts",
      title: "Financial charts",
      body: <AnalysisCharts analysis={analysis} />,
    },
    {
      id: "incentives",
      title: `Incentive programs (${analysis.incentives.length})`,
      body: (
        <ul className="divide-y divide-slate-100">
          {analysis.incentives.map((i) => (
            <li key={i.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
              <div className="max-w-xl">
                <p className="font-medium text-slate-800">{i.name}</p>
                <p className="text-xs text-slate-500">
                  {i.provider} · {i.incentiveType} · {i.incentiveValue}
                </p>
                <p className="mt-1 text-xs text-slate-500">{i.matchReason}</p>
              </div>
              <a href={i.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-600">
                Source <ExternalLink className="size-3" />
              </a>
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: "assumptions",
      title: "Assumptions",
      body: (
        <div className="grid gap-x-8 sm:grid-cols-2">
          {analysis.assumptions.map((x, i) => (
            <Row key={`${i}-${x.label}`} label={x.label} value={x.value} />
          ))}
        </div>
      ),
    },
    {
      id: "summary",
      title: analysis.explanation.method === "ai" ? "AI-written summary" : "Plan summary",
      body: <p className="leading-relaxed whitespace-pre-line text-slate-600">{analysis.explanation.summary}</p>,
    },
    {
      id: "sources",
      title: "Sources & methodology",
      body: (
        <div className="space-y-4">
          <ul className="space-y-1.5">
            {analysis.sources.map((s, i) => (
              <li key={`${i}-${s.name}`} className="text-slate-600">
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-slate-800">
                    {s.name}
                  </a>
                ) : (
                  <span className="text-slate-800">{s.name}</span>
                )}
                {s.note && <span className="text-slate-500"> — {s.note}</span>}
              </li>
            ))}
          </ul>
          <ul className="space-y-1 text-xs text-slate-500">
            {analysis.pipeline.map((p) => (
              <li key={p.key}>
                <span className="font-medium text-slate-700">{p.label}</span> · {p.status} · {p.detail}
              </li>
            ))}
          </ul>
        </div>
      ),
    },
  ];
  if (debug) {
    sections.push({
      id: "debug",
      title: "Debug payload",
      body: (
        <pre className="max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-[11px] text-slate-200">
          {JSON.stringify({ debug: analysis.debug, pipeline: analysis.pipeline }, null, 2)}
        </pre>
      ),
    });
  }

  return (
    <section aria-label="Technical details" className={cn(SURFACE, "print-expand mt-6 px-6 py-2 sm:px-8")}>
      <div className="flex items-center gap-2 pt-5 pb-2">
        <Landmark className="size-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-900">Want more detail?</h2>
      </div>
      <Accordion type="multiple">
        {sections.map((s) => (
          <AccordionItem key={s.id} value={s.id} className="border-slate-100">
            <AccordionTrigger className="py-4 text-slate-700 hover:no-underline">{s.title}</AccordionTrigger>
            <AccordionContent className="pb-5">
              {s.body}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
