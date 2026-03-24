import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { uuidSchema } from "../../core/validation/uuid.js";
import { ok } from "../../core/types/api.js";
import type { AppServices } from "../../core/types/container.js";
import { matchStatusSchema, moduleTypeSchema } from "../../domain/models/enums.js";
import { errorResponseSchemas, paginationMetaSchema, successResponseSchema, toSwaggerSchema } from "../../core/docs/swagger.js";

const participantInputSchema = z.object({
  playerId: uuidSchema,
  tftPlacement: z.number().int()
});

const createMatchConfirmationSchema = z.object({
  mode: z.enum(["ENGINE", "MANUAL_ADJUSTED"]),
  participantNets: z
    .array(
      z.object({
        playerId: uuidSchema,
        netVnd: z.number().int()
      })
    )
    .optional(),
  overrideReason: z.string().max(2000).nullable().optional()
});

const previewMatchSchema = z.object({
  module: moduleTypeSchema,
  ruleSetId: uuidSchema,
  note: z.string().max(4000).nullable().optional(),
  participants: z.array(participantInputSchema).min(3).max(4)
});

const createMatchSchema = z.object({
  module: moduleTypeSchema,
  ruleSetId: uuidSchema,
  ruleSetVersionId: uuidSchema,
  note: z.string().max(4000).nullable().optional(),
  participants: z.array(participantInputSchema).min(3).max(4),
  confirmation: createMatchConfirmationSchema.optional()
});

