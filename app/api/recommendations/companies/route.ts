import { AnalysisRefinementsSchema } from "@/lib/types/refinement";
import { refineAnalysis, RefinementInputError } from "@/lib/analytics/refinement";
import { z } from "zod";
import { getAnalysis } from "@/lib/db/store";
import { getCompanyDiscovery } from "@/lib/ai/company-discovery";
import { PlanningInputSchema, planningInput } from "@/lib/wny/types";
import { LocationSchema, companyLocation } from "@/lib/companies/types";

export const maxDuration = 180;
const BodySchema = z.object({
  analysisId: z.string().uuid(), upgradeId: z.string().min(1).max(120),
  refinements: AnalysisRefinementsSchema.optional(), snapshot: PlanningInputSchema.optional(), location: LocationSchema,
  widen: z.boolean().default(false),
  excludeWebsites: z.array(z.string().url().max(500)).max(40).default([]),
}).strict();
const limits = new Map<string, { count: number; expires: number }>();
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function bodyJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("Empty request");
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 200000) { await reader.cancel(); throw new RangeError("Too large"); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Open company search from this website." }, 403);
  const now = Date.now();
  for (const [key, row] of limits) if (row.expires <= now) limits.delete(key);
  const key = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const bucket = limits.get(key) ?? { count: 0, expires: now + 3600000 };
  if (bucket.count >= 60 || (!limits.has(key) && limits.size >= 10000)) return json({ error: "Company-search limit reached. Saved results remain available; try again later." }, 429);
  bucket.count++; limits.set(key, bucket);
  try {
    const body = BodySchema.parse(await bodyJson(request));
    if (body.snapshot && body.snapshot.id !== body.analysisId) return json({ error: "Analysis IDs do not match." }, 400);
    const stored = await getAnalysis(body.analysisId);
    const input = stored ? planningInput(body.refinements ? refineAnalysis(stored, body.refinements) : stored) : body.snapshot;
    if (!input) return json({ error: "Analysis not found. Reopen your report or run a new analysis." }, 404);
    if (!input.recommendations.some(r => r.id === body.upgradeId)) return json({ error: "This upgrade is not part of your analysis." }, 400);
    if (!process.env.OPENAI_API_KEY) return json({ error: "Live company search is not configured. Add OPENAI_API_KEY on the server to enable it." }, 503);
    const location = stored ? companyLocation(stored.building) : body.location;
    return json({ result: await getCompanyDiscovery(input, location, body.upgradeId, body.excludeWebsites, body.widen) });
  } catch (error) {
    if (error instanceof RefinementInputError) return json({ error: error.message }, 400);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "Could not read the location or analysis. Reopen the results and try again." }, 400);
    if (error instanceof RangeError) return json({ error: "Company-search request is too large." }, 413);
    // Provider details stay server-side; no silent invented-company or directory-only fallback.
    const message = error instanceof Error ? error.message : "Unknown error";
    const safeMessage = process.env.OPENAI_API_KEY ? message.split(process.env.OPENAI_API_KEY).join("[redacted]") : message;
    console.error("Company discovery failed", safeMessage.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]").slice(0, 500));
    return json({ error: "Live company search could not finish. Retry the search; your upgrade estimates are unchanged." }, 502);
  }
}
