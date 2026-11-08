import { readAppSession } from "./session-storage";
import type { AnalyzeRequest } from "@/lib/types/analysis";
import type { BuildingType } from "@/lib/types/building";
import type { BuildingProfile, UtilityData } from "@/lib/types/contracts";
import type { ExtractionResult } from "@/lib/types/utility";

/** Raw input strings exactly as typed, so Back/Forward never reformats a field. */
export interface AnalyzeFormState {
  address: string;
  buildingType: BuildingType;
  squareFeet: string;
  yearBuilt: string;
  stories: string;
  electricityKwh: string;
  gasTherms: string;
  elecRate: string;
  gasRate: string;
  hasGasService: boolean;
}

export const EMPTY_FORM: AnalyzeFormState = {
  address: "",
  buildingType: "office",
  squareFeet: "",
  yearBuilt: "",
  stories: "",
  electricityKwh: "",
  gasTherms: "",
  elecRate: "",
  gasRate: "",
  hasGasService: true,
};

export const DEMO_FORM: AnalyzeFormState = {
  address: "123 Main Street, Buffalo, NY 14202",
  buildingType: "office",
  squareFeet: "25000",
  yearBuilt: "1988",
  stories: "3",
  electricityKwh: "145000",
  gasTherms: "42000",
  elecRate: "0.15",
  gasRate: "1.10",
  hasGasService: true,
};

const STORAGE_KEY = "retropilot:intake";

export function loadForm(): { form: AnalyzeFormState; extraction: ExtractionResult | null } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = readAppSession("intake", value => {
      const parsed = JSON.parse(value);
      return typeof parsed?.form?.address === "string" && typeof parsed.form.hasGasService === "boolean" && typeof parsed.form.elecRate === "string";
    });
    if (!raw) return null;
    const saved = JSON.parse(raw) as { form?: Partial<AnalyzeFormState>; extraction?: ExtractionResult | null };
    return { form: { ...EMPTY_FORM, ...saved.form }, extraction: saved.extraction ?? null };
  } catch {
    return null;
  }
}

export function saveForm(form: AnalyzeFormState, extraction: ExtractionResult | null): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ form, extraction }));
  } catch {
    // Storage full or disabled; state still lives in memory for this visit.
  }
}

export function clearForm(): void {
  try {
    // Adopt an older draft first so clearing cannot resurrect it later.
    loadForm();
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/** "145,000", "$0.15" and " 25000 " all parse; blank → null; garbage → NaN. */
export function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[,$\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : Number.NaN;
}

type FieldErrors = Partial<Record<keyof AnalyzeFormState, string>>;

function check(errors: FieldErrors, key: keyof AnalyzeFormState, raw: string, min: number, max: number, label: string, integer = false) {
  const n = parseNumber(raw);
  if (n == null) return;
  if (Number.isNaN(n)) errors[key] = `${label} must be a number.`;
  else if (integer && !Number.isInteger(n)) errors[key] = `${label} must be a whole number.`;
  else if (n < min || n > max) errors[key] = `${label} must be between ${min.toLocaleString()} and ${max.toLocaleString()}.`;
}

export function validateBuilding(f: AnalyzeFormState): FieldErrors {
  const e: FieldErrors = {};
  if (f.address.trim().length < 3) e.address = "Enter the building address.";
  check(e, "squareFeet", f.squareFeet, 100, 10_000_000, "Square footage");
  check(e, "yearBuilt", f.yearBuilt, 1700, new Date().getFullYear(), "Year built", true);
  check(e, "stories", f.stories, 1, 200, "Floors", true);
  return e;
}

export function validateEnergy(f: AnalyzeFormState): FieldErrors {
  const e: FieldErrors = {};
  check(e, "electricityKwh", f.electricityKwh, 0, 1e9, "Annual electricity");
  check(e, "elecRate", f.elecRate, 0.01, 5, "Electricity rate");
  if (f.hasGasService) {
    check(e, "gasTherms", f.gasTherms, 0, 1e8, "Annual gas");
    check(e, "gasRate", f.gasRate, 0.01, 20, "Gas rate");
  }
  return e;
}

const orNull = (raw: string) => {
  const n = parseNumber(raw);
  return n == null || Number.isNaN(n) ? null : n;
};

export function toBuildingProfile(f: AnalyzeFormState): BuildingProfile {
  return {
    address: f.address.trim(),
    buildingType: f.buildingType,
    squareFeet: orNull(f.squareFeet),
    yearBuilt: orNull(f.yearBuilt),
    stories: orNull(f.stories),
  };
}

export function toUtilityData(f: AnalyzeFormState, extraction: ExtractionResult | null): UtilityData {
  const electricityKwh = orNull(f.electricityKwh);
  return {
    electricityKwh,
    naturalGasTherms: f.hasGasService ? orNull(f.gasTherms) : 0,
    electricityRate: orNull(f.elecRate),
    gasRate: f.hasGasService ? orNull(f.gasRate) : null,
    hasGasService: f.hasGasService,
    source: extraction
      ? extraction.method === "ai"
        ? "ai-extracted"
        : extraction.method === "demo"
          ? "demo"
          : "rule-extracted"
      : electricityKwh != null
        ? "manual"
        : "none",
  };
}

export function toAnalyzeRequest(
  mode: "demo" | "custom",
  f: AnalyzeFormState,
  extraction: ExtractionResult | null,
): AnalyzeRequest {
  return {
    mode,
    ...toBuildingProfile(f),
    utility: {
      ...toUtilityData(f, extraction),
      utilityProvider: extraction?.extraction.utilityProvider ?? null,
      monthsOfData: extraction?.extraction.billingPeriodMonths
        ? Math.min(24, Math.max(1, Math.round(extraction.extraction.billingPeriodMonths)))
        : null,
    },
    extraction: extraction ?? undefined,
  };
}
