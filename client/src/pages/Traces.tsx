import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Filter,
  Layers3,
  Loader2,
  Plus,
  RefreshCw,
  RefreshCcw,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";

type SortKey = "createdAt" | "latencyMs" | "totalTokens" | "estimatedCost";
type SortDir = "asc" | "desc";

function formatTime(value: Date | string | number) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCompact(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString();
}

// ── Field helpers ──────────────────────────────────────────────────────────
function Field({
  label, required, hint, children,
}: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}{required && <span className="ml-0.5 text-rose-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-slate-600">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-white/[0.08] bg-[#09111b]/80 px-3 py-2 text-xs text-slate-300 outline-none placeholder:text-slate-700 focus:border-cyan-300/40 transition disabled:opacity-50";

// ── Retry button for error traces ─────────────────────────────────────────
function RetryRow({
  callId,
  onRetried,
  onRetrySuccess,
}: {
  callId: number;
  onRetried: () => void;
  /** Called after a successful retry so the parent can update the row status */
  onRetrySuccess?: (retriedTraceId: string, answer: string, latencyMs: number) => void;
}) {
  const [result, setResult] = useState<{ latencyMs: number; traceId: string; answer: string } | null>(null);

  const mutation = trpc.observability.retryTrace.useMutation({
    onSuccess: data => {
      const r = {
        latencyMs: data.retried.latencyMs,
        traceId:   data.retried.traceId,
        answer:    data.retried.response ?? "",
      };
      setResult(r);
      onRetried();
      onRetrySuccess?.(r.traceId, r.answer, r.latencyMs);
    },
  });

  if (result) {
    return (
      <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] p-3 space-y-1.5">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" /> Retry succeeded
          <span className="ml-auto font-mono text-slate-500">{result.latencyMs}ms · {result.traceId}</span>
        </div>
        <p className="text-xs text-slate-400 leading-5">{result.answer}</p>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {mutation.isError && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-300/15 bg-rose-300/[0.06] px-3 py-2 text-[11px] text-rose-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {mutation.error.message}
        </div>
      )}
      <button
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ id: callId })}
        className="flex items-center gap-2 self-start rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/[0.14] disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
      >
        {mutation.isPending ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Retrying via Groq…</>
        ) : (
          <><RefreshCcw className="h-3.5 w-3.5" /> Fix — retry this prompt via Groq</>
        )}
      </button>
      <p className="text-[10px] text-slate-600">
        Re-runs the original prompt through the configured model and records a new success trace.
      </p>
    </div>
  );
}

// ── Trace detail slide-over panel ─────────────────────────────────────────
type TraceLike = {
  id: number;
  traceId: string;
  provider: string;
  model: string;
  service: string;
  endpoint: string;
  prompt: string;
  response: string | null;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: string | number;
  status: "success" | "error";
  errorMessage: string | null;
  createdAt: Date | string;
};

