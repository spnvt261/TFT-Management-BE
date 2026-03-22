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

const matchStakesSummarySchema = z.object({
  module: z.literal("MATCH_STAKES"),
  players: z.array(
    z.object({
      playerId: z.string().uuid(),
      playerName: z.string(),
      totalNetVnd: z.number().int(),
      totalMatches: z.number().int().nonnegative(),
      firstPlaceCountAmongParticipants: z.number().int().nonnegative(),
      biggestLossCount: z.number().int().nonnegative()
    })
  ),
  debtSuggestions: z.array(z.unknown()),
  totalMatches: z.number().int().nonnegative(),
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
    module: z.literal("MATCH_STAKES"),
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

export async function registerMatchStakesRoutes(app: FastifyInstance, services: AppServices): Promise<void> {
  app.get(
    "/match-stakes/summary",
    {
      schema: {
        tags: ["Match Stakes"],
        summary: "Get match-stakes summary",
        querystring: toSwaggerSchema(summaryQuerySchema),
        response: {
          200: successResponseSchema(matchStakesSummarySchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const query = summaryQuerySchema.parse(request.query);
      return ok(await services.matchStakes.getSummary(query));
    }
  );

  app.get(
    "/match-stakes/ledger",
    {
      schema: {
        tags: ["Match Stakes"],
        summary: "List match-stakes ledger entries",
        querystring: toSwaggerSchema(querySchema),
        response: {
          200: successResponseSchema(z.array(moduleLedgerItemSchema), paginationMetaSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const query = querySchema.parse(request.query);
      const result = await services.matchStakes.getLedger(query);

      return ok(result.items, {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize)
      });
    }
  );

  app.get(
    "/match-stakes/matches",
    {
      schema: {
        tags: ["Match Stakes"],
        summary: "List match-stakes match history",
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

      const result = await services.matchStakes.getMatches(query);

      return ok(result.items, {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize)
      });
    }
  );
}
