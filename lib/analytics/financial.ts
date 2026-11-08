/**
 * Deterministic financial engine. The LLM never performs these calculations.
 *
 * Definitions (shown to users in the methodology panel):
 *  - Net cost        = max(0, project cost − incentives)
 *  - Simple payback  = net cost ÷ annual savings          (null when savings ≤ 0)
 *  - Annual ROI      = annual savings ÷ net cost × 100     (null when net cost is 0 or savings ≤ 0)
 *  - Lifetime net    = annual savings × lifetime − net cost
 */

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const safe = (v: unknown, fallback = 0): number => (isNum(v) ? v : fallback);

export function netCost(projectCost: number | null | undefined, incentives: number | null | undefined): number {
  return Math.max(0, safe(projectCost) - Math.max(0, safe(incentives)));
}

/** Incentives are capped at project cost (never produce a negative project cost). */
export function cappedIncentive(projectCost: number | null | undefined, incentives: number | null | undefined): number {
  return Math.min(Math.max(0, safe(incentives)), Math.max(0, safe(projectCost)));
}

export function simplePayback(net: number | null | undefined, annualSavings: number | null | undefined): number | null {
  const s = safe(annualSavings);
  const n = safe(net);
  if (s <= 0) return null;
  if (n <= 0) return 0;
  return n / s;
}

export function annualRoiPercent(net: number | null | undefined, annualSavings: number | null | undefined): number | null {
  const s = safe(annualSavings);
  const n = safe(net);
  if (s <= 0 || n <= 0) return null;
  return (s / n) * 100;
}

export function lifetimeNetSavings(
  annualSavings: number | null | undefined,
  lifetimeYears: number | null | undefined,
  net: number | null | undefined,
): number {
  return safe(annualSavings) * Math.max(0, safe(lifetimeYears)) - safe(net);
}

export interface MeasureFinancials {
  projectCost: number;
  incentives: number;
  netCost: number;
  annualSavings: number;
  paybackYears: number | null;
  roiPercent: number | null;
  lifetimeSavings: number;
}

export function computeMeasureFinancials(input: {
  projectCost: number | null | undefined;
  incentives: number | null | undefined;
  annualSavings: number | null | undefined;
  lifetimeYears: number | null | undefined;
}): MeasureFinancials {
  const projectCost = Math.max(0, safe(input.projectCost));
  const incentives = cappedIncentive(projectCost, input.incentives);
  const net = netCost(projectCost, incentives);
  const annualSavings = safe(input.annualSavings);
  return {
    projectCost,
    incentives,
    netCost: net,
    annualSavings,
    paybackYears: simplePayback(net, annualSavings),
    roiPercent: annualRoiPercent(net, annualSavings),
    lifetimeSavings: lifetimeNetSavings(annualSavings, input.lifetimeYears, net),
  };
}

/** Cumulative cash position by year (year 0 = −net investment). Undiscounted, preliminary. */
export function cumulativeCashflow(
  totalNet: number,
  annualSavings: number,
  years: number,
): { year: number; cumulativeNet: number; cumulativeSavings: number }[] {
  const out = [];
  for (let y = 0; y <= years; y++) {
    out.push({
      year: y,
      cumulativeSavings: Math.round(annualSavings * y),
      cumulativeNet: Math.round(annualSavings * y - totalNet),
    });
  }
  return out;
}

export function round(value: number, digits = 0): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
