import type { FastifyInstance } from "fastify";
import { ok } from "../../core/types/api.js";
import { nowIso } from "../../lib/time/date.js";
import { z } from "zod";
import { errorResponseSchemas, successResponseSchema } from "../../core/docs/swagger.js";

const healthDataSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  timestamp: z.string()
});

export async function registerSystemRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/health",
    {
      schema: {
        tags: ["System"],
        summary: "Health check",
        description: "Returns backend service status and current server timestamp.",
        security: [],
        response: {
          200: successResponseSchema(healthDataSchema),
          ...errorResponseSchemas
        }
      }
    },
    async () => {
      return ok({
        status: "ok",
        service: "tft-history-api",
        timestamp: nowIso()
      });
    }
  );
}
