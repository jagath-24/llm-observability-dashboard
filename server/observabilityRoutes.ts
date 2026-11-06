import type { Express, Request, Response } from "express";
import { getObservabilityCalls, getObservabilityCosts, getObservabilityStats } from "./observability";

function readLimit(req: Request) {
  const value = Number(req.query.limit ?? 100);
  return Number.isFinite(value) ? Math.min(Math.max(Math.floor(value), 1), 500) : 100;
}

export function registerObservabilityRoutes(app: Express) {
  app.get("/api/observability/calls", async (req, res) => {
    try {
      res.json({ data: await getObservabilityCalls(readLimit(req)) });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unable to load calls" });
    }
  });
  app.get("/api/observability/stats", async (_req: Request, res: Response) => {
    try {
      res.json({ data: await getObservabilityStats() });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unable to load stats" });
    }
  });
  app.get("/api/observability/costs", async (_req: Request, res: Response) => {
    try {
      res.json({ data: await getObservabilityCosts() });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unable to load costs" });
    }
  });
}
