# WNY installer and cost data maintenance

This feature is a screening comparison, not a contractor marketplace or a quote service.
The shipped directory contains **templates only**. It intentionally recommends no businesses
until someone has researched, verified and entered real records. No company names, phone
numbers, reviews, certifications or prices were invented.

## Add and verify an installer

1. Start from an official NYSERDA Clean Heat or NY-Sun contractor finder, National Grid or
   NYSEG program list. The results page links to these starting points. Program listing
   alone is not proof that a company serves a county or performs every type of work.
2. Copy a template in `data/wny-installers.json`. Give it a unique, stable lowercase ID.
   Replace the template name with the business's exact published name. Set `isTemplate`
   to false. Record the real HTTPS website and public business phone (or null if absent).
3. Confirm service counties and specific services directly with the business. Use only the
   county and system keys listed in `lib/wny/types.ts`. Do not infer service area from its
   mailing address. A lighting-only company can be a partial match for lighting plus controls;
   the UI discloses the remaining scope instead of promising it handles everything.
4. Add source URLs. For each certification/program participation, record its name, an
   evidence URL and `verifiedOn` date (YYYY-MM-DD). Verify credentials using the issuing
   organization's directory; do not turn an unsourced marketing claim into a certification.
5. Check applicable municipal/trade licenses and current liability/workers compensation
   coverage. Explain what was checked, where, when and any remaining limitations in
   `licenseInsuranceNotes`. State unresolved issues plainly.
6. Leave `priceTier` as `unverified`, `priceTierSource` and `priceVerifiedOn` as null unless
   comparable, documented price evidence supports a tier. Never infer price from reviews,
   branding or certifications. Set budget/mid/premium only with a linked methodology and
   current evidence. Tiers are relative indicators, not project quotes or proof of cheapest.
7. Set `verificationStatus` to `verified` and `lastVerified` to the actual verification date
   only after completing the checks. Keep incomplete entries `unverified`.
8. Run `npm test`, `npm run lint`, and `npm run build`. The loader validates schema and
   unique IDs. Check the results page for the relevant county and every offered service.

Templates, unverified entries, future dates and entries more than 365 days old are excluded.
Expired certifications are hidden and undocumented/expired price tiers become `unverified`.
Re-verify service area, credentials, contact details, insurance and price evidence regularly.
No verified record currently ships; therefore there is no installer last-verified date yet.

## Cost reference review

Edit `data/wny-cost-catalog.json`; retain evidence for **each** numeric value. Each row has
low/typical/high unit costs, lifetime, source, source date, last review date, regional multiplier
and explicit TODOs. `sourceNote` distinguishes a published benchmark from a carried-forward
engine allowance. A design/program link is **not evidence of a numeric installed cost**.

Currently:

- Roof insulation uses a DOE-hosted CEE national residential installed range; its expected
  value is an explicitly labeled midpoint. Verify commercial roof scope and WNY applicability.
- Rooftop solar uses DOE/NREL's Q1 2025 commercial PV-only market benchmark, in 2024 dollars.
  Its low/high planning band is an assumption, not an observed price distribution. Verify the
  reference system's scale/domestic-content scope and current Buffalo costs before relying on it.
- Other active rows retain the existing engine's provisional unit allowances. They are NOT
  verified WNY prices. NYSERDA residential heat-pump/HPWH benchmarks are context only and
  are not represented as commercial full-installed prices.
- Ground-source heat pumps, replacement windows and standalone thermostats have null cost
  fields pending evidence. They are reference slots, not newly predicted upgrades. No equipment
  count, window area, ground-loop suitability or thermostat count is invented.
- Buffalo multipliers are null. Code uses a disclosed neutral 1.0 until supported local evidence
  is supplied. No unverified inflation factor is applied. Lifetimes remain planning assumptions.

For every TODO, collect comparable current local installed quotes or published project costs;
record building class, project size, labor, electrical/duct/roof work, permitting, disposal,
price year, sample size and exclusions. Replace nulls and provisional values only when evidence
supports them. Do not extrapolate a residential per-unit cost to a large central commercial system.

