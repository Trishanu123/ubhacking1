import type { IncentiveProgram, IncentiveProvider, IncentiveQuery, MatchedIncentive } from "@/lib/types/incentive";

/**
 * Seeded official-program references. Incentive values are qualitative on purpose —
 * never treat these as published rebate amounts.
 */
export const SEEDED_PROGRAMS: IncentiveProgram[] = [
  {
    id: "nyserda-flextech",
    name: "NYSERDA FlexTech",
    provider: "NYSERDA",
    providerType: "state",
    technology: ["assessment", "hvac", "lighting", "controls", "envelope"],
    states: ["NY"],
    buildingTypes: "all",
    eligibility: "New York commercial, industrial, and multifamily building owners and energy service providers seeking technical studies.",
    incentiveType: "cost-share",
    incentiveValue: "See program requirements",
    sourceUrl: "https://www.nyserda.ny.gov/All-Programs/FlexTech-Program",
    sourceName: "Official NYSERDA FlexTech Program",
    verificationDate: "2026-04-01",
    status: "potentially-applicable",
    notes: "Cost-share for energy studies and technical analysis. Eligibility and cost-share rates must be confirmed with NYSERDA.",
  },
  {
    id: "nyserda-clean-heat",
    name: "NYS Clean Heat",
    provider: "NYSERDA / participating utilities",
    providerType: "state",
    technology: ["heat_pump", "hvac", "water_heating"],
    states: ["NY"],
    buildingTypes: "all",
    eligibility: "Eligible heat pump and related electrification projects in participating New York utility territories.",
    incentiveType: "rebate",
    incentiveValue: "See program requirements",
    sourceUrl: "https://www.nyserda.ny.gov/All-Programs/Clean-Heat-Program",
    sourceName: "Official NYSERDA Clean Heat Program",
    verificationDate: "2026-04-01",
    status: "potentially-applicable",
    notes: "Incentive levels vary by equipment type, climate application, and utility. Confirm current catalog with the program administrator.",
  },
  {
    id: "nyserda-nysun",
    name: "NY-Sun",
    provider: "NYSERDA",
    providerType: "state",
    technology: ["solar"],
    states: ["NY"],
    buildingTypes: "all",
    eligibility: "Eligible solar photovoltaic projects in New York, subject to block availability and installer participation.",
    incentiveType: "rebate",
    incentiveValue: "See program requirements",
    sourceUrl: "https://www.nyserda.ny.gov/All-Programs/NY-Sun",
    sourceName: "Official NYSERDA NY-Sun",
    verificationDate: "2026-04-01",
    status: "potentially-applicable",
    notes: "Incentive blocks change over time. Interconnection, MW Block status, and installer eligibility require verification.",
  },
  {
    id: "nyserda-storage",
    name: "NYSERDA Energy Storage",
    provider: "NYSERDA",
    providerType: "state",
    technology: ["storage"],
    states: ["NY"],
    buildingTypes: "all",
    eligibility: "Eligible customer-sited and bulk energy storage projects in New York.",
    incentiveType: "rebate",
    incentiveValue: "See program requirements",
    sourceUrl: "https://www.nyserda.ny.gov/All-Programs/Energy-Storage-Program",
    sourceName: "Official NYSERDA Energy Storage Program",
    verificationDate: "2026-04-01",
    status: "potentially-applicable",
    notes: "Storage incentives depend on market, size, and remaining program funds.",
  },
  {
    id: "nyserda-rtem",
    name: "NYSERDA Real Time Energy Management",
    provider: "NYSERDA",
    providerType: "state",
    technology: ["controls"],
    states: ["NY"],
    buildingTypes: "all",
    eligibility: "Commercial and institutional buildings implementing qualifying energy management systems.",
    incentiveType: "rebate",
    incentiveValue: "See program requirements",
    sourceUrl: "https://www.nyserda.ny.gov/All-Programs/Real-Time-Energy-Management",
    sourceName: "Official NYSERDA RTEM Program",
    verificationDate: "2026-04-01",
    status: "potentially-applicable",
    notes: "Program status and eligible vendors should be confirmed before specifying a system.",
  },
  {
    id: "irs-179d",
    name: "Section 179D Energy Efficient Commercial Buildings Deduction",
    provider: "Internal Revenue Service",
    providerType: "federal",
    technology: ["lighting", "hvac", "envelope", "controls"],
    states: ["US"],
    buildingTypes: "all",
    eligibility: "Qualifying energy-efficient commercial building property placed in service, subject to IRS rules and prevailing-wage / apprenticeship provisions where applicable.",
    incentiveType: "tax-deduction",
    incentiveValue: "See program requirements",
    sourceUrl: "https://www.irs.gov/credits-deductions/energy-efficient-commercial-buildings-deduction",
    sourceName: "Official IRS 179D",
    verificationDate: "2026-04-01",
    status: "potentially-applicable",
    notes: "Tax treatment requires a qualified professional. Watt does not provide tax advice.",
  },
  {
    id: "irs-itc",
    name: "Federal Investment Tax Credit for solar and storage (verify current law)",
    provider: "Internal Revenue Service",
    providerType: "federal",
    technology: ["solar", "storage"],
    states: ["US"],
    buildingTypes: "all",
    eligibility: "Eligibility, credit rates, and phase-out dates depend on current federal law and project placed-in-service dates.",
    incentiveType: "tax-credit",
    incentiveValue: "See program requirements — federal solar credit rules changed in 2025 and must be verified",
    sourceUrl: "https://www.energy.gov/eere/solar/federal-solar-tax-credits-businesses",
    sourceName: "U.S. DOE / IRS solar tax credit overview",
    verificationDate: "2026-04-01",
    status: "verify-status",
    notes: "Do not assume a 30% credit. Confirm current federal tax treatment with a tax advisor.",
  },
  {
    id: "ngrid-ny-ci",
    name: "National Grid NY Commercial Energy Efficiency Programs",
    provider: "National Grid",
    providerType: "utility",
    technology: ["lighting", "hvac", "controls", "envelope", "water_heating"],
    states: ["NY"],
    utilities: ["national grid"],
    buildingTypes: "all",
    eligibility: "Commercial and industrial customers in National Grid New York electric and/or gas territory, subject to program manuals.",
    incentiveType: "rebate",
    incentiveValue: "See program requirements",
    sourceUrl: "https://www.nationalgridus.com/Upstate-NY-Business/Energy-Saving-Programs",
    sourceName: "National Grid Upstate NY Business Energy Saving Programs",
    verificationDate: "2026-04-01",
    status: "potentially-applicable",
    notes: "Prescriptive and custom pathways vary. Pre-approval is often required for custom measures.",
  },
  {
    id: "nyseg-ci",
    name: "NYSEG / RG&E Commercial Energy Efficiency",
    provider: "NYSEG / RG&E",
    providerType: "utility",
    technology: ["lighting", "hvac", "controls", "envelope"],
    states: ["NY"],
    utilities: ["nyseg", "rge", "rg&e"],
    buildingTypes: "all",
    eligibility: "Commercial customers in NYSEG or RG&E territory.",
    incentiveType: "rebate",
    incentiveValue: "See program requirements",
    sourceUrl: "https://www.nyseg.com/wps/portal/nyseg/saveenergy",
    sourceName: "NYSEG energy efficiency programs",
    verificationDate: "2026-04-01",
    status: "potentially-applicable",
    notes: "Confirm whether the site is in NYSEG or RG&E territory before applying.",
  },
  {
    id: "nyserda-commercial",
    name: "NYSERDA Commercial & Industrial Programs (overview)",
    provider: "NYSERDA",
    providerType: "state",
    technology: ["assessment", "financing", "hvac", "lighting", "solar", "storage", "controls"],
    states: ["NY"],
    buildingTypes: "all",
    eligibility: "New York commercial and industrial customers; specific eligibility varies by program.",
    incentiveType: "technical-assistance",
    incentiveValue: "See program requirements",
    sourceUrl: "https://www.nyserda.ny.gov/All-Programs/Programs-for-Commercial-and-Industrial",
    sourceName: "Official NYSERDA C&I programs",
    verificationDate: "2026-04-01",
    status: "potentially-applicable",
    notes: "Portal for locating current commercial programs. Use as a starting point, not a commitment of funds.",
  },
];

