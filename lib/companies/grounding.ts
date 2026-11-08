import { CompanyResearchSchema, type CompanySearchResult, type FoundCompany } from "./types";

export function canonicalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|gclid|fbclid)/i.test(key)) url.searchParams.delete(key);
    url.hostname = url.hostname.replace(/^www\./, "");
    return url.toString().replace(/\/$/, "");
  } catch { return null; }
}
const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");
const DIRECTORY_HOSTS = /(^|\.)(energyscout\.io|solarscout\.io|hvacservice\.io|loc8nearme\.com|storeboard\.com|buildzoom\.com|yellowpages\.com|manta\.com|chamberofcommerce\.com|solarreviews\.com|energysage\.com|yelp\.com|angi\.com|homeadvisor\.com|thumbtack\.com|google\.com|bing\.com|facebook\.com|linkedin\.com|wikipedia\.org|bbb\.org|nyserda\.ny\.gov|nyserda\.my\.salesforce-sites\.com)$/i;
export function groundCompanies(value: unknown, consultedUrls: string[], researchText: string): FoundCompany[] {
  const parsed = CompanyResearchSchema.parse(value);
  const consulted = new Set(consultedUrls.map(canonicalUrl).filter((v): v is string => !!v));
  const seen = new Set<string>();
  const companies: FoundCompany[] = [];
  for (const company of parsed.companies) {
    const sources = [...new Set(company.sources.map(canonicalUrl).filter((v): v is string => !!v && consulted.has(v)))];
    const website = canonicalUrl(company.website);
    // A real primary website must have appeared in the search, not just a model-supplied URL.
    if (!website || DIRECTORY_HOSTS.test(host(website)) || !sources.length || !sources.some(source => host(source) === host(website))) continue;
    const key = host(website);
    if (seen.has(key)) continue;
    seen.add(key);
    const phone = company.phone && company.phone.replace(/\D/g, "").length >= 7 && /^[+\d ()\-.]{7,40}$/.test(company.phone) && researchText.replace(/\D/g, "").includes(company.phone.replace(/\D/g, "")) ? company.phone : null;
    const p = company.pricing;
    const priceSource = p.sourceUrl ? canonicalUrl(p.sourceUrl) : null;
    const researchNumbers = new Set((researchText.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map(v => Number(v.replace(/,/g, ""))));
    const pricePresent = (n: number) => researchNumbers.has(n);
    const validPrice = p.status === "published" && p.low != null && p.high != null && p.high >= p.low && p.unit !== "unknown" && !!priceSource && sources.includes(priceSource) && host(priceSource) === host(website) && p.evidence.length > 0 && pricePresent(p.low) && pricePresent(p.high);
    const pricing = validPrice ? { ...p, sourceUrl: priceSource } : {
      status: "quote_required" as const, low: null, high: null, unit: "unknown" as const, scope: "A site-specific installed quote is required.", installed: false, sourceUrl: null, evidence: "No supported, comparable installed price was found in the searched sources.",
    };
    companies.push({ ...company, website, phone, sources, pricing, id: key, rank: 0 });
  }
  // Rank confirmed coverage/building fit before providers that still need confirmation.
  companies.sort((a, b) => Number(b.coverage === "published_local") - Number(a.coverage === "published_local") || Number(b.buildingFit === "published_match") - Number(a.buildingFit === "published_match"));
  return companies.map((c, i) => ({ ...c, rank: i + 1 }));
}
export function priceConclusion(companies: FoundCompany[]): CompanySearchResult["pricing"] {
  const groups = new Map<string, FoundCompany[]>();
  for (const c of companies) {
    const p = c.pricing;
    if (c.coverage !== "published_local" || c.buildingFit !== "published_match" || p.status !== "published" || !p.installed || p.unit === "flat_project" || p.unit === "unknown") continue;
    const key = `${p.unit}:${p.scope.toLowerCase().trim().replace(/\s+/g, " ")}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const comparable = [...groups.values()].filter(g => g.length >= 2).sort((a, b) => b.length - a.length)[0];
  if (!comparable) return { companyId: null, label: "Compare quotes for the best price", explanation: "The companies found do not publish enough like-for-like installed prices to identify the cheapest for your property. The first-call recommendation is based on job fit, not an invented price ranking. Request at least 3 itemized quotes." };
  const ordered = [...comparable].sort((a, b) => a.pricing.low! - b.pricing.low!);
  if (ordered[0].pricing.low === ordered[1].pricing.low) return { companyId: null, label: "Published starting prices are tied", explanation: "Comparable published starting rates are tied. Final installed costs still need site-specific quotes." };
  return { companyId: ordered[0].id, label: "Lowest published starting rate", explanation: `Among ${comparable.length} providers found with the same published unit and scope. This is an advertised starting rate, not a guaranteed lowest quote for your property. Verify exclusions and get comparable quotes.` };
}