The results cost layer sizes fixtures and controls from existing area/profile heuristics, HVAC
from the existing area-per-ton heuristic, insulation from roof area, solar from the existing
sizing function, storage from the existing peak/duration assumptions, and central water heating
from the existing annual-therm proxy. These quantities require an on-site survey. HVAC results
show a **full replacement allowance**, while the original engine can use an incremental premium.
This is disclosed in cost details and does not change stored analyses or savings predictions.

## Incentives and AI behavior

The new presentation layer calls the existing capped-incentive, net-cost and simple-payback
functions and uses the existing category planning shares only for matched catalog programs.
These shares are not awarded amounts. Invented program IDs do not create incentives. No new
25C/25D residential credit is added; stale or explicitly unverified entries cannot authorize one.
The underlying incentive catalog and financial/prediction engine are unchanged.

`POST /api/recommendations/installers` accepts `{ analysisId, county, snapshot? }`. County must
be a supported WNY county or null. A known non-NY property never receives WNY installer matches.
There is no address-to-county guess. The optional snapshot is a bounded, validated projection of
an existing session analysis for memory-only/serverless use. It contains no address, photos,
utility bill images or API credentials. Stored analyses take precedence; snapshots are never
persisted or used to retrain/change the model.

The server uses the existing OpenAI SDK/env conventions with temperature 0, strict JSON schema,
Zod parsing and per-upgrade directory-ID validation. All company contacts/credentials/tiers in
the UI come from the canonical directory. Unsupported claims about prices, reviews or contacts
in model prose cause a deterministic fallback. No AI arithmetic replaces cost/savings formulas.
Invalid IDs, refusals, timeouts and missing keys are labeled **not AI-ranked**. The deterministic
installer order is service coverage, current documented credentials, then documented price tier.

A bounded in-process cache shares in-flight requests and caches successful AI output for six hours;
fallbacks expire after one minute. Keys include analysis content, county, cost and installer facts,
and model configuration. This is per server instance, not durable shared storage. Changing data
invalidates the content key. No database migrations or mandatory new environment variables are needed.

The combined-selection panel reuses the existing budget planner's compatibility and package-total
helpers. Alternatives cannot be selected together; signed fuel changes, the overlap factor and
solar-after-efficiency caps are preserved. No optimizer is rerun to silently drop chosen upgrades.


## Live AI company discovery on the results dashboard

The results UI now uses `/api/recommendations/companies` for actual company discovery rather
than requiring manually populated directory records. The template directory remains available
for curated data, but does not restrict live results. The existing county-based API and its
fallback descriptions above apply to the legacy comparison, not the live company list.

The new API searches official company/service pages and program sources using the analysis's
entered location, job type, building class and existing sizing. City/state/ZIP are sufficient
when available, avoiding transmission of the street address. The API then extracts structured
company data and validates websites/evidence against URLs returned by the web-search tool.
Unsupported phone numbers and prices are removed. Source-backed web leads are not treated as
verified insurance, certification, guaranteed availability or service-area confirmations.

Results show the AI's suggested first call based on service and location fit. The pricing
conclusion is a separate calculation over supported company-published installed rates with
identical scope and units, matched building class and published local coverage. If comparable
prices are absent, it requests quotes instead of inventing a cheapest installer. No contractor
has been contacted and no quote has been requested on the user's behalf.

Selecting an upgrade opens its company results in a desktop side sheet or mobile bottom sheet.
The top recommendation's company summary appears directly on the dashboard. Initial searches,
retry states, empty results and cached per-upgrade results are supported. “Find more companies”
widens the search, excludes existing websites and merges distinct returned companies. Web
search is not a complete registry; all companies, coverage, availability and prices must be
confirmed before hiring. The old placeholder records are never passed off as live companies.

Optional `OPENAI_COMPANY_SEARCH_MODEL` controls web search. Successes are cached per server
instance for six hours; empty results for one minute; failures are removed from the cache.
Live search and extraction have timeouts and bounded output. The API validates snapshots,
location and upgrade IDs, limits request size/rate and keeps provider secrets on the server.
Tests cover evidence rejection, unsupported prices/phones, compatible price comparisons,
location minimization, API failures, retries, cache sharing and wider searches.
