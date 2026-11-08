import { describe, expect, it } from "vitest";
import { runAnalysis } from "@/lib/analytics/pipeline";
import { demoAnalyzeRequest } from "@/lib/demo/demo-building";
import { AnalyzeRequestSchema } from "@/lib/types/analysis";
import { DEMO_FORM, parseNumber, toAnalyzeRequest, validateEnergy } from "@/lib/client/analyze-form";
import { summarizeAnalysis } from "./summarize";

describe("results summary contract", () => {
  it("reconciles card and hero arithmetic with the engine", async () => {
    const analysis = await runAnalysis(demoAnalyzeRequest());
    const result = summarizeAnalysis(analysis);

    const measures = [result.topPick!.measure, ...result.others];
    expect(measures).toHaveLength(analysis.recommendations.length);
    for (const m of measures) {
      expect(m.netCost).toBeCloseTo(Math.max(0, m.upfrontCost - m.incentive), 0);
      if (m.annualSavings > 0 && m.netCost > 0) {
        expect(m.paybackYears).toBeCloseTo(m.netCost / m.annualSavings, 1);
      }
    }

    const t = result.totals;
    expect(t.netCost).toBeCloseTo(t.upfrontCost - t.incentives, 0);
    expect(t.blendedPaybackYears).toBeCloseTo(t.netCost / t.annualSavings, 1);
    expect(t.shareOfBaseline).toBeCloseTo(t.annualSavings / result.baseline.annualEnergyCost, 2);
    expect(result.topPick!.measure.includedInTotals).toBe(true);
    expect(result.topPick!.pitch.length).toBeGreaterThan(20);
  }, 30_000);

  it("treats an electric-only account as zero gas instead of estimating it", async () => {
    const analysis = await runAnalysis(
      AnalyzeRequestSchema.parse({
        mode: "custom",
        address: "1 Test Plaza, Phoenix, AZ 85004",
        buildingType: "retail",
        squareFeet: 20000,
        utility: { electricityKwh: 300000, hasGasService: false, source: "manual" },
      }),
    );
    expect(analysis.energy.naturalGasTherms).toBe(0);
    expect(analysis.building.heatingFuel).toBe("electric");
    expect(analysis.recommendations.some((r) => r.category === "heat_pump")).toBe(false);
    expect(summarizeAnalysis(analysis).baseline.hasGas).toBe(false);
  }, 30_000);
});

describe("intake form", () => {
  it("parses formatted numbers and flags garbage", () => {
    expect(parseNumber("145,000")).toBe(145000);
    expect(parseNumber("$0.15")).toBe(0.15);
    expect(parseNumber("")).toBeNull();
    expect(Number.isNaN(parseNumber("abc"))).toBe(true);
    expect(validateEnergy({ ...DEMO_FORM, elecRate: "abc" }).elecRate).toBeDefined();
  });

  it("builds a request the API schema accepts, dropping gas for electric-only", () => {
    const req = toAnalyzeRequest("custom", { ...DEMO_FORM, hasGasService: false, squareFeet: "25,000" }, null);
    const parsed = AnalyzeRequestSchema.parse(req);
    expect(parsed.squareFeet).toBe(25000);
    expect(parsed.utility?.naturalGasTherms).toBe(0);
    expect(parsed.utility?.gasRate).toBeNull();
    expect(parsed.utility?.hasGasService).toBe(false);
  });
});
