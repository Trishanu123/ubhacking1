import sharp from "sharp";
import { z } from "zod";
import { analyzePropertyPhotos } from "@/lib/property-photos/analyze";

export const maxDuration = 100;
const BodySchema = z.object({ images: z.array(z.string().max(340000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/)).min(1).max(8) });
const state = globalThis as typeof globalThis & { photoRequestLimits?: Map<string, { count: number; expires: number }> };
const limits = state.photoRequestLimits ??= new Map();
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "no-store" } }); }

async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty");
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 2900000) { await reader.cancel(); throw new RangeError("large"); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Open Analyze on this website to add photos." }, 403);
  // Basic per-instance abuse protection. The hosting proxy must overwrite this header.
  const now = Date.now();
  for (const [key, row] of limits) if (row.expires < now) limits.delete(key);
  const key = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const bucket = limits.get(key) ?? { count: 0, expires: now + 3600000 };
  if (bucket.count >= 10 || (!limits.has(key) && limits.size >= 10000)) return json({ error: "Photo limit reached. Try again later." }, 429);
  bucket.count++; limits.set(key, bucket);
  try {
    const body = BodySchema.parse(await readBody(request));
    if (!process.env.OPENAI_API_KEY) return json({ error: "Photo analysis is unavailable right now. Please try again later." }, 503);
    const images: string[] = [];
    for (const data of body.images) {
      try {
        const bytes = Buffer.from(data.split(",")[1], "base64");
        if ((await sharp(bytes, { limitInputPixels: 25000000 }).metadata()).format !== "jpeg") throw new Error("format");
        // Re-encode independently of the client to strip EXIF/GPS before forwarding.
        const clean = await sharp(bytes, { limitInputPixels: 25000000 }).rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
        images.push(`data:image/jpeg;base64,${clean.toString("base64")}`);
      } catch { return json({ error: "One photo could not be read. Remove it or try a JPG/PNG image." }, 400); }
    }
    const inventory = await analyzePropertyPhotos(images, AbortSignal.any([request.signal, AbortSignal.timeout(90000)]));
    return json({ inventory });
  } catch (error) {
    if (error instanceof RangeError) return json({ error: "Photos are too large. Try fewer photos." }, 413);
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "Could not read the photo data. Try uploading again." }, 400);
    return json({ error: "Could not analyze these photos. Please try again." }, 502);
  }
}
