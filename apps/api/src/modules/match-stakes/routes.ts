import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { uuidSchema } from "../../core/validation/uuid.js";
import { ok } from "../../core/types/api.js";
import type { AppServices } from "../../core/types/container.js";
import { errorResponseSchemas, paginationMetaSchema, successResponseSchema, toSwaggerSchema } from "../../core/docs/swagger.js";
import { debtPeriodStatusSchema, matchStakesImpactModeSchema } from "../../domain/models/enums.js";

const querySchema = z.object({
  playerId: uuidSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

const summaryQuerySchema = z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional() });
const periodIdParamSchema = z.object({ periodId: uuidSchema });

const createDebtPeriodBodySchema = z.object({
  title: z.string().max(150).nullable().optional(),
  note: z.string().max(4000).nullable().optional()
});

const createSettlementBodySchema = z.object({
  postedAt: z.string().datetime().optional(),
  note: z.string().max(4000).nullable().optional(),
  lines: z
    .array(
      z.object({
        payerPlayerId: uuidSchema,
        receiverPlayerId: uuidSchema,
        amountVnd: z.coerce.number().int().positive(),
        note: z.string().max(1000).nullable().optional()
      })
    )
    .min(1)
}).superRefine((value, context) => {
  value.lines.forEach((line, index) => {
    if (line.payerPlayerId === line.receiverPlayerId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lines", index, "receiverPlayerId"],
        message: "payerPlayerId and receiverPlayerId must be different"
      });
    }
  });
});

const closeDebtPeriodBodySchema = z
  .object({
    note: z.string().max(4000).nullable().optional(),
    closingBalances: z.array(
      z.object({
        playerId: uuidSchema,
        netVnd: z.coerce.number().int()
      })
    )
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();
    value.closingBalances.forEach((item, index) => {
      if (seen.has(item.playerId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["closingBalances", index, "playerId"],
          message: "playerId must be unique in closingBalances"
        });
      }
      seen.add(item.playerId);
    });
  });

const historyItemTypeSchema = z.enum(["MATCH", "DEBT_SETTLEMENT", "ADVANCE", "NOTE"]);

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

const matchStakesHistoryQuerySchema = z.object({
  playerId: uuidSchema.optional(),
  periodId: uuidSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  itemTypes: historyItemTypesQuerySchema,
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

const matchStakesImpactModeInputSchema = z
  .union([matchStakesImpactModeSchema, z.literal("INFORMATION_ONLY")])
  .transform((value) => (value === "INFORMATION_ONLY" ? "INFORMATIONAL" : value));

// Keep Fastify body schema as a flat object to avoid oneOf + removeAdditional
// mutating request.body before the explicit Zod parse in the handler.
const createMatchStakesHistoryEventRouteBodySchema = z
  .object({
    eventType: z.enum(["MATCH_STAKES_ADVANCE", "MATCH_STAKES_NOTE"]),
    postedAt: z.string().datetime().optional(),
    playerId: uuidSchema.optional(),
    amountVnd: z.union([z.number(), z.string()]).optional(),
    note: z.union([z.string(), z.null()]).optional(),
    impactMode: z.union([matchStakesImpactModeSchema, z.literal("INFORMATION_ONLY")]).optional(),
    beneficiaryPlayerIds: z.array(uuidSchema).min(1).optional(),
    debtPeriodId: uuidSchema.optional()
  })
  .passthrough();

const createMatchStakesHistoryEventBodySchema = z
  .discriminatedUnion("eventType", [
    z.object({
      eventType: z.literal("MATCH_STAKES_ADVANCE"),
      postedAt: z.string().datetime().optional(),
      playerId: uuidSchema,
      amountVnd: z.coerce.number().int().positive(),
      note: z.string().max(4000).nullable().optional(),
      impactMode: matchStakesImpactModeInputSchema.optional(),
      beneficiaryPlayerIds: z.array(uuidSchema).min(1).optional(),
      debtPeriodId: uuidSchema.optional()
    }),
    z.object({
      eventType: z.literal("MATCH_STAKES_NOTE"),
      postedAt: z.string().datetime().optional(),
      note: z.string().min(1).max(4000),
      playerId: uuidSchema.optional(),
      debtPeriodId: uuidSchema.optional()
    })
  ])
  .superRefine((value, context) => {
    if (value.eventType === "MATCH_STAKES_ADVANCE") {
      const unique = new Set(value.beneficiaryPlayerIds ?? []);
      if ((value.beneficiaryPlayerIds?.length ?? 0) !== unique.size) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["beneficiaryPlayerIds"],
          message: "beneficiaryPlayerIds must not contain duplicates"
        });
      }
    }
  });

