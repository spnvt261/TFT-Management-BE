import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../../core/types/api.js";
import type { AppServices } from "../../core/types/container.js";

const querySchema = z.object({
  playerId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

export async function registerGroupFundRoutes(app: FastifyInstance, services: AppServices): Promise<void> {
  app.get("/group-fund/summary", async (request) => {
    const query = z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional() }).parse(request.query);
    return ok(await services.groupFund.getSummary(query));
  });

  app.get("/group-fund/ledger", async (request) => {
    const query = querySchema.parse(request.query);
    const result = await services.groupFund.getLedger(query);

    return ok(result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / query.pageSize)
    });
  });

  app.get("/group-fund/matches", async (request) => {
    const query = querySchema
      .extend({
        ruleSetId: z.string().uuid().optional()
      })
      .parse(request.query);

    const result = await services.groupFund.getMatches(query);

    return ok(result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / query.pageSize)
    });
  });
}
