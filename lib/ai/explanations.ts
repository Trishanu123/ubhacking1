import OpenAI from "openai";
import { z } from "zod";
import type { AIExplanation, Analysis } from "@/lib/types/analysis";
import { usd, num } from "@/lib/format";

const ExplanationSchema = z.object({
  summary: z.string().min(20).max(2500),
  measureRationales: z.array(z.object({ id: z.string(), rationale: z.string().max(800) })).default([]),
  caveats: z.array(z.string()).min(1).max(12),
});

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : trimmed;
  return JSON.parse(raw);
}

function numbersIn(text: string): string[] {
  return (text.match(/\$?[\d][\d,]*(?:\.\d+)?/g) ?? []).map((s) => s.replace(/[$,]/g, ""));
}

function groundingCheck(text: string, allowed: Set<string>): { passed: boolean; ungroundedNumbers: string[] } {
  const found = numbersIn(text);
  const ungrounded = found.filter((n) => {
    if (n.length <= 1) return false;
    return !allowed.has(n) && !allowed.has(String(Math.round(Number(n))));
  });
  return { passed: ungrounded.length === 0, ungroundedNumbers: ungrounded.slice(0, 8) };
}

function allowedNumbers(analysis: Analysis): Set<string> {
  const vals: number[] = [
    analysis.energy.annualEnergyCost,
    analysis.energy.electricityKwh,
    analysis.energy.naturalGasTherms,
    analysis.building.buildingAreaSqFt ?? 0,
    analysis.building.yearBuilt ?? 0,
    analysis.financialSummary.potentialAnnualSavings,
    analysis.financialSummary.potentialIncentives,
    analysis.financialSummary.bestPaybackYears ?? 0,
    analysis.recommendations.length,
    analysis.financialSummary.opportunityCount,
    analysis.financialSummary.savingsRange.low,
    analysis.financialSummary.savingsRange.high,
    analysis.financialSummary.totalNetCost,
    analysis.financialSummary.totalProjectCost,
    analysis.energy.euiKbtuPerSqFt ?? 0,
    analysis.energy.electricityCost,
    analysis.energy.gasCost,
  ];
  for (const r of analysis.recommendations) {
    vals.push(
      r.estimatedAnnualSavings,
      r.netCost,
      r.estimatedCost,
      r.paybackYears ?? 0,
      r.incentives,
      r.annualElectricitySavingsKwh,
      r.annualGasSavingsTherms,
      r.savingsRange.low,
      r.savingsRange.high,
    );
  }
  const set = new Set<string>();
  for (const v of vals) {
    if (!Number.isFinite(v)) continue;
    set.add(String(Math.round(v)));
    set.add(Math.round(v).toLocaleString("en-US"));
    set.add(v.toFixed(1));
    set.add(v.toFixed(0));
  }
  return set;
}

export function templateExplanation(analysis: Analysis): AIExplanation {
  const top = analysis.recommendations.filter((r) => r.includedInPortfolio).slice(0, 3);
  const names = top.map((r) => r.name).join("; ");
  const summary = `Based on the available ${analysis.isDemo ? "demo " : ""}building and energy data, this ${analysis.building.buildingType} (${analysis.building.buildingAreaSqFt ? num(analysis.building.buildingAreaSqFt) + " sq ft" : "area unknown"}) has an estimated annual energy cost of ${usd(analysis.energy.annualEnergyCost)} (${num(analysis.energy.electricityKwh)} kWh and ${num(analysis.energy.naturalGasTherms)} therms). The preliminary model identifies ${analysis.financialSummary.opportunityCount} opportunities with combined estimated annual savings of approximately ${usd(analysis.financialSummary.savingsRange.low)}–${usd(analysis.financialSummary.savingsRange.high)} after an interactive-effects adjustment. Highest-priority items to investigate first: ${names || "none with positive savings"}. These are screening estimates and require professional verification.`;
  return {
    method: "template",
    summary,
    measureRationales: analysis.recommendations.map((r) => ({ id: r.id, rationale: r.priorityReason })),
    caveats: [
      "Estimates are preliminary and depend on assumed end-use splits, costs, and operating conditions.",
      "Incentive dollars in the financial model are planning assumptions, not awarded amounts.",
      "A professional energy audit and contractor quotes are required before decisions.",
    ],
    groundingCheck: { passed: true, ungroundedNumbers: [] },
  };
}

export async function explainAnalysis(analysis: Analysis): Promise<AIExplanation> {
  if (!process.env.OPENAI_API_KEY) return templateExplanation(analysis);
  const payload = {
    building: {
      address: analysis.building.address,
      type: analysis.building.buildingType,
      sqft: analysis.building.buildingAreaSqFt,
      yearBuilt: analysis.building.yearBuilt,
      state: analysis.building.state,
    },
    energy: {
      electricityKwh: analysis.energy.electricityKwh,
      gasTherms: analysis.energy.naturalGasTherms,
      annualCost: Math.round(analysis.energy.annualEnergyCost),
      eui: analysis.energy.euiKbtuPerSqFt,
    },
    financialSummary: {
      potentialAnnualSavings: analysis.financialSummary.potentialAnnualSavings,
      savingsRange: analysis.financialSummary.savingsRange,
      potentialIncentives: analysis.financialSummary.potentialIncentives,
      bestPaybackYears: analysis.financialSummary.bestPaybackYears,
    },
    recommendations: analysis.recommendations.map((r) => ({
      id: r.id,
      name: r.name,
      priority: r.priority,
      savings: r.estimatedAnnualSavings,
      netCost: r.netCost,
      paybackYears: r.paybackYears,
      reason: r.reason,
    })),
    incentives: analysis.incentives.map((i) => ({ name: i.name, provider: i.provider })),
    assumptions: analysis.assumptions.slice(0, 12),
  };

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are explaining a preliminary energy retrofit analysis. Do not create calculations. Use only the supplied structured data. Do not invent statistics or extra numbers. Prefer qualitative wording over new figures. If you mention a number, copy it exactly from the JSON. Explain why each opportunity may be worth further investigation. Clearly state uncertainty and assumptions. Return JSON { summary, measureRationales: [{id, rationale}], caveats: string[] }.",
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const text = completion.choices[0]?.message?.content ?? "{}";
    let parsedJson: unknown;
    try {
      parsedJson = parseJsonObject(text);
    } catch (err) {
      const fallback = templateExplanation(analysis);
      fallback.fallbackReason = `AI JSON parse failed: ${err instanceof Error ? err.message : "invalid JSON"}`;
      return fallback;
    }
    const parsed = ExplanationSchema.safeParse(parsedJson);
    if (!parsed.success) {
      const fallback = templateExplanation(analysis);
      fallback.fallbackReason = "AI explanation did not match the expected schema.";
      return fallback;
    }
    const allowed = allowedNumbers(analysis);
    const check = groundingCheck(
      `${parsed.data.summary} ${parsed.data.measureRationales.map((m) => m.rationale).join(" ")}`,
      allowed,
    );
    const caveats = [...parsed.data.caveats];
    if (!check.passed) {
      caveats.push(
        "Some wording in this narrative may round or paraphrase figures. Use the tables and calculation traces as the source of truth.",
      );
    }
    return {
      method: "ai",
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      summary: parsed.data.summary,
      measureRationales: parsed.data.measureRationales,
      caveats,
      groundingCheck: check,
    };
  } catch (err) {
    const fallback = templateExplanation(analysis);
    fallback.fallbackReason = err instanceof Error ? err.message : "OpenAI request failed";
    return fallback;
  }
}
