import { randomUUID } from "crypto";
import type { Analysis, AnalyzeRequest, Assumption, PipelineStep } from "@/lib/types/analysis";
import type { Provenance } from "@/lib/types/building";
import { DISCLAIMER } from "@/lib/constants";
import { METHODOLOGY_SOURCES, source } from "@/lib/sources";
import { computeBaseline } from "./energy-baseline";
import { DEFAULT_AREA_BY_TYPE, estimateEnergy } from "./energy-estimator";
import { BUILDING_PROFILES, DEFAULT_RATES, INTERACTIVE_EFFECTS_FACTOR } from "./assumptions";
import { UNIT_COSTS } from "./cost-model";
import { buildRecommendations, evaluateMeasures, technologiesFor } from "./recommendations";
import { makeContext } from "./measure";
import { assessConfidence } from "./confidence";
import { summarizePortfolio } from "./portfolio";
import { buildNextSteps } from "./next-steps";
import { explainAnalysis } from "@/lib/ai/explanations";
import { DEMO_UTILITY, demoAnalyzeRequest } from "@/lib/demo/demo-building";
import { getBuildingData } from "@/lib/services/building-data";
import { DemoBuildingDataProvider } from "@/lib/services/building-data";
import { getSolarResource } from "@/lib/services/pvwatts";
import { findIncentives } from "@/lib/services/incentives";
import { resolveRates } from "@/lib/services/utility-rates";
import { demoExtraction } from "@/lib/services/utility-bill-ai";
import { saveAnalysis } from "@/lib/db/store";

async function timed<T>(
  steps: PipelineStep[],
  key: PipelineStep["key"],
  label: string,
  fn: () => Promise<{ value: T; status: PipelineStep["status"]; detail: string }>,
): Promise<T> {
  const t0 = Date.now();
  try {
    const { value, status, detail } = await fn();
    steps.push({ key, label, status, detail, durationMs: Date.now() - t0 });
    return value;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    steps.push({ key, label, status: "error", detail: message, durationMs: Date.now() - t0 });
    throw err;
  }
}

