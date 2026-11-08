import { LIFETIMES } from "./assumptions";
import { addRanges, costRange } from "./cost-model";
import { dollarSavings, fmt, type MeasureContext, type MeasureDraft } from "./measure";
import { LIGHTING_CONTROLS_REDUCTION, ledReduction } from "./savings-model";

/** LED retrofit + lighting controls. */
export function evaluateLighting(ctx: MeasureContext): MeasureDraft | null {
  const { baseline, building, profile, areaSqFt } = ctx;
  const lightingKwh = baseline.endUse.lightingKwh;
  if (lightingKwh <= 0 || areaSqFt <= 0) return null;

  const led = ledReduction(building.yearBuilt);
  const ledKwh = lightingKwh * led.value;
  const remaining = lightingKwh - ledKwh;
  const ctrlKwh = remaining * LIGHTING_CONTROLS_REDUCTION.value;
  const totalKwh = ledKwh + ctrlKwh;
  const savings = dollarSavings(ctx, totalKwh, 0);

  const fixtures = Math.round((areaSqFt / 1000) * profile.fixturesPer1000SqFt);
  const cost = addRanges(
    costRange("ledPerFixture", fixtures, "LED fixtures"),
    costRange("lightingControlsPerSqFt", areaSqFt, "Controls"),
  );

  const newer = building.yearBuilt != null && building.yearBuilt >= 2018;
  const fit = newer ? 0.35 : 0.9;
  const fitReasons = newer
    ? ["Newer building — may already have LED lighting"]
    : ["Commercial lighting is typically a large, low-risk electricity end use", "Lighting inventory not yet verified"];

  return {
    id: "lighting-led-controls",
    category: "lighting",
    name: "LED Lighting + Controls",
    description:
      "Replace legacy fixtures with LED and add occupancy/daylight controls to reduce lighting runtime.",
    elecKwh: totalKwh,
    gasTherms: 0,
    extraDollars: 0,
    annualSavings: savings,
    cost,
    lifetimeYears: LIFETIMES.lighting,
    complexity: "low",
    confidence: building.yearBuilt == null ? "medium" : newer ? "low" : "medium",
    fit,
    fitReasons,
    assumptions: [
      `Lighting share of electricity assumed ${fmt.pct(profile.elec.lighting)} for ${building.buildingType} buildings.`,
      led.rationale,
      LIGHTING_CONTROLS_REDUCTION.rationale,
      `Fixture count estimated at ${profile.fixturesPer1000SqFt} fixtures per 1,000 sq ft (${fixtures.toLocaleString()} fixtures).`,
      "Actual savings depend on existing fixture types, operating hours and occupancy patterns.",
    ],
    calculation: [
      {
        label: "Estimated lighting consumption",
        expression: `${fmt.kwh(baseline.electricityKwh)} × ${fmt.pct(profile.elec.lighting)} lighting share`,
        result: fmt.kwh(lightingKwh),
      },
      { label: "LED reduction", expression: `${fmt.kwh(lightingKwh)} × ${fmt.pct(led.value)}`, result: fmt.kwh(ledKwh) },
      {
        label: "Controls reduction (on remaining load)",
        expression: `${fmt.kwh(remaining)} × ${fmt.pct(LIGHTING_CONTROLS_REDUCTION.value)}`,
        result: fmt.kwh(ctrlKwh),
      },
      {
        label: "Estimated annual savings",
        expression: `${fmt.kwh(totalKwh)} × ${fmt.rate(baseline.electricityRate, "kWh")}`,
        result: `${fmt.usd(savings)}/yr`,
      },
    ],
    reason: newer
      ? "Lighting upgrades may still offer controls savings, but newer buildings often already have LED."
      : "Lighting is a large, well-understood end use in commercial buildings; LED + controls retrofits are typically low-risk with short installation timelines.",
    nextStep: "Conduct a lighting inventory (fixture types, counts, operating hours) and request an LED retrofit quote.",
  };
}
