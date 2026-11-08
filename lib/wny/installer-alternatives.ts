import { COUNTIES, type System } from "./types";
import { filterInstallers, loadInstallers, normalizeCounty, type Installer } from "./directory";

export interface ContractorFinder { label: string; url: string; description: string }
const NYSERDA: ContractorFinder = {
  label: "Find an energy contractor",
  url: "https://www.nyserda.ny.gov/contractors/find-a-contractor",
  description: "NYSERDA’s statewide contractor and consultant directories. Check building type and project scope.",
};
const SOLAR: ContractorFinder = {
  label: "Find a NY-Sun solar installer",
  url: "https://www.nyserda.ny.gov/find-a-solar-contractor",
  description: "Find participating solar contractors beyond our directory. Confirm commercial or residential project experience.",
};
const HEAT: ContractorFinder = {
  label: "Find a Clean Heat contractor",
  url: "https://cleanheat.ny.gov/find-a-contractor/",
  description: "Search participating heat-pump contractors and ask whether they cover your location and system size.",
};
const BPI: ContractorFinder = {
  label: "Find an efficiency professional",
  url: "https://www.bpi.org/pages/locator/",
  description: "BPI’s locator for home-performance professionals. Confirm suitability for commercial buildings.",
};
const STORAGE: ContractorFinder = {
  label: "Find an energy-storage contractor",
  url: "https://nyserda.my.salesforce-sites.com/FindAContractorRetailStorage",
  description: "NYSERDA’s retail-storage contractor directory. Confirm battery scope, system size and service area.",
};
const SEARCH_TERMS: Partial<Record<System, string>> = {
  led: "LED lighting installation contractors", lighting_controls: "commercial lighting controls contractors",
  hvac_controls: "commercial HVAC controls building automation contractors", furnace_boiler: "furnace boiler replacement contractors",
  air_source_heat_pump: "air source heat pump installers", ground_source_heat_pump: "geothermal heat pump installers",
  air_sealing: "insulation air sealing contractors", insulation: "insulation air sealing contractors",
  windows: "window replacement installers", smart_thermostat: "smart thermostat installers",
  heat_pump_water_heater: "heat pump water heater installers", rooftop_solar: "solar panel installers", battery_storage: "battery storage installers",
};
export function contractorFinders(systems: System[], state: string | null): ContractorFinder[] {
  if (state?.toUpperCase() !== "NY") return systems.some(s => ["air_sealing", "insulation", "windows"].includes(s)) ? [BPI] : [];
  const links: ContractorFinder[] = [];
  if (systems.includes("rooftop_solar")) links.push(SOLAR);
  if (systems.includes("battery_storage")) links.push(STORAGE);
  if (systems.some(s => ["air_source_heat_pump", "ground_source_heat_pump", "heat_pump_water_heater"].includes(s))) links.push(HEAT);
  if (systems.some(s => ["air_sealing", "insulation", "windows"].includes(s))) links.push(BPI);
  links.push(NYSERDA);
  return links;
}

/** Discovery only: other WNY listings do not imply that they cover this property's county. */
export function regionalInstallerAlternatives(systems: System[], county: string | null, state: string | null, rows = loadInstallers(), now = new Date()): Installer[] {
  const selectedCounty = normalizeCounty(county);
  if (!selectedCounty || state?.toUpperCase() !== "NY") return [];
  const listings = new Map<string, Installer>();
  for (const otherCounty of COUNTIES.filter(c => c !== selectedCounty)) {
    for (const installer of filterInstallers(systems, otherCounty, rows, now)) {
      if (!installer.serviceArea.includes(selectedCounty)) listings.set(installer.id, installer);
    }
  }
  const matches = (installer: Installer) => systems.filter(s => installer.services.includes(s)).length;
  return [...listings.values()].sort((a, b) => matches(b) - matches(a) || a.name.localeCompare(b.name)).slice(0, 3);
}

/** Only broad location context enters this link; it never contains a street address. */
export function installerSearch(systems: System[], county: string | null, state: string | null) {
  const selectedCounty = normalizeCounty(county);
  const isNY = state?.toUpperCase() === "NY";
  const location = isNY && selectedCounty ? `${selectedCounty} County, NY` : "near me";
  const query = `${SEARCH_TERMS[systems[0]] ?? "energy upgrade contractors"} ${location}`;
  return { label: isNY && selectedCounty ? `Search near ${selectedCounty} County` : "Search installers near me",
    url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` };
}
