import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InstallerAlternatives } from "@/components/analysis/installer-alternatives";
import { contractorFinders, installerSearch, regionalInstallerAlternatives } from "./installer-alternatives";
import { InstallerSchema, type Installer } from "./directory";

const now = new Date();
const date = now.toISOString().slice(0, 10);
function fixture(overrides: Partial<Installer> = {}): Installer {
  return InstallerSchema.parse({ id: "fixture-only", name: "Test fixture only", website: "https://example.org", phone: null,
    serviceArea: ["Niagara", "Genesee"], services: ["rooftop_solar"], certifications: [], licenseInsuranceNotes: "Test fixture, not a business.",
    priceTier: "unverified", priceTierSource: null, priceVerifiedOn: null, sourceUrls: ["https://example.org"],
    lastVerified: date, verificationStatus: "verified", isTemplate: false, ...overrides });
}
describe("installer alternatives", () => {
  it("offers relevant official finders for solar, heating, storage and weatherization", () => {
    expect(contractorFinders(["rooftop_solar"], "NY")[0].label).toContain("NY-Sun");
    expect(contractorFinders(["air_source_heat_pump"], "NY")[0].label).toContain("Clean Heat");
    expect(contractorFinders(["battery_storage"], "NY")[0].label).toContain("storage");
    expect(contractorFinders(["air_sealing", "insulation"], "NY")[0].url).toContain("bpi.org");
    expect(contractorFinders(["led"], "NY")[0].url).toContain("nyserda");
  });
  it("uses broad county context for external searches and never assumes a NY county for another state", () => {
    const result = installerSearch(["rooftop_solar"], "Erie", "NY");
    const url = new URL(result.url);
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toBe("solar panel installers Erie County, NY");
    expect(installerSearch(["rooftop_solar"], "Erie", "CA").label).toContain("near me");
    expect(contractorFinders(["rooftop_solar"], "CA")).toEqual([]);
  });
  it("shows service-matched regional listings once without claiming local coverage", () => {
    const rows = [fixture(), fixture({ id: "local", serviceArea: ["Erie"] }), fixture({ id: "wrong-service", services: ["led"] })];
    const result = regionalInstallerAlternatives(["rooftop_solar"], "Erie", "NY", rows, now);
    expect(result.map(r => r.id)).toEqual(["fixture-only"]);
    expect(result[0].serviceArea).not.toContain("Erie");
  });
  it("excludes stale, unverified and template entries from alternatives too", () => {
    const rows = [fixture({ id: "old", lastVerified: "2000-01-01" }), fixture({ id: "unverified", verificationStatus: "unverified" }), fixture({ id: "template", isTemplate: true, verificationStatus: "unverified" })];
    expect(regionalInstallerAlternatives(["rooftop_solar"], "Erie", "NY", rows, now)).toEqual([]);
    expect(regionalInstallerAlternatives(["rooftop_solar"], "Erie", "CA", [fixture()], now)).toEqual([]);
    expect(regionalInstallerAlternatives(["rooftop_solar"], null, "NY", [fixture()], now)).toEqual([]);
  });
  it("still offers real next steps when the shipped directory has no businesses", () => {
    const html = renderToStaticMarkup(createElement(InstallerAlternatives, { systems: ["rooftop_solar"], county: "Erie", state: "NY", compact: true }));
    expect(html).toContain("You can still get this upgrade");
    expect(html).toContain("Find a NY-Sun solar installer");
    expect(html).toContain("Search near Erie County");
    expect(html).not.toContain("TEMPLATE");
  });
});
