import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { Analysis } from "@/lib/types/analysis";
import { demoAnalyzeRequest } from "@/lib/demo/demo-building";
import { runAnalysis } from "@/lib/analytics/pipeline";
import { planningInput, PlanningInputSchema, type PlanningInput } from "./types";
import { COST_CATALOG, estimateUpgrade, pricedUpgrades, scaleCost } from "./costs";
import { filterInstallers, InstallerSchema, loadInstallers, normalizeCounty, type Installer } from "./directory";
import { buildInstallerContext, fallbackInstallerAdvice, type InstallerContext } from "./advice";
import { aiAdvice, validateRanking } from "./ranking";
import { getInstallerRecommendations, rankInstallerContext } from "@/lib/ai/installer-recommendation";
import { combineSelection } from "./selection";

let analysis: Analysis;
let input: PlanningInput;
beforeAll(async () => {
  analysis = await runAnalysis(demoAnalyzeRequest());
  input = planningInput(analysis);
}, 30000);
const today = new Date().toISOString().slice(0, 10);
function installer(overrides: Partial<Installer> = {}): Installer {
  return InstallerSchema.parse({ id: "test-fixture", name: "Test fixture only", website: "https://example.org", phone: null,
    serviceArea: ["Erie"], services: ["led", "lighting_controls"], certifications: [], licenseInsuranceNotes: "Test fixture; not a business.",
    priceTier: "budget", priceTierSource: "https://example.org/evidence", priceVerifiedOn: today,
    sourceUrls: ["https://example.org"], lastVerified: today, verificationStatus: "verified", isTemplate: false, ...overrides });
}
function rankingContext(): InstallerContext {
  const lighting = input.recommendations.find(r => r.category === "lighting")!;
  return buildInstallerContext({ ...input, recommendations: [lighting] }, "Erie", [installer()]);
}
function validRanking(context: InstallerContext) {
  const advice = fallbackInstallerAdvice(context);
  return { top: advice.top, upgrades: advice.upgrades.map(r => ({ ...r, installers: r.installers.map(i => ({ ...i, caveats: ["Price tier is not a quote."] })) })) };
}

describe("WNY cost estimates", () => {
  it("scales ordered installed ranges and validates inputs", () => {
    expect(scaleCost({ low: 100, typical: 200, high: 300 }, 10, 1.1)).toEqual({ low: 1100, typical: 2200, high: 3300 });
    expect(() => scaleCost({ low: 3, typical: 2, high: 1 }, 10)).toThrow();
    expect(() => scaleCost({ low: 1, typical: 2, high: 3 }, NaN)).toThrow();
  });
  it("scales with actual floor area and keeps source/date and uncertainty visible", () => {
    const controls = input.recommendations.find(r => r.category === "controls")!;
    const a = estimateUpgrade(input, controls);
    const twice = estimateUpgrade({ ...input, building: { ...input.building, buildingAreaSqFt: input.building.buildingAreaSqFt! * 2 } }, controls);
    expect(twice.installed.typical).toBe(a.installed.typical * 2);
    expect(a.installed.low).toBeLessThan(a.installed.typical);
    expect(a.installed.high).toBeGreaterThan(a.installed.typical);
    expect(a.provisional).toBe(true);
    expect(a.sources.every(s => s.url.startsWith("https:") && s.reviewed)).toBe(true);
  });
  it("keeps original savings unchanged, estimates net ranges with existing incentive shares, and calculates payback", () => {
    const before = structuredClone(input);
    for (const r of pricedUpgrades(input)) {
      expect(r.estimatedAnnualSavings).toBe(input.recommendations.find(i => i.id === r.id)!.estimatedAnnualSavings);
      expect(r.estimate.net.typical).toBe(Math.max(0, r.estimate.installed.typical - r.estimate.incentives.typical));
      if (r.estimatedAnnualSavings > 0) expect(r.estimate.payback.typical).toBeCloseTo(r.estimate.net.typical / r.estimatedAnnualSavings);
      else expect(r.estimate.payback.typical).toBeNull();
    }
    expect(input).toEqual(before);
  });
  it("does not grant invented or expired residential credit IDs", () => {
    const rec = { ...input.recommendations[0], programIds: ["federal-25C", "federal-25D", "invented-program"] };
    expect(estimateUpgrade(input, rec, 2026).incentives.typical).toBe(0);
  });
  it("uses full HVAC replacement cost here without changing the original incremental engine cost", () => {
    const rec = input.recommendations.find(r => r.category === "hvac")!;
    expect(estimateUpgrade(input, rec).installed.typical).toBeGreaterThan(rec.estimatedCost);
    expect(rec.cost.basis).toContain("Incremental");
  });
  it("leaves unsupported equipment costs null rather than inventing counts or prices", () => {
    for (const id of ["windows", "smart_thermostat", "ground_source_heat_pump"]) {
      const entry = COST_CATALOG.entries.find(e => e.id === id)!;
      expect(entry.low).toBeNull(); expect(entry.typical).toBeNull(); expect(entry.high).toBeNull();
      expect(entry.todo.length).toBeGreaterThan(0);
    }
  });
});

