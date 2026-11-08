# More specific estimates

The results show an **expected value** first. Savings, cost and payback scenarios remain in
expandable details. A point estimate is not a promise of accuracy or a statistically calibrated
prediction interval. Narrowing a generic band without new evidence would not improve accuracy.

The original forecast is a deterministic engineering screen. No real, independently labeled
post-retrofit outcomes have been supplied to validate predictive error. The sample H5 file and
synthetic data are not used to claim measured accuracy, retrain the forecast, or manufacture
narrow confidence limits.

## Actual details that replace assumptions

Open an upgrade's side panel, then **Make this estimate more specific**. Only enter documented
measurements, an engineering assessment, manufacturer/proposal specifications, or an itemized
installed quote. Blanks retain assumptions. There is no automatic equipment wattage inferred
from photos. Inputs remain in browser session storage, scoped to the analysis.

- All upgrades: actual installed quote and a confirmed eligible incentive amount. Quote cost
  replaces a generic allowance; it is not independently verified and must cover the same scope.
- All upgrades: variable electricity and gas tariffs can be entered at the top of the report.
  Exclude fixed account fees and separately billed demand charges. A blended total bill rate may
  overstate savings when fixed charges are unavoidable.
- Lighting: fixture count, baseline/proposed connected watts including ballasts, annual hours
  and documented controls reduction. kWh = count × (old watts − new watts × (1 − controls share))
  × hours / 1,000. Without a documented controls input the existing 20% assumption remains.
  Optional low/high operating hours propagate to scenario savings with other inputs held fixed.
- Furnace/boiler: dedicated annual heating therms and both existing/proposed seasonal efficiencies.
  Therm savings = heating therms × (1 − old efficiency / proposed efficiency). Cooling remains modeled.
- Heat pump: heating therms, existing efficiency, seasonal COP and heating-load coverage.
  Added electricity is displaced therms × 100 × existing efficiency / (3.412 × seasonal COP).
  Existing modeled cooling savings remain. Use climate-specific seasonal performance, not a
  single-condition rated COP.
- Heat-pump water heater: water-heating therms, existing efficiency and seasonal COP. Electricity
  is subtracted from displaced gas. A central system needs actual demand and capacity assessment.
- Controls/envelope: documented audit/commissioning reduction percentages replace generic factors.
  Unmetered end-use splits remain assumptions; entering a percentage does not verify it.
- Solar: a design/proposal's kW DC replaces generic system sizing, including in the cost layer.
  Existing PVWatts/fallback yield, 90% rate valuation and purchased-load cap remain. This does
  not remove shading, weather or tariff uncertainty.
- Battery: supported monthly billed-peak reduction, actual demand tariff and months, minus
  extra electricity for losses. Capacity alone cannot prove demand savings. Dispatch and interval
  data must support the entered peak reduction; losses default to zero only as an explicit
  simplifying assumption when omitted.

Invalid partial lighting/efficiency groups, impossible heating loads and peak reductions are
rejected. Inputs never mutate the original analysis. AI recommendation and company endpoints
validate refinements and recompute from stored originals when available. Memory-only snapshots
carry the same refined evidence and sizing. Cache keys include refined inputs so old estimates
and installer research are not silently reused after changes.

## Consistency fixes

- Portfolio and selected-package totals now reuse signed-fuel and solar-after-efficiency logic.
  Heat-pump electricity increases are no longer discarded from portfolio consumption totals.
- Solar and efficiency cannot both save the same purchased electricity; savings and carbon
  reductions are capped by available fuel/energy. The existing overlap factor remains a
  planning assumption, not an empirically calibrated interaction model.
- Combined savings propagate actual per-upgrade scenario ranges, including entered lighting
  operating-hour bounds, instead of replacing refinements with one blanket percentage.
- Expected payback remains net cost / expected annual savings. The low scenario uses lower
  net cost / higher savings; the high scenario uses higher net cost / lower savings. When a
  savings scenario is nonpositive its payback is unavailable, not zero or a finite upper bound.
- Demo provenance is not classified as measured utility data. Gas data/rates are not required
  to assess input completeness for an all-electric property. Completeness is not model accuracy.

Generic cost bands and other unknown performance assumptions remain broad until supported by
real inputs. A tighter quoted-cost scenario is not a guarantee against change orders or scope
changes. Actual predictive accuracy requires independent measured before/after outcomes, weather
and occupancy normalization, and held-out validation; none is invented here.

Engineering references:
- DOE FEMP measurement and verification options:
  https://www.energy.gov/cmei/femp/measurement-and-verification-options-federal-energy-and-water-saving-projects
- DOE FEMP M&V Guidelines 5.0 (2024):
  https://www.energy.gov/sites/default/files/2024-10/mv_guide_5_0.pdf
- PVWatts interpretation and annual weather variability:
  https://pvwatts.nlr.gov/docs/en/help_results_interpret.php
