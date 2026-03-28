import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { uuidSchema } from "../../core/validation/uuid.js";
import { ok } from "../../core/types/api.js";
import type { AppServices } from "../../core/types/container.js";
import { errorResponseSchemas, paginationMetaSchema, successResponseSchema, toSwaggerSchema } from "../../core/docs/swagger.js";

const querySchema = z.object({
  playerId: uuidSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

const summaryQuerySchema = z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional() });
const groupFundTransactionTypeSchema = z.enum(["CONTRIBUTION", "WITHDRAWAL", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"]);
const markGroupFundContributionSchema = z.object({
  playerId: uuidSchema,
  amountVnd: z.coerce.number().int().positive(),
  note: z.string().max(500).nullable().optional(),
  postedAt: z.string().datetime().optional()
});

const createGroupFundAdvanceSchema = z.object({
  playerId: uuidSchema,
  amountVnd: z.coerce.number().int().positive(),
  note: z.string().max(2000).nullable().optional(),
  postedAt: z.string().datetime().optional()
});

const createGroupFundHistoryEventSchema = z.discriminatedUnion("eventType", [
  z.object({
    eventType: z.literal("GROUP_FUND_NOTE"),
    note: z.string().min(1).max(4000),
    playerId: uuidSchema.optional(),
    postedAt: z.string().datetime().optional()
  })
]);

const createGroupFundTransactionSchema = z
  .object({
    transactionType: groupFundTransactionTypeSchema,
    playerId: uuidSchema.nullable().optional(),
    amountVnd: z.coerce.number().int().positive(),
    reason: z.string().min(3).max(500),
    postedAt: z.string().datetime().optional()
  })
  .superRefine((value, context) => {
    const needsPlayer = value.transactionType === "CONTRIBUTION" || value.transactionType === "WITHDRAWAL";
    if (needsPlayer && !value.playerId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["playerId"],
        message: "playerId is required for CONTRIBUTION and WITHDRAWAL"
      });
    }

    if (!needsPlayer && value.playerId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["playerId"],
        message: "playerId must be null for ADJUSTMENT_IN and ADJUSTMENT_OUT"
      });
    }
  });

const listGroupFundTransactionsQuerySchema = z.object({
  transactionType: groupFundTransactionTypeSchema.optional(),
  playerId: uuidSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

const historyItemTypeSchema = z.enum(["MATCH", "MANUAL_TRANSACTION", "ADVANCE", "NOTE", "ADJUSTMENT", "CONTRIBUTION"]);
const historyItemTypesQuerySchema = z
  .preprocess((value) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value.flatMap((item) =>
        String(item)
          .split(",")
          .map((token) => token.trim())
          .filter((token) => token.length > 0)
      );
    }

    if (typeof value === "string") {
      return value
        .split(",")
        .map((token) => token.trim())
        .filter((token) => token.length > 0);
    }

    return value;
  }, z.array(historyItemTypeSchema))
  .optional();

