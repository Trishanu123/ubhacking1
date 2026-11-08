import { LIFETIMES } from "./assumptions";
import { addRanges, costRange } from "./cost-model";
import { dollarSavings, fmt, type MeasureContext, type MeasureDraft } from "./measure";
import { envelopeReduction, HPWH, STORAGE } from "./savings-model";

/** Building envelope / weatherization (simpler heuristic — no detailed envelope properties invented). */
export function evaluateEnvelope(ctx: MeasureContext): MeasureDraft | null {
  const { baseline, building, areaSqFt, roofAreaSqFt } = ctx;
  if (areaSqFt <= 0) return null;
  const f = envelopeReduction(building.yearBuilt);
  if (!f) return null;
  const heat = baseline.endUse.spaceHeatingTherms;
  if (heat < 1000) return null;
  const gasTherms = heat * f.value;
  const savings = dollarSavings(ctx, 0, gasTherms);
  const cost = addRanges(
    costRange("airSealingPerSqFt", areaSqFt, "Air sealing"),
    costRange("roofInsulationPerSqFt", roofAreaSqFt, "Roof insulation"),
  );
  const highHeat = (baseline.gasThermsPerSqFt ?? 0) > 0.6;

  return {
    id: "envelope-weatherization",
    category: "envelope",
    name: "Envelope Assessment & Weatherization",
    description: "Air sealing, roof insulation and targeted window/door weatherization, informed by an envelope assessment.",
    elecKwh: 0,
    gasTherms,
    extraDollars: 0,
    annualSavings: savings,
    cost,
    lifetimeYears: LIFETIMES.envelope,
    complexity: "medium",
    confidence: "low",
    fit: building.yearBuilt == null ? 0.5 : building.yearBuilt < 1980 ? (highHeat ? 0.85 : 0.7) : 0.5,
    fitReasons: [
      building.yearBuilt != null ? `Built ${building.yearBuilt}` : "Building vintage unknown",
      highHeat ? "Heating intensity is high relative to floor area" : "Moderate heating intensity",
      "Envelope characteristics are not available — assessment recommended",
    ],
    assumptions: [
      f.rationale,
      `Roof area estimated at ${fmt.num(roofAreaSqFt)} sq ft.`,
      "No envelope properties (insulation levels, window types, air leakage) are known; values are screening estimates only.",
    ],
    calculation: [
      { label: "Space-heating gas", expression: "from baseline end-use split", result: fmt.therms(heat) },
      { label: "Gas savings", expression: `${fmt.therms(heat)} × ${fmt.pct(f.value)}`, result: fmt.therms(gasTherms) },
      { label: "Estimated annual savings", expression: `${fmt.therms(gasTherms)} × ${fmt.rate(baseline.gasRate, "therm")}`, result: `${fmt.usd(savings)}/yr` },
    ],
    reason: "Older building with a meaningful heating load and no envelope data — an envelope/weatherization assessment is recommended.",
    nextStep: "Schedule an envelope assessment (infrared scan / blower-door where practical) to confirm air leakage and insulation levels.",
  };
}

