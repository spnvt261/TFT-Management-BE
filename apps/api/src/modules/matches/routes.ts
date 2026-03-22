import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../../core/types/api.js";
import type { AppServices } from "../../core/types/container.js";
import { moduleTypeSchema } from "../../domain/models/enums.js";

const createMatchSchema = z.object({
  module: moduleTypeSchema,
  playedAt: z.string().datetime(),
  ruleSetId: z.string().uuid(),
  ruleSetVersionId: z.string().uuid().optional(),
  note: z.string().max(4000).nullable().optional(),
  participants: z
    .array(
      z.object({
        playerId: z.string().uuid(),
        tftPlacement: z.number().int()
      })
    )
    .min(3)
    .max(4)
});

const listMatchesQuerySchema = z.object({
  module: moduleTypeSchema.optional(),
  playerId: z.string().uuid().optional(),
  ruleSetId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

const voidMatchSchema = z.object({
  reason: z.string().min(3).max(500)
});

export async function registerMatchRoutes(app: FastifyInstance, services: AppServices): Promise<void> {
  app.post("/matches", async (request, reply) => {
    const input = createMatchSchema.parse(request.body);
    const result = await services.matches.createMatch(input);
    reply.status(201);
    return ok(result);
  });

  app.get("/matches", async (request) => {
    const query = listMatchesQuerySchema.parse(request.query);
    const result = await services.matches.listMatches(query);

    return ok(result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / query.pageSize)
    });
  });

  app.get("/matches/:matchId", async (request) => {
    const params = z.object({ matchId: z.string().uuid() }).parse(request.params);
    return ok(await services.matches.getMatchDetail(params.matchId));
  });

  app.post("/matches/:matchId/void", async (request) => {
    const params = z.object({ matchId: z.string().uuid() }).parse(request.params);
    const body = voidMatchSchema.parse(request.body);

    return ok(await services.matches.voidMatch(params.matchId, body.reason));
  });
}
