import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const DEFAULT_LATENCY_THRESHOLD_MS = 1200;
const DEFAULT_ERROR_RATE_THRESHOLD = 5;

// ── Live "last updated" ticker ─────────────────────────────────────────────
function useSecondsTicker(resetSignal: unknown) {
  const [secs, setSecs] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSecs(0);
    ref.current && clearInterval(ref.current);
    ref.current = setInterval(() => setSecs(s => s + 1), 1000);
    return () => { ref.current && clearInterval(ref.current); };
  }, [resetSignal]);

  return secs;
}

// ── Animated status pill ───────────────────────────────────────────────────
function StatusBanner({
  allGood,
  errorRate,
  p95,
  prevErrorRate,
  prevP95,
  justFixed,
}: {
  allGood: boolean;
  errorRate: number;
  p95: number;
  prevErrorRate: number | null;
  prevP95: number | null;
  justFixed: boolean;
}) {
  const errorImproved = prevErrorRate !== null && errorRate < prevErrorRate;
  const latencyImproved = prevP95 !== null && p95 < prevP95;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-all duration-500 ${
        justFixed
          ? "border-emerald-300/30 bg-emerald-300/[0.09] shadow-[0_0_30px_rgba(52,211,153,0.08)]"
          : allGood
          ? "border-emerald-300/15 bg-emerald-300/[0.05]"
          : "border-rose-300/20 bg-rose-300/[0.05]"
      }`}
    >
      {allGood ? (
        <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 transition-colors duration-300 ${justFixed ? "text-emerald-300" : "text-emerald-300"}`} />
      ) : (
        <AlertTriangle className="h-4 w-4 text-rose-300 shrink-0 mt-0.5" />
      )}
      <div className="flex-1">
        <p className={`text-xs font-semibold transition-colors duration-300 ${allGood ? "text-emerald-200" : "text-rose-200"}`}>
          {justFixed
            ? "Guardrails cleared — error trace was fixed"
            : allGood
            ? "All guardrails within tolerance"
            : "One or more guardrails breached"}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {allGood
            ? "P95 latency and error rate are both within the configured thresholds."
            : "Retry error traces in the Traces page to fix them and lower the error rate."}
        </p>
        {(errorImproved || latencyImproved) && (
          <div className="mt-2 flex flex-wrap gap-3">
            {errorImproved && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-300 font-mono">
                Error rate {prevErrorRate}% <ArrowRight className="h-3 w-3" /> {errorRate}%
              </span>
            )}
            {latencyImproved && (
              <span className="flex items-center gap-1 text-[10px] text-cyan-300 font-mono">
                P95 {prevP95}ms <ArrowRight className="h-3 w-3" /> {p95}ms
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Guardrail card ─────────────────────────────────────────────────────────
function GuardrailCard({
  title,
  description,
  threshold,
  currentValue,
  unit,
  breached,
  icon: Icon,
}: {
  title: string;
  description: string;
  threshold: string;
  currentValue: string;
  unit: string;
  breached: boolean;
  icon: typeof Clock3;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:p-6 transition-all duration-500 ${
        breached
          ? "border-rose-300/20 bg-rose-300/[0.04]"
          : "border-emerald-300/15 bg-[#111925]/90"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 transition-colors duration-300 ${breached ? "text-rose-300" : "text-cyan-300"}`} />
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all duration-300 ${
          breached
            ? "border-rose-300/20 bg-rose-300/[0.08] text-rose-300"
            : "border-emerald-300/15 bg-emerald-300/[0.07] text-emerald-300"
        }`}>
          {breached
            ? <><AlertTriangle className="h-3 w-3" /> Breached</>
            : <><CheckCircle2 className="h-3 w-3" /> OK</>}
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-500 leading-5">{description}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-600">Threshold</p>
          <p className="mt-1 font-mono text-sm font-medium text-slate-300">
            {threshold}<span className="text-xs text-slate-600 ml-1">{unit}</span>
          </p>
        </div>
        <div className="rounded-xl bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-widest text-slate-600">Current</p>
          <p className={`mt-1 font-mono text-sm font-medium transition-colors duration-300 ${breached ? "text-rose-300" : "text-emerald-300"}`}>
            {currentValue}<span className="text-xs text-slate-600 ml-1">{unit}</span>
          </p>
        </div>
      </div>

      {/* Progress bar showing how close to threshold */}
      {!breached && (
        <div className="mt-4">
          <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-300/60 transition-all duration-700"
              style={{
                width: `${Math.min(
                  100,
                  unit === "ms"
                    ? (Number(currentValue) / DEFAULT_LATENCY_THRESHOLD_MS) * 100
                    : (Number(currentValue) / DEFAULT_ERROR_RATE_THRESHOLD) * 100,
                )}%`,
              }}
            />
          </div>
          <p className="mt-1 text-right text-[10px] text-slate-700 tabular-nums">
            {unit === "ms"
              ? `${Math.round((Number(currentValue) / DEFAULT_LATENCY_THRESHOLD_MS) * 100)}% of threshold`
              : `${Math.round((Number(currentValue) / DEFAULT_ERROR_RATE_THRESHOLD) * 100)}% of threshold`}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Guardrails() {
  // Refetch every 5 s so changes from retries show up quickly
  // staleTime: 0 ensures we always refetch on mount (no stale flash after navigating back)
  const statsQuery = trpc.observability.stats.useQuery(
    undefined,
    {
      refetchInterval: 5000,
      staleTime: 0,
      refetchOnMount: "always",
    },
  );

  const stats = statsQuery.data;
  const p95 = stats?.p95Latency ?? 0;
  const errorRate = stats?.errorRate ?? 0;
  const latencyBreached = p95 > DEFAULT_LATENCY_THRESHOLD_MS;
  const errorBreached = errorRate >= DEFAULT_ERROR_RATE_THRESHOLD;
  const allGood = !latencyBreached && !errorBreached;

  // Track previous values to show improvement arrows
  const prevRef = useRef<{ errorRate: number; p95: number } | null>(null);
  const [justFixed, setJustFixed] = useState(false);
  const fixTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dataKey = statsQuery.dataUpdatedAt;
  const secsSinceUpdate = useSecondsTicker(dataKey);

  useEffect(() => {
    if (!stats) return;
    const prev = prevRef.current;
    if (prev) {
      const wasBreached = prev.errorRate >= DEFAULT_ERROR_RATE_THRESHOLD || prev.p95 > DEFAULT_LATENCY_THRESHOLD_MS;
      const nowGood = errorRate < DEFAULT_ERROR_RATE_THRESHOLD && p95 <= DEFAULT_LATENCY_THRESHOLD_MS;
      if (wasBreached && nowGood) {
        setJustFixed(true);
        fixTimerRef.current && clearTimeout(fixTimerRef.current);
        fixTimerRef.current = setTimeout(() => setJustFixed(false), 6000);
      }
    }
    prevRef.current = { errorRate, p95 };
  }, [errorRate, p95, stats]);

  useEffect(() => () => { fixTimerRef.current && clearTimeout(fixTimerRef.current); }, []);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300 mb-1">
            <ShieldCheck className="h-3.5 w-3.5" /> Guardrails
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Production thresholds</h1>
          <p className="text-xs text-slate-500 mt-1">
            Checks every 5 seconds — updates immediately when a trace is retried.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live update ticker */}
          <span className="hidden items-center gap-1.5 text-[10px] text-slate-600 sm:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${statsQuery.isFetching ? "bg-cyan-300 animate-pulse" : "bg-slate-700"}`} />
            {statsQuery.isFetching ? "Updating…" : `${secsSinceUpdate}s ago`}
          </span>
          <button
            onClick={() => statsQuery.refetch()}
            disabled={statsQuery.isFetching}
            className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-xs text-slate-400 transition hover:bg-white/[0.07] hover:text-slate-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${statsQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh now
          </button>
        </div>
      </div>

      {statsQuery.isLoading ? (
        <div className="flex items-center justify-center gap-3 py-24 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading guardrail status…</span>
        </div>
      ) : statsQuery.isError ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <AlertTriangle className="h-6 w-6 text-rose-400" />
          <p className="text-sm text-rose-300">Failed to load stats</p>
          <p className="text-xs text-slate-600">{statsQuery.error.message}</p>
        </div>
      ) : (
        <>
          {/* Status banner — animates on fix */}
          <StatusBanner
            allGood={allGood}
            errorRate={errorRate}
            p95={p95}
            prevErrorRate={prevRef.current?.errorRate ?? null}
            prevP95={prevRef.current?.p95 ?? null}
            justFixed={justFixed}
          />

          {/* Guardrail cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            <GuardrailCard
              title="P95 latency"
              description={`Fires when the 95th-percentile latency exceeds ${DEFAULT_LATENCY_THRESHOLD_MS}ms. High latency usually indicates a slow upstream model or a very large prompt.`}
              threshold={String(DEFAULT_LATENCY_THRESHOLD_MS)}
              currentValue={String(p95)}
              unit="ms"
              breached={latencyBreached}
              icon={Clock3}
            />
            <GuardrailCard
              title="Error rate"
              description={`Fires when ${DEFAULT_ERROR_RATE_THRESHOLD}% or more of completions fail. Retry error traces from the Traces page to lower this.`}
              threshold={String(DEFAULT_ERROR_RATE_THRESHOLD)}
              currentValue={String(errorRate)}
              unit="%"
              breached={errorBreached}
              icon={Zap}
            />
          </div>

          {/* Error trace quick-action */}
          {errorBreached && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-200">How to fix this</p>
                <p className="mt-0.5 text-xs text-slate-500 leading-5">
                  Go to <span className="text-cyan-300 font-medium">Traces</span>, click any red error row to expand it,
                  then hit <span className="font-mono text-cyan-300 bg-white/[0.04] px-1 rounded">Fix — retry this prompt via Groq</span>.
                  The new success trace records immediately and the error rate recalculates within 5 seconds.
                </p>
              </div>
            </div>
          )}

          {/* Snapshot grid */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#111925]/90 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">Live snapshot</h2>
              <span className="text-[10px] text-slate-600 font-mono">
                {statsQuery.isFetching ? (
                  <span className="flex items-center gap-1.5 text-cyan-300">
                    <RefreshCw className="h-3 w-3 animate-spin" /> refreshing…
                  </span>
                ) : (
                  `last check ${secsSinceUpdate}s ago`
                )}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              {[
                { label: "Total calls",     value: String(stats?.totalCalls ?? 0),   ok: true },
                { label: "Avg latency",     value: `${stats?.averageLatency ?? 0}ms`, ok: (stats?.averageLatency ?? 0) <= DEFAULT_LATENCY_THRESHOLD_MS },
                { label: "Success latency", value: `${stats?.successLatency ?? 0}ms`, ok: true },
                { label: "P95 latency",     value: `${p95}ms`,                        ok: !latencyBreached },
                { label: "Error rate",      value: `${errorRate}%`,                   ok: !errorBreached },
                { label: "Total tokens",    value: stats?.totalTokens ? `${(stats.totalTokens / 1000).toFixed(1)}k` : "0", ok: true },
              ].map(({ label, value, ok }) => (
                <div key={label} className="rounded-xl bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-widest text-slate-600">{label}</p>
                  <p className={`mt-1 font-mono font-medium transition-colors duration-300 ${ok ? "text-slate-200" : "text-rose-300"}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Config note */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-xs text-slate-500 leading-5">
            <p className="font-semibold text-slate-400 mb-1">Changing thresholds</p>
            <p>
              Thresholds are defined in{" "}
              <code className="font-mono text-slate-400 bg-white/[0.04] px-1 py-0.5 rounded">server/observability.ts</code>.
              Update <code className="font-mono text-slate-400 bg-white/[0.04] px-1 py-0.5 rounded">DEFAULT_LATENCY_THRESHOLD_MS</code> and{" "}
              <code className="font-mono text-slate-400 bg-white/[0.04] px-1 py-0.5 rounded">DEFAULT_ERROR_RATE_THRESHOLD</code> to match your SLOs.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