/** High-efficiency / heat pump water heating — only for building types with material hot-water use. */
export function evaluateWaterHeating(ctx: MeasureContext): MeasureDraft | null {
  const { baseline, profile, building } = ctx;
  if (!profile.significantHotWater) return null;
  const dhw = baseline.endUse.waterHeatingTherms;
  if (dhw < 800) return null;
  const addedKwh = (dhw * 100 * HPWH.existingEfficiency.value) / 3.412 / HPWH.cop.value;
  const savings = dollarSavings(ctx, -addedKwh, dhw);
  const cost = costRange("hpwhPerAnnualTherm", dhw, "Heat pump water heating");

  return {
    id: "water-heating-hpwh",
    category: "water_heating",
    name: "Heat Pump Water Heating",
    description: "Replace gas-fired domestic hot water with heat pump water heating (commercial / central HPWH system).",
    elecKwh: -addedKwh,
    gasTherms: dhw,
    extraDollars: 0,
    annualSavings: savings,
    cost,
    lifetimeYears: LIFETIMES.water_heating,
    complexity: "medium",
    confidence: "low",
    fit: 0.7,
    fitReasons: [`${building.buildingType} buildings typically have significant hot-water demand`],
    assumptions: [
      `Water heating assumed ${fmt.pct(profile.gas.waterHeating)} of gas use.`,
      HPWH.existingEfficiency.rationale,
      HPWH.cop.rationale,
      "Space, ambient temperature and electrical capacity at the mechanical room require verification.",
    ],
    calculation: [
      { label: "Water-heating gas", expression: `${fmt.therms(baseline.naturalGasTherms)} × ${fmt.pct(profile.gas.waterHeating)}`, result: fmt.therms(dhw) },
      { label: "Added electricity", expression: `${fmt.therms(dhw)} × 100 × ${fmt.pct(HPWH.existingEfficiency.value)} ÷ 3.412 ÷ COP ${HPWH.cop.value}`, result: fmt.kwh(addedKwh) },
      {
        label: "Net annual savings",
        expression: `${fmt.therms(dhw)} × ${fmt.rate(baseline.gasRate, "therm")} − ${fmt.kwh(addedKwh)} × ${fmt.rate(baseline.electricityRate, "kWh")}`,
        result: `${fmt.usd(savings)}/yr`,
      },
    ],
    reason: "Hot water is a material end use for this building type, and heat pump water heaters can significantly reduce water-heating fuel use.",
    nextStep: "Confirm hot-water system type, age, capacity and daily demand; evaluate HPWH feasibility.",
  };
}

/** Battery storage — preliminary demand-charge value estimate only (no dispatch optimization). */
export function evaluateStorage(ctx: MeasureContext, solarPlanned: boolean): MeasureDraft | null {
  const { baseline } = ctx;
  const peak = baseline.peakDemandKw;
  if (baseline.electricityCost < 15000 || peak < 30) return null;
  const kw = Math.max(10, peak * STORAGE.sizingFractionOfPeak);
  const kwh = Math.max(20, kw * STORAGE.durationHours);
  const demandDollars = baseline.electricityCost * STORAGE.demandShareOfBill.value;
  const savings = demandDollars * STORAGE.peakReduction.value;
  const cost = costRange("batteryPerKwh", kwh, "Battery");

  return {
    id: "battery-storage",
    category: "storage",
    name: "Battery Storage (Peak Shaving)",
    description: `Approximately ${fmt.num(kw)} kW / ${fmt.num(kwh)} kWh behind-the-meter battery to reduce peak demand charges${solarPlanned ? " and pair with solar" : ""}.`,
    elecKwh: 0,
    gasTherms: 0,
    extraDollars: savings,
    annualSavings: savings,
    cost,
    lifetimeYears: LIFETIMES.storage,
    complexity: "medium",
    confidence: "low",
    fit: baseline.peakDemandProvenance === "user" ? 0.6 : 0.4,
    fitReasons: [
      `Peak demand ${baseline.peakDemandProvenance === "user" ? "provided" : "estimated"} at ~${fmt.num(peak)} kW`,
      "Value depends heavily on tariff structure and interval load data",
    ],
    assumptions: [
      STORAGE.demandShareOfBill.rationale,
      STORAGE.peakReduction.rationale,
      `Battery sized at ${fmt.pct(STORAGE.sizingFractionOfPeak)} of peak demand for ${STORAGE.durationHours} hours.`,
      "Preliminary storage estimate — a professional dispatch analysis using 15-minute interval data is required.",
    ],
    calculation: [
      { label: "Estimated peak demand", expression: baseline.peakDemandProvenance === "user" ? "provided" : `${fmt.kwh(baseline.electricityKwh)} ÷ (8,760 h × load factor)`, result: `${fmt.num(peak)} kW` },
      { label: "Assumed demand charges", expression: `${fmt.usd(baseline.electricityCost)} × ${fmt.pct(STORAGE.demandShareOfBill.value)}`, result: `${fmt.usd(demandDollars)}/yr` },
      { label: "Estimated annual value", expression: `${fmt.usd(demandDollars)} × ${fmt.pct(STORAGE.peakReduction.value)} peak reduction`, result: `${fmt.usd(savings)}/yr` },
    ],
    reason: "Electricity spend is meaningful; storage may reduce demand charges, particularly when paired with solar. Interval data is needed to confirm.",
    nextStep: "Obtain 12 months of 15-minute interval data and the exact tariff to evaluate storage dispatch value.",
  };
}
