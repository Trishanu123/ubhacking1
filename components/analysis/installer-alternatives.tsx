import { ExternalLink } from "lucide-react";
import { contractorFinders, installerSearch, regionalInstallerAlternatives } from "@/lib/wny/installer-alternatives";
import type { System } from "@/lib/wny/types";

export function InstallerAlternatives({ systems, county, state, compact = false }: {
  systems: System[]; county: string | null; state: string | null; compact?: boolean;
}) {
  const finders = contractorFinders(systems, state);
  const search = installerSearch(systems, county, state);
  const regional = regionalInstallerAlternatives(systems, county, state);
  const links = compact ? finders.slice(0, 1) : finders;
  return <div className={compact ? "mt-2" : "rounded-xl border border-slate-200 bg-slate-50/50 p-5"}>
    <p className="text-sm font-medium text-slate-800">You can still get this upgrade</p>
    <p className="mt-1 text-sm leading-6 text-slate-500">Our directory has no confirmed local match yet. Find a provider through an official directory or search beyond your county.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {links.map(link => <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500">{link.label}<ExternalLink className="size-3.5 shrink-0" aria-hidden="true" /></a>)}
      <a href={search.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500">{search.label}<ExternalLink className="size-3.5 shrink-0" aria-hidden="true" /></a>
    </div>
    {!compact && <>
      <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-500">{finders.map(link => <li key={link.url}>{link.description}</li>)}</ul>
      {regional.length > 0 && <div className="mt-5 border-t border-slate-200 pt-4"><h4 className="text-sm font-medium text-slate-800">Other Western New York listings</h4><p className="mt-1 text-xs leading-5 text-slate-500">These businesses list relevant services in other counties. They are not confirmed to cover your county and are not AI-ranked for your property. Contact them to ask about travel, project size and remaining scope.</p><ul className="mt-3 space-y-3">{regional.map(i => <li key={i.id} className="text-sm text-slate-700"><p className="font-medium">{i.name}</p><p className="mt-1 text-xs text-slate-500">Listed counties: {i.serviceArea.join(", ")} · Last verified: {i.lastVerified}</p><div className="mt-1 flex flex-wrap gap-3">{i.website && <a href={i.website} target="_blank" rel="noreferrer" className="underline underline-offset-4">Website</a>}{i.phone && <a href={`tel:${i.phone.replace(/[^+\d]/g, "")}`} className="underline underline-offset-4">{i.phone}</a>}</div></li>)}</ul></div>}
      <p className="mt-4 text-xs leading-5 text-slate-500">External listings are leads, not verified RetroPilot recommendations. Confirm coverage, licenses, insurance and program eligibility, and get at least 3 quotes.</p>
    </>}
  </div>;
}