describe("installer retrieval", () => {
  it("excludes every shipped placeholder", () => {
    expect(loadInstallers().length).toBeGreaterThan(0);
    expect(filterInstallers("led", "Erie")).toEqual([]);
  });
  it("matches county AND service, without guessing missing locations", () => {
    const row = installer();
    expect(normalizeCounty(" erie County, NY ")).toBe("Erie");
    expect(filterInstallers("led", "Erie County", [row])).toHaveLength(1);
    expect(filterInstallers("led", "Niagara", [row])).toHaveLength(0);
    expect(filterInstallers("rooftop_solar", "Erie", [row])).toHaveLength(0);
    expect(filterInstallers("led", null, [row])).toHaveLength(0);
  });
  it("excludes unverified, template and expired records and downgrades undocumented prices", () => {
    const rows = [installer({ id: "old", lastVerified: "2000-01-01" }), installer({ id: "unverified", verificationStatus: "unverified" }), installer({ id: "price-unknown", priceTierSource: null })];
    const matches = filterInstallers("led", "Erie", rows);
    expect(matches.map(r => r.id)).toEqual(["price-unknown"]);
    expect(matches[0].priceTier).toBe("unverified");
  });
  it("does not use NY county selections for an out-of-state building", () => {
    const context = buildInstallerContext({ ...input, building: { ...input.building, state: "CA" } }, "Erie", [installer()]);
    expect(Object.values(context.candidates).flat()).toEqual([]);
  });
});

describe("grounded GPT rankings", () => {
  it("accepts canonical IDs, prices and service matches", () => {
    const ctx = rankingContext();
    expect(validateRanking(validRanking(ctx), ctx).top?.upgradeId).toBe(ctx.upgrades[0].id);
  });
  it("rejects hallucinated or cross-upgrade installer IDs, invented price tiers, duplicates and unknown upgrades", () => {
    const ctx = rankingContext();
    for (const change of [
      (r: ReturnType<typeof validRanking>) => { r.upgrades[0].installers[0].id = "made-up-company"; },
      (r: ReturnType<typeof validRanking>) => { r.upgrades[0].installers[0].priceTier = "premium"; },
      (r: ReturnType<typeof validRanking>) => { r.upgrades.push(r.upgrades[0]); },
      (r: ReturnType<typeof validRanking>) => { r.top!.upgradeId = "unknown-upgrade"; },
      (r: ReturnType<typeof validRanking>) => { r.top!.installerIds = ["different-company"]; },
    ]) {
      const ranked = validRanking(ctx); change(ranked); expect(() => validateRanking(ranked, ctx)).toThrow();
    }
    const other = buildInstallerContext(input, "Erie", [installer()]);
    const ranked = validRanking(other);
    const hvac = ranked.upgrades.find(r => r.upgradeId === "hvac-modernization")!;
    hvac.installers = validRanking(ctx).upgrades[0].installers;
    expect(() => validateRanking(ranked, other)).toThrow();
  });
  it("rejects unsupported cheapest, review and monetary claims in prose", () => {
    const ctx = rankingContext();
    for (const reason of ["They are the cheapest", "Five-star reviews", "Installation costs $500"]) {
      const ranked = validRanking(ctx); ranked.upgrades[0].installers[0].reason = reason;
      expect(() => validateRanking(ranked, ctx)).toThrow();
    }
  });
  it("labels missing-key, failed and invalid-response fallbacks as not AI-ranked", async () => {
    const ctx = rankingContext();
    expect((await rankInstallerContext(ctx, null)).method).toBe("deterministic");
    expect((await rankInstallerContext(ctx, async () => { throw new Error("provider failure"); })).method).toBe("deterministic");
    expect((await rankInstallerContext(ctx, async () => ({ top: { upgradeId: "invented" }, upgrades: [] }))).method).toBe("deterministic");
    expect((await rankInstallerContext(ctx, async () => validRanking(ctx))).method).toBe("ai");
  });
  it("returns every upgrade and an empty installer list when no verified candidates exist", () => {
    const fallback = fallbackInstallerAdvice(buildInstallerContext(input, "Erie"));
    expect(fallback.upgrades.length).toBe(input.recommendations.length);
    expect(fallback.upgrades.every(r => r.installers.length === 0)).toBe(true);
  });
});

