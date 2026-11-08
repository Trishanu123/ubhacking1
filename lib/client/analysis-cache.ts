import { readAppSession } from "./session-storage";
import type { Analysis } from "@/lib/types/analysis";

export function analysisCacheKey(id: string) {
  return `retropilot:analysis:${id}`;
}

export function cacheAnalysis(analysis: Analysis) {
  try {
    sessionStorage.setItem(analysisCacheKey(analysis.id), JSON.stringify(analysis));
    sessionStorage.setItem("retropilot:latest", analysis.id);
  } catch {
    /* quota / private mode */
  }
}

export function readCachedAnalysis(id: string): Analysis | null {
  try {
    const raw = readAppSession(`analysis:${id}`, value => {
      const parsed = JSON.parse(value);
      return parsed?.id === id && typeof parsed.building?.address === "string" && Array.isArray(parsed.recommendations);
    });
    return raw ? (JSON.parse(raw) as Analysis) : null;
  } catch {
    return null;
  }
}