export async function runAnalysis(raw: AnalyzeRequest): Promise<Analysis> {
  // Demo mode always uses the labeled Buffalo office dataset so empty form fields cannot overwrite it.
  const req = raw.mode === "demo" ? demoAnalyzeRequest() : raw;
  const steps: PipelineStep[] = [];
  const errors: { step: string; message: string }[] = [];
  const notices: string[] = [];
  const isDemo = req.mode === "demo";

  const building = await timed(steps, "building", "Building identified", async () => {
    if (isDemo) {
      const b = await new DemoBuildingDataProvider().getBuildingData({ address: req.address });
      return { value: b, status: "done" as const, detail: "Loaded demo Buffalo office (labeled demo data)." };
    }
    try {
      const b = await getBuildingData({
        address: req.address,
        buildingType: req.buildingType,
        squareFeet: req.squareFeet,
        yearBuilt: req.yearBuilt,
        stories: req.stories,
      });
      const fallback = b.warnings.some((w) => w.includes("unavailable") || w.includes("could not be geocoded"));
      return {
        value: b,
        status: fallback ? ("fallback" as const) : ("done" as const),
        detail: b.normalizedAddress ?? b.address,
      };
    } catch (err) {
      errors.push({ step: "building", message: err instanceof Error ? err.message : "geocode failed" });
      const b = await getBuildingData({
        address: req.address,
        buildingType: req.buildingType,
        squareFeet: req.squareFeet,
        yearBuilt: req.yearBuilt,
        stories: req.stories,
      });
      return { value: b, status: "fallback" as const, detail: "Used submitted building fields." };
    }
  });

  if (isDemo) notices.push("Demo / estimated data — illustrative Buffalo-area office, not a real account.");

  const extraction = isDemo ? demoExtraction() : (req.extraction as Analysis["extraction"]) ?? null;

  const utility = await timed(steps, "utility", "Utility data assembled", async () => {
    const u = req.utility;
    const fromExtract = extraction?.annualized;
    const electricOnly = u?.hasGasService === false;
    if (electricOnly) {
      building.heatingFuel = "electric";
      building.fieldProvenance.heatingFuel = "user";
      building.warnings = building.warnings.filter((w) => !/heating fuel/i.test(w));
    }
    const electricityKwh = u?.electricityKwh ?? fromExtract?.electricityKwh ?? null;
    const naturalGasTherms = electricOnly ? 0 : u?.naturalGasTherms ?? fromExtract?.naturalGasTherms ?? null;
    const elecProv: Provenance = electricityKwh != null ? (isDemo ? "demo" : u?.source === "ai-extracted" ? "ai-extracted" : "user") : "estimated";
    const gasProv: Provenance = naturalGasTherms != null ? (isDemo ? "demo" : u?.source === "ai-extracted" ? "ai-extracted" : "user") : "estimated";

    let area = building.buildingAreaSqFt;
    if (!area) {
      area = DEFAULT_AREA_BY_TYPE[building.buildingType];
      building.buildingAreaSqFt = area;
      building.fieldProvenance.buildingAreaSqFt = "estimated";
      building.warnings.push(`Floor area estimated at ${area.toLocaleString()} sq ft from building type (last-resort default).`);
    }

    const estimate = estimateEnergy({
      buildingType: building.buildingType,
      squareFeet: area,
      yearBuilt: building.yearBuilt,
      latitude: building.latitude,
    });

    const elec = electricityKwh ?? estimate.electricityKwh;
    const gas = naturalGasTherms ?? estimate.naturalGasTherms;
    if (electricityKwh == null || naturalGasTherms == null) {
      notices.push("Estimated from building characteristics.");
    }

    const rates = resolveRates({
      state: building.state,
      electricityRate: u?.electricityRate ?? fromExtract?.electricityRate,
      gasRate: u?.gasRate ?? fromExtract?.gasRate,
      elecProv: isDemo ? "demo" : u?.electricityRate ? "user" : undefined,
      gasProv: isDemo ? "demo" : u?.gasRate ? "user" : undefined,
    });

    return {
      value: {
        electricityKwh: elec,
        naturalGasTherms: gas,
        peakDemandKw: u?.peakDemandKw ?? (isDemo ? DEMO_UTILITY.peakDemandKw : null),
        rates,
        elecProv: electricityKwh != null ? elecProv : ("estimated" as Provenance),
        gasProv: naturalGasTherms != null ? gasProv : ("estimated" as Provenance),
        estimateNotes: estimate.factors,
      },
      status: electricityKwh != null ? ("done" as const) : ("fallback" as const),
      detail: electricityKwh != null ? "Utility consumption provided." : estimate.method,
    };
  });

  const energy = await timed(steps, "baseline", "Energy baseline calculated", async () => {
    const baseline = computeBaseline({
      building,
      electricityKwh: utility.electricityKwh,
      naturalGasTherms: utility.naturalGasTherms,
      electricityRate: utility.rates.electricity,
      gasRate: utility.rates.gas,
      peakDemandKw: utility.peakDemandKw,
      provenance: {
        electricityKwh: utility.elecProv,
        naturalGasTherms: utility.gasProv,
        electricityRate: utility.rates.electricityProvenance,
        gasRate: utility.rates.gasProvenance,
      },
    });
    return { value: baseline, status: "done" as const, detail: `Estimated annual energy cost $${Math.round(baseline.annualEnergyCost).toLocaleString()}.` };
  });

  const solarPack = await timed(steps, "solar", "Solar resource estimated", async () => {
    const pack = await getSolarResource(building.latitude, building.longitude);
    return {
      value: pack,
      status: pack.solar.method === "pvwatts" ? ("done" as const) : ("fallback" as const),
      detail: pack.solar.note,
    };
  });

  const ctx = makeContext(building, energy, solarPack.solar);
  const drafts = evaluateMeasures(ctx);

  const incentives = await timed(steps, "incentives", "Incentives matched", async () => {
    const list = await findIncentives({
      state: building.state,
      utility: req.utility?.utilityProvider ?? extraction?.extraction.utilityProvider ?? (isDemo ? DEMO_UTILITY.utilityProvider : null),
      buildingType: building.buildingType,
      technologies: technologiesFor(drafts),
    });
    return {
      value: list,
      status: "done" as const,
      detail: `${list.length} potentially relevant program(s). Eligibility must be confirmed.`,
    };
  });

  const recommendations = await timed(steps, "opportunities", "Retrofit opportunities evaluated", async () => {
    const recs = buildRecommendations(drafts, ctx, incentives, req.lifetimeOverrideYears);
    return { value: recs, status: "done" as const, detail: `${recs.length} measures screened.` };
  });

  const financialSummary = await timed(steps, "financial", "Financial analysis complete", async () => {
    const summary = summarizePortfolio(recommendations, energy);
    return {
      value: summary,
      status: "done" as const,
      detail: `Potential annual savings ~$${summary.potentialAnnualSavings.toLocaleString()} (preliminary, with interactive-effects factor ${INTERACTIVE_EFFECTS_FACTOR}).`,
    };
  });

  const assumptions: Assumption[] = [
    { category: "Rates", label: "Electricity rate", value: `$${energy.electricityRate.toFixed(3)}/kWh (${energy.provenance.electricityRate})` },
    { category: "Rates", label: "Gas rate", value: `$${energy.gasRate.toFixed(2)}/therm (${energy.provenance.gasRate})` },
    { category: "End use", label: "Lighting share of electricity", value: `${Math.round(BUILDING_PROFILES[building.buildingType].elec.lighting * 100)}%` },
    { category: "End use", label: "Space heating share of gas", value: `${Math.round(BUILDING_PROFILES[building.buildingType].gas.spaceHeating * 100)}%` },
    { category: "Solar", label: "Usable roof fraction", value: "60% of estimated roof area" },
    { category: "Solar", label: "Installed PV cost", value: `$${UNIT_COSTS.solarPerWatt.typical}/W typical` },
    { category: "HVAC", label: "Installed cost basis", value: UNIT_COSTS.hvacIncrementalPerTon.unit },
    { category: "Lighting", label: "LED fixture cost", value: `$${UNIT_COSTS.ledPerFixture.typical} typical installed` },
    { category: "Battery", label: "Installed cost", value: `$${UNIT_COSTS.batteryPerKwh.typical}/kWh typical` },
    { category: "Portfolio", label: "Interactive-effects factor", value: String(INTERACTIVE_EFFECTS_FACTOR) },
    { category: "Incentives", label: "Modeled incentive dollars", value: "Planning share of project cost — not a published program value" },
    { category: "Defaults", label: "NY default rates (if used)", value: `$${DEFAULT_RATES.NY.electricity}/kWh, $${DEFAULT_RATES.NY.gas}/therm` },
    ...utility.estimateNotes.map((f) => ({ category: "Estimator", label: "Heuristic factor", value: f })),
  ];

  const sources = [
    ...building.dataSources,
    ...METHODOLOGY_SOURCES,
    solarPack.sourceNote,
    source("Seeded official incentive catalog", "incentive", "https://www.nyserda.ny.gov/", "Program names and URLs only. Values require verification."),
    isDemo
      ? source("Demo utility composite", "utility", undefined, "Demo / estimated data")
      : source("User-provided or extracted utility data", "utility", undefined, utility.rates.note),
  ];

  const confidence = assessConfidence(building, energy);

  let analysis: Analysis = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    mode: isDemo ? "demo" : "custom",
    isDemo,
    building,
    energy,
    solar: solarPack.solar,
    recommendations,
    incentives,
    financialSummary,
    assumptions,
    sources,
    confidence,
    nextSteps: [],
    explanation: {
      method: "template",
      summary: "",
      measureRationales: [],
      caveats: [],
      groundingCheck: { passed: true, ungroundedNumbers: [] },
    },
    pipeline: steps,
    extraction,
    notices: [...notices, ...building.warnings, ...energy.notes],
    debug: { errors, input: isDemo ? { mode: "demo" } : { address: req.address, buildingType: req.buildingType } },
    disclaimer: DISCLAIMER,
    persistence: "memory",
  };

  analysis.nextSteps = buildNextSteps(analysis);

  analysis.explanation = await timed(steps, "explanation", "Explanation generated", async () => {
    const explanation = await explainAnalysis(analysis);
    return {
      value: explanation,
      status: explanation.method === "ai" ? ("done" as const) : ("fallback" as const),
      detail:
        explanation.method === "ai"
          ? "LLM explanation grounded in calculated inputs."
          : explanation.fallbackReason
            ? `Template explanation (${explanation.fallbackReason})`
            : "Template explanation (no AI key).",
    };
  });

  analysis = await timed(steps, "persist", "Analysis stored", async () => {
    const saved = await saveAnalysis(analysis);
    return {
      value: saved,
      status: saved.persistence === "supabase" ? ("done" as const) : ("fallback" as const),
      detail:
        saved.persistence === "supabase"
          ? "Saved to Supabase."
          : saved.debug.errors.some((e) => e.step === "persist")
            ? "Saved in session memory (Supabase tables missing or insert failed)."
            : "Saved in session memory (Supabase not configured).",
    };
  });

  analysis.pipeline = steps;
  return analysis;
}
