import type { MatchedIncentive, Technology } from "@/lib/types/incentive";
import type { Priority, Recommendation } from "@/lib/types/recommendation";
import { EMISSIONS, INCENTIVE_PLANNING_RATE, SAVINGS_UNCERTAINTY, UNIT } from "./assumptions";
import { gridFactor } from "./energy-baseline";
import { computeMeasureFinancials, round } from "./financial";
import { evaluateHeatPump, evaluateHvacControls, evaluateHvacModernization } from "./hvac";
import { evaluateLighting } from "./lighting";
import { fmt, type MeasureContext, type MeasureDraft } from "./measure";
import { evaluateEnvelope, evaluateStorage, evaluateWaterHeating } from "./other-measures";
import { evaluateSolar } from "./solar";

export const CATEGORY_LABELS: Record<Technology, string> = {
  lighting: "Lighting",
  controls: "Controls",
  hvac: "HVAC",
  heat_pump: "Heat Pump",
  envelope: "Envelope",
  solar: "Solar",
  storage: "Storage",
  water_heating: "Water Heating",
  assessment: "Assessment",
  financing: "Financing",
};

/** Run every screening module; modules return null when a technology does not fit the building. */
export function evaluateMeasures(ctx: MeasureContext): MeasureDraft[] {
  const drafts: (MeasureDraft | null)[] = [
    evaluateLighting(ctx),
    evaluateHvacControls(ctx),
    evaluateHvacModernization(ctx),
    evaluateHeatPump(ctx),
    evaluateEnvelope(ctx),
    evaluateWaterHeating(ctx),
  ];
  const solar = evaluateSolar(ctx);
  drafts.push(solar, evaluateStorage(ctx, solar != null));
  return drafts.filter((d): d is MeasureDraft => d != null);
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

interface ScoreParts {
  payback: number;
  magnitude: number;
  energy: number;
  incentive: number;
  fit: number;
  confidence: number;
  complexityPenalty: number;
}

export function scoreMeasure(
  r: Pick<Recommendation, "paybackYears" | "estimatedAnnualSavings" | "annualEnergySavingsMMBtu" | "incentives" | "estimatedCost" | "confidence" | "complexity" | "lifetimeYears">,
  fit: number,
  annualEnergyCost: number,
  siteMMBtu: number,
): { score: number; parts: ScoreParts } {
  const payback =
    r.paybackYears == null || r.paybackYears > r.lifetimeYears ? 0 : clamp01(1 - (r.paybackYears - 3) / 15);
  const magnitude = annualEnergyCost > 0 ? clamp01(r.estimatedAnnualSavings / (0.1 * annualEnergyCost)) : 0;
  const energy = siteMMBtu > 0 ? clamp01(r.annualEnergySavingsMMBtu / (0.12 * siteMMBtu)) : 0;
  const incentive = r.estimatedCost > 0 ? clamp01(r.incentives / r.estimatedCost / 0.25) : 0;
  const confidence = r.confidence === "high" ? 1 : r.confidence === "medium" ? 0.65 : 0.35;
  const complexityPenalty = r.complexity === "high" ? 0.06 : r.complexity === "medium" ? 0.03 : 0;
  const parts = { payback, magnitude, energy, incentive, fit, confidence, complexityPenalty };
  const score =
    0.3 * payback + 0.2 * magnitude + 0.12 * energy + 0.08 * incentive + 0.18 * fit + 0.12 * confidence - complexityPenalty;
  return { score: clamp01(score), parts };
}

function priorityFrom(score: number, r: Pick<Recommendation, "estimatedAnnualSavings" | "paybackYears" | "lifetimeYears">): Priority {
  if (r.estimatedAnnualSavings <= 0 || r.paybackYears == null || r.paybackYears > r.lifetimeYears) return "explore";
  if (score >= 0.58) return "high";
  if (score >= 0.42) return "medium";
  return "explore";
}

function explainPriority(priority: Priority, parts: ScoreParts, draft: MeasureDraft, r: Recommendation): string {
  const positives: string[] = [];
  const negatives: string[] = [];
  if (parts.payback >= 0.6) positives.push(`a relatively short estimated payback (${r.paybackYears?.toFixed(1)} yrs)`);
  else if (r.paybackYears == null) negatives.push("no positive operating-cost savings at current rates");
  else if (parts.payback < 0.3) negatives.push(`a long estimated payback (${r.paybackYears.toFixed(1)} yrs)`);
  if (parts.magnitude >= 0.6) positives.push(`meaningful annual savings (~${fmt.usd(r.estimatedAnnualSavings)}/yr)`);
  if (parts.energy >= 0.5) positives.push("a large share of site energy addressed");
  if (parts.incentive >= 0.6) positives.push("potential incentive pathways");
  if (draft.fit >= 0.8) positives.push(draft.fitReasons[0]?.toLowerCase() ?? "strong building fit");
  if (draft.fit < 0.5) negatives.push(draft.fitReasons[0]?.toLowerCase() ?? "uncertain building fit");
  if (r.confidence === "low") negatives.push("limited data (low confidence)");
  if (draft.complexity === "high") negatives.push("higher implementation complexity");

  const label = priority === "high" ? "High priority" : priority === "medium" ? "Medium priority" : "Explore";
  const pos = positives.length ? ` because of ${joinList(positives)}` : "";
  const neg = negatives.length ? `${positives.length ? "; tempered by" : " due to"} ${joinList(negatives)}` : "";
  return `${label}${pos}${neg}.`;
}

function joinList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Turns measure drafts into fully-costed, prioritized recommendations. */
export function buildRecommendations(
  drafts: MeasureDraft[],
  ctx: MeasureContext,
  incentives: MatchedIncentive[],
  lifetimeOverrideYears?: number | null,
): Recommendation[] {
  const { baseline } = ctx;
  const gf = gridFactor(ctx.building.state);

  const recs = drafts.map((d) => {
    const programs = incentives.filter((i) => i.matchedTechnologies.includes(d.category));
    const rate = INCENTIVE_PLANNING_RATE[d.category as keyof typeof INCENTIVE_PLANNING_RATE] ?? 0;
    // Whole dollars in, so displayed cost − incentive = net and net ÷ savings = payback exactly.
    const modeledIncentive = programs.length > 0 ? round(d.cost.typical * rate) : 0;
    const lifetime = lifetimeOverrideYears ?? d.lifetimeYears;
    const fin = computeMeasureFinancials({
      projectCost: round(d.cost.typical),
      incentives: modeledIncentive,
      annualSavings: round(d.annualSavings),
      lifetimeYears: lifetime,
    });
    const mmbtu = (d.elecKwh * UNIT.kbtuPerKwh + d.gasTherms * UNIT.kbtuPerTherm) / 1000;
    const co2 = d.gasTherms * EMISSIONS.gasTonsPerTherm + d.elecKwh * gf;

    const rec: Recommendation = {
      id: d.id,
      category: d.category,
      categoryLabel: CATEGORY_LABELS[d.category],
      name: d.name,
      description: d.description,
      cost: d.cost,
      estimatedCost: fin.projectCost,
      annualElectricitySavingsKwh: round(d.elecKwh),
      annualGasSavingsTherms: round(d.gasTherms),
      annualEnergySavingsMMBtu: round(mmbtu, 1),
      estimatedAnnualSavings: round(fin.annualSavings),
      savingsRange: {
        low: round(fin.annualSavings * (fin.annualSavings >= 0 ? SAVINGS_UNCERTAINTY.low : SAVINGS_UNCERTAINTY.high)),
        high: round(fin.annualSavings * (fin.annualSavings >= 0 ? SAVINGS_UNCERTAINTY.high : SAVINGS_UNCERTAINTY.low)),
      },
      annualCo2eSavingsTons: round(co2, 1),
      incentives: round(fin.incentives),
      incentiveBasis:
        programs.length > 0
          ? `Modeled planning assumption: ${fmt.pct(rate)} of typical project cost, based on ${programs.length} potentially relevant program(s). Not a published program value — eligibility and amount require verification.`
          : "No potentially relevant program identified for this technology; incentives not modeled.",
      netCost: round(fin.netCost),
      paybackYears: fin.paybackYears == null ? null : round(fin.paybackYears, 1),
      roiPercent: fin.roiPercent == null ? null : round(fin.roiPercent, 1),
      lifetimeYears: lifetime,
      lifetimeSavings: round(fin.lifetimeSavings),
      confidence: d.confidence,
      priority: "explore",
      priorityReason: "",
      suitabilityScore: 0,
      complexity: d.complexity,
      assumptions: [
        ...d.assumptions,
        `Installed cost: preliminary estimate ${fmt.usd(d.cost.low)}–${fmt.usd(d.cost.high)} (typical ${fmt.usd(d.cost.typical)}); ${d.cost.basis}.`,
        `Measure life assumed ${lifetime} years.`,
      ],
      calculation: [
        ...d.calculation,
        { label: "Preliminary installed cost (typical)", expression: d.cost.basis, result: fmt.usd(fin.projectCost) },
        { label: "Modeled incentive", expression: programs.length ? `${fmt.usd(fin.projectCost)} × ${fmt.pct(rate)} (planning assumption)` : "no matching program", result: fmt.usd(fin.incentives) },
        { label: "Net cost", expression: `max(0, ${fmt.usd(fin.projectCost)} − ${fmt.usd(fin.incentives)})`, result: fmt.usd(fin.netCost) },
        {
          label: "Simple payback",
          expression: `${fmt.usd(fin.netCost)} ÷ ${fmt.usd(fin.annualSavings)}/yr`,
          result: fin.paybackYears == null ? "n/a (no positive savings)" : `${fin.paybackYears.toFixed(1)} years`,
        },
        {
          label: "Annual ROI",
          expression: `${fmt.usd(fin.annualSavings)} ÷ ${fmt.usd(fin.netCost)} × 100`,
          result: fin.roiPercent == null ? "n/a" : `${fin.roiPercent.toFixed(1)}%`,
        },
      ],
      reason: d.reason,
      nextStep: d.nextStep,
      alternativeGroup: d.alternativeGroup,
      includedInPortfolio: true,
      matchedPrograms: programs.map((p) => ({ id: p.id, name: p.name, provider: p.provider, sourceUrl: p.sourceUrl })),
    };

    const { score, parts } = scoreMeasure(rec, d.fit, baseline.annualEnergyCost, baseline.siteEnergyMMBtu);
    rec.suitabilityScore = round(score, 3);
    rec.priority = priorityFrom(score, rec);
    rec.priorityReason = explainPriority(rec.priority, parts, d, rec);
    return rec;
  });

  // Alternatives (e.g., high-efficiency HVAC vs heat pump): only the best-scoring one counts toward totals.
  const groups = new Map<string, Recommendation[]>();
  for (const r of recs) if (r.alternativeGroup) groups.set(r.alternativeGroup, [...(groups.get(r.alternativeGroup) ?? []), r]);
  for (const members of groups.values()) {
    members.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
    members.slice(1).forEach((m) => {
      m.includedInPortfolio = false;
      m.priorityReason += ` Shown as an alternative to "${members[0].name}" and excluded from portfolio totals.`;
    });
  }
  // Measures with no positive savings are never added to savings totals.
  recs.forEach((r) => {
    if (r.estimatedAnnualSavings <= 0) r.includedInPortfolio = false;
  });

  const order: Record<Priority, number> = { high: 0, medium: 1, explore: 2 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority] || b.suitabilityScore - a.suitabilityScore);
}

export function technologiesFor(drafts: MeasureDraft[]): Technology[] {
  return Array.from(new Set<Technology>([...drafts.map((d) => d.category), "assessment", "financing"]));
}
