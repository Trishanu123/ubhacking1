"use client";

import type { Analysis } from "@/lib/types/analysis";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usd, num } from "@/lib/format";

const EMERALD = "#059669";
const INDIGO = "#6366f1";
const SLATE = "#94a3b8";
const COLORS = [EMERALD, INDIGO, "#0ea5e9", "#f59e0b", "#64748b", "#14b8a6"];
const AXIS = { fontSize: 11, fill: "#64748b" };

export function AnalysisCharts({ analysis }: { analysis: Analysis }) {
  const f = analysis.financialSummary;
  const included = analysis.recommendations.filter((r) => r.includedInPortfolio);
  const costData = [
    { name: "Before", cost: f.annualEnergyCost },
    { name: "After (est.)", cost: f.postRetrofitAnnualCost },
  ];
  const contrib = included.map((r) => ({
    name: r.categoryLabel,
    savings: Math.round(r.estimatedAnnualSavings),
  }));
  const energyData = [
    { name: "Electricity kWh", before: analysis.energy.electricityKwh, after: f.postRetrofitElectricityKwh },
    ...(analysis.energy.naturalGasTherms > 0
      ? [{ name: "Gas therms", before: analysis.energy.naturalGasTherms, after: f.postRetrofitGasTherms }]
      : []),
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Annual energy cost before vs estimated after">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={costData}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={AXIS} />
            <YAxis tick={AXIS} tickFormatter={(v) => `$${num(v / 1000, 0)}k`} />
            <Tooltip formatter={(v) => usd(Number(v))} />
            <Bar dataKey="cost" fill={EMERALD} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Savings contribution by technology">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={contrib} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={AXIS} tickFormatter={(v) => `$${num(v / 1000, 0)}k`} />
            <YAxis type="category" dataKey="name" width={90} tick={AXIS} />
            <Tooltip formatter={(v) => usd(Number(v))} />
            <Bar dataKey="savings" radius={[0, 4, 4, 0]}>
              {contrib.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Ten-year cumulative financial impact (undiscounted)">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={f.cumulative}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={AXIS} />
            <YAxis tick={AXIS} tickFormatter={(v) => `$${num(v / 1000, 0)}k`} />
            <Tooltip formatter={(v) => usd(Number(v))} />
            <Legend />
            <Line type="monotone" dataKey="cumulativeNet" name="Cumulative net" stroke={EMERALD} dot={false} />
            <Line type="monotone" dataKey="cumulativeSavings" name="Cumulative savings" stroke={INDIGO} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Energy consumption before vs estimated after">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={energyData}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={AXIS} />
            <YAxis tick={AXIS} />
            <Tooltip />
            <Legend />
            <Bar dataKey="before" fill={SLATE} radius={[4, 4, 0, 0]} />
            <Bar dataKey="after" fill={EMERALD} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <p className="mb-4 text-xs font-medium tracking-wider text-slate-500 uppercase">{title}</p>
      {children}
    </div>
  );
}
