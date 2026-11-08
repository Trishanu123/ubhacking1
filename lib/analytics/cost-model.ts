import type { BuildingType } from "@/lib/types/building";
import type { CostRange } from "@/lib/types/recommendation";

/**
 * Preliminary installed-cost model. Ranges, not quotes.
 * The "typical" value drives the primary calculation; low/high are displayed for context.
 * Unit costs are approximate planning values and should be replaced with contractor quotes.
 */
export const UNIT_COSTS = {
  ledPerFixture: { low: 110, typical: 160, high: 230, unit: "per fixture (LED retrofit, installed)" },
  lightingControlsPerSqFt: { low: 0.35, typical: 0.55, high: 0.85, unit: "per sq ft (occupancy/daylight controls)" },
  hvacControlsPerSqFt: { low: 0.6, typical: 1.0, high: 1.6, unit: "per sq ft (BAS/EMS upgrade + retro-commissioning)" },
  hvacIncrementalPerTon: { low: 500, typical: 800, high: 1200, unit: "per ton (incremental cost of high-efficiency vs. standard replacement)" },
  hvacFullPerTon: { low: 2000, typical: 2800, high: 3800, unit: "per ton (full replacement, for reference)" },
  heatPumpPerTon: { low: 3000, typical: 4200, high: 5500, unit: "per ton (cold-climate heat pump, installed)" },
  airSealingPerSqFt: { low: 0.3, typical: 0.5, high: 0.8, unit: "per sq ft floor area (air sealing)" },
  roofInsulationPerSqFt: { low: 2.5, typical: 3.5, high: 5.0, unit: "per sq ft roof (insulation upgrade)" },
  solarPerWatt: { low: 2.1, typical: 2.6, high: 3.2, unit: "per W-dc (commercial rooftop PV, installed)" },
  batteryPerKwh: { low: 700, typical: 950, high: 1250, unit: "per kWh (behind-the-meter battery, installed)" },
  hpwhPerAnnualTherm: { low: 9, typical: 14, high: 20, unit: "per annual therm of water-heating load (sizing proxy)" },
} as const;

export type UnitCostKey = keyof typeof UNIT_COSTS;

/** Sq ft of conditioned area per ton of cooling (sizing heuristic). */
export const SQFT_PER_TON: Record<BuildingType, number> = {
  office: 350, retail: 300, restaurant: 200, warehouse: 1000, multifamily: 450,
  hotel: 350, school: 350, healthcare: 250, industrial: 600, other: 350,
};

export function costRange(key: UnitCostKey, quantity: number, basisPrefix?: string): CostRange {
  const u = UNIT_COSTS[key];
  const q = Math.max(0, quantity);
  return {
    low: Math.round(u.low * q),
    typical: Math.round(u.typical * q),
    high: Math.round(u.high * q),
    basis: `${basisPrefix ? basisPrefix + ": " : ""}${formatQty(q)} × $${u.typical.toLocaleString()} ${u.unit} (range $${u.low}–$${u.high})`,
  };
}

export function addRanges(a: CostRange, b: CostRange): CostRange {
  return {
    low: a.low + b.low,
    typical: a.typical + b.typical,
    high: a.high + b.high,
    basis: `${a.basis}; ${b.basis}`,
  };
}

function formatQty(q: number): string {
  return q >= 100 ? Math.round(q).toLocaleString() : q.toFixed(q < 10 ? 1 : 0);
}
