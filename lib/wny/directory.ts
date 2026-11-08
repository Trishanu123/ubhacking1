import { z } from "zod";
import directory from "@/data/wny-installers.json";
import { CountySchema, SystemSchema, type County, type System } from "./types";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Use a real ISO date");
const webUrl = z.string().url().refine(v => new URL(v).protocol === "https:", "Use https URLs");
export const InstallerSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(3).max(200),
  website: webUrl.nullable(), phone: z.string().regex(/^\+?[\d ()-.]{7,25}$/).nullable(),
  serviceArea: z.array(CountySchema).min(1), services: z.array(SystemSchema).min(1),
  certifications: z.array(z.object({ name: z.string().min(1).max(200), sourceUrl: webUrl, verifiedOn: date })),
  licenseInsuranceNotes: z.string().min(1).max(1200),
  priceTier: z.enum(["budget", "mid", "premium", "unverified"]),
  priceTierSource: webUrl.nullable(), priceVerifiedOn: date.nullable(), sourceUrls: z.array(webUrl),
  lastVerified: date.nullable(), verificationStatus: z.enum(["verified", "unverified"]), isTemplate: z.boolean(),
}).superRefine((row, ctx) => {
  if (row.verificationStatus === "verified" && (!row.lastVerified || !row.sourceUrls.length || row.isTemplate || (!row.website && !row.phone))) {
    ctx.addIssue({ code: "custom", message: "Verified businesses need dated evidence, contact details, and must not be templates." });
  }
});
export type Installer = z.infer<typeof InstallerSchema>;
export function loadInstallers(): Installer[] {
  const rows = z.array(InstallerSchema).parse(directory.entries);
  if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error("Duplicate installer IDs in directory.");
  return rows;
}
export function normalizeCounty(value: string | null | undefined): County | null {
  const normalized = value?.trim().replace(/,?\s*(ny|new york)$/i, "").replace(/\s+county$/i, "").trim().toLowerCase();
  return CountySchema.options.find(c => c.toLowerCase() === normalized) ?? null;
}
function recent(dateValue: string | null, now: Date) {
  if (!dateValue) return false;
  const age = now.getTime() - Date.parse(dateValue);
  return age >= 0 && age <= 365 * 86400000;
}
export function filterInstallers(systems: System | System[], county: string | null, rows = loadInstallers(), now = new Date()): Installer[] {
  const normalized = normalizeCounty(county);
  const services = Array.isArray(systems) ? systems : [systems];
  if (!normalized) return [];
  return rows.filter(row => !row.isTemplate && row.verificationStatus === "verified" && recent(row.lastVerified, now) && row.serviceArea.includes(normalized) && services.some(s => row.services.includes(s)))
    .map(row => ({ ...row,
      certifications: row.certifications.filter(c => recent(c.verifiedOn, now)),
      priceTier: row.priceTierSource && recent(row.priceVerifiedOn, now) ? row.priceTier : "unverified",
    }));
}
export const CONTRACTOR_FINDERS = [
  { name: "NYS Clean Heat contractors", url: "https://cleanheat.ny.gov/find-a-contractor/" },
  { name: "NYSERDA NY-Sun", url: "https://www.nyserda.ny.gov/All-Programs/NY-Sun" },
  { name: "National Grid efficiency programs", url: "https://www.nationalgridus.com/Upstate-NY-Business/Energy-Saving-Programs" },
  { name: "NYSEG efficiency programs", url: "https://www.nyseg.com/smartenergy" },
];
