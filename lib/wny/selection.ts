import type { Analysis } from "@/lib/types/analysis";
import type { PricedUpgrade, MoneyRange } from "./types";
import { compatible, packageTotals, packageSavingsRange } from "@/lib/analytics/budget-planner";
import { simplePayback } from "@/lib/analytics/financial";

/** Uses the existing planner's signed fuel, overlap and solar-after-efficiency logic. */
export function combineSelection(analysis: Analysis, ids: string[], priced: PricedUpgrade[]) {
  if (new Set(ids).size !== ids.length) throw new Error("Select each upgrade only once.");
  const selected = ids.map(id => {
    const rec = analysis.recommendations.find(r => r.id === id);
    if (!rec) throw new Error("This upgrade is not in the analysis.");
    return rec;
  });
  selected.forEach((rec, i) => {
    if (!compatible(rec, selected.slice(0, i))) throw new Error("These heating systems or alternative upgrades cannot be combined. Choose one.");
  });
  const totals = packageTotals(selected, analysis.energy, analysis.building.state);
  const sum = (field: "installed" | "net"): MoneyRange => selected.reduce((total, r) => {
    const item = priced.find(p => p.id === r.id);
    if (!item) throw new Error("Cost estimate unavailable for a selected upgrade.");
    const range = item.estimate[field];
    return { low: total.low + range.low, typical: total.typical + range.typical, high: total.high + range.high };
  }, { low: 0, typical: 0, high: 0 });
  const net = sum("net");
  return { ...totals, count: selected.length, installed: sum("installed"), net,
    paybackYears: simplePayback(net.typical, totals.annualSavings),
    savingsRange: packageSavingsRange(selected, analysis.energy, totals),
  };
}
