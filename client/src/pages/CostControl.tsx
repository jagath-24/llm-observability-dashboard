import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  DollarSign,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#fbbf24", "#67e8f9", "#c4b5fd", "#34d399", "#f87171", "#60a5fa"];

const chartTooltipStyle = {
  background: "#111a28",
  border: "1px solid rgba(148, 163, 184, 0.16)",
  borderRadius: "10px",
  color: "#e2e8f0",
  fontSize: "12px",
};

function SummaryCard({
  label,
  value,
  sub,
  tone = "text-amber-300",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111925]/90 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-3 font-mono text-2xl font-medium tracking-[-0.04em] ${tone}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-600">{sub}</p>
    </div>
  );
}

export default function CostControl() {
  const costsQuery = trpc.observability.costs.useQuery(
    undefined,
    { refetchInterval: 30000 },
  );
  const statsQuery = trpc.observability.stats.useQuery(
    undefined,
    { refetchInterval: 30000 },
  );

  const costs = costsQuery.data;
  const stats = statsQuery.data;
  const isLoading = costsQuery.isLoading || statsQuery.isLoading;
  const isError = costsQuery.isError || statsQuery.isError;

  const totalCalls = stats?.totalCalls ?? 0;
  const totalCost = costs?.totalCost ?? 0;
  const costPerCall = totalCalls > 0 ? totalCost / totalCalls : 0;
  const totalTokens = stats?.totalTokens ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300 mb-1">
            <DollarSign className="h-3.5 w-3.5" /> Cost control
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Spend analytics</h1>
          <p className="text-xs text-slate-500 mt-1">
            Simulated pricing — $0.005/1K input · $0.015/1K output
          </p>
        </div>
        <button
          onClick={() => { costsQuery.refetch(); statsQuery.refetch(); }}
          disabled={costsQuery.isFetching}
          className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-xs text-slate-400 transition hover:bg-white/[0.07] hover:text-slate-200 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${costsQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-3 py-24 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading cost data…</span>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <AlertTriangle className="h-6 w-6 text-rose-400" />
          <p className="text-sm text-rose-300">Failed to load cost data</p>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Total simulated spend"
              value={`$${totalCost.toFixed(4)}`}
              sub="OpenAI-equivalent pricing"
              tone="text-amber-300"
            />
            <SummaryCard
              label="Cost per call"
              value={`$${costPerCall.toFixed(5)}`}
              sub={`across ${totalCalls} completions`}
              tone="text-cyan-300"
            />
            <SummaryCard
              label="Total tokens"
              value={totalTokens >= 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : String(totalTokens)}
              sub="prompt + completion combined"
              tone="text-violet-300"
            />
            <SummaryCard
              label="Endpoints tracked"
              value={String(costs?.byEndpoint.length ?? 0)}
              sub="distinct API endpoints"
              tone="text-slate-200"
            />
          </div>

          {/* Budget guidance banner */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-4 py-3">
            <TrendingUp className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-200">Pricing is simulated</p>
              <p className="mt-0.5 text-xs text-amber-100/50">
                Costs use a flat $0.005/1K input and $0.015/1K output rate.
                Replace with your provider's actual pricing table for accurate forecasting.
                Set per-user quotas and a hard global cap on the server to prevent runaway spend.
              </p>
            </div>
          </div>

          {/* Charts row */}
          <div className="grid gap-5 xl:grid-cols-2">
            {/* Cost by endpoint bar */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#111925]/90 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:p-6">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-amber-300" />
                <h2 className="text-sm font-semibold text-slate-200">Cost by endpoint</h2>
              </div>
              <p className="text-xs text-slate-600 mb-5">Top endpoints by simulated spend</p>
              {(costs?.byEndpoint ?? []).length === 0 ? (
                <div className="flex items-center justify-center h-40 text-slate-600 text-xs">
                  No data yet
                </div>
              ) : (
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={costs?.byEndpoint ?? []}
                      layout="vertical"
                      margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
                    >
                      <CartesianGrid horizontal={false} stroke="rgba(148,163,184,0.08)" />
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="endpoint"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#7e8da3", fontSize: 10 }}
                        width={120}
                      />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        cursor={{ fill: "rgba(255,255,255,0.03)" }}
                        formatter={(v: number) => [`$${v.toFixed(4)}`, "cost"]}
                      />
                      <Bar dataKey="cost" radius={[0, 5, 5, 0]} barSize={22}>
                        {(costs?.byEndpoint ?? []).map((entry, i) => (
                          <Cell key={entry.endpoint} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Cost by model bar */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#111925]/90 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:p-6">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-violet-300" />
                <h2 className="text-sm font-semibold text-slate-200">Cost by model</h2>
              </div>
              <p className="text-xs text-slate-600 mb-5">Top models by simulated spend</p>
              {(costs?.byModel ?? []).length === 0 ? (
                <div className="flex items-center justify-center h-40 text-slate-600 text-xs">
                  No data yet
                </div>
              ) : (
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={costs?.byModel ?? []}
                      layout="vertical"
                      margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
                    >
                      <CartesianGrid horizontal={false} stroke="rgba(148,163,184,0.08)" />
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="model"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#7e8da3", fontSize: 9 }}
                        width={130}
                        tickFormatter={(v: string) => v.split("/").pop()?.replace("-versatile", "") ?? v}
                      />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        cursor={{ fill: "rgba(255,255,255,0.03)" }}
                        formatter={(v: number) => [`$${v.toFixed(4)}`, "cost"]}
                      />
                      <Bar dataKey="cost" radius={[0, 5, 5, 0]} barSize={22}>
                        {(costs?.byModel ?? []).map((entry, i) => (
                          <Cell key={entry.model} fill={COLORS[(i + 2) % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Detailed table */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111925]/90 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
            <div className="border-b border-white/[0.06] px-5 py-4 sm:px-6">
              <h2 className="text-sm font-semibold text-slate-200">Cost detail by endpoint</h2>
            </div>
            {(costs?.byEndpoint ?? []).length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <DollarSign className="h-8 w-8 text-slate-700" />
                <p className="text-sm text-slate-400">No completions recorded yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] text-left">
                  <thead>
                    <tr className="border-b border-white/[0.05] text-[10px] uppercase tracking-[0.14em] text-slate-600">
                      <th className="px-5 py-3 font-semibold sm:px-6">Endpoint</th>
                      <th className="px-3 py-3 font-semibold">Service</th>
                      <th className="px-3 py-3 font-semibold">Calls</th>
                      <th className="px-3 py-3 font-semibold">Tokens</th>
                      <th className="px-5 py-3 text-right font-semibold sm:px-6">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(costs?.byEndpoint ?? []).map(ep => (
                      <tr
                        key={ep.endpoint}
                        className="border-b border-white/[0.04] hover:bg-white/[0.025] transition"
                      >
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-300 sm:px-6">
                          {ep.endpoint}
                        </td>
                        <td className="px-3 py-3.5 text-xs text-slate-500">{ep.service}</td>
                        <td className="px-3 py-3.5 font-mono text-xs text-slate-400">{ep.calls}</td>
                        <td className="px-3 py-3.5 font-mono text-xs text-slate-400">
                          {ep.tokens >= 1000 ? `${(ep.tokens / 1000).toFixed(1)}k` : ep.tokens}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-xs text-amber-300 sm:px-6">
                          ${ep.cost.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
