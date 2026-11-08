import { NextResponse } from "next/server";
import { AnalyzeRequestSchema } from "@/lib/types/analysis";
import { runAnalysis } from "@/lib/analytics/pipeline";
import { summarizeAnalysis } from "@/lib/results/summarize";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = AnalyzeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }
    const analysis = await runAnalysis(parsed.data);
    return NextResponse.json({ analysis, result: summarizeAnalysis(analysis) });
  } catch {
    return NextResponse.json(
      { error: "Analysis failed. Please retry with the information you have — the engine will use fallbacks." },
      { status: 500 },
    );
  }
}
