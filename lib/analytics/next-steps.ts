import type { Analysis, NextStep } from "@/lib/types/analysis";

export function buildNextSteps(analysis: Pick<Analysis, "building" | "energy" | "recommendations" | "confidence">): NextStep[] {
  const steps: NextStep[] = [
    {
      title: "Collect 12 months of utility bills",
      detail:
        analysis.energy.provenance.electricityKwh === "estimated"
          ? "Consumption was estimated. Twelve months of electricity and gas bills will materially improve confidence."
          : "Confirm that the billed period represents a typical year and capture demand (kW) if available.",
    },
    {
      title: "Verify current HVAC equipment and age",
      detail:
        "Record make, model, capacity, fuel, and approximate age of heating and cooling equipment before committing to replacement or heat-pump evaluation.",
    },
    {
      title: "Perform a professional energy audit",
      detail:
        "These results are a preliminary screen. An ASHRAE-aligned audit or engineering study is needed before design or procurement.",
    },
    {
      title: "Obtain contractor quotes",
      detail:
        "Installed costs shown are planning ranges. Request multiple contractor quotes for any measure you intend to pursue.",
    },
    {
      title: "Verify incentive eligibility before project commitment",
      detail:
        "Program rules, application timing, pre-approval, and stacking restrictions must be confirmed with the program administrator.",
    },
  ];

  if (analysis.recommendations.some((r) => r.category === "solar")) {
    steps.push({
      title: "Evaluate structural suitability for rooftop solar",
      detail:
        "Roof age, remaining membrane life, structural capacity, shading, and interconnection requirements require professional verification.",
    });
  }

  if (analysis.confidence.level !== "high") {
    steps.unshift({
      title: "Fill remaining building data gaps",
      detail: `Overall data confidence is ${analysis.confidence.level}. Adding square footage, vintage, rates, or bills will tighten the estimates.`,
    });
  }

  return steps;
}