function relevance(program: IncentiveProgram, query: IncentiveQuery): { score: number; reason: string; matched: MatchedIncentive["matchedTechnologies"] } {
  const matched = program.technology.filter((t) => query.technologies.includes(t));
  if (matched.length === 0) return { score: 0, reason: "", matched: [] };
  let score = 0.4 + 0.1 * matched.length;
  const reasons: string[] = [];
  const stateOk =
    program.states.includes("US") || (query.state != null && program.states.includes(query.state));
  if (!stateOk) return { score: 0, reason: "", matched: [] };
  if (query.state && program.states.includes(query.state)) {
    score += 0.2;
    reasons.push(`${query.state} program`);
  } else {
    reasons.push("federal / nationwide program");
  }
  if (program.utilities?.length) {
    const u = (query.utility ?? "").toLowerCase();
    if (u && program.utilities.some((x) => u.includes(x) || x.includes(u))) {
      score += 0.15;
      reasons.push("utility territory may match");
    } else if (u) {
      score -= 0.1;
      reasons.push("utility territory should be confirmed");
    }
  }
  reasons.push(`relevant to ${matched.join(", ")}`);
  return { score: Math.min(1, score), reason: reasons.join("; "), matched };
}

export class SeededIncentiveProvider implements IncentiveProvider {
  readonly name = "seeded-official-catalog";

  async findIncentives(query: IncentiveQuery): Promise<MatchedIncentive[]> {
    const matches: MatchedIncentive[] = [];
    for (const program of SEEDED_PROGRAMS) {
      const { score, reason, matched } = relevance(program, query);
      if (score <= 0) continue;
      matches.push({ ...program, matchedTechnologies: matched, matchReason: reason, relevance: score });
    }
    return matches.sort((a, b) => b.relevance - a.relevance);
  }
}

export const incentiveProvider: IncentiveProvider = new SeededIncentiveProvider();

export async function findIncentives(query: IncentiveQuery): Promise<MatchedIncentive[]> {
  return incentiveProvider.findIncentives(query);
}
