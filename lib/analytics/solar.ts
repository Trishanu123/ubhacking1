import { LIFETIMES } from "./assumptions";
import { costRange } from "./cost-model";
import { fmt, type MeasureContext, type MeasureDraft } from "./measure";
import { SOLAR } from "./savings-model";

export interface SolarSizing {
  usableRoofSqFt: number;
  roofLimitedKw: number;
  consumptionLimitedKw: number;
  systemKw: number;
  annualKwh: number;
  offsetPct: number;
}

export function sizeSolar(roofAreaSqFt: number, annualKwh: number, specificYield: number): SolarSizing {
  const usableRoofSqFt = roofAreaSqFt * SOLAR.usableRoofFraction.value;
  const roofLimitedKw = (usableRoofSqFt * SOLAR.wattsPerSqFt.value) / 1000;
  const consumptionLimitedKw = specificYield > 0 ? (annualKwh * SOLAR.maxOffset.value) / specificYield : 0;
  const systemKw = Math.max(0, Math.min(roofLimitedKw, consumptionLimitedKw));
  const gen = systemKw * specificYield;
  return {
    usableRoofSqFt,
    roofLimitedKw,
    consumptionLimitedKw,
    systemKw,
    annualKwh: gen,
    offsetPct: annualKwh > 0 ? gen / annualKwh : 0,
  };
}

/** Rooftop solar PV. Only evaluated when roof area and meaningful electricity use exist. */
export function evaluateSolar(ctx: MeasureContext): MeasureDraft | null {
  const { baseline, roofAreaSqFt, solar, building } = ctx;
  if (roofAreaSqFt < 1500 || baseline.electricityKwh < 20000) return null;
  const sizing = sizeSolar(roofAreaSqFt, baseline.electricityKwh, solar.specificYieldKwhPerKw);
  if (sizing.systemKw < 10) return null;

  const valuePerKwh = baseline.electricityRate * SOLAR.valueFactor.value;
  const savings = sizing.annualKwh * valuePerKwh;
  const cost = costRange("solarPerWatt", sizing.systemKw * 1000, "PV system");
  const roofFromData = building.fieldProvenance.footprintSqFt === "api";

  return {
    id: "solar-pv",
    category: "solar",
    name: "Rooftop Solar PV",
    description: `Approximately ${fmt.num(sizing.systemKw)} kW-dc rooftop system offsetting an estimated ${fmt.pct(sizing.offsetPct)} of annual electricity purchases.`,
    elecKwh: sizing.annualKwh,
    gasTherms: 0,
    extraDollars: 0,
    annualSavings: savings,
    cost,
    lifetimeYears: LIFETIMES.solar,
    complexity: "medium",
    confidence: solar.method === "pvwatts" && roofFromData ? "medium" : solar.method === "pvwatts" ? "medium" : "low",
    fit: building.stories != null && building.stories > 6 ? 0.45 : 0.75,
    fitReasons: [
      `Estimated roof area ${fmt.num(roofAreaSqFt)} sq ft (${roofFromData ? "from building footprint data" : "area ÷ stories"})`,
      "Roof structural condition requires professional verification",
    ],
    assumptions: [
      SOLAR.usableRoofFraction.rationale,
      SOLAR.wattsPerSqFt.rationale,
      `Specific yield ${fmt.num(solar.specificYieldKwhPerKw)} kWh/kW-yr (${solar.method === "pvwatts" ? "NREL PVWatts" : "approximate latitude-based estimate"}; tilt ${solar.tilt}°, azimuth ${solar.azimuth}°, losses ${solar.losses}%).`,
      SOLAR.valueFactor.rationale,
      SOLAR.maxOffset.rationale,
      "Federal tax credit eligibility changed under 2025 federal legislation and is not included in modeled incentives — verify with a tax advisor.",
      "Roof structural condition, age and interconnection requirements require professional verification.",
    ],
    calculation: [
      { label: "Usable roof area", expression: `${fmt.num(roofAreaSqFt)} sq ft × ${fmt.pct(SOLAR.usableRoofFraction.value)}`, result: `${fmt.num(sizing.usableRoofSqFt)} sq ft` },
      { label: "Roof-limited size", expression: `${fmt.num(sizing.usableRoofSqFt)} sq ft × ${SOLAR.wattsPerSqFt.value} W/sq ft`, result: `${fmt.num(sizing.roofLimitedKw, 1)} kW` },
      { label: "Consumption-limited size", expression: `${fmt.kwh(baseline.electricityKwh)} ÷ ${fmt.num(solar.specificYieldKwhPerKw)} kWh/kW`, result: `${fmt.num(sizing.consumptionLimitedKw, 1)} kW` },
      { label: "Annual generation", expression: `${fmt.num(sizing.systemKw, 1)} kW × ${fmt.num(solar.specificYieldKwhPerKw)} kWh/kW`, result: fmt.kwh(sizing.annualKwh) },
      { label: "Estimated annual value", expression: `${fmt.kwh(sizing.annualKwh)} × ${fmt.rate(valuePerKwh, "kWh")}`, result: `${fmt.usd(savings)}/yr` },
    ],
    reason: `The building has an estimated ${fmt.num(sizing.usableRoofSqFt)} sq ft of usable roof and ${fmt.kwh(baseline.electricityKwh)} of annual electricity use, so rooftop PV could offset a portion of purchases.`,
    nextStep: "Commission a roof structural and condition assessment and request solar proposals including interconnection review.",
  };
}
