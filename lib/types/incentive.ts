export type Technology =
  | "lighting"
  | "controls"
  | "hvac"
  | "heat_pump"
  | "envelope"
  | "solar"
  | "storage"
  | "water_heating"
  | "assessment"
  | "financing";

export interface IncentiveProgram {
  id: string;
  name: string;
  provider: string;
  providerType: "federal" | "state" | "utility" | "local";
  technology: Technology[];
  /** States where the program applies ("US" = nationwide). */
  states: string[];
  /** Optional utility territory restriction (lower-case utility names). */
  utilities?: string[];
  buildingTypes: "all" | string[];
  eligibility: string;
  incentiveType: "rebate" | "cost-share" | "tax-credit" | "tax-deduction" | "performance" | "financing" | "technical-assistance";
  /** Never a fabricated dollar figure: qualitative description or "See program requirements". */
  incentiveValue: string;
  sourceUrl: string;
  sourceName: string;
  verificationDate: string;
  status: "potentially-applicable" | "verify-status";
  notes: string;
}

export interface MatchedIncentive extends IncentiveProgram {
  matchedTechnologies: Technology[];
  matchReason: string;
  relevance: number;
}

export interface IncentiveProvider {
  readonly name: string;
  findIncentives(query: IncentiveQuery): Promise<MatchedIncentive[]>;
}

export interface IncentiveQuery {
  state: string | null;
  utility: string | null;
  buildingType: string;
  technologies: Technology[];
}
