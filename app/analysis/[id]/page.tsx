import { AnalysisLoader } from "@/components/analysis/loader";
import { getAnalysis } from "@/lib/db/store";

export default async function AnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ debug?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const analysis = await getAnalysis(id);
  return <AnalysisLoader id={id} initial={analysis} debug={query.debug === "true"} />;
}
