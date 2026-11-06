import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  DollarSign,
  Gauge,
  Layers3,
  Menu,
  Play,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  TimerReset,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import CostControl from "./CostControl";
import Guardrails from "./Guardrails";
import Integrations from "./Integrations";
import Models from "./Models";
import Traces from "./Traces";

type NavPage = "overview" | "traces" | "models" | "cost" | "integrations" | "guardrails";

const navItems: { label: string; icon: typeof Activity; page: NavPage }[] = [
  { label: "Overview", icon: Activity, page: "overview" },
  { label: "Traces", icon: Layers3, page: "traces" },
  { label: "Models", icon: Bot, page: "models" },
  { label: "Cost control", icon: DollarSign, page: "cost" },
];

const systemItems: { label: string; icon: typeof Activity; page: NavPage }[] = [
  { label: "Integrations", icon: Server, page: "integrations" },
  { label: "Guardrails", icon: ShieldCheck, page: "guardrails" },
];

const pageLabels: Record<NavPage, string> = {
  overview: "overview",
  traces: "traces",
  models: "models",
  cost: "cost control",
  integrations: "integrations",
  guardrails: "guardrails",
};

const chartTooltipStyle = {
  background: "#111a28",
  border: "1px solid rgba(148, 163, 184, 0.16)",
  borderRadius: "10px",
  color: "#e2e8f0",
  fontSize: "12px",
};

function formatCompact(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString();
}

