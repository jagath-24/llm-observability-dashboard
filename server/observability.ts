import { randomUUID } from "node:crypto";
import { invokeLLM } from "./_core/llm";
import { InsertLlmCall, LlmCall } from "../drizzle/schema";
import { getLlmCallById, insertLlmCall, listLlmCalls } from "./db";

export const INPUT_COST_PER_1K = 0.005;
export const OUTPUT_COST_PER_1K = 0.015;
export const DEFAULT_LATENCY_THRESHOLD_MS = 1200;
export const DEFAULT_ERROR_RATE_THRESHOLD = 5;

export type CallStatus = "success" | "error";
export type CallLogInput = {
  provider?: string;
  model: string;
  service: string;
  endpoint: string;
  prompt: string;
  response?: string | null;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  status: CallStatus;
  errorMessage?: string | null;
  traceId?: string;
  createdAt?: Date;
};

const runtimeCalls: LlmCall[] = [
  { id: 9001, traceId: "tr_7c11a9", provider: "groq", model: "openai/gpt-oss-120b", service: "hallucination-rag", endpoint: "/api/rag/answer", prompt: "Summarize the supported evidence for the retrieval query.", response: "The answer is grounded in 3 retrieved chunks.", latencyMs: 684, promptTokens: 482, completionTokens: 96, totalTokens: 578, estimatedCost: "0.00385", status: "success", errorMessage: null, createdAt: new Date(Date.now() - 1000 * 60 * 18) },
  { id: 9002, traceId: "tr_19f3b2", provider: "groq", model: "openai/gpt-oss-120b", service: "hallucination-rag", endpoint: "/api/rag/answer", prompt: "Check whether this claim is supported by context.", response: "Insufficient evidence; the claim is flagged.", latencyMs: 1410, promptTokens: 714, completionTokens: 144, totalTokens: 858, estimatedCost: "0.00573", status: "success", errorMessage: null, createdAt: new Date(Date.now() - 1000 * 60 * 42) },
  { id: 9003, traceId: "tr_5d63ee", provider: "groq", model: "qwen/qwen3.8-27b", service: "hallucination-rag", endpoint: "/api/rag/answer", prompt: "Answer from the supplied context only.", response: null, latencyMs: 1918, promptTokens: 364, completionTokens: 0, totalTokens: 364, estimatedCost: "0.00182", status: "error", errorMessage: "Upstream timeout after 1,900 ms", createdAt: new Date(Date.now() - 1000 * 60 * 68) },
  { id: 9004, traceId: "tr_0b8d4a", provider: "groq", model: "openai/gpt-oss-120b", service: "hallucination-rag", endpoint: "/api/rag/answer", prompt: "Identify unsupported statements in the draft.", response: "2 claims need citations before shipping.", latencyMs: 768, promptTokens: 628, completionTokens: 119, totalTokens: 747, estimatedCost: "0.00492", status: "success", errorMessage: null, createdAt: new Date(Date.now() - 1000 * 60 * 92) },
  { id: 9005, traceId: "tr_12a7bc", provider: "groq", model: "openai/gpt-oss-120b", service: "hallucination-rag", endpoint: "/api/rag/answer", prompt: "Explain why the answer is grounded.", response: "Each sentence maps to a retrieved source span.", latencyMs: 612, promptTokens: 530, completionTokens: 88, totalTokens: 618, estimatedCost: "0.00397", status: "success", errorMessage: null, createdAt: new Date(Date.now() - 1000 * 60 * 118) },
];

export function estimateTokens(value: string | null | undefined): number {
  if (!value) return 0;
  const words = value.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words * 1.33));
}

export function estimateCost(promptTokens: number, completionTokens: number): number {
  return Number(((promptTokens / 1000) * INPUT_COST_PER_1K + (completionTokens / 1000) * OUTPUT_COST_PER_1K).toFixed(6));
}

function normalizeResponse(response: unknown): string | null {
  if (response == null) return null;
  if (typeof response === "string") return response;
  try {
    return JSON.stringify(response);
  } catch {
    return String(response);
  }
}

