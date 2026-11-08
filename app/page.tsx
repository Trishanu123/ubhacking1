import Link from "next/link";
import { ArrowRight, Camera, FileText, ChartNoAxesCombined } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRODUCT_NAME } from "@/lib/constants";

const STEPS = [
  {
    icon: Camera,
    title: "Show your property",
    description: "Upload photos for a quick overview of the electric and gas appliances you can see.",
  },
  {
    icon: FileText,
    title: "Add the details",
    description: "Tell us about your building and upload a utility bill, or enter your energy use.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "See a way forward",
    description: "Compare potential upgrades by estimated savings, installation cost, and payback.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <section className="pb-16 pt-16 sm:pb-20 sm:pt-24 lg:pt-28">
        <p className="text-[11px] font-medium tracking-[0.18em] text-slate-500 uppercase">
          A little clarity. A better building.
        </p>
        <h1 className="mt-6 max-w-3xl text-[2.75rem] leading-[1.08] font-semibold tracking-[-0.055em] text-balance text-slate-900 sm:text-6xl lg:text-7xl">
          A clearer path to
          <br className="hidden sm:block" />
          {" "}<span className="text-slate-400">lower energy bills.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-slate-500 sm:text-lg sm:leading-8">
          Understand what your building costs to run, which upgrades could help,
          and where to start. {PRODUCT_NAME} brings the details together so your next
          decision feels simpler.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild size="lg" className="h-12 rounded-xl bg-slate-900 px-6 text-sm text-white hover:bg-slate-800">
            <Link href="/analyze">
              Analyze your building <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="h-12 rounded-xl px-5 text-sm text-slate-600 hover:bg-slate-100">
            <Link href="/analyze?demo=1">Explore the demo</Link>
          </Button>
        </div>
        <p className="mt-5 text-xs text-slate-400">
          For commercial buildings. Preliminary estimates to help you plan.
        </p>
      </section>

      <section aria-label="The problem and our approach" className="grid overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm md:grid-cols-2">
        <div className="p-6 sm:p-8 lg:p-10">
          <p className="text-[11px] font-medium tracking-[0.16em] text-slate-400 uppercase">The problem</p>
          <h2 className="mt-4 max-w-xs text-2xl leading-tight font-semibold tracking-tight text-slate-900">
            High bills. Too many unknowns.
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-500">
            You know what you spend on energy. Figuring out what to improve takes
            more work: aging equipment, building condition, upfront costs, and
            incentive programs all affect the answer.
          </p>
        </div>
        <div className="border-t border-slate-200/80 bg-slate-50/60 p-6 sm:p-8 md:border-t-0 md:border-l lg:p-10">
          <p className="text-[11px] font-medium tracking-[0.16em] text-slate-400 uppercase">The solution</p>
          <h2 className="mt-4 max-w-xs text-2xl leading-tight font-semibold tracking-tight text-slate-900">
            A practical place to start.
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-500">
            {PRODUCT_NAME} uses your building details and energy data to screen
            potential upgrades, estimate their financial impact, and surface
            relevant incentive pathways. You get a clear starting plan for what
            to investigate next.
          </p>
        </div>
      </section>

      <section className="pb-16 pt-16 sm:pb-20 sm:pt-20" aria-labelledby="how-it-works">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="how-it-works" className="text-xl font-semibold tracking-tight text-slate-900">From your building to your next step.</h2>
          <span className="text-xs text-slate-400">Three simple steps</span>
        </div>
        <ol className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-6">
          {STEPS.map(({ icon: Icon, title, description }, index) => (
            <li key={title} className="border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-mono text-[11px]">0{index + 1}</span>
                <Icon className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </div>
              <h3 className="mt-5 text-sm font-semibold text-slate-800">{title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">{description}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
