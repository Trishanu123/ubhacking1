import type { DataSource } from "@/lib/types/building";

export function source(
  name: string,
  category: DataSource["category"],
  url?: string,
  note?: string,
): DataSource {
  return { name, url, retrievedAt: new Date().toISOString(), category, note };
}

export const METHODOLOGY_SOURCES: DataSource[] = [
  source(
    "RetroPilot deterministic calculation engine",
    "methodology",
    undefined,
    "Net cost, payback, ROI and lifetime savings are computed in TypeScript. The LLM does not perform financial arithmetic.",
  ),
  source(
    "Preliminary commercial end-use intensity heuristics",
    "methodology",
    "https://www.eia.gov/consumption/commercial/",
    "End-use shares and intensities are planning heuristics informed by typical U.S. commercial building patterns (e.g. CBECS-shaped splits). They are not measured data for a specific building.",
  ),
  source(
    "EPA natural gas combustion emission factor",
    "emissions",
    "https://www.epa.gov/energy/greenhouse-gases-equivalencies-calculator-calculations-and-references",
    "Approximate 0.0053 metric tons CO2 per therm.",
  ),
];