export async function recordLlmCall(input: CallLogInput): Promise<LlmCall> {
  const promptTokens = input.promptTokens ?? estimateTokens(input.prompt);
  const completionTokens = input.completionTokens ?? estimateTokens(input.response);
  const response = normalizeResponse(input.response);
  const call: InsertLlmCall = {
    traceId: input.traceId ?? `tr_${randomUUID().replaceAll("-", "").slice(0, 10)}`,
    provider: input.provider ?? "groq",
    model: input.model,
    service: input.service,
    endpoint: input.endpoint,
    prompt: input.prompt,
    response,
    latencyMs: input.latencyMs,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimatedCost: estimateCost(promptTokens, completionTokens).toFixed(6),
    status: input.status,
    errorMessage: input.errorMessage ?? null,
    createdAt: input.createdAt ?? new Date(),
  };

  const persisted = await insertLlmCall(call);
  if (persisted) return persisted;
  const fallback = { ...call, id: 10000 + runtimeCalls.length } as LlmCall;
  runtimeCalls.unshift(fallback);
  return fallback;
}

export async function observedLlmCall<T>(
  input: Omit<CallLogInput, "response" | "latencyMs" | "promptTokens" | "completionTokens" | "status" | "errorMessage">,
  operation: () => Promise<{ result: T; responseText?: string; promptTokens?: number; completionTokens?: number }>,
): Promise<{ result: T; call: LlmCall }> {
  const started = performance.now();
  try {
    const output = await operation();
    const call = await recordLlmCall({
      ...input,
      response: output.responseText ?? normalizeResponse(output.result),
      latencyMs: Math.round(performance.now() - started),
      promptTokens: output.promptTokens,
      completionTokens: output.completionTokens,
      status: "success",
    });
    return { result: output.result, call };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown LLM error";
    const call = await recordLlmCall({
      ...input,
      response: null,
      latencyMs: Math.round(performance.now() - started),
      status: "error",
      errorMessage: message,
    });
    throw Object.assign(error instanceof Error ? error : new Error(message), { observabilityCall: call });
  }
}

function fallbackOrPersisted(calls: LlmCall[]): LlmCall[] {
  return calls.length > 0 ? calls : runtimeCalls;
}

