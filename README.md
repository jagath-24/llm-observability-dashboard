# signal/atlas — LLM Observability Dashboard

A Langfuse-style production telemetry layer for Groq-compatible LLM calls. The project tracks prompt/response pairs, latency, token usage, simulated paid-tier cost, model, endpoint, service, trace ID, and errors. It ships with a reusable Spring AOP interceptor plus a live Hallucination-Aware RAG demo wired into the same dashboard.

> **Portfolio story:** this is not a standalone charting exercise. The dashboard is designed as the shared operational layer that retrofits the other AI projects in a portfolio: attach one annotation to an existing Groq client method, and every completion becomes queryable through the same traces, latency, cost, and error views.

## What is included

| Layer | Implementation | Why it matters |
| --- | --- | --- |
| Interception | `observability/spring-aop` | Captures every annotated Groq-compatible call without scattering logging code through business services. |
| Persistence | MySQL / Drizzle `llm_calls` table | Keeps prompt, response, status, usage, cost, trace, endpoint, and timestamp in one operational record. |
| Estimation | `TokenCostEstimator` + TypeScript estimator | Uses provider usage when available and falls back to a deterministic word-based estimate. Pricing is simulated at `$0.005 / 1K input` and `$0.015 / 1K output`. |
| API | `GET /api/observability/calls`, `/stats`, `/costs` | REST-compatible endpoints for other internal tools, alongside typed tRPC procedures used by the dashboard. |
| Dashboard | React + Recharts | Latency/throughput trend, cost by endpoint, recent traces, KPI cards, and threshold banners. |
| Live retrofit | `runRagDemo` in `server/observability.ts` | Calls a Groq-compatible Llama model using the project's server-side LLM proxy and records the completion through the same wrapper. |
| Alerting | UI-only banners | Flags P95 latency above `1,200ms` and error rate at or above `5%`. |

## Before / after retrofit

### Before: manual, easy-to-miss logging

```java
public RagAnswer answer(RagRequest request) {
    long started = System.currentTimeMillis();
    try {
        var answer = groqClient.complete(request.prompt());
        // Every new endpoint must remember to duplicate this block.
        telemetry.save(request.prompt(), answer.text(), System.currentTimeMillis() - started);
        return answer;
    } catch (Exception ex) {
        telemetry.saveError(request.prompt(), ex.getMessage());
        throw ex;
    }
}
```

### After: one annotation at the Groq boundary

```java
@LlmObserved(
    service = "hallucination-rag",
    endpoint = "/api/rag/answer",
    provider = "groq",
    model = "llama-3.3-70b-versatile"
)
public RagAnswer answer(RagRequest request) {
    return groqClient.complete(request.prompt());
}
```

`GroqObservabilityAspect` wraps the method, serializes the arguments and result, measures latency, estimates missing token usage, calculates simulated cost, records success/error status, and delegates persistence to `LlmCallLogger`. `JdbcTemplateLlmCallLogger` is the ready-to-use MySQL implementation.

## Live retrofit demo

The dashboard's **Live RAG retrofit** card asks the Hallucination-Aware RAG answerer a question. The server builds a small evidence context, invokes the configured server-side LLM helper with the Groq-compatible `llama-3.3-70b-versatile` model, and calls `observedLlmCall(...)` around it. On success, the dashboard invalidates the calls, stats, and costs queries, so the new trace appears in the table and the KPI values update. On failure, the failed call is still recorded with its error message and latency.

The platform preview may not have a pre-existing Spring Boot application attached, so the live demo is implemented as the working retrofit path in this full-stack project, while the `observability/spring-aop` module is the portable Java integration for an existing Spring Boot/Groq project.

## API contract

```http
GET /api/observability/calls?limit=100
GET /api/observability/stats
GET /api/observability/costs
```

Responses are JSON objects. The dashboard consumes the typed tRPC equivalents:

```text
observability.calls({ limit })
observability.stats()
observability.costs()
observability.runDemo({ question })
```

Example call record:

```json
{
  "traceId": "tr_7c11a9",
  "provider": "groq",
  "model": "llama-3.3-70b-versatile",
  "service": "hallucination-rag",
  "endpoint": "/api/rag/answer",
  "latencyMs": 684,
  "promptTokens": 482,
  "completionTokens": 96,
  "totalTokens": 578,
  "estimatedCost": "0.003850",
  "status": "success"
}
```

## Project layout

```text
client/src/pages/Home.tsx                         # Dashboard UI
server/observability.ts                           # Runtime wrapper, estimators, live RAG demo
server/observabilityRoutes.ts                     # REST routes
server/routers.ts                                 # Typed tRPC procedures
drizzle/schema.ts                                 # MySQL schema and generated types
observability/sql/schema.sql                      # Portable SQL handoff
observability/spring-aop/                         # Reusable Spring AOP module
```

## Run locally

```bash
pnpm install
pnpm dev
```

The managed WebDev environment supplies `DATABASE_URL` and the server-side LLM credentials. The dashboard also has a small in-memory fallback so the UI remains inspectable before the first persisted call; pressing **Run instrumented completion** exercises the live path and persists to MySQL when the database is available.

Validate the project with:

```bash
pnpm check
pnpm test
pnpm build
```

Build the portable Java module with Java 17 and Maven:

```bash
cd observability/spring-aop
mvn test
```

## Production notes

The interceptor deliberately stores both the raw prompt and response because debugging an LLM system requires reproducibility, but a production deployment should add configurable redaction for PII and secrets before persistence. For high-volume systems, move aggregation to SQL or a warehouse, add retention policies, and sample or hash large payloads. The simulated cost model is intentionally provider-neutral and should be replaced with a versioned pricing table when a real billing forecast is required.