describe("combined selections", () => {
  it("adjusts combined savings for overlap and sums the new estimated net ranges", () => {
    const selected = analysis.recommendations.filter(r => r.category === "lighting" || r.category === "controls");
    const priced = pricedUpgrades(input);
    const combo = combineSelection(analysis, selected.map(r => r.id), priced);
    expect(combo.annualSavings).toBeCloseTo(selected.reduce((s, r) => s + r.estimatedAnnualSavings, 0) * 0.9);
    expect(combo.net.typical).toBe(selected.reduce((s, r) => s + priced.find(p => p.id === r.id)!.estimate.net.typical, 0));
  });
  it("rejects incompatible heating, duplicate and unknown selections", () => {
    const priced = pricedUpgrades(input);
    expect(() => combineSelection(analysis, ["hvac-modernization", "heat-pump-hybrid"], priced)).toThrow();
    expect(() => combineSelection(analysis, [priced[0].id, priced[0].id], priced)).toThrow();
    expect(() => combineSelection(analysis, ["made-up"], priced)).toThrow();
  });
  it("handles empty selection and preserves signed fuel changes", () => {
    const priced = pricedUpgrades(input);
    expect(combineSelection(analysis, [], priced).annualSavings).toBe(0);
    const heatPump = analysis.recommendations.find(r => r.category === "heat_pump");
    if (heatPump) expect(combineSelection(analysis, [heatPump.id], priced).annualElectricitySavingsKwh).toBeLessThan(0);
  });
  it("does not double-count solar electricity already saved by efficiency", () => {
    const priced = pricedUpgrades(input);
    const combo = combineSelection(analysis, analysis.recommendations.filter(r => ["solar", "lighting", "controls"].includes(r.category)).map(r => r.id), priced);
    expect(combo.annualElectricitySavingsKwh).toBeLessThanOrEqual(analysis.energy.electricityKwh);
  });
});

it("validates bounded session snapshots and drops addresses, photos and extra fields", () => {
  expect("address" in input.building).toBe(false);
  expect("photos" in input).toBe(false);
  expect(PlanningInputSchema.safeParse({ ...input, recommendations: Array(31).fill(input.recommendations[0]) }).success).toBe(false);
});

it("caches advice per analysis content and county, and expires fallback output", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  const sample = { ...input, id: "e0c2e7dc-2f06-41c9-97fd-919930e6f93b" };
  const now = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(now);
  try {
    const first = getInstallerRecommendations(sample, "Erie");
    await first;
    expect(getInstallerRecommendations(sample, "Erie")).toBe(first);
    expect(getInstallerRecommendations(sample, "Niagara")).not.toBe(first);
    expect(getInstallerRecommendations({ ...sample, electricityKwh: sample.electricityKwh + 1 }, "Erie")).not.toBe(first);
    clock.mockReturnValue(now + 61000);
    expect(getInstallerRecommendations(sample, "Erie")).not.toBe(first);
  } finally { clock.mockRestore(); vi.unstubAllEnvs(); }
});

it("does not describe the empty curated directory as the result of live company research", () => {
  const context = rankingContext();
  const ranked = validRanking(context);
  ranked.top!.reason = "This upgrade has positive savings. Its payback is feasible. Although no installers are listed, this is worth considering.";
  const advice = aiAdvice(ranked, context, "test-model");
  expect(advice.top!.reason).toContain("positive savings");
  expect(advice.top!.reason).not.toContain("no installers");
});
