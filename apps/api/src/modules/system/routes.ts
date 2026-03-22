import type { FastifyInstance } from "fastify";
import { ok } from "../../core/types/api.js";
import { nowIso } from "../../lib/time/date.js";

export async function registerSystemRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    return ok({
      status: "ok",
      service: "tft-history-api",
      timestamp: nowIso()
    });
  });
}
