import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../../core/types/api.js";
import type { AppServices } from "../../core/types/container.js";
import { moduleTypeSchema } from "../../domain/models/enums.js";
import { errorResponseSchemas, paginationMetaSchema, successResponseSchema, toSwaggerSchema } from "../../core/docs/swagger.js";

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

const matchIdParamSchema = z.object({ matchId: z.string().uuid() });

const matchParticipantResponseSchema = z.object({
  playerId: z.string().uuid(),
  playerName: z.string(),
  tftPlacement: z.number().int(),
  relativeRank: z.number().int(),
  isWinnerAmongParticipants: z.boolean().optional(),
  settlementNetVnd: z.number().int()
});

const settlementLineResponseSchema = z.object({
  id: z.string().uuid(),
  lineNo: z.number().int().positive(),
  ruleId: z.string().uuid().nullable(),
  ruleCode: z.string(),
  ruleName: z.string(),
  sourceAccountId: z.string().uuid(),
  destinationAccountId: z.string().uuid(),
  sourcePlayerId: z.string().uuid().nullable(),
  destinationPlayerId: z.string().uuid().nullable(),
  amountVnd: z.number().int(),
  reasonText: z.string(),
  metadata: z.unknown()
});

const settlementResponseSchema = z.object({
  id: z.string().uuid(),
  totalTransferVnd: z.number().int(),
  totalFundInVnd: z.number().int(),
  totalFundOutVnd: z.number().int(),
  engineVersion: z.string(),
  ruleSnapshot: z.unknown(),
  resultSnapshot: z.unknown(),
  postedToLedgerAt: z.string().nullable(),
  lines: z.array(settlementLineResponseSchema)
});

const matchListItemResponseSchema = z.object({
  id: z.string().uuid(),
  module: moduleTypeSchema,
  playedAt: z.string(),
  participantCount: z.number().int(),
  ruleSetId: z.string().uuid(),
  ruleSetName: z.string(),
  ruleSetVersionId: z.string().uuid(),
  notePreview: z.string().nullable(),
  status: z.string(),
  participants: z.array(matchParticipantResponseSchema),
  totalTransferVnd: z.number().int(),
  totalFundInVnd: z.number().int(),
  totalFundOutVnd: z.number().int(),
  createdAt: z.string()
});

const matchDetailResponseSchema = z.object({
  id: z.string().uuid(),
  module: moduleTypeSchema,
  playedAt: z.string(),
  participantCount: z.number().int(),
  status: z.string(),
  note: z.string().nullable(),
  ruleSet: z.object({
    id: z.string().uuid(),
    name: z.string(),
    module: moduleTypeSchema
  }),
  ruleSetVersion: z
    .object({
      id: z.string().uuid(),
      versionNo: z.number().int().positive(),
      participantCountMin: z.number().int(),
      participantCountMax: z.number().int(),
      effectiveFrom: z.string(),
      effectiveTo: z.string().nullable()
    })
    .nullable(),
  participants: z.array(matchParticipantResponseSchema),
  settlement: settlementResponseSchema.nullable(),
  voidReason: z.string().nullable().optional(),
  voidedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

const createMatchResponseSchema = z.object({
  id: z.string().uuid(),
  module: moduleTypeSchema,
  playedAt: z.string(),
  participantCount: z.number().int(),
  status: z.string(),
  note: z.string().nullable().optional(),
  ruleSet: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      module: moduleTypeSchema
    })
    .optional(),
  ruleSetVersion: z
    .object({
      id: z.string().uuid(),
      versionNo: z.number().int().positive(),
      participantCountMin: z.number().int(),
      participantCountMax: z.number().int(),
      effectiveFrom: z.string(),
      effectiveTo: z.string().nullable()
    })
    .nullable()
    .optional(),
  participants: z.array(matchParticipantResponseSchema),
  settlement: settlementResponseSchema.nullable().optional(),
  voidReason: z.string().nullable().optional(),
  voidedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

const voidMatchResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.literal("VOIDED"),
  reason: z.string(),
  voidedAt: z.string()
});

export async function registerMatchRoutes(app: FastifyInstance, services: AppServices): Promise<void> {
  app.post(
    "/matches",
    {
      schema: {
        tags: ["Matches"],
        summary: "Create match and post settlement ledger",
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
