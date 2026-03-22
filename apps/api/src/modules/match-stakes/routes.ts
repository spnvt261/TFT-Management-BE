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
  entryId: z.string().uuid(),
  postedAt: z.string(),
  matchId: z.string().uuid().nullable(),
  sourcePlayerId: z.string().uuid().nullable(),
  sourcePlayerName: z.string().nullable(),
  destinationPlayerId: z.string().uuid().nullable(),
  destinationPlayerName: z.string().nullable(),
  amountVnd: z.number().int(),
  entryReason: z.string(),
  ruleCode: z.string().nullable(),
  ruleName: z.string().nullable()
});

const matchParticipantResponseSchema = z.object({
  playerId: z.string().uuid(),
  playerName: z.string(),
  tftPlacement: z.number().int(),
  relativeRank: z.number().int(),
  settlementNetVnd: z.number().int()
});

const moduleMatchHistoryItemSchema = z.object({
  id: z.string().uuid(),
  module: z.literal("MATCH_STAKES"),
  playedAt: z.string(),
  participantCount: z.number().int(),
  ruleSetId: z.string().uuid(),
  ruleSetName: z.string(),
  ruleSetVersionId: z.string().uuid(),
  ruleSetVersionNo: z.number().int().positive(),
  notePreview: z.string().nullable(),
  status: z.string(),
  participants: z.array(matchParticipantResponseSchema),
  totalTransferVnd: z.number().int(),
  totalFundInVnd: z.number().int(),
  totalFundOutVnd: z.number().int(),
  createdAt: z.string()
});

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
      const items = result.items.map((item) => ({
        entryId: item.entry_id,
        postedAt: item.posted_at,
        matchId: item.match_id,
        sourcePlayerId: item.source_player_id,
        sourcePlayerName: item.source_player_name,
        destinationPlayerId: item.destination_player_id,
        destinationPlayerName: item.destination_player_name,
        amountVnd: item.amount_vnd,
        entryReason: item.entry_reason,
        ruleCode: item.rule_code,
        ruleName: item.rule_name
      }));

      return ok(items, {
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

      const result = await services.matches.listMatches({
        module: "MATCH_STAKES",
        playerId: query.playerId,
        ruleSetId: query.ruleSetId,
        from: query.from,
        to: query.to,
        page: query.page,
        pageSize: query.pageSize
      });

      return ok(result.items, {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize)
      });
    }
  );
}