const listMatchesQuerySchema = z.object({
  module: moduleTypeSchema.optional(),
  status: matchStatusSchema.optional(),
  playerId: uuidSchema.optional(),
  ruleSetId: uuidSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

const voidMatchSchema = z.object({
  reason: z.string().min(3).max(500)
});

const matchIdParamSchema = z.object({ matchId: uuidSchema });

const matchParticipantResponseSchema = z.object({
  playerId: uuidSchema,
  playerName: z.string(),
  tftPlacement: z.number().int(),
  relativeRank: z.number().int(),
  isWinnerAmongParticipants: z.boolean().optional(),
  settlementNetVnd: z.number().int()
});

const settlementLineResponseSchema = z.object({
  id: uuidSchema,
  lineNo: z.number().int().positive(),
  ruleId: uuidSchema.nullable(),
  ruleCode: z.string(),
  ruleName: z.string(),
  sourceAccountId: uuidSchema,
  destinationAccountId: uuidSchema,
  sourcePlayerId: uuidSchema.nullable(),
  sourcePlayerName: z.string().nullable(),
  destinationPlayerId: uuidSchema.nullable(),
  destinationPlayerName: z.string().nullable(),
  amountVnd: z.number().int(),
  reasonText: z.string(),
  metadata: z.unknown()
});

const settlementResponseSchema = z.object({
  id: uuidSchema,
  totalTransferVnd: z.number().int(),
  totalFundInVnd: z.number().int(),
  totalFundOutVnd: z.number().int(),
  engineVersion: z.string(),
  ruleSnapshot: z.unknown(),
  resultSnapshot: z.unknown(),
  postedToLedgerAt: z.string().nullable(),
  lines: z.array(settlementLineResponseSchema)
});

const previewSettlementLineSchema = z.object({
  lineNo: z.number().int().positive(),
  ruleId: uuidSchema.nullable(),
  ruleCode: z.string(),
  ruleName: z.string(),
  sourceAccountId: uuidSchema,
  destinationAccountId: uuidSchema,
  sourcePlayerId: uuidSchema.nullable(),
  sourcePlayerName: z.string().nullable(),
  destinationPlayerId: uuidSchema.nullable(),
  destinationPlayerName: z.string().nullable(),
  amountVnd: z.number().int(),
  reasonText: z.string(),
  metadata: z.unknown()
});

const previewSettlementSchema = z.object({
  totalTransferVnd: z.number().int(),
  totalFundInVnd: z.number().int(),
  totalFundOutVnd: z.number().int(),
  engineVersion: z.string(),
  ruleSnapshot: z.unknown(),
  resultSnapshot: z.unknown(),
  lines: z.array(previewSettlementLineSchema)
});

const previewMatchParticipantResponseSchema = z.object({
  playerId: uuidSchema,
  playerName: z.string(),
  tftPlacement: z.number().int(),
  relativeRank: z.number().int(),
  suggestedNetVnd: z.number().int()
});

const previewMatchResponseSchema = z.object({
  module: moduleTypeSchema,
  note: z.string().nullable(),
  ruleSet: z.object({
    id: uuidSchema,
    name: z.string(),
    module: moduleTypeSchema
  }),
  ruleSetVersion: z.object({
    id: uuidSchema,
    versionNo: z.number().int().positive(),
    participantCountMin: z.number().int(),
    participantCountMax: z.number().int(),
    effectiveFrom: z.string(),
    effectiveTo: z.string().nullable()
  }),
  participants: z.array(previewMatchParticipantResponseSchema),
  settlementPreview: previewSettlementSchema
});

const matchListItemResponseSchema = z.object({
  id: uuidSchema,
  module: moduleTypeSchema,
  playedAt: z.string(),
  participantCount: z.number().int(),
  ruleSetId: uuidSchema,
  ruleSetName: z.string(),
  ruleSetVersionId: uuidSchema,
  ruleSetVersionNo: z.number().int().positive(),
  debtPeriodId: uuidSchema.nullable(),
  debtPeriodNo: z.number().int().positive().nullable(),
  notePreview: z.string().nullable(),
  status: z.string(),
  confirmationMode: z.enum(["ENGINE", "MANUAL_ADJUSTED"]),
  overrideReason: z.string().nullable(),
  manualAdjusted: z.boolean(),
  participants: z.array(matchParticipantResponseSchema),
  totalTransferVnd: z.number().int(),
  totalFundInVnd: z.number().int(),
  totalFundOutVnd: z.number().int(),
  createdAt: z.string()
});

const matchDetailResponseSchema = z.object({
  id: uuidSchema,
  module: moduleTypeSchema,
  playedAt: z.string(),
  participantCount: z.number().int(),
  status: z.string(),
  note: z.string().nullable(),
  debtPeriodId: uuidSchema.nullable(),
  debtPeriodNo: z.number().int().positive().nullable(),
  confirmationMode: z.enum(["ENGINE", "MANUAL_ADJUSTED"]),
  overrideReason: z.string().nullable(),
  manualAdjusted: z.boolean(),
  ruleSet: z.object({
    id: uuidSchema,
    name: z.string(),
    module: moduleTypeSchema
  }),
  ruleSetVersion: z
    .object({
      id: uuidSchema,
      versionNo: z.number().int().positive(),
      participantCountMin: z.number().int(),
      participantCountMax: z.number().int(),
      effectiveFrom: z.string(),
      effectiveTo: z.string().nullable()
    })
    .nullable(),
  participants: z.array(matchParticipantResponseSchema),
  engineCalculationSnapshot: z.unknown().nullable(),
  settlement: settlementResponseSchema.nullable(),
  voidReason: z.string().nullable().optional(),
  voidedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

const createMatchResponseSchema = z.object({
  id: uuidSchema,
  module: moduleTypeSchema,
  playedAt: z.string(),
  participantCount: z.number().int(),
  status: z.string(),
  debtPeriodId: uuidSchema.nullable().optional(),
  debtPeriodNo: z.number().int().positive().nullable().optional(),
  note: z.string().nullable().optional(),
  confirmationMode: z.enum(["ENGINE", "MANUAL_ADJUSTED"]),
  overrideReason: z.string().nullable(),
  manualAdjusted: z.boolean(),
  ruleSet: z
    .object({
      id: uuidSchema,
      name: z.string(),
      module: moduleTypeSchema
    })
    .optional(),
  ruleSetVersion: z
    .object({
      id: uuidSchema,
      versionNo: z.number().int().positive(),
      participantCountMin: z.number().int(),
      participantCountMax: z.number().int(),
      effectiveFrom: z.string(),
      effectiveTo: z.string().nullable()
    })
    .nullable()
    .optional(),
  participants: z.array(matchParticipantResponseSchema),
  engineCalculationSnapshot: z.unknown().nullable().optional(),
  settlement: settlementResponseSchema.nullable().optional(),
  voidReason: z.string().nullable().optional(),
  voidedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

const voidMatchResponseSchema = z.object({
  id: uuidSchema,
  status: z.literal("VOIDED"),
  reason: z.string(),
  voidedAt: z.string()
});

export async function registerMatchRoutes(app: FastifyInstance, services: AppServices): Promise<void> {
  app.post(
    "/matches/preview",
    {
      schema: {
        tags: ["Matches"],
        summary: "Preview settlement for a match without persistence",
        body: toSwaggerSchema(previewMatchSchema),
        response: {
          200: successResponseSchema(previewMatchResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const input = previewMatchSchema.parse(request.body);
      return ok(await services.matches.previewMatch(input));
    }
  );

  app.post(
    "/matches",
    {
      schema: {
        tags: ["Matches"],
        summary: "Create match from engine or manually confirmed participant net amounts",
        body: toSwaggerSchema(createMatchSchema),
        response: {
          201: successResponseSchema(createMatchResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request, reply) => {
      const input = createMatchSchema.parse(request.body);
      const result = await services.matches.createMatch(input);
      reply.status(201);
      return ok(result);
    }
  );

  app.get(
    "/matches",
    {
      schema: {
        tags: ["Matches"],
        summary: "List matches",
        querystring: toSwaggerSchema(listMatchesQuerySchema),
        response: {
          200: successResponseSchema(z.array(matchListItemResponseSchema), paginationMetaSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const query = listMatchesQuerySchema.parse(request.query);
      const result = await services.matches.listMatches(query);

      return ok(result.items, {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize)
      });
    }
  );

  app.get(
    "/matches/:matchId",
    {
      schema: {
        tags: ["Matches"],
        summary: "Get match detail",
        params: toSwaggerSchema(matchIdParamSchema),
        response: {
          200: successResponseSchema(matchDetailResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const params = matchIdParamSchema.parse(request.params);
      return ok(await services.matches.getMatchDetail(params.matchId));
    }
  );

  app.post(
    "/matches/:matchId/void",
    {
      schema: {
        tags: ["Matches"],
        summary: "Void a match and generate reversal ledger entries",
        params: toSwaggerSchema(matchIdParamSchema),
        body: toSwaggerSchema(voidMatchSchema),
        response: {
          200: successResponseSchema(voidMatchResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const params = matchIdParamSchema.parse(request.params);
      const body = voidMatchSchema.parse(request.body);

      return ok(await services.matches.voidMatch(params.matchId, body.reason));
    }
  );
}
