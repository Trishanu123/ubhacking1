import { z } from "zod";
import type { InstallerContext } from "./advice";
import type { InstallerAdvice } from "./types";

const note = z.string().min(1).max(1000);
export const RankingSchema = z.object({
  top: z.object({ upgradeId: z.string(), reason: note, installerIds: z.array(z.string()).max(3) }).nullable(),
  upgrades: z.array(z.object({
    upgradeId: z.string(),
    installers: z.array(z.object({ id: z.string(), rank: z.number().int().positive(), reason: note,
      priceTier: z.enum(["budget", "mid", "premium", "unverified"]), match: z.enum(["strong", "partial"]), caveats: z.array(note).max(8) })).max(12),
    howToChoose: note,
  })).max(30),
}).strict();

/** IDs and canonical facts are checked again after the model's structured-output schema. */
export function validateRanking(value: unknown, context: InstallerContext): z.infer<typeof RankingSchema> {
  const ranked = RankingSchema.parse(value);
  if (ranked.upgrades.length !== context.upgrades.length || new Set(ranked.upgrades.map(r => r.upgradeId)).size !== context.upgrades.length) throw new Error("Incomplete or duplicate upgrade advice.");
  for (const row of ranked.upgrades) {
    const upgrade = context.upgrades.find(r => r.id === row.upgradeId);
    if (!upgrade) throw new Error("Unknown upgrade ID.");
    if (new Set(row.installers.map(r => r.id)).size !== row.installers.length) throw new Error("Duplicate installer IDs.");
    row.installers.forEach((rank, i) => {
      const installer = context.candidates[row.upgradeId].find(r => r.id === rank.id);
      if (!installer) throw new Error("Installer ID is not in this upgrade's filtered directory.");
      if (rank.rank !== i + 1 || rank.priceTier !== installer.priceTier) throw new Error("Invented rank or price tier.");
      const match = upgrade.systems.every(s => installer.services.includes(s)) ? "strong" : "partial";
      if (rank.match !== match) throw new Error("Unsubstantiated service match.");
    });
    if (context.candidates[row.upgradeId].length && !row.installers.length) throw new Error("Missing available installer candidates.");
  }
  if (context.upgrades.length && !ranked.top) throw new Error("A top upgrade is required.");
  if (!context.upgrades.length && ranked.top) throw new Error("No upgrade can be invented.");
  if (ranked.top) {
    const top = ranked.upgrades.find(r => r.upgradeId === ranked.top!.upgradeId);
    if (!top || new Set(ranked.top.installerIds).size !== ranked.top.installerIds.length || ranked.top.installerIds.some(id => !top.installers.some(r => r.id === id))) throw new Error("Top recommendation references an unranked installer or upgrade.");
    if (top.installers.length && !ranked.top.installerIds.length) throw new Error("Top installer is missing.");
  }
  const text = [ranked.top?.reason ?? "", ...ranked.upgrades.flatMap(r => [r.howToChoose, ...r.installers.flatMap(i => [i.reason, ...i.caveats])])].join(" ");
  // Prices and contact details come exclusively from canonical data, never model prose.
  if (/https?:|www\.|@|[$€£]|\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b|\bcheapest\b|lowest[ -]pric|best[ -]pric|\breviews?\b|five[ -]star/i.test(text)) throw new Error("Unsupported price, contact or review claim.");
  return ranked;
}
export function aiAdvice(value: unknown, context: InstallerContext, model: string): InstallerAdvice {
  const ranked = validateRanking(value, context);
  // Directory emptiness does not describe the separate live company search.
  if (ranked.top) {
    ranked.top.reason = ranked.top.reason.split(/(?<=[.!?])\s+/).filter(sentence => !/no (?:installers|contractors|companies) (?:are |were )?(?:listed|available|found)/i.test(sentence)).join(" ") || "Compare this upgrade's expected savings, estimated net cost and payback. Company availability is researched separately for your property.";
  }
  return { ...ranked, method: "ai", model, generatedAt: new Date().toISOString(), county: context.property.county,
    notice: "AI compares only the supplied estimates and directory candidates. It does not verify workmanship or guarantee prices. Get at least 3 comparable quotes." };
}
