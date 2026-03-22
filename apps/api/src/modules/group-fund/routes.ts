import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../../core/types/api.js";
import type { AppServices } from "../../core/types/container.js";
import { errorResponseSchemas, paginationMetaSchema, successResponseSchema, toSwaggerSchema } from "../../core/docs/swagger.js";

const querySchema = z.object({
  playerId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

const summaryQuerySchema = z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional() });

const groupFundSummarySchema = z.object({
  module: z.literal("GROUP_FUND"),
  fundBalanceVnd: z.number().int(),
  totalMatches: z.number().int().nonnegative(),
  players: z.array(
    z.object({
      playerId: z.string().uuid(),
      playerName: z.string(),
      totalContributedVnd: z.number().int(),
      currentObligationVnd: z.number().int()
    })
  ),
  range: z.object({
    from: z.string().datetime().nullable(),
    to: z.string().datetime().nullable()
  })
});

const moduleLedgerItemSchema = z.object({
  entry_id: z.string().uuid(),
  posted_at: z.string(),
  match_id: z.string().uuid().nullable(),
  amount_vnd: z.number().int(),
  entry_reason: z.string(),
  source_player_id: z.string().uuid().nullable(),
  source_player_name: z.string().nullable(),
  destination_player_id: z.string().uuid().nullable(),
  destination_player_name: z.string().nullable(),
  rule_code: z.string().nullable(),
  rule_name: z.string().nullable()
});

const moduleMatchHistoryItemSchema = z
  .object({
    id: z.string().uuid(),
    group_id: z.string().uuid().optional(),
    module: z.literal("GROUP_FUND"),
    rule_set_id: z.string().uuid().optional(),
    rule_set_version_id: z.string().uuid().optional(),
    played_at: z.string().optional(),
    participant_count: z.number().int().optional(),
    status: z.string(),
    void_reason: z.string().nullable().optional(),
    voided_at: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    ruleSetId: z.string().uuid().optional(),
    ruleSetVersionId: z.string().uuid().optional(),
    playedAt: z.string().optional(),
    participantCount: z.number().int().optional(),
    voidReason: z.string().nullable().optional(),
    voidedAt: z.string().nullable().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional()
  })
  .passthrough();

export async function registerGroupFundRoutes(app: FastifyInstance, services: AppServices): Promise<void> {
  app.get(
    "/group-fund/summary",
    {
      schema: {
        tags: ["Group Fund"],
        summary: "Get group-fund summary",
        querystring: toSwaggerSchema(summaryQuerySchema),
        response: {
          200: successResponseSchema(groupFundSummarySchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const query = summaryQuerySchema.parse(request.query);
      return ok(await services.groupFund.getSummary(query));
    }
  );

  app.get(
    "/group-fund/ledger",
    {
      schema: {
        tags: ["Group Fund"],
        summary: "List group-fund ledger entries",
        querystring: toSwaggerSchema(querySchema),
        response: {
          200: successResponseSchema(z.array(moduleLedgerItemSchema), paginationMetaSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const query = querySchema.parse(request.query);
      const result = await services.groupFund.getLedger(query);

      return ok(result.items, {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize)
      });
    }
  );

  app.get(
    "/group-fund/matches",
    {
      schema: {
        tags: ["Group Fund"],
        summary: "List group-fund match history",
        querystring: toSwaggerSchema(
          querySchema.extend({
            ruleSetId: z.string().uuid().optional()
          })
        ),
        response: {
          200: successResponseSchema(z.array(moduleMatchHistoryItemSchema), paginationMetaSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
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
    }
  );
}
