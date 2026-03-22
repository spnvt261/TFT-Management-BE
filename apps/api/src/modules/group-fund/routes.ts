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
  entryId: z.string().uuid(),
  postedAt: z.string(),
  matchId: z.string().uuid().nullable(),
  relatedPlayerId: z.string().uuid().nullable(),
  relatedPlayerName: z.string().nullable(),
  amountVnd: z.number().int(),
  movementType: z.enum(["FUND_IN", "FUND_OUT"]),
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
  module: z.literal("GROUP_FUND"),
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
      const items = result.items.map((item) => {
        const isFundIn =
          item.destination_account_type === "FUND_MAIN" ||
          (item.source_player_id !== null && item.destination_player_id === null);
        const relatedPlayerId = isFundIn ? item.source_player_id : item.destination_player_id;
        const relatedPlayerName = isFundIn ? item.source_player_name : item.destination_player_name;

        return {
          entryId: item.entry_id,
          postedAt: item.posted_at,
          matchId: item.match_id,
          relatedPlayerId,
          relatedPlayerName,
          amountVnd: item.amount_vnd,
          movementType: isFundIn ? "FUND_IN" : "FUND_OUT",
          entryReason: item.entry_reason,
          ruleCode: item.rule_code,
          ruleName: item.rule_name
        };
      });

      return ok(items, {
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

      const result = await services.matches.listMatches({
        module: "GROUP_FUND",
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