export async function getObservabilityCalls(limit = 100): Promise<LlmCall[]> {
  const persisted = await listLlmCalls(Math.min(Math.max(limit, 1), 500));
  return fallbackOrPersisted(persisted).slice(0, limit);
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export async function getObservabilityStats() {
  const calls = await getObservabilityCalls(500);
  const totalCalls = calls.length;
  const errors = calls.filter(call => call.status === "error").length;
  const successful = calls.filter(call => call.status === "success");
  const totalTokens = calls.reduce((sum, call) => sum + call.totalTokens, 0);
  const totalCost = calls.reduce((sum, call) => sum + Number(call.estimatedCost), 0);
  const latencies = calls.map(call => call.latencyMs).sort((a, b) => a - b);
  const p95Index = Math.max(0, Math.ceil(latencies.length * 0.95) - 1);
  const averageLatency = totalCalls ? calls.reduce((sum, call) => sum + call.latencyMs, 0) / totalCalls : 0;
  const successLatency = successful.length ? successful.reduce((sum, call) => sum + call.latencyMs, 0) / successful.length : 0;
  const byDay = new Map<string, { calls: number; errors: number; tokens: number; cost: number; latency: number }>();
  for (const call of calls) {
    const day = new Date(call.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const entry = byDay.get(day) ?? { calls: 0, errors: 0, tokens: 0, cost: 0, latency: 0 };
    entry.calls += 1;
    entry.errors += call.status === "error" ? 1 : 0;
    entry.tokens += call.totalTokens;
    entry.cost += Number(call.estimatedCost);
    entry.latency += call.latencyMs;
    byDay.set(day, entry);
  }
  const timeseries = Array.from(byDay.entries()).reverse().map(([date, value]) => ({
    date,
    calls: value.calls,
    errorRate: round((value.errors / value.calls) * 100),
    tokens: value.tokens,
    cost: round(value.cost, 4),
    latency: Math.round(value.latency / value.calls),
  }));
  return {
    totalCalls,
    errorRate: round(totalCalls ? (errors / totalCalls) * 100 : 0),
    totalTokens,
    totalCost: round(totalCost, 4),
    averageLatency: Math.round(averageLatency),
    successLatency: Math.round(successLatency),
    p95Latency: latencies.length ? latencies[p95Index] : 0,
    timeseries,
    alerts: {
      highLatency: (latencies.length ? latencies[p95Index] : 0) > DEFAULT_LATENCY_THRESHOLD_MS,
      elevatedErrors: (totalCalls ? (errors / totalCalls) * 100 : 0) >= DEFAULT_ERROR_RATE_THRESHOLD,
    },
  };
}

export async function getObservabilityCosts() {
  const calls = await getObservabilityCalls(500);
  const byEndpoint = new Map<string, { endpoint: string; service: string; cost: number; tokens: number; calls: number }>();
  const byModel = new Map<string, { model: string; cost: number; tokens: number; calls: number }>();
  for (const call of calls) {
    const endpoint = byEndpoint.get(call.endpoint) ?? { endpoint: call.endpoint, service: call.service, cost: 0, tokens: 0, calls: 0 };
    endpoint.cost += Number(call.estimatedCost);
    endpoint.tokens += call.totalTokens;
    endpoint.calls += 1;
    byEndpoint.set(call.endpoint, endpoint);
    const model = byModel.get(call.model) ?? { model: call.model, cost: 0, tokens: 0, calls: 0 };
    model.cost += Number(call.estimatedCost);
    model.tokens += call.totalTokens;
    model.calls += 1;
    byModel.set(call.model, model);
  }
  return {
    totalCost: round(calls.reduce((sum, call) => sum + Number(call.estimatedCost), 0), 4),
    byEndpoint: Array.from(byEndpoint.values()).map(item => ({ ...item, cost: round(item.cost, 4) })).sort((a, b) => b.cost - a.cost),
    byModel: Array.from(byModel.values()).map(item => ({ ...item, cost: round(item.cost, 4) })).sort((a, b) => b.cost - a.cost),
  };
}

export async function runRagDemo(question: string) {
  const context = [
    "Source A — Retrieval quality: The answerer must cite retrieved chunks and abstain when evidence is insufficient.",
    "Source B — Evaluation rule: A claim is grounded only when a retrieved span entails the claim, not merely when it is topically related.",
    "Source C — Production guardrail: Log latency, token usage, model, prompt, response, and endpoint for every completion.",
  ].join("\\n");
  const prompt = `You are the Hallucination-Aware RAG answerer. Answer only from the context. If the context is insufficient, say so clearly.\\n\\nContext:\\n${context}\\n\\nQuestion: ${question}`;
  const model = "openai/gpt-oss-120b";
  const observed = await observedLlmCall(
    { provider: "groq", model, service: "hallucination-rag", endpoint: "/api/rag/answer", prompt },
    async () => {
      const result = await invokeLLM({
        model,
        messages: [
          { role: "system", content: "You are a precise, citation-aware RAG assistant. Never invent evidence." },
          { role: "user", content: prompt },
        ],
        maxTokens: 260,
      });
      const message = result.choices[0]?.message?.content;
      const responseText = typeof message === "string" ? message : JSON.stringify(message ?? "");
      return { result: responseText, responseText, promptTokens: result.usage?.prompt_tokens, completionTokens: result.usage?.completion_tokens };
    },
  );
  return { answer: observed.result, call: observed.call, model };
}

export async function retryTrace(originalId: number): Promise<{ original: LlmCall; retried: LlmCall }> {
  // Try DB first, fall back to in-memory seed data
  let original: LlmCall | undefined = await getLlmCallById(originalId);
  const isInMemory = !original;
  if (!original) {
    original = runtimeCalls.find(c => c.id === originalId);
  }
  if (!original) {
    throw new Error(`Trace with id ${originalId} not found.`);
  }
  if (original.status !== "error") {
    throw new Error("Only error traces can be retried.");
  }

  const model = original.model;
  const observed = await observedLlmCall(
    {
      provider: original.provider,
      model,
      service: original.service,
      endpoint: original.endpoint,
      prompt: original.prompt,
      traceId: `${original.traceId}_retry`,
    },
    async () => {
      const result = await invokeLLM({
        model,
        messages: [
          { role: "system", content: "You are a precise, citation-aware RAG assistant. Never invent evidence." },
          { role: "user", content: original!.prompt },
        ],
        maxTokens: 260,
      });
      const message = result.choices[0]?.message?.content;
      const responseText = typeof message === "string" ? message : JSON.stringify(message ?? "");
      return {
        result: responseText,
        responseText,
        promptTokens: result.usage?.prompt_tokens,
        completionTokens: result.usage?.completion_tokens,
      };
    },
  );

  // For in-memory mode: patch the original error entry to success so stats
  // immediately reflect the fix — the error no longer counts toward error rate.
  if (isInMemory) {
    const idx = runtimeCalls.findIndex(c => c.id === originalId);
    if (idx !== -1) {
      runtimeCalls[idx] = {
        ...runtimeCalls[idx],
        status: "success",
        response: observed.call.response,
        errorMessage: null,
        latencyMs: observed.call.latencyMs,
        completionTokens: observed.call.completionTokens,
        totalTokens: observed.call.totalTokens,
        estimatedCost: observed.call.estimatedCost,
      };
    }
  }

  return { original, retried: observed.call };
}