const groupFundHistoryQuerySchema = z.object({
  playerId: uuidSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  itemTypes: historyItemTypesQuerySchema,
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

const groupFundSummarySchema = z.object({
  module: z.literal("GROUP_FUND"),
  fundBalanceVnd: z.number().int(),
  totalMatches: z.number().int().nonnegative(),
  negativeBalanceAllowed: z.literal(true),
  totalRegularContributionsVnd: z.number().int(),
  totalAdvancesVnd: z.number().int(),
  advancesByPlayers: z.array(
    z.object({
      playerId: uuidSchema,
      playerName: z.string(),
      totalAdvancedVnd: z.number().int(),
      lastAdvancedAt: z.string()
    })
  ),
  players: z.array(
    z.object({
      playerId: uuidSchema,
      playerName: z.string(),
      totalContributedVnd: z.number().int(),
      currentObligationVnd: z.number().int(),
      netObligationVnd: z.number().int(),
      prepaidVnd: z.number().int().nonnegative(),
      totalAdvancedVnd: z.number().int().nonnegative()
    })
  ),
  range: z.object({
    from: z.string().datetime().nullable(),
    to: z.string().datetime().nullable()
  })
});

const moduleLedgerItemSchema = z.object({
  entryId: uuidSchema,
  postedAt: z.string(),
  matchId: uuidSchema.nullable(),
  relatedPlayerId: uuidSchema.nullable(),
  relatedPlayerName: z.string().nullable(),
  amountVnd: z.number().int(),
  movementType: z.enum(["FUND_IN", "FUND_OUT"]),
  entryReason: z.string(),
  ruleCode: z.string().nullable(),
  ruleName: z.string().nullable()
});

const matchParticipantResponseSchema = z.object({
  playerId: uuidSchema,
  playerName: z.string(),
  tftPlacement: z.number().int(),
  relativeRank: z.number().int(),
  settlementNetVnd: z.number().int()
});

const moduleMatchHistoryItemSchema = z.object({
  id: uuidSchema,
  module: z.literal("GROUP_FUND"),
  playedAt: z.string(),
  participantCount: z.number().int(),
  ruleSetId: uuidSchema,
  ruleSetName: z.string(),
  ruleSetVersionId: uuidSchema,
  ruleSetVersionNo: z.number().int().positive(),
  notePreview: z.string().nullable(),
  status: z.string(),
  participants: z.array(matchParticipantResponseSchema),
  totalTransferVnd: z.number().int(),
  totalFundInVnd: z.number().int(),
  totalFundOutVnd: z.number().int(),
  createdAt: z.string()
});

const groupFundTransactionResponseSchema = z.object({
  entryId: uuidSchema.optional(),
  batchId: uuidSchema,
  postedAt: z.string(),
  sourceType: z.enum(["MANUAL_ADJUSTMENT", "SYSTEM_CORRECTION"]),
  transactionType: groupFundTransactionTypeSchema,
  playerId: uuidSchema.nullable(),
  playerName: z.string().nullable(),
  amountVnd: z.number().int(),
  reason: z.string()
});

const markGroupFundContributionResponseSchema = z.object({
  batchId: uuidSchema,
  postedAt: z.string(),
  playerId: uuidSchema,
  playerName: z.string(),
  amountVnd: z.number().int(),
  note: z.string().nullable()
});

const unifiedGroupFundHistoryItemSchema = z.object({
  id: uuidSchema,
  module: z.literal("GROUP_FUND"),
  itemType: z.string(),
  postedAt: z.string(),
  createdAt: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  amountVnd: z.number().int().nullable(),
  player: z
    .object({
      id: uuidSchema,
      name: z.string()
    })
    .nullable(),
  secondaryPlayer: z
    .object({
      id: uuidSchema,
      name: z.string()
    })
    .nullable(),
  matchId: uuidSchema.nullable(),
  debtPeriodId: uuidSchema.nullable(),
  ledgerBatchId: uuidSchema.nullable(),
  balanceBeforeVnd: z.number().int().nullable(),
  balanceAfterVnd: z.number().int().nullable(),
  outstandingBeforeVnd: z.number().int().nullable(),
  outstandingAfterVnd: z.number().int().nullable(),
  note: z.string().nullable(),
  metadata: z.unknown()
});

const groupFundAdvanceResponseSchema = z.object({
  batchId: uuidSchema,
  event: unifiedGroupFundHistoryItemSchema
});

const groupFundHistoryEventResponseSchema = z.object({
  event: unifiedGroupFundHistoryItemSchema
});

export async function registerGroupFundRoutes(app: FastifyInstance, services: AppServices): Promise<void> {
  app.post(
    "/group-fund/contributions",
    {
      schema: {
        tags: ["Group Fund"],
        summary: "Mark player paid into group fund",
        body: toSwaggerSchema(markGroupFundContributionSchema),
        response: {
          201: successResponseSchema(markGroupFundContributionResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request, reply) => {
      const input = markGroupFundContributionSchema.parse(request.body);
      const created = await services.groupFund.markContributionPaid({
        playerId: input.playerId,
        amountVnd: input.amountVnd,
        note: input.note,
        postedAt: input.postedAt,
        createdByRoleCode: request.authUser?.roleCode ?? null
      });

      reply.status(201);
      return ok(created);
    }
  );

  app.post(
    "/group-fund/advances",
    {
      schema: {
        tags: ["Group Fund"],
        summary: "Record player advancing personal money into the group fund",
        body: toSwaggerSchema(createGroupFundAdvanceSchema),
        response: {
          201: successResponseSchema(groupFundAdvanceResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request, reply) => {
      const input = createGroupFundAdvanceSchema.parse(request.body);
      const created = await services.groupFund.createAdvance({
        playerId: input.playerId,
        amountVnd: input.amountVnd,
        note: input.note,
        postedAt: input.postedAt,
        createdByRoleCode: request.authUser?.roleCode ?? null
      });

      reply.status(201);
      return ok(created);
    }
  );

  app.post(
    "/group-fund/history-events",
    {
      schema: {
        tags: ["Group Fund"],
        summary: "Create non-match group-fund history event",
        body: toSwaggerSchema(createGroupFundHistoryEventSchema),
        response: {
          201: successResponseSchema(groupFundHistoryEventResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request, reply) => {
      const input = createGroupFundHistoryEventSchema.parse(request.body);
      const created = await services.groupFund.createNoteEvent({
        note: input.note,
        playerId: input.playerId,
        postedAt: input.postedAt,
        createdByRoleCode: request.authUser?.roleCode ?? null
      });

      reply.status(201);
      return ok(created);
    }
  );

  app.post(
    "/group-fund/transactions",
    {
      schema: {
        tags: ["Group Fund"],
        summary: "Create manual group-fund transaction",
        body: toSwaggerSchema(createGroupFundTransactionSchema),
        response: {
          201: successResponseSchema(groupFundTransactionResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request, reply) => {
      const input = createGroupFundTransactionSchema.parse(request.body);
      const created = await services.groupFund.createManualTransaction({
        transactionType: input.transactionType,
        playerId: input.playerId ?? null,
        amountVnd: input.amountVnd,
        reason: input.reason,
        postedAt: input.postedAt,
        createdByRoleCode: request.authUser?.roleCode ?? null
      });

      reply.status(201);
      return ok(created);
    }
  );

  app.get(
    "/group-fund/transactions",
    {
      schema: {
        tags: ["Group Fund"],
        summary: "List manual group-fund transactions",
        querystring: toSwaggerSchema(listGroupFundTransactionsQuerySchema),
        response: {
          200: successResponseSchema(z.array(groupFundTransactionResponseSchema), paginationMetaSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const query = listGroupFundTransactionsQuerySchema.parse(request.query);
      const result = await services.groupFund.listManualTransactions(query);

      return ok(result.items, {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize)
      });
    }
  );

  app.get(
    "/group-fund/history",
    {
      schema: {
        tags: ["Group Fund"],
        summary: "Get unified group-fund history (matches + advances + manual transactions + notes)",
        querystring: toSwaggerSchema(groupFundHistoryQuerySchema),
        response: {
          200: successResponseSchema(z.array(unifiedGroupFundHistoryItemSchema), paginationMetaSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const query = groupFundHistoryQuerySchema.parse(request.query);
      const result = await services.groupFund.getHistory(query);

      return ok(result.items, {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize)
      });
    }
  );

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
            ruleSetId: uuidSchema.optional()
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
          ruleSetId: uuidSchema.optional()
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
