import { describe, expect, it } from "vitest";
import { estimateCost, estimateTokens, getObservabilityCosts, getObservabilityStats } from "./observability";

describe("observability estimators", () => {
  it("estimates tokens deterministically when provider usage is absent", () => {
    expect(estimateTokens("one two three four")).toBe(6);
    expect(estimateTokens("")).toBe(0);
  });

  it("calculates simulated paid-tier cost from input and output tokens", () => {
    expect(estimateCost(1000, 1000)).toBe(0.02);
  });
});

describe("observability aggregates", () => {
  it("exposes dashboard stats and threshold alerts from the fallback trace set", async () => {
    const stats = await getObservabilityStats();
    expect(stats.totalCalls).toBeGreaterThan(0);
    expect(stats.totalTokens).toBeGreaterThan(0);
    expect(stats.p95Latency).toBeGreaterThan(0);
    expect(stats.alerts.highLatency).toBe(true);
    expect(stats.alerts.elevatedErrors).toBe(true);
  });

  it("returns endpoint cost rankings", async () => {
    const costs = await getObservabilityCosts();
    expect(costs.totalCost).toBeGreaterThan(0);
    expect(costs.byEndpoint[0]?.endpoint).toBe("/api/rag/answer");
    expect(costs.byModel.length).toBeGreaterThan(0);
  });
});