function TraceDetailPanel({
  trace,
  onClose,
  onRetried,
}: {
  trace: TraceLike | null;
  onClose: () => void;
  onRetried: () => void;
}) {
  // Local override so the panel updates immediately after retry without waiting for the refetch
  const [localStatus, setLocalStatus] = useState<"success" | "error" | null>(null);
  const [localResponse, setLocalResponse] = useState<string | null>(null);

  // Reset local overrides when a different trace is selected
  const [lastTraceId, setLastTraceId] = useState<number | null>(null);
  if (trace && trace.id !== lastTraceId) {
    setLastTraceId(trace.id);
    setLocalStatus(null);
    setLocalResponse(null);
  }

  if (!trace) return null;

  const status = localStatus ?? trace.status;
  const response = localResponse ?? trace.response;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <aside className="relative ml-auto flex h-full w-full max-w-[560px] flex-col border-l border-white/[0.07] bg-[#0c131e] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-6 py-5">
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.07] hover:text-slate-200 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  status === "success" ? "bg-emerald-300" : "bg-rose-300"
                }`}
              />
              <h2 className="font-mono text-sm font-semibold text-white truncate">{trace.traceId}</h2>
              <span
                className={`ml-1 shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                  status === "success"
                    ? "bg-emerald-300/10 text-emerald-300"
                    : "bg-rose-300/10 text-rose-300"
                }`}
              >
                {status}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500 truncate">
              {trace.endpoint} · {trace.service}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.07] hover:text-slate-200 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Model", value: trace.model.split("/").pop() ?? trace.model },
              { label: "Provider", value: trace.provider },
              { label: "Latency", value: `${trace.latencyMs}ms`, highlight: trace.latencyMs > 1200 ? "text-amber-300" : undefined },
              { label: "Cost", value: `$${Number(trace.estimatedCost).toFixed(4)}` },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">{label}</p>
                <p className={`mt-1 font-mono text-xs ${highlight ?? "text-slate-300"}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Token counts */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Prompt tokens", value: trace.promptTokens },
              { label: "Completion tokens", value: trace.completionTokens },
              { label: "Total tokens", value: trace.totalTokens },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">{label}</p>
                <p className="mt-1 font-mono text-xs text-slate-300">{value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Timestamp */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <Clock3 className="h-3.5 w-3.5" />
            {new Date(trace.createdAt).toLocaleString([], {
              month: "short", day: "numeric", year: "numeric",
              hour: "2-digit", minute: "2-digit", second: "2-digit",
            })}
          </div>

          {/* Prompt */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 mb-2">Prompt</p>
            <div className="rounded-xl border border-white/[0.06] bg-[#09111b]/80 px-4 py-3">
              <p className="text-xs text-slate-400 leading-6 whitespace-pre-wrap break-words">{trace.prompt}</p>
            </div>
          </div>

          {/* Response / Error */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 mb-2">Response</p>
            {status === "error" ? (
              <div className="rounded-xl border border-rose-300/15 bg-rose-300/[0.05] px-4 py-3 space-y-1">
                <div className="flex items-start gap-2 text-rose-300">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span className="text-xs leading-5">{trace.errorMessage ?? "Unknown error"}</span>
                </div>
                <RetryRow
                  callId={trace.id}
                  onRetried={onRetried}
                  onRetrySuccess={(_retryTraceId, answer) => {
                    setLocalStatus("success");
                    setLocalResponse(answer);
                  }}
                />
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-[#09111b]/80 px-4 py-3">
                <p className="text-xs text-slate-400 leading-6 whitespace-pre-wrap break-words">
                  {response ?? "—"}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

// ── Add Trace slide-over ───────────────────────────────────────────────────
type FormState = {
  provider: string;
  model: string;
  service: string;
  endpoint: string;
  prompt: string;
  response: string;
  latencyMs: string;
  promptTokens: string;
  completionTokens: string;
  status: "success" | "error";
  errorMessage: string;
};

const EMPTY: FormState = {
  provider: "groq",
  model: "",
  service: "",
  endpoint: "",
  prompt: "",
  response: "",
  latencyMs: "",
  promptTokens: "",
  completionTokens: "",
  status: "success",
  errorMessage: "",
};

function validateForm(f: FormState): string | null {
  if (!f.model.trim())    return "Model is required.";
  if (!f.service.trim())  return "Service is required.";
  if (!f.endpoint.trim()) return "Endpoint is required.";
  if (!f.prompt.trim())   return "Prompt is required.";
  const lat = Number(f.latencyMs);
  if (!f.latencyMs || isNaN(lat) || lat < 0 || lat > 600_000)
    return "Latency must be a number between 0 and 600 000 ms.";
  if (f.promptTokens && (isNaN(Number(f.promptTokens)) || Number(f.promptTokens) < 0))
    return "Prompt tokens must be a non-negative number.";
  if (f.completionTokens && (isNaN(Number(f.completionTokens)) || Number(f.completionTokens) < 0))
    return "Completion tokens must be a non-negative number.";
  if (f.status === "error" && !f.errorMessage.trim())
    return "Error message is required when status is 'error'.";
  return null;
}

function AddTracePanel({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = trpc.observability.addTrace.useMutation({
    onSuccess: () => {
      setForm(EMPTY);
      setFormError(null);
      onAdded();
      onClose();
    },
    onError: err => setFormError(err.message),
  });

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateForm(form);
    if (err) { setFormError(err); return; }
    setFormError(null);
    mutation.mutate({
      provider:         form.provider.trim() || "groq",
      model:            form.model.trim(),
      service:          form.service.trim(),
      endpoint:         form.endpoint.trim(),
      prompt:           form.prompt.trim(),
      response:         form.response.trim() || undefined,
      latencyMs:        Number(form.latencyMs),
      promptTokens:     form.promptTokens ? Number(form.promptTokens) : undefined,
      completionTokens: form.completionTokens ? Number(form.completionTokens) : undefined,
      status:           form.status,
      errorMessage:     form.errorMessage.trim() || undefined,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <aside className="relative ml-auto flex h-full w-full max-w-[480px] flex-col border-l border-white/[0.07] bg-[#0c131e] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-5">
          <div>
            <h2 className="text-sm font-semibold text-white">Add trace</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Manually record an LLM call into the observability pipeline.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.07] hover:text-slate-200 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-0 overflow-y-auto"
          noValidate
        >
          <div className="flex-1 space-y-5 px-6 py-6">
            {/* Provider + Model */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Provider">
                <input
                  type="text"
                  value={form.provider}
                  onChange={set("provider")}
                  maxLength={32}
                  placeholder="groq"
                  className={inputCls}
                />
              </Field>
              <Field label="Model" required>
                <input
                  type="text"
                  value={form.model}
                  onChange={set("model")}
                  maxLength={128}
                  placeholder="openai/gpt-oss-120b"
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Service + Endpoint */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Service" required>
                <input
                  type="text"
                  value={form.service}
                  onChange={set("service")}
                  maxLength={128}
                  placeholder="my-service"
                  className={inputCls}
                />
              </Field>
              <Field label="Endpoint" required>
                <input
                  type="text"
                  value={form.endpoint}
                  onChange={set("endpoint")}
                  maxLength={255}
                  placeholder="/api/my/endpoint"
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Prompt */}
            <Field label="Prompt" required hint="The full prompt sent to the model.">
              <textarea
                value={form.prompt}
                onChange={set("prompt")}
                maxLength={8000}
                rows={4}
                placeholder="You are a helpful assistant…"
                className={`${inputCls} resize-y min-h-[90px]`}
              />
              <p className="text-right text-[10px] text-slate-700 tabular-nums">{form.prompt.length}/8000</p>
            </Field>

            {/* Response */}
            <Field label="Response" hint="Leave blank for error traces.">
              <textarea
                value={form.response}
                onChange={set("response")}
                maxLength={8000}
                rows={3}
                placeholder="The model's response…"
                className={`${inputCls} resize-y min-h-[72px]`}
              />
            </Field>

            {/* Latency + Tokens */}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Latency (ms)" required>
                <input
                  type="number"
                  value={form.latencyMs}
                  onChange={set("latencyMs")}
                  min={0}
                  max={600000}
                  placeholder="420"
                  className={inputCls}
                />
              </Field>
              <Field label="Prompt tokens" hint="Optional">
                <input
                  type="number"
                  value={form.promptTokens}
                  onChange={set("promptTokens")}
                  min={0}
                  placeholder="120"
                  className={inputCls}
                />
              </Field>
              <Field label="Compl. tokens" hint="Optional">
                <input
                  type="number"
                  value={form.completionTokens}
                  onChange={set("completionTokens")}
                  min={0}
                  placeholder="48"
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Status */}
            <Field label="Status" required>
              <select
                value={form.status}
                onChange={set("status") as React.ChangeEventHandler<HTMLSelectElement>}
                className={inputCls}
              >
                <option value="success">success</option>
                <option value="error">error</option>
              </select>
            </Field>

            {/* Error message — only when status = error */}
            {form.status === "error" && (
              <Field label="Error message" required hint="Describe what went wrong.">
                <input
                  type="text"
                  value={form.errorMessage}
                  onChange={set("errorMessage")}
                  maxLength={500}
                  placeholder="Upstream timeout after 5000ms"
                  className={inputCls}
                />
              </Field>
            )}

            {/* Validation / mutation errors */}
            {formError && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-3 py-2.5 text-xs text-rose-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {formError}
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/[0.08] px-4 py-2 text-xs text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-2 text-xs font-semibold text-[#07131c] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
            >
              {mutation.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
              ) : (
                <><Plus className="h-3.5 w-3.5" /> Add trace</>
              )}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

// ── Main Traces page ───────────────────────────────────────────────────────
export default function Traces() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "error">("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [panelOpen, setPanelOpen] = useState(false);
  // Trace selected for detail panel
  const [detailTrace, setDetailTrace] = useState<(typeof calls)[number] | null>(null);
  // Local status overrides so badge flips immediately after retry
  const [retried, setRetried] = useState<Set<number>>(new Set());

  const utils = trpc.useUtils();

  const callsQuery = trpc.observability.calls.useQuery(
    { limit: 200 },
    { refetchInterval: 30000 },
  );

  const calls = callsQuery.data ?? [];

  const filtered = useMemo(() => {
    let result = calls;
    if (statusFilter !== "all") result = result.filter(c => c.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        c =>
          c.traceId.toLowerCase().includes(q) ||
          c.endpoint.toLowerCase().includes(q) ||
          c.model.toLowerCase().includes(q) ||
          c.service.toLowerCase().includes(q) ||
          c.prompt.toLowerCase().includes(q),
      );
    }
    return [...result].sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === "createdAt") {
        av = new Date(a.createdAt).getTime();
        bv = new Date(b.createdAt).getTime();
      } else if (sortKey === "estimatedCost") {
        av = Number(a.estimatedCost);
        bv = Number(b.estimatedCost);
      } else {
        av = a[sortKey];
        bv = b[sortKey];
      }
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [calls, search, statusFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return null;
    return sortDir === "desc" ? (
      <ChevronDown className="inline h-3 w-3 ml-0.5 text-cyan-300" />
    ) : (
      <ChevronUp className="inline h-3 w-3 ml-0.5 text-cyan-300" />
    );
  }

  const handleAdded = () => {
    void utils.observability.calls.invalidate();
    void utils.observability.stats.invalidate();
    void utils.observability.costs.invalidate();
    // Refetch immediately so fresh data is in cache before user navigates to Guardrails
    void utils.observability.stats.refetch();
  };

  /** Called when a retry succeeds — flips the row badge immediately */
  const handleRetried = (callId: number) => {
    setRetried(prev => new Set(prev).add(callId));
    handleAdded();
  };

  return (
    <>
      <AddTracePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onAdded={handleAdded}
      />

      <TraceDetailPanel
        trace={detailTrace}
        onClose={() => setDetailTrace(null)}
        onRetried={() => detailTrace && handleRetried(detailTrace.id)}
      />

      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300 mb-1">
              <Layers3 className="h-3.5 w-3.5" /> Traces
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">All completions</h1>
            <p className="text-xs text-slate-500 mt-1">
              {callsQuery.isLoading
                ? "Loading…"
                : `${filtered.length} of ${calls.length} record${calls.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => callsQuery.refetch()}
              disabled={callsQuery.isFetching}
              className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-xs text-slate-400 transition hover:bg-white/[0.07] hover:text-slate-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${callsQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={() => setPanelOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-[#07131c] transition hover:bg-cyan-200 active:scale-[0.98]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add trace
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              placeholder="Search by trace ID, model, endpoint, prompt…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              maxLength={200}
              data-traces-search=""
              className="w-full rounded-xl border border-white/[0.08] bg-[#111925]/90 py-2 pl-9 pr-4 text-xs text-slate-300 outline-none placeholder:text-slate-600 focus:border-cyan-300/40 transition"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-600" />
            {(["all", "success", "error"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs capitalize transition ${
                  statusFilter === s
                    ? "bg-cyan-300/10 text-cyan-200 border border-cyan-300/20"
                    : "border border-white/[0.08] text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111925]/90 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
          {callsQuery.isLoading ? (
            <div className="flex items-center justify-center gap-3 py-20 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading traces…</span>
            </div>
          ) : callsQuery.isError ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <AlertTriangle className="h-6 w-6 text-rose-400" />
              <p className="text-sm text-rose-300">Failed to load traces</p>
              <p className="text-xs text-slate-600">{callsQuery.error.message}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <Layers3 className="h-8 w-8 text-slate-700" />
              {calls.length === 0 ? (
                <>
                  <p className="text-sm text-slate-400">No traces yet</p>
                  <p className="text-xs text-slate-600 max-w-xs">
                    Run the live demo on the Overview page, or add a trace manually.
                  </p>
                  <button
                    onClick={() => setPanelOpen(true)}
                    className="flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-[#07131c] transition hover:bg-cyan-200"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add trace
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-400">No traces match your filters</p>
                  <button
                    onClick={() => { setSearch(""); setStatusFilter("all"); }}
                    className="text-xs text-cyan-300 hover:text-cyan-200"
                  >
                    Clear filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left">
                <thead>
                  <tr className="border-b border-white/[0.05] text-[10px] uppercase tracking-[0.14em] text-slate-600">
                    <th className="px-5 py-3 font-semibold">Trace / endpoint</th>
                    <th className="px-3 py-3 font-semibold">Model</th>
                    <th
                      className="px-3 py-3 font-semibold cursor-pointer hover:text-slate-300"
                      onClick={() => toggleSort("latencyMs")}
                    >
                      Latency <SortIcon k="latencyMs" />
                    </th>
                    <th
                      className="px-3 py-3 font-semibold cursor-pointer hover:text-slate-300"
                      onClick={() => toggleSort("totalTokens")}
                    >
                      Tokens <SortIcon k="totalTokens" />
                    </th>
                    <th
                      className="px-3 py-3 font-semibold cursor-pointer hover:text-slate-300"
                      onClick={() => toggleSort("estimatedCost")}
                    >
                      Cost <SortIcon k="estimatedCost" />
                    </th>
                    <th
                      className="px-3 py-3 font-semibold cursor-pointer hover:text-slate-300"
                      onClick={() => toggleSort("createdAt")}
                    >
                      Time <SortIcon k="createdAt" />
                    </th>
                    <th className="px-5 py-3 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(call => {
                    const effectiveStatus = retried.has(call.id) ? "success" : call.status;
                    return (
                    <Fragment key={call.id}>
                      {/* Main row */}
                      <tr
                        onClick={() => setDetailTrace(call)}
                        className="border-b border-white/[0.04] cursor-pointer transition hover:bg-white/[0.025]"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${effectiveStatus === "success" ? "bg-emerald-300" : "bg-rose-300"}`} />
                            <div>
                              <div className="font-mono text-xs text-slate-300">{call.traceId}</div>
                              <div className="mt-0.5 text-[10px] text-slate-600">
                                {call.endpoint} · {call.service}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className="rounded-md bg-white/[0.04] px-2 py-1 font-mono text-[10px] text-slate-500">
                            {call.model.split("/").pop()?.replace("-versatile", "") ?? call.model}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={`font-mono text-xs ${call.latencyMs > 1200 ? "text-amber-300" : "text-slate-400"}`}>
                            {call.latencyMs}ms
                          </span>
                        </td>
                        <td className="px-3 py-3.5 font-mono text-xs text-slate-400">
                          {formatCompact(call.totalTokens)}
                        </td>
                        <td className="px-3 py-3.5 font-mono text-xs text-slate-400">
                          ${Number(call.estimatedCost).toFixed(4)}
                        </td>
                        <td className="px-3 py-3.5 text-xs text-slate-500">
                          {formatTime(call.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {effectiveStatus === "success"
                            ? <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-300/80" />
                            : <XCircle className="ml-auto h-4 w-4 text-rose-300/80" />}
                        </td>
                      </tr>
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
