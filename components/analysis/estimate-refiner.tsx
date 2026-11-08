"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MeasureRefinementSchema, type AnalysisRefinements, type MeasureRefinement } from "@/lib/types/refinement";
import type { Technology } from "@/lib/types/incentive";

type Field = { key: keyof MeasureRefinement; label: string; help?: string; max?: number };
const COMMON: Field[] = [
  { key: "quotedCost", label: "Installed quote for this upgrade ($)", help: "Total for the same scope, before incentives. Leave blank without a quote." },
  { key: "confirmedIncentive", label: "Confirmed eligible incentive ($)", help: "Use an eligibility/award document. Enter 0 if none applies." },
];
const HEATING: Field[] = [
  { key: "heatingTherms", label: "Annual gas used for this heating system (therms)", help: "Dedicated load from an audit/meter; blank keeps the estimated end-use split." },
  { key: "existingEfficiencyPct", label: "Existing seasonal efficiency (%)", max: 100 },
];
const FIELDS: Partial<Record<Technology, Field[]>> = {
  lighting: [
    { key: "fixtureCount", label: "Fixtures being replaced" }, { key: "oldWatts", label: "Existing watts per fixture (including ballast)" },
    { key: "newWatts", label: "Proposed watts per fixture" }, { key: "annualHours", label: "Annual operating hours", max: 8760 },
    { key: "lightingControlsPct", label: "Documented additional controls reduction (%)", max: 100, help: "Blank keeps the 20% planning assumption; use 0 without controls." },
    { key: "hoursLow", label: "Low operating-hours scenario (optional)", max: 8760 }, { key: "hoursHigh", label: "High operating-hours scenario (optional)", max: 8760 },
  ],
  hvac: [...HEATING, { key: "newEfficiencyPct", label: "Proposed seasonal efficiency (%)", max: 100 }],
  heat_pump: [...HEATING, { key: "seasonalCop", label: "Documented seasonal heat-pump COP", max: 8, help: "Use seasonal climate-specific performance, not a single rated test point." }, { key: "heatingCoveragePct", label: "Annual heating load served by heat pump (%)", max: 100 }],
  water_heating: [{ key: "heatingTherms", label: "Annual water-heating gas use (therms)" }, { key: "existingEfficiencyPct", label: "Existing water-heater efficiency (%)", max: 100 }, { key: "seasonalCop", label: "Seasonal heat-pump water-heater COP", max: 8 }],
  controls: [{ key: "electricReductionPct", label: "Audited HVAC-electricity reduction (%)", max: 100 }, { key: "gasReductionPct", label: "Audited heating reduction (%)", max: 100 }],
  envelope: [{ key: "gasReductionPct", label: "Audited space-heating reduction (%)", max: 100 }, { key: "heatingTherms", label: "Annual space-heating gas use (therms)" }],
  solar: [{ key: "solarKw", label: "Proposed solar size (kW DC)", help: "From a roof-specific design/proposal. The existing solar-resource model is retained." }],
  storage: [{ key: "demandReductionKw", label: "Supported monthly peak reduction (kW)", help: "From interval/dispatch analysis; capacity alone does not establish peak savings." }, { key: "demandRate", label: "Demand charge ($ per kW per month)" }, { key: "billingMonths", label: "Months with this peak reduction", max: 12 }, { key: "addedElectricityKwh", label: "Extra annual electricity for losses (kWh)" }],
};
export function EstimateRefiner({ id, category, value, onApply }: { id: string; category: Technology; value?: MeasureRefinement; onApply: (value: MeasureRefinement) => void }) {
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(value ?? {}).map(([key, v]) => [key, String(v)])));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  return <details className="mt-5 rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-800">Make this estimate more specific</summary>
    <p className="mt-3 text-xs leading-5 text-slate-500">Use equipment specifications, operating logs, an energy audit or an itemized quote. Leave unknown values blank. Entering a number does not verify it; ranges describe planning scenarios, not a promise of accuracy.</p>
    <form className="mt-4 space-y-4" onSubmit={event => {
      event.preventDefault(); setSaved(false);
      try {
        const parsed = MeasureRefinementSchema.parse(Object.fromEntries(Object.entries(draft).filter(([, v]) => v.trim() !== "").map(([key, v]) => [key, Number(v)])));
        onApply(parsed); setError(null); setSaved(true);
      } catch (e) { setError(e instanceof Error && e.name !== "ZodError" ? e.message : "Check that the entered values are within the shown units and limits."); }
    }}>
      <div className="grid gap-4 sm:grid-cols-2">{[...COMMON, ...(FIELDS[category] ?? [])].map(field => <div key={field.key} className="space-y-1.5"><Label htmlFor={`${id}-refine-${field.key}`} className="text-xs leading-5 text-slate-700">{field.label}</Label><Input id={`${id}-refine-${field.key}`} type="number" min={0} max={field.max ?? 1e10} step="any" inputMode="decimal" value={draft[field.key] ?? ""} onChange={e => { setDraft(d => ({ ...d, [field.key]: e.target.value })); setSaved(false); }} />{field.help && <p className="text-[11px] leading-5 text-slate-500">{field.help}</p>}</div>)}</div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {saved && <p role="status" className="text-sm text-emerald-700">Updated the estimate, cost and payback using your inputs.</p>}
      <div className="flex flex-wrap gap-2"><Button type="submit" className="rounded-xl">Update estimate</Button><Button type="button" variant="ghost" className="rounded-xl" onClick={() => { onApply({}); setDraft({}); setError(null); setSaved(false); }}>Use original assumptions</Button></div>
    </form>
  </details>;
}
export function BillRateRefiner({ values, onApply }: { values: AnalysisRefinements; onApply: (rates: { electricityRate?: number; gasRate?: number }) => void }) {
  const [electricityRate, setElectricityRate] = useState(values.electricityRate?.toString() ?? "");
  const [gasRate, setGasRate] = useState(values.gasRate?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  return <details className="mt-5 rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-medium text-slate-700">Use the energy rates from my bill</summary><p className="mt-3 text-xs leading-5 text-slate-500">Enter variable energy charges, including applicable delivery charges. Exclude fixed account charges and separate demand charges. Leave blank to keep the original bill/default rate. This updates every upgrade; it does not imply that modeled end uses are measured.</p><form className="mt-4 grid items-end gap-4 sm:grid-cols-3" onSubmit={event => { event.preventDefault(); try { onApply({ electricityRate: electricityRate.trim() ? Number(electricityRate) : undefined, gasRate: gasRate.trim() ? Number(gasRate) : undefined }); setError(null); } catch { setError("Use a positive electricity rate up to $5/kWh and gas rate up to $20/therm."); } }}><div className="space-y-2"><Label htmlFor="refine-electric-rate">Electricity ($/kWh)</Label><Input id="refine-electric-rate" type="number" min={0.001} max={5} step="any" value={electricityRate} onChange={e => setElectricityRate(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="refine-gas-rate">Gas ($/therm)</Label><Input id="refine-gas-rate" type="number" min={0.001} max={20} step="any" value={gasRate} onChange={e => setGasRate(e.target.value)} /></div><Button className="rounded-xl">Update all estimates</Button>{error && <p role="alert" className="text-sm text-red-700 sm:col-span-3">{error}</p>}</form></details>;
}
