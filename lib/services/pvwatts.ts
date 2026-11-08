import type { SolarResource } from "@/lib/types/analysis";
import { source } from "@/lib/sources";

export interface PvwattsProvider {
  readonly name: string;
  getSpecificYield(lat: number, lon: number): Promise<SolarResource>;
}

/** Approximate kWh/kW-yr for a south-facing, 14% loss, fixed-tilt array. */
export function fallbackYield(lat: number): number {
  const clamped = Math.min(49, Math.max(24, lat));
  return Math.round(1750 - (clamped - 25) * 22);
}

export class FallbackPvwattsProvider implements PvwattsProvider {
  readonly name = "latitude-fallback";
  async getSpecificYield(lat: number, _lon?: number): Promise<SolarResource> {
    const y = fallbackYield(lat);
    return {
      method: "fallback",
      specificYieldKwhPerKw: y,
      monthlyKwhPerKw: null,
      tilt: Math.round(lat),
      azimuth: 180,
      losses: 14,
      note: `PVWatts was unavailable. Used a transparent latitude-based estimate (~${y} kWh/kW-yr).`,
    };
  }
}

export class NrelPvwattsProvider implements PvwattsProvider {
  readonly name = "nrel-pvwatts-v8";
  constructor(private apiKey: string) {}

  async getSpecificYield(lat: number, lon: number): Promise<SolarResource> {
    const tilt = Math.round(Math.min(60, Math.max(5, lat)));
    const url = new URL("https://developer.nrel.gov/api/pvwatts/v8.json");
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("system_capacity", "1");
    url.searchParams.set("azimuth", "180");
    url.searchParams.set("tilt", String(tilt));
    url.searchParams.set("array_type", "1");
    url.searchParams.set("module_type", "0");
    url.searchParams.set("losses", "14");

    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`PVWatts HTTP ${res.status}`);
    const json = (await res.json()) as { outputs?: { ac_annual?: number; ac_monthly?: number[] }; errors?: string[] };
    if (json.errors?.length) throw new Error(json.errors.join("; "));
    const annual = json.outputs?.ac_annual;
    if (!annual || !Number.isFinite(annual)) throw new Error("PVWatts missing ac_annual");
    return {
      method: "pvwatts",
      specificYieldKwhPerKw: Math.round(annual),
      monthlyKwhPerKw: json.outputs?.ac_monthly ?? null,
      tilt,
      azimuth: 180,
      losses: 14,
      note: "Annual production per kW from NREL PVWatts v8 (1 kW reference system, south-facing).",
    };
  }
}

export async function getSolarResource(lat: number | null, lon: number | null): Promise<{ solar: SolarResource; sourceNote: ReturnType<typeof source> }> {
  const fallback = new FallbackPvwattsProvider();
  const key = process.env.PVWATTS_API_KEY;
  const useLat = lat ?? 42.8864;
  const useLon = lon ?? -78.8784;

  if (key) {
    try {
      const solar = await new NrelPvwattsProvider(key).getSpecificYield(useLat, useLon);
      return {
        solar,
        sourceNote: source("NREL PVWatts v8", "solar", "https://developer.nrel.gov/docs/solar/pvwatts/v8/", solar.note),
      };
    } catch (err) {
      const solar = await fallback.getSpecificYield(useLat, useLon);
      solar.note = `${solar.note} (PVWatts error: ${err instanceof Error ? err.message : "unknown"})`;
      return {
        solar,
        sourceNote: source("Latitude-based PV yield fallback", "solar", undefined, solar.note),
      };
    }
  }

  const solar = await fallback.getSpecificYield(useLat, useLon);
  return {
    solar,
    sourceNote: source("Latitude-based PV yield fallback", "solar", undefined, solar.note),
  };
}
