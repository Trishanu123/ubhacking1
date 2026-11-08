import { AnalysisRefinementsSchema } from "@/lib/types/refinement";
import { refineAnalysis, RefinementInputError } from "@/lib/analytics/refinement";
import { z } from "zod";
import { getAnalysis } from "@/lib/db/store";
import { getInstallerRecommendations } from "@/lib/ai/installer-recommendation";
import { CountySchema, PlanningInputSchema, planningInput } from "@/lib/wny/types";

export const maxDuration = 60;
const RequestSchema = z.object({ analysisId: z.string().uuid(), county: CountySchema.nullable(), refinements: AnalysisRefinementsSchema.optional(), snapshot: PlanningInputSchema.optional() }).strict();
const limits = new Map<string, { count: number; expires: number }>();
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } }); }
async function readJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("Empty body");
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 180000) { await reader.cancel(); throw new RangeError("Request too large"); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Request this comparison from RetroPilot." }, 403);
  const now = Date.now();
  for (const [key, row] of limits) if (row.expires <= now) limits.delete(key);
  const key = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const bucket = limits.get(key) ?? { count: 0, expires: now + 3600000 };
  if (bucket.count >= 30 || (!limits.has(key) && limits.size >= 10000)) return json({ error: "Comparison limit reached. Try again later." }, 429);
  bucket.count++; limits.set(key, bucket);
  try {
    const body = RequestSchema.parse(await readJson(request));
    if (body.snapshot && body.snapshot.id !== body.analysisId) return json({ error: "Analysis IDs do not match." }, 400);
    // Session snapshots keep existing memory/session-only reports usable across serverless instances.
    // They are bounded and validated, never persisted or used to alter the prediction model.
    const stored = await getAnalysis(body.analysisId);
    const input = stored ? planningInput(body.refinements ? refineAnalysis(stored, body.refinements) : stored) : body.snapshot;
    if (!input) return json({ error: "Analysis not found. Reopen the report or run a new analysis." }, 404);
    if (new Set(input.recommendations.map(r => r.id)).size !== input.recommendations.length) return json({ error: "Duplicate upgrade IDs." }, 400);
    return json({ advice: await getInstallerRecommendations(input, body.county) });
  } catch (error) {
    if (error instanceof RefinementInputError) return json({ error: error.message }, 400);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "Invalid analysis or county." }, 400);
    if (error instanceof RangeError) return json({ error: "Analysis request is too large." }, 413);
    return json({ error: "Installer comparison is unavailable. Try again; your existing estimates are unchanged." }, 503);
  }
}