const debtPeriodTimelineQuerySchema = z.object({
  includeInitialSnapshot: z
    .preprocess((value) => {
      if (value === undefined || value === null) {
        return undefined;
      }

      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true" || normalized === "1") {
          return true;
        }
        if (normalized === "false" || normalized === "0") {
          return false;
        }
      }

      return value;
    }, z.boolean())
    .optional()
    .default(true)
});

const debtPeriodSchema = z.object({
  id: uuidSchema,
  periodNo: z.number().int().positive(),
  title: z.string().nullable(),
  note: z.string().nullable(),
  closeNote: z.string().nullable(),
  nextPeriodId: uuidSchema.nullable(),
  status: debtPeriodStatusSchema,
  openedAt: z.string(),
  closedAt: z.string().nullable()
});

const debtPeriodPlayerSummarySchema = z.object({
  playerId: uuidSchema,
  playerName: z.string(),
  totalMatches: z.number().int().nonnegative(),
  initNetVnd: z.number().int(),
  accruedNetVnd: z.number().int(),
  settledPaidVnd: z.number().int().nonnegative(),
  settledReceivedVnd: z.number().int().nonnegative(),
  outstandingNetVnd: z.number().int()
});

const debtPeriodSummarySchema = z.object({
  totalMatches: z.number().int().nonnegative(),
  totalPlayers: z.number().int().nonnegative(),
  totalOutstandingReceiveVnd: z.number().int().nonnegative(),
  totalOutstandingPayVnd: z.number().int().nonnegative()
});

const debtPeriodCurrentResponseSchema = z.object({
  period: debtPeriodSchema,
  summary: debtPeriodSummarySchema,
  players: z.array(debtPeriodPlayerSummarySchema)
});

const debtPeriodListItemSchema = debtPeriodSchema.extend({
  totalMatches: z.number().int().nonnegative(),
  totalPlayers: z.number().int().nonnegative(),
  totalOutstandingReceiveVnd: z.number().int().nonnegative(),
  totalOutstandingPayVnd: z.number().int().nonnegative()
});

const debtSettlementLineSchema = z.object({
  id: uuidSchema,
  payerPlayerId: uuidSchema,
  payerPlayerName: z.string(),
  receiverPlayerId: uuidSchema,
  receiverPlayerName: z.string(),
  amountVnd: z.number().int().positive(),
  note: z.string().nullable(),
  createdAt: z.string()
});

const debtSettlementSchema = z.object({
  id: uuidSchema,
  postedAt: z.string(),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lines: z.array(debtSettlementLineSchema)
});

const debtPeriodDetailResponseSchema = z.object({
  period: debtPeriodSchema,
  summary: debtPeriodSummarySchema,
  players: z.array(debtPeriodPlayerSummarySchema),
  settlements: z.array(debtSettlementSchema),
  recentMatches: z.array(
    z.object({
      id: uuidSchema,
      playedAt: z.string(),
      participantCount: z.number().int().positive(),
      status: z.string(),
      debtPeriodId: uuidSchema.nullable(),
      debtPeriodNo: z.number().int().positive().nullable(),
      periodMatchNo: z.number().int().positive().nullable()
    })
  )
});

const debtPeriodTimelinePlayerRowSchema = z.object({
  playerId: uuidSchema,
  playerName: z.string(),
  tftPlacement: z.number().int().nullable(),
  relativeRank: z.number().int().nullable(),
  matchNetVnd: z.number().int(),
  cumulativeNetVnd: z.number().int()
});

const debtPeriodTimelineItemSchema = z.object({
  type: z.union([z.literal("MATCH"), z.literal("INITIAL"), z.literal("ADVANCE"), z.literal("NOTE")]),
  matchId: uuidSchema.nullable(),
  eventId: uuidSchema.nullable(),
  eventType: z.string().nullable(),
  playedAt: z.string().nullable(),
  matchNo: z.number().int().positive().nullable(),
  participantCount: z.number().int().positive().nullable(),
  status: z.string().nullable(),
  amountVnd: z.number().int().nullable(),
  note: z.string().nullable(),
  affectsDebt: z.boolean().nullable(),
  impactMode: matchStakesImpactModeSchema.nullable(),
  metadata: z.unknown().nullable(),
  rows: z.array(debtPeriodTimelinePlayerRowSchema)
});

