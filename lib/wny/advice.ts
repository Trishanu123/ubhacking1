import { filterInstallers, type Installer } from "./directory";
import { pricedUpgrades } from "./costs";
import type { County, InstallerAdvice, PlanningInput, PricedUpgrade } from "./types";

export interface InstallerContext {
  property: PlanningInput["building"] & { county: County | null };
  upgrades: PricedUpgrade[];
  candidates: Record<string, Installer[]>;
}
export function buildInstallerContext(input: PlanningInput, county: County | null, directory?: Installer[]): InstallerContext {
  const upgrades = pricedUpgrades(input);
  // The WNY directory must never imply coverage for a known out-of-state property.
  const allowedCounty = input.building.state?.toUpperCase() === "NY" ? county : null;
  return {
    property: { ...input.building, county: allowedCounty }, upgrades,
    candidates: Object.fromEntries(upgrades.map(r => [r.id, filterInstallers(r.systems, allowedCounty, directory)])),
  };
}
export function fallbackInstallerAdvice(context: InstallerContext, notice = "AI ranking is unavailable. Showing a rule-based comparison."): InstallerAdvice {
  const upgrades = context.upgrades.map(rec => {
    const matchCount = (r: Installer) => rec.systems.filter(s => r.services.includes(s)).length;
    const tier = { budget: 0, mid: 1, premium: 2, unverified: 3 };
    const ranked = [...context.candidates[rec.id]].sort((a, b) =>
      matchCount(b) - matchCount(a) || b.certifications.length - a.certifications.length || tier[a.priceTier] - tier[b.priceTier] || a.id.localeCompare(b.id));
    return { upgradeId: rec.id,
      installers: ranked.map((r, i) => ({ id: r.id, rank: i + 1, reason: matchCount(r) === rec.systems.length ? "Lists all services in this upgrade and serves your selected county." : "Serves your county and lists part of this upgrade. Confirm a partner for the remaining work.",
        priceTier: r.priceTier, match: matchCount(r) === rec.systems.length ? "strong" as const : "partial" as const,
        caveats: ["Verify licenses, insurance, credentials and current availability directly.", ...(r.priceTier === "unverified" ? ["Price data is unverified; no cheapest-installer claim can be made."] : ["A documented price tier is not a project quote or a cheapest-price guarantee."])] })),
      howToChoose: "Get at least 3 itemized quotes for the same scope. Compare warranties, permits, equipment sizing and verified program participation.",
    };
  });
  const viable = context.upgrades.filter(r => r.estimatedAnnualSavings > 0 && r.includedInPortfolio);
  const top = [...(viable.length ? viable : context.upgrades)].sort((a, b) => b.suitabilityScore - a.suitabilityScore || (a.estimate.payback.typical ?? Infinity) - (b.estimate.payback.typical ?? Infinity) || a.estimate.net.typical - b.estimate.net.typical)[0];
  return { method: "deterministic", generatedAt: new Date().toISOString(), county: context.property.county,
    top: top ? { upgradeId: top.id,
      reason: top.estimatedAnnualSavings > 0 ? "This is the strongest fit in the existing screening results. Compare its expected savings, cost after estimated incentives and time to recover the cost before committing." : "No upgrade has confirmed positive bill savings in this screening. Investigate this option with an energy professional before spending.",
      installerIds: upgrades.find(r => r.upgradeId === top.id)!.installers.slice(0, 2).map(r => r.id) } : null,
    upgrades, notice };
}
