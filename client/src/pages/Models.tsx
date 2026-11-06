import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";

function formatCompact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString();
}

type ModelStat = {
  model: string;
  calls: number;
  successCalls: number;
  errorCalls: number;
  totalTokens: number;
  totalCost: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
};

export default function Models() {
  const callsQuery = trpc.observability.calls.useQuery(
    { limit: 500 },
    { refetchInterval: 30000 },
  );
  const costsQuery = trpc.observability.costs.useQuery(
    undefined,
    { refetchInterval: 30000 },
  );

  const modelStats: ModelStat[] = useMemo(() => {
    const calls = callsQuery.data ?? [];
    const byModel = new Map<string, typeof calls>();
    for (const c of calls) {
      const arr = byModel.get(c.model) ?? [];
      arr.push(c);
      byModel.set(c.model, arr);
    }
    return Array.from(byModel.entries()).map(([model, cs]) => {
      const latencies = cs.map(c => c.latencyMs).sort((a, b) => a - b);
      const p95Index = Math.max(0, Math.ceil(latencies.length * 0.95) - 1);
      const errorCalls = cs.filter(c => c.status === "error").length;
      return {
        model,
        calls: cs.length,
        successCalls: cs.length - errorCalls,
        errorCalls,
        totalTokens: cs.reduce((s, c) => s + c.totalTokens, 0),
        totalCost: cs.reduce((s, c) => s + Number(c.estimatedCost), 0),
        avgLatencyMs: Math.round(cs.reduce((s, c) => s + c.latencyMs, 0) / cs.length),
        p95LatencyMs: latencies[p95Index] ?? 0,
        errorRate: Math.round((errorCalls / cs.length) * 100 * 10) / 10,
      };
    }).sort((a, b) => b.calls - a.calls);
  }, [callsQuery.data]);

  const isLoading = callsQuery.isLoading || costsQuery.isLoading;
  const isError = callsQuery.isError || costsQuery.isError;

  const totalCalls = modelStats.reduce((s, m) => s + m.calls, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300 mb-1">
            <Bot className="h-3.5 w-3.5" /> Models
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Model analytics</h1>
          <p className="text-xs text-slate-500 mt-1">
            {isLoading ? "Loading…" : `${modelStats.length} model${modelStats.length !== 1 ? "s" : ""} in use`}
          </p>
        </div>
        <button
          onClick={() => { callsQuery.refetch(); costsQuery.refetch(); }}
          disabled={callsQuery.isFetching}
          className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-xs text-slate-400 transition hover:bg-white/[0.07] hover:text-slate-200 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${callsQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* State guards */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-3 py-24 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading model data…</span>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <AlertTriangle className="h-6 w-6 text-rose-400" />
          <p className="text-sm text-rose-300">Failed to load model data</p>
        </div>
      ) : modelStats.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center rounded-2xl border border-white/[0.07] bg-[#111925]/90">
          <Bot className="h-8 w-8 text-slate-700" />
          <p className="text-sm text-slate-400">No completions recorded yet</p>
          <p className="text-xs text-slate-600">Run the live demo to record your first trace.</p>
        </div>
      ) : (
        <>
          {/* Model cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {modelStats.map(m => {
              const sharePercent = totalCalls > 0 ? Math.round((m.calls / totalCalls) * 100) : 0;
              const healthy = m.errorRate < 5 && m.p95LatencyMs < 1200;
              return (
                <div
                  key={m.model}
                  className="rounded-2xl border border-white/[0.07] bg-[#111925]/90 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] space-y-4"
                >
                  {/* Model name + health */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-violet-300 shrink-0" />
                        <span className="font-mono text-xs text-slate-200 break-all leading-5">
                          {m.model}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-600">
                        {sharePercent}% of all completions
                      </p>
                    </div>
                    {healthy ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
                    )}
                  </div>

                  {/* Usage bar */}
                  <div>
                    <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-cyan-300"
                        style={{ width: `${sharePercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="text-[10px] uppercase tracking-widest text-slate-600">Calls</p>
                      <p className="mt-1 font-mono font-medium text-slate-200">{m.calls}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {m.successCalls} ok / {m.errorCalls} err
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="text-[10px] uppercase tracking-widest text-slate-600">Error rate</p>
                      <p className={`mt-1 font-mono font-medium ${m.errorRate >= 5 ? "text-rose-300" : "text-emerald-300"}`}>
                        {m.errorRate}%
                      </p>
                      <div className="flex items-center gap-0.5 text-[10px] text-slate-600 mt-0.5">
                        {m.errorRate >= 5 ? (
                          <TrendingUp className="h-3 w-3 text-rose-400" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-emerald-400" />
                        )}
                        target &lt; 5%
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="text-[10px] uppercase tracking-widest text-slate-600">Avg latency</p>
                      <p className={`mt-1 font-mono font-medium ${m.avgLatencyMs > 1200 ? "text-amber-300" : "text-slate-200"}`}>
                        {m.avgLatencyMs}ms
                      </p>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        p95 {m.p95LatencyMs}ms
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] p-3">
                      <p className="text-[10px] uppercase tracking-widest text-slate-600">Cost</p>
                      <p className="mt-1 font-mono font-medium text-amber-300">
                        ${m.totalCost.toFixed(4)}
                      </p>
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {formatCompact(m.totalTokens)} tokens
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cost by model table */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111925]/90 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
            <div className="border-b border-white/[0.06] px-5 py-4 sm:px-6">
              <h2 className="text-sm font-semibold text-slate-200">Cost breakdown by model</h2>
              <p className="text-xs text-slate-600 mt-0.5">Simulated at $0.005/1K input · $0.015/1K output</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-left">
                <thead>
                  <tr className="border-b border-white/[0.05] text-[10px] uppercase tracking-[0.14em] text-slate-600">
                    <th className="px-5 py-3 font-semibold sm:px-6">Model</th>
                    <th className="px-3 py-3 font-semibold">Calls</th>
                    <th className="px-3 py-3 font-semibold">Tokens</th>
                    <th className="px-3 py-3 font-semibold">Simulated cost</th>
                    <th className="px-5 py-3 font-semibold text-right sm:px-6">Cost/call</th>
                  </tr>
                </thead>
                <tbody>
                  {modelStats.map(m => (
                    <tr
                      key={m.model}
                      className="border-b border-white/[0.04] hover:bg-white/[0.025] transition"
                    >
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-300 sm:px-6">
                        {m.model.split("/").pop()}
                      </td>
                      <td className="px-3 py-3.5 font-mono text-xs text-slate-400">{m.calls}</td>
                      <td className="px-3 py-3.5 font-mono text-xs text-slate-400">
                        {formatCompact(m.totalTokens)}
                      </td>
                      <td className="px-3 py-3.5 font-mono text-xs text-amber-300">
                        ${m.totalCost.toFixed(4)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs text-slate-500 sm:px-6">
                        ${(m.totalCost / Math.max(m.calls, 1)).toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
