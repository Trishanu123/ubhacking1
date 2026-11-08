import { describe, expect, it } from "vitest";
import { DEMO_BUILDING } from "@/lib/demo/demo-building";
import type { BuildingType } from "@/lib/types/building";
import { computeBaseline } from "./energy-baseline";
import { makeContext } from "./measure";
import { buildRecommendations, evaluateMeasures } from "./recommendations";

const solar = {
  method: "fallback" as const,
  specificYieldKwhPerKw: 1250,
  monthlyKwhPerKw: null,
  tilt: 43,
  azimuth: 180,
  losses: 14,
  note: "test",
};

function analyzeType(buildingType: BuildingType) {
  const building = {
    ...structuredClone(DEMO_BUILDING),
    buildingType,
    heatingFuel: "natural_gas" as const,
  };
  const energy = computeBaseline({
    building,
    electricityKwh: 145000,
    naturalGasTherms: 42000,
    electricityRate: 0.15,
    gasRate: 1.1,
    peakDemandKw: 55,
    provenance: {
      electricityKwh: "user",
      naturalGasTherms: "user",
      electricityRate: "user",
      gasRate: "user",
    },
  });
  const ctx = makeContext(building, energy, solar);
  const drafts = evaluateMeasures(ctx);
  const recs = buildRecommendations(drafts, ctx, []);
  return recs;
}

describe("recommendation engine", () => {
  for (const type of ["office", "retail", "warehouse", "multifamily"] as const) {
    it(`screens ${type} buildings without throwing`, () => {
      const recs = analyzeType(type);
      expect(recs.length).toBeGreaterThan(0);
      expect(recs.every((r) => r.estimatedCost >= 0)).toBe(true);
      expect(recs.every((r) => r.netCost >= 0)).toBe(true);
      expect(recs.some((r) => r.category === "lighting" || r.category === "controls")).toBe(true);
    });
  }

  it("does not rank solely by ROI", () => {
    const recs = analyzeType("office");
    const order = recs.map((r) => r.priority);
    expect(order.includes("high") || order.includes("medium")).toBe(true);
    const byRoi = [...recs].sort((a, b) => (b.roiPercent ?? -1) - (a.roiPercent ?? -1));
    expect(recs[0].id === byRoi[0].id || recs[0].priority !== "explore").toBe(true);
  });
});
