"use client";

import { useState } from "react";
import { ArrowRight, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_BUDGET, planBudget, type BudgetPlan, type BudgetPriority } from "@/lib/analytics/budget-planner";
import type { Analysis } from "@/lib/types/analysis";
import { num, pct, usd, years } from "@/lib/format";
import { simpleUpgradeName } from "@/lib/results/summarize";
import { cn } from "@/lib/utils";

const PRIORITIES: { value: BudgetPriority; label: string }[] = [
  { value: "bills", label: "Lower bills" },
  { value: "emissions", label: "Lower emissions" },
  { value: "payback", label: "Shorter payback" },
];

export function BudgetPlanner({ analysis, onViewMeasure }: { analysis: Analysis; onViewMeasure: (id: string) => void }) {
  const [budget, setBudget] = useState("25000");
  const [priority, setPriority] = useState<BudgetPriority>("bills");
  const [plan, setPlan] = useState<BudgetPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const budgetId = `upgrade-budget-${analysis.id}`;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      if (!budget.trim()) throw new Error("Enter your upfront budget.");
      setPlan(planBudget(analysis.recommendations, analysis.energy, Number(budget), priority, analysis.building.state));
    } catch (err) {
      setPlan(null);
      setError(err instanceof Error ? err.message : "Could not build a plan. Check your budget and try again.");
    }
  }

  return (
    <section aria-labelledby={`budget-title-${analysis.id}`} className={cn("mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8", !plan && "no-print")}>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Wallet className="size-4" aria-hidden="true" /></span>
        <div>
          <h2 id={`budget-title-${analysis.id}`} className="text-lg font-semibold tracking-tight text-slate-900">What should I do with my budget?</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">Find a compatible package of upgrades based on what matters most to you.</p>
        </div>
      </div>

      <form onSubmit={submit} className="no-print mt-6 space-y-5">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="space-y-2">
            <Label htmlFor={budgetId} className="text-slate-700">Upfront budget ($)</Label>
            <Input id={budgetId} type="number" inputMode="decimal" min={0} max={MAX_BUDGET} step="0.01" required value={budget}
              onChange={e => { setBudget(e.target.value); setPlan(null); setError(null); }} />
          </div>
          <fieldset className="min-w-0 space-y-2">
            <legend className="text-sm font-medium text-slate-700">Your priority</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {PRIORITIES.map(option => (
                <label key={option.value} className={cn("flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-center text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-slate-500", priority === option.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
                  <input type="radio" name={`budget-priority-${analysis.id}`} value={option.value} checked={priority === option.value} className="sr-only"
                    onChange={() => { setPriority(option.value); setPlan(null); setError(null); }} />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-xs leading-5 text-slate-500">Uses estimated upfront costs before incentives. Actual quotes may vary; unconfirmed rebates don’t increase your budget.</p>
          <Button className="rounded-xl">Find my upgrades <ArrowRight className="size-4" /></Button>
        </div>
      </form>

      {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
      {plan && <div className="mt-6 border-t border-slate-100 pt-6" aria-live="polite">
        {!plan.selected.length ? (
          <p className="text-sm leading-6 text-slate-600">No available package fits {usd(plan.budget, 2)} and improves your selected priority using the current estimates. Try a larger budget or another priority; an energy assessment may identify smaller projects.</p>
        ) : <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Your recommended package</h3>
            <p className="text-xs text-slate-500">{PRIORITIES.find(p => p.value === plan.priority)?.label} · {usd(plan.budget, 2)} budget</p>
          </div>
          <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-3">
            <Metric label="Estimated upfront cost" value={usd(plan.upfrontCost, 2)} />
            <Metric label={plan.annualSavings >= 0 ? "Annual bill savings" : "Annual bill increase"} value={`${usd(Math.abs(plan.annualSavings))}/yr`} />
            <Metric label="Savings cover your cost in" value={plan.paybackYears == null ? "No bill savings" : years(plan.paybackYears)} />
          </dl>
          <p className="mt-4 text-xs text-slate-500">{usd(plan.remainingBudget, 2)} remains in your budget.</p>
          <ul className="mt-5 divide-y divide-slate-100">
            {plan.selected.map(rec => <li key={rec.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0"><p className="text-sm font-medium text-slate-800">{simpleUpgradeName(rec)}</p><p className="mt-1 text-xs text-slate-500">{usd(rec.estimatedCost)} estimated upfront</p></div>
              <Button type="button" size="sm" variant="ghost" className="no-print rounded-lg text-slate-600" onClick={() => onViewMeasure(rec.id)}>Details <ArrowRight className="size-3.5" /></Button>
            </li>)}
          </ul>
          {plan.priority === "emissions" && <p className="mt-3 text-sm text-slate-600">Estimated climate pollution avoided: {num(plan.annualCo2eSavingsTons, 2)} tonnes a year.</p>}
          <details className="mt-4 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">How this package was chosen</summary>
            <div className="mt-3 space-y-2">
            <p>Estimated yearly bill change: {usd(plan.savingsRange.low)} to {usd(plan.savingsRange.high)} saved. Climate pollution avoided: {num(plan.annualCo2eSavingsTons, 2)} tonnes a year.</p>
            <p>{plan.overlapFactor < 1 ? `Package benefits include a ${pct(1 - plan.overlapFactor)} overlap reduction using the existing planning assumption.` : "A single upgrade needs no package overlap reduction."} Conflicting heating replacements and declared alternatives cannot be combined. Solar offsets only the electricity remaining after other upgrades.</p>
            <p>Net annual energy change: {num(plan.annualElectricitySavingsKwh)} kWh and {num(plan.annualGasSavingsTherms)} therms saved. Negative savings mean added energy use.</p>
            <p>{plan.priority === "payback" ? "Selected for the shortest positive package payback; spending the entire budget may not improve that goal." : plan.priority === "emissions" ? "Selected for the largest modeled emissions reduction; a lower-emissions package can increase energy bills." : "Selected for the largest modeled annual bill savings within your budget."} Payback uses upfront cost, with no assumed incentive deduction. Figures and ranges are preliminary; confirm quotes, tariffs and measure interactions before installation.</p>
          </div></details>
        </>}
      </div>}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</dd></div>;
}