function formatTime(value: Date | string | number) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function StatCard({
  label, value, detail, icon: Icon, tone, trend,
}: {
  label: string; value: string; detail: string;
  icon: typeof Activity; tone: string; trend?: "up" | "down";
}) {
  return (
    <div className="metric-card group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111925]/90 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <div className={`absolute -right-6 -top-8 h-24 w-24 rounded-full blur-3xl opacity-20 ${tone}`} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="mt-3 font-mono text-[28px] font-medium tracking-[-0.04em] text-slate-100">{value}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            {trend === "up" && <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />}
            {trend === "down" && <ArrowDownRight className="h-3.5 w-3.5 text-rose-400" />}
            <span>{detail}</span>
          </div>
        </div>
        <div className={`rounded-xl border border-white/[0.08] bg-white/[0.04] p-2.5 ${tone.replace("bg-", "text-")}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

// Sidebar nav list — shared between desktop aside and mobile drawer
function NavList({
  page,
  onNavigate,
}: {
  page: NavPage;
  onNavigate: (p: NavPage) => void;
}) {
  return (
    <>
      <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">Workspace</p>
      <nav className="mt-3 space-y-1">
        {navItems.map(item => (
          <button
            key={item.page}
            onClick={() => onNavigate(item.page)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
              page === item.page
                ? "bg-cyan-300/[0.09] text-cyan-200"
                : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
            {page === item.page && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_#67e8f9]" />
            )}
          </button>
        ))}
      </nav>
      <p className="mt-8 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">System</p>
      <nav className="mt-3 space-y-1">
        {systemItems.map(item => (
          <button
            key={item.page}
            onClick={() => onNavigate(item.page)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
              page === item.page
                ? "bg-cyan-300/[0.09] text-cyan-200"
                : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
            {page === item.page && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_#67e8f9]" />
            )}
          </button>
        ))}
      </nav>
    </>
  );
}

export default function Home() {
  const [page, setPage] = useState<NavPage>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [question, setQuestion] = useState("What makes a RAG answer trustworthy in production?");
  const [demoAnswer, setDemoAnswer] = useState<string | null>(null);
  const [demoTrace, setDemoTrace] = useState<{ latencyMs: number; traceId: string } | null>(null);

  const statsQuery = trpc.observability.stats.useQuery(undefined, { refetchInterval: 30000 });
  const callsQuery = trpc.observability.calls.useQuery({ limit: 30 }, { refetchInterval: 30000 });
  const costsQuery = trpc.observability.costs.useQuery(undefined, { refetchInterval: 30000 });
  const utils = trpc.useUtils();

  const demoMutation = trpc.observability.runDemo.useMutation({
    onSuccess: result => {
      setDemoAnswer(result.answer);
      setDemoTrace({ latencyMs: result.call.latencyMs, traceId: result.call.traceId });
      void utils.observability.stats.invalidate();
      void utils.observability.calls.invalidate();
      void utils.observability.costs.invalidate();
    },
  });

  const stats = statsQuery.data;
  const calls = callsQuery.data ?? [];
  const costs = costsQuery.data;
  const chartData = stats?.timeseries ?? [];
  const endpointData = costs?.byEndpoint ?? [];
  const isRefreshing = statsQuery.isFetching || callsQuery.isFetching || costsQuery.isFetching;
  const maxEndpointCost = useMemo(
    () => Math.max(...endpointData.map(item => item.cost), 0.001),
    [endpointData],
  );

  const searchRef = useRef<HTMLButtonElement>(null);

  // ⌘K / Ctrl+K focuses the search box and navigates to Traces
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPage("traces");
        // Wait for the Traces page to mount before focusing
        requestAnimationFrame(() => {
          const input = document.querySelector<HTMLInputElement>("[data-traces-search]");
          input?.focus();
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close mobile drawer on page change
  const navigate = (p: NavPage) => {
    setPage(p);
    setMobileOpen(false);
  };

  const refreshAll = () => {
    void statsQuery.refetch();
    void callsQuery.refetch();
    void costsQuery.refetch();
  };

  return (
    <div className="min-h-screen bg-[#090e16] text-slate-200">

      {/* ── Mobile nav drawer ─────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          {/* Sheet */}
          <aside className="absolute inset-y-0 left-0 flex w-[260px] flex-col border-r border-white/[0.06] bg-[#0c131e] shadow-2xl">
            <div className="flex h-[76px] items-center justify-between border-b border-white/[0.06] px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-300 to-blue-600 text-[#08111c] shadow-[0_0_28px_rgba(34,211,238,0.28)]">
                  <Activity className="h-4 w-4" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="font-mono text-sm font-semibold tracking-[-0.04em] text-white">
                    signal<span className="text-cyan-300">/</span>atlas
                  </div>
                  <div className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-slate-600">LLM observability</div>
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.07] hover:text-slate-200 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-7">
              <NavList page={page} onNavigate={navigate} />
            </div>
            <div className="m-3 rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.05] p-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> Live pipeline
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">Spring AOP interceptor attached.</p>
              <div className="mt-3 font-mono text-[10px] text-slate-600">groq · mysql · v1.4.0</div>
            </div>
          </aside>
        </div>
      )}

      {/* ── Desktop sidebar ───────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[232px] flex-col border-r border-white/[0.06] bg-[#0c131e] lg:flex">
        <div className="flex h-[76px] items-center gap-3 border-b border-white/[0.06] px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-300 to-blue-600 text-[#08111c] shadow-[0_0_28px_rgba(34,211,238,0.28)]">
            <Activity className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-mono text-sm font-semibold tracking-[-0.04em] text-white">
              signal<span className="text-cyan-300">/</span>atlas
            </div>
            <div className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-slate-600">LLM observability</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-7">
          <NavList page={page} onNavigate={navigate} />
        </div>
        <div className="m-3 rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.05] p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> Live pipeline
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">Spring AOP interceptor is attached to the RAG demo.</p>
          <div className="mt-3 font-mono text-[10px] text-slate-600">groq · mysql · v1.4.0</div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <main className="lg:pl-[232px]">
        {/* Top header */}
        <header className="flex h-[76px] items-center justify-between border-b border-white/[0.06] bg-[#0a1019]/80 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="mr-1 rounded-lg border border-white/[0.08] p-2 text-slate-500 transition hover:bg-white/[0.07] hover:text-slate-200 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="font-mono text-slate-300">workspace</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span>production / {pageLabels[page]}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Search — navigates to Traces and focuses the search input */}
            <button
              ref={searchRef}
              onClick={() => { setPage("traces"); requestAnimationFrame(() => { document.querySelector<HTMLInputElement>("[data-traces-search]")?.focus(); }); }}
              className="hidden items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-slate-600 sm:flex hover:bg-white/[0.05] hover:text-slate-400 transition"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search traces</span>
              <kbd className="ml-4 rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
            </button>
            <button
              aria-label="Refresh dashboard"
              onClick={refreshAll}
              className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-2 text-slate-500 transition hover:bg-white/[0.07] hover:text-slate-200 active:scale-95"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
            <div className="flex items-center gap-2 border-l border-white/[0.08] pl-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-300 to-fuchsia-500 font-mono text-xs font-semibold text-[#100d1d]">
                AK
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-medium text-slate-300">Aarav K.</div>
                <div className="text-[10px] text-slate-600">owner</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page body */}
        <div className="signal-grid min-h-[calc(100vh-76px)] px-5 py-8 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-[1440px]">

            {/* Sub-pages */}
            {page === "traces"       && <Traces />}
            {page === "models"       && <Models />}
            {page === "cost"         && <CostControl />}
            {page === "integrations" && <Integrations />}
            {page === "guardrails"   && <Guardrails />}

            {/* ── Overview ──────────────────────────────────────────── */}
            {page === "overview" && (
              <>
                <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
                  <div>
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#67e8f9]" />
                      System health / nominal
                    </div>
                    <h1 className="text-3xl font-semibold tracking-[-0.045em] text-white sm:text-[40px]">
                      LLM observability
                    </h1>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                      One operational view across every prompt, completion, token, and dollar in your AI stack.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden text-xs text-slate-600 md:inline">Updated just now</span>
                    <button
                      onClick={() => document.getElementById("live-demo")?.scrollIntoView({ behavior: "smooth" })}
                      className="flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-semibold text-[#07131c] shadow-[0_0_24px_rgba(103,232,249,0.16)] transition hover:bg-cyan-200 active:scale-[0.98]"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" /> Run live demo
                    </button>
                  </div>
                </section>

                {/* Alert banners */}
                {(stats?.alerts.highLatency || stats?.alerts.elevatedErrors) && (
                  <section className="mt-7 grid gap-3 md:grid-cols-2">
                    {stats.alerts.highLatency && (
                      <div className="flex items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                        <div>
                          <p className="text-xs font-semibold text-amber-200">Latency threshold crossed</p>
                          <p className="mt-1 text-xs text-amber-100/50">
                            P95 is {stats.p95Latency}ms — above the 1,200ms production threshold.
                          </p>
                        </div>
                      </div>
                    )}
                    {stats.alerts.elevatedErrors && (
                      <div className="flex items-start gap-3 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                        <div>
                          <p className="text-xs font-semibold text-rose-200">Error rate needs attention</p>
                          <p className="mt-1 text-xs text-rose-100/50">
                            {stats.errorRate}% of recorded completions are failing.
                          </p>
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {/* KPI cards */}
                <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Total calls" value={formatCompact(stats?.totalCalls ?? 0)} detail="vs. previous window" icon={Zap} tone="bg-cyan-400" trend="up" />
                  <StatCard label="Error rate" value={`${stats?.errorRate ?? 0}%`} detail="target below 5%" icon={Gauge} tone="bg-rose-400" trend={stats?.errorRate && stats.errorRate > 5 ? "up" : "down"} />
                  <StatCard label="Avg. latency" value={`${stats?.averageLatency ?? 0}ms`} detail={`p95 ${stats?.p95Latency ?? 0}ms`} icon={Clock3} tone="bg-violet-400" trend={stats?.averageLatency && stats.averageLatency > 1000 ? "up" : "down"} />
                  <StatCard label="Simulated spend" value={`$${(stats?.totalCost ?? 0).toFixed(4)}`} detail="OpenAI-equivalent pricing" icon={DollarSign} tone="bg-amber-400" trend="up" />
                </section>

                {/* Charts row */}
                <section className="mt-5 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
                  {/* Latency + throughput */}
                  <div className="rounded-2xl border border-white/[0.07] bg-[#111925]/90 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <TimerReset className="h-4 w-4 text-cyan-300" />
                          <h2 className="text-sm font-semibold text-slate-200">Latency &amp; throughput</h2>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">Daily completion health across the active window</p>
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> latency</span>
                        <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-violet-300" /> calls</span>
                      </div>
                    </div>
                    <div className="mt-6 h-[230px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="latencyFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#67e8f9" stopOpacity={0.22} />
                              <stop offset="100%" stopColor="#67e8f9" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="callsFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#c4b5fd" stopOpacity={0.16} />
                              <stop offset="100%" stopColor="#c4b5fd" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.08)" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#526176", fontSize: 10 }} />
                          <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: "#526176", fontSize: 10 }} />
                          <YAxis yAxisId="right" orientation="right" hide />
                          <Tooltip contentStyle={chartTooltipStyle} cursor={{ stroke: "rgba(103,232,249,0.25)" }} />
                          <Area yAxisId="left" type="monotone" dataKey="latency" stroke="#67e8f9" strokeWidth={2} fill="url(#latencyFill)" name="Latency (ms)" />
                          <Area yAxisId="right" type="monotone" dataKey="calls" stroke="#c4b5fd" strokeWidth={1.5} fill="url(#callsFill)" name="Calls" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4 text-[11px] text-slate-600">
                      <span>Threshold <span className="font-mono text-amber-300/80">1,200ms</span></span>
                      <span>p95 <span className="font-mono text-slate-300">{stats?.p95Latency ?? 0}ms</span></span>
                      <span>success avg <span className="font-mono text-emerald-300/80">{stats?.successLatency ?? 0}ms</span></span>
                    </div>
                  </div>

                  {/* Cost by endpoint */}
                  <div className="rounded-2xl border border-white/[0.07] bg-[#111925]/90 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-amber-300" />
                          <h2 className="text-sm font-semibold text-slate-200">Cost by endpoint</h2>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">Simulated paid-tier economics</p>
                      </div>
                      <span className="rounded-md border border-amber-300/15 bg-amber-300/[0.06] px-2 py-1 font-mono text-[10px] text-amber-200">USD</span>
                    </div>
                    <div className="mt-6 h-[230px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={endpointData} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
                          <CartesianGrid horizontal={false} stroke="rgba(148,163,184,0.08)" />
                          <XAxis type="number" hide domain={[0, maxEndpointCost]} />
                          <YAxis type="category" dataKey="endpoint" axisLine={false} tickLine={false} tick={{ fill: "#7e8da3", fontSize: 10 }} width={108} />
                          <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} formatter={(value: number) => [`$${value.toFixed(4)}`, "cost"]} />
                          <Bar dataKey="cost" radius={[0, 5, 5, 0]} barSize={22}>
                            {endpointData.map((entry, index) => (
                              <Cell key={entry.endpoint} fill={index === 0 ? "#fbbf24" : "#64748b"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 border-t border-white/[0.06] pt-4 text-[11px] text-slate-600">
                      Highest spend <span className="font-mono text-slate-300">{endpointData[0]?.endpoint ?? "—"}</span>
                    </div>
                  </div>
                </section>

                {/* Recent traces + live demo */}
                <section className="mt-5 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
                  {/* Recent traces table */}
                  <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111925]/90 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
                    <div className="flex items-start justify-between border-b border-white/[0.06] p-5 sm:p-6">
                      <div>
                        <div className="flex items-center gap-2">
                          <Terminal className="h-4 w-4 text-violet-300" />
                          <h2 className="text-sm font-semibold text-slate-200">Recent traces</h2>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">Every completion, captured automatically</p>
                      </div>
                      <button
                        onClick={() => setPage("traces")}
                        className="text-xs text-cyan-300 transition hover:text-cyan-200"
                      >
                        View all <ChevronRight className="ml-1 inline h-3 w-3" />
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[650px] text-left">
                        <thead>
                          <tr className="border-b border-white/[0.05] text-[10px] uppercase tracking-[0.14em] text-slate-600">
                            <th className="px-5 py-3 font-semibold sm:px-6">Trace / endpoint</th>
                            <th className="px-3 py-3 font-semibold">Model</th>
                            <th className="px-3 py-3 font-semibold">Latency</th>
                            <th className="px-3 py-3 font-semibold">Tokens</th>
                            <th className="px-5 py-3 text-right font-semibold sm:px-6">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calls.slice(0, 6).map(call => (
                            <tr
                              key={`${call.id}-${call.traceId}`}
                              className="border-b border-white/[0.04] transition hover:bg-white/[0.025] cursor-pointer"
                              onClick={() => setPage("traces")}
                            >
                              <td className="px-5 py-3.5 sm:px-6">
                                <div className="flex items-center gap-2">
                                  <span className={`h-1.5 w-1.5 rounded-full ${call.status === "success" ? "bg-emerald-300" : "bg-rose-300"}`} />
                                  <div>
                                    <div className="font-mono text-xs text-slate-300">{call.traceId}</div>
                                    <div className="mt-1 text-[10px] text-slate-600">{call.endpoint} · {formatTime(call.createdAt)}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3.5">
                                <span className="rounded-md bg-white/[0.04] px-2 py-1 font-mono text-[10px] text-slate-500">
                                  {call.model.split("/").pop()?.replace("-versatile", "") ?? call.model}
                                </span>
                              </td>
                              <td className="px-3 py-3.5 font-mono text-xs text-slate-400">{call.latencyMs}ms</td>
                              <td className="px-3 py-3.5 font-mono text-xs text-slate-400">{formatCompact(call.totalTokens)}</td>
                              <td className="px-5 py-3.5 text-right sm:px-6">
                                {call.status === "success"
                                  ? <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-300/80" />
                                  : <XCircle className="ml-auto h-4 w-4 text-rose-300/80" />}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Live RAG demo */}
                  <div id="live-demo" className="relative overflow-hidden rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-[#142232] via-[#111925] to-[#0d151f] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.2)] sm:p-6">
                    <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-cyan-300/10 blur-3xl" />
                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-cyan-300" />
                          <h2 className="text-sm font-semibold text-slate-100">Live RAG retrofit</h2>
                        </div>
                        <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/[0.07] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> ready
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Ask the Hallucination-Aware RAG service a question. The AOP wrapper records the call automatically.
                      </p>
                      <label htmlFor="rag-question" className="mt-5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                        Question
                      </label>
                      <textarea
                        id="rag-question"
                        value={question}
                        onChange={e => setQuestion(e.target.value)}
                        maxLength={800}
                        rows={4}
                        className="mt-2 min-h-[90px] w-full resize-none rounded-xl border border-white/[0.08] bg-[#09111b]/70 p-3 text-xs leading-5 text-slate-300 outline-none transition placeholder:text-slate-700 focus:border-cyan-300/40"
                      />
                      <div className="mt-0.5 text-right text-[10px] text-slate-700 tabular-nums">
                        {question.length}/800
                      </div>
                      <button
                        disabled={demoMutation.isPending || question.trim().length < 3}
                        onClick={() => demoMutation.mutate({ question })}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 py-2.5 text-xs font-semibold text-[#07131c] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
                      >
                        {demoMutation.isPending
                          ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Calling model…</>
                          : <><Play className="h-3.5 w-3.5 fill-current" /> Run instrumented completion</>}
                      </button>
                      {demoMutation.isError && (
                        <div className="mt-3 flex gap-2 rounded-lg border border-rose-300/15 bg-rose-300/[0.06] p-3 text-[11px] leading-5 text-rose-200">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          {demoMutation.error.message}
                        </div>
                      )}
                      {demoAnswer && (
                        <div className="mt-4 rounded-xl border border-white/[0.07] bg-[#09111b]/70 p-3">
                          <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-cyan-300">
                            <span>Observed response</span>
                            <span className="font-mono text-slate-600">
                              {demoTrace?.latencyMs ?? "—"}ms · {demoTrace?.traceId ?? "pending"}
                            </span>
                          </div>
                          <div className="prose prose-invert max-w-none text-xs leading-5 text-slate-400">
                            <Streamdown>{demoAnswer}</Streamdown>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <footer className="flex flex-col justify-between gap-3 border-t border-white/[0.06] py-8 text-[10px] uppercase tracking-[0.14em] text-slate-700 sm:flex-row">
                  <span>signal/atlas · production telemetry</span>
                  <span>Spring AOP · MySQL · React · Recharts</span>
                </footer>
              </>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
