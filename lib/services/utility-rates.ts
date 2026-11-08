import { DEFAULT_RATES } from "@/lib/analytics/assumptions";
import type { Provenance } from "@/lib/types/building";

export interface RateResult {
  electricity: number;
  gas: number;
  electricityProvenance: Provenance;
  gasProvenance: Provenance;
  note: string;
}

/**
 * Utility-rate lookup. A paid tariff API can replace this later.
 * Uses user / extracted rates when present; otherwise labeled regional defaults.
 */
export function resolveRates(input: {
  state: string | null;
  electricityRate?: number | null;
  gasRate?: number | null;
  elecProv?: Provenance;
  gasProv?: Provenance;
}): RateResult {
  const defaults = input.state === "NY" ? DEFAULT_RATES.NY : DEFAULT_RATES.US;
  const electricity = input.electricityRate && input.electricityRate > 0 ? input.electricityRate : defaults.electricity;
  const gas = input.gasRate && input.gasRate > 0 ? input.gasRate : defaults.gas;
  return {
    electricity,
    gas,
    electricityProvenance: input.electricityRate && input.electricityRate > 0 ? (input.elecProv ?? "user") : "default",
    gasProvenance: input.gasRate && input.gasRate > 0 ? (input.gasProv ?? "user") : "default",
    note:
      input.electricityRate && input.gasRate
        ? "Rates from user input or extracted bill."
        : `Default ${input.state === "NY" ? "New York" : "U.S."} commercial planning rates used where a rate was not provided ($${defaults.electricity}/kWh, $${defaults.gas}/therm).`,
  };
}