const debtPeriodTimelineResponseSchema = z.object({
  period: debtPeriodSchema,
  summary: debtPeriodSummarySchema,
  currentPlayers: z.array(debtPeriodPlayerSummarySchema),
  timeline: z.array(debtPeriodTimelineItemSchema)
});

const createSettlementResponseSchema = z.object({
  settlement: debtSettlementSchema,
  summary: debtPeriodSummarySchema,
  players: z.array(debtPeriodPlayerSummarySchema)
});

const closeDebtPeriodResponseSchema = z.object({
  id: uuidSchema,
  status: z.literal("CLOSED"),
  closedAt: z.string().nullable(),
  nextPeriod: debtPeriodSchema,
  carryForwardBalances: z.array(
    z.object({
      playerId: uuidSchema,
      playerName: z.string(),
      netVnd: z.number().int()
    })
  )
});

const unifiedHistoryItemSchema = z.object({
  id: uuidSchema,
  module: z.literal("MATCH_STAKES"),
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

const createMatchStakesHistoryEventResponseSchema = z.object({
  period: debtPeriodSchema,
  event: unifiedHistoryItemSchema,
  summary: debtPeriodSummarySchema,
  players: z.array(debtPeriodPlayerSummarySchema)
});

const matchStakesSummarySchema = z.object({
  module: z.literal("MATCH_STAKES"),
  players: z.array(
    z.object({
      playerId: uuidSchema,
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
  entryId: uuidSchema,
  postedAt: z.string(),
  matchId: uuidSchema.nullable(),
  sourcePlayerId: uuidSchema.nullable(),
  sourcePlayerName: z.string().nullable(),
  destinationPlayerId: uuidSchema.nullable(),
  destinationPlayerName: z.string().nullable(),
  amountVnd: z.number().int(),
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
  module: z.literal("MATCH_STAKES"),
  playedAt: z.string(),
  participantCount: z.number().int(),
  ruleSetId: uuidSchema,
  ruleSetName: z.string(),
  ruleSetVersionId: uuidSchema,
  ruleSetVersionNo: z.number().int().positive(),
  debtPeriodId: uuidSchema.nullable(),
  debtPeriodNo: z.number().int().positive().nullable(),
  periodMatchNo: z.number().int().positive().nullable(),
  notePreview: z.string().nullable(),
  status: z.string(),
  participants: z.array(matchParticipantResponseSchema),
  totalTransferVnd: z.number().int(),
  totalFundInVnd: z.number().int(),
  totalFundOutVnd: z.number().int(),
  createdAt: z.string()
});

const listDebtPeriodsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

export async function registerMatchStakesRoutes(app: FastifyInstance, services: AppServices): Promise<void> {
  app.get(
    "/match-stakes/debt-periods/current",
    {
      schema: {
        tags: ["Match Stakes"],
        summary: "Get current open debt period with cumulative outstanding summary",
        response: {
          200: successResponseSchema(debtPeriodCurrentResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async () => ok(await services.matchStakes.getCurrentDebtPeriod())
  );

  app.get(
    "/match-stakes/debt-periods",
    {
      schema: {
        tags: ["Match Stakes"],
        summary: "List match-stakes debt periods",
        querystring: toSwaggerSchema(listDebtPeriodsQuerySchema),
        response: {
          200: successResponseSchema(z.array(debtPeriodListItemSchema), paginationMetaSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const query = listDebtPeriodsQuerySchema.parse(request.query);
      const result = await services.matchStakes.listDebtPeriods(query);
      return ok(result.items, {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize)
      });
    }
  );

  app.get(
    "/match-stakes/debt-periods/:periodId/timeline",
    {
      schema: {
        tags: ["Match Stakes"],
        summary: "Get debt period timeline with cumulative per-match debt history",
        params: toSwaggerSchema(periodIdParamSchema),
        querystring: toSwaggerSchema(debtPeriodTimelineQuerySchema),
        response: {
          200: successResponseSchema(debtPeriodTimelineResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const params = periodIdParamSchema.parse(request.params);
      const query = debtPeriodTimelineQuerySchema.parse(request.query);
      return ok(
        await services.matchStakes.getDebtPeriodTimeline(params.periodId, {
          includeInitialSnapshot: query.includeInitialSnapshot
        })
      );
    }
  );

  app.get(
    "/match-stakes/debt-periods/:periodId",
    {
      schema: {
        tags: ["Match Stakes"],
        summary: "Get debt period detail with players and settlements",
        params: toSwaggerSchema(periodIdParamSchema),
        response: {
          200: successResponseSchema(debtPeriodDetailResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const params = periodIdParamSchema.parse(request.params);
      return ok(await services.matchStakes.getDebtPeriodDetail(params.periodId));
    }
  );

  app.post(
    "/match-stakes/debt-periods",
    {
      schema: {
        tags: ["Match Stakes"],
        summary: "Create a new open match-stakes debt period",
        body: toSwaggerSchema(createDebtPeriodBodySchema),
        response: {
          201: successResponseSchema(debtPeriodSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request, reply) => {
      const input = createDebtPeriodBodySchema.parse(request.body);
      const created = await services.matchStakes.createDebtPeriod(input);
      reply.status(201);
      return ok(created);
    }
  );

  app.post(
    "/match-stakes/debt-periods/:periodId/settlements",
    {
      schema: {
        tags: ["Match Stakes"],
        summary: "Record real-world settlement payments in an open debt period",
        params: toSwaggerSchema(periodIdParamSchema),
        body: toSwaggerSchema(createSettlementBodySchema),
        response: {
          201: successResponseSchema(createSettlementResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request, reply) => {
      const params = periodIdParamSchema.parse(request.params);
      const body = createSettlementBodySchema.parse(request.body);
      const created = await services.matchStakes.createDebtSettlement(params.periodId, body);
      reply.status(201);
      return ok(created);
    }
  );

  app.post(
    "/match-stakes/debt-periods/:periodId/close",
    {
      schema: {
        tags: ["Match Stakes"],
        summary: "Close an open debt period and carry balances to the next period",
        params: toSwaggerSchema(periodIdParamSchema),
        body: toSwaggerSchema(closeDebtPeriodBodySchema),
        response: {
          200: successResponseSchema(closeDebtPeriodResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const params = periodIdParamSchema.parse(request.params);
      const body = closeDebtPeriodBodySchema.parse(request.body);
      return ok(await services.matchStakes.closeDebtPeriod(params.periodId, body));
    }
  );

  app.post(
    "/match-stakes/history-events",
    {
      schema: {
        tags: ["Match Stakes"],
        summary: "Create non-match history event for match-stakes timeline",
        body: toSwaggerSchema(createMatchStakesHistoryEventRouteBodySchema),
        response: {
          201: successResponseSchema(createMatchStakesHistoryEventResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request, reply) => {
      const body = createMatchStakesHistoryEventBodySchema.parse(request.body);
      const created = await services.matchStakes.createHistoryEvent({
        ...body,
        createdByRoleCode: request.authUser?.roleCode ?? null
      });

      reply.status(201);
      return ok(created);
    }
  );

  app.get(
    "/match-stakes/history",
    {
      schema: {
        tags: ["Match Stakes"],
        summary: "Get unified match-stakes history (matches + settlements + non-match events)",
        querystring: toSwaggerSchema(matchStakesHistoryQuerySchema),
        response: {
          200: successResponseSchema(z.array(unifiedHistoryItemSchema), paginationMetaSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const query = matchStakesHistoryQuerySchema.parse(request.query);
      const result = await services.matchStakes.getHistory(query);
      return ok(result.items, {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize)
      });
    }
  );

  app.get(
    "/match-stakes/debt-periods/:periodId/history",
    {
      schema: {
        tags: ["Match Stakes"],
        summary: "Get unified history for a specific match-stakes debt period",
        params: toSwaggerSchema(periodIdParamSchema),
        querystring: toSwaggerSchema(matchStakesHistoryQuerySchema.omit({ periodId: true })),
        response: {
          200: successResponseSchema(z.array(unifiedHistoryItemSchema), paginationMetaSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const params = periodIdParamSchema.parse(request.params);
      const query = matchStakesHistoryQuerySchema.omit({ periodId: true }).parse(request.query);
      const result = await services.matchStakes.getHistory({
        ...query,
        periodId: params.periodId
      });

      return ok(result.items, {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize)
      });
    }
  );

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
        summary: "List match-stakes ledger entries (legacy audit-oriented endpoint)",
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
            ruleSetId: uuidSchema.optional(),
            periodId: uuidSchema.optional()
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
          ruleSetId: uuidSchema.optional(),
          periodId: uuidSchema.optional()
        })
        .parse(request.query);

      const result = await services.matches.listMatches({
        module: "MATCH_STAKES",
        playerId: query.playerId,
        ruleSetId: query.ruleSetId,
        periodId: query.periodId,
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
