import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ok } from "../../core/types/api.js";
import type { AppServices } from "../../core/types/container.js";
import { moduleTypeSchema, ruleStatusSchema, ruleKindSchema, conditionOperatorSchema, actionTypeSchema, selectorTypeSchema } from "../../domain/models/enums.js";
import { errorResponseSchemas, paginationMetaSchema, successResponseSchema, toSwaggerSchema } from "../../core/docs/swagger.js";

const listRuleSetsQuerySchema = z.object({
  module: moduleTypeSchema.optional(),
  status: ruleStatusSchema.optional(),
  isDefault: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

const createRuleSetSchema = z.object({
  module: moduleTypeSchema,
  code: z.string().min(1).max(80),
  name: z.string().min(1).max(150),
  description: z.string().nullable().optional(),
  status: ruleStatusSchema.optional().default("ACTIVE"),
  isDefault: z.boolean().optional().default(false)
});

const updateRuleSetSchema = z
  .object({
    name: z.string().min(1).max(150).optional(),
    description: z.string().nullable().optional(),
    status: ruleStatusSchema.optional(),
    isDefault: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field must be provided" });

const ruleConditionSchema = z.object({
  conditionKey: z.enum(["participantCount", "module", "subjectRelativeRank", "subjectAbsolutePlacement", "matchContainsAbsolutePlacements"]),
  operator: conditionOperatorSchema,
  valueJson: z.unknown(),
  sortOrder: z.coerce.number().int().positive().default(1)
});

const ruleActionSchema = z.object({
  actionType: actionTypeSchema,
  amountVnd: z.number().int().nonnegative(),
  sourceSelectorType: selectorTypeSchema,
  sourceSelectorJson: z.unknown().optional().default({}),
  destinationSelectorType: selectorTypeSchema,
  destinationSelectorJson: z.unknown().optional().default({}),
  descriptionTemplate: z.string().nullable().optional(),
  sortOrder: z.coerce.number().int().positive().default(1)
});

const ruleSchema = z.object({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(150),
  description: z.string().nullable().optional(),
  ruleKind: ruleKindSchema,
  priority: z.coerce.number().int().default(100),
  status: ruleStatusSchema.default("ACTIVE"),
  stopProcessingOnMatch: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  conditions: z.array(ruleConditionSchema),
  actions: z.array(ruleActionSchema)
});

const createRuleSetVersionSchema = z.object({
  participantCountMin: z.coerce.number().int().min(2).max(8),
  participantCountMax: z.coerce.number().int().min(2).max(8),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional().default(true),
  summaryJson: z.record(z.string(), z.unknown()).nullable().optional(),
  rules: z.array(ruleSchema).min(1)
});

const updateRuleSetVersionSchema = z
  .object({
    isActive: z.boolean().optional(),
    effectiveFrom: z.string().datetime().optional(),
    effectiveTo: z.string().datetime().nullable().optional(),
    summaryJson: z.record(z.string(), z.unknown()).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field must be provided" });

const ruleSetIdParamSchema = z.object({ ruleSetId: z.string().uuid() });
const ruleSetVersionParamSchema = z.object({ ruleSetId: z.string().uuid(), versionId: z.string().uuid() });
const moduleParamSchema = z.object({ module: moduleTypeSchema });

const ruleConditionResponseSchema = z.object({
  id: z.string().uuid().optional(),
  conditionKey: z.string(),
  operator: z.string(),
  valueJson: z.unknown(),
  sortOrder: z.number().int().positive()
});

const ruleActionResponseSchema = z.object({
  id: z.string().uuid().optional(),
  actionType: z.string(),
  amountVnd: z.number().int(),
  sourceSelectorType: z.string(),
  sourceSelectorJson: z.unknown(),
  destinationSelectorType: z.string(),
  destinationSelectorJson: z.unknown(),
  descriptionTemplate: z.string().nullable(),
  sortOrder: z.number().int().positive()
});

const ruleResponseSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  ruleKind: z.string(),
  priority: z.number().int(),
  status: z.string(),
  stopProcessingOnMatch: z.boolean(),
  metadata: z.unknown(),
  conditions: z.array(ruleConditionResponseSchema),
  actions: z.array(ruleActionResponseSchema)
});

const ruleSetVersionResponseSchema = z.object({
  id: z.string().uuid(),
  ruleSetId: z.string().uuid(),
  versionNo: z.number().int().positive(),
  participantCountMin: z.number().int(),
  participantCountMax: z.number().int(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  isActive: z.boolean(),
  summaryJson: z.unknown(),
  createdAt: z.string(),
  rules: z.array(ruleResponseSchema)
});

const ruleSetResponseSchema = z.object({
  id: z.string().uuid(),
  module: moduleTypeSchema,
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: ruleStatusSchema,
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

const ruleSetDetailResponseSchema = ruleSetResponseSchema.extend({
  versions: z.array(ruleSetVersionResponseSchema)
});

const defaultByModuleResponseSchema = z.object({
  ruleSet: ruleSetResponseSchema,
  activeVersion: ruleSetVersionResponseSchema.nullable()
});

export async function registerRuleRoutes(app: FastifyInstance, services: AppServices): Promise<void> {
  app.get(
    "/rule-sets",
    {
      schema: {
        tags: ["Rules"],
        summary: "List rule sets",
        querystring: toSwaggerSchema(listRuleSetsQuerySchema),
        response: {
          200: successResponseSchema(z.array(ruleSetResponseSchema), paginationMetaSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const query = listRuleSetsQuerySchema.parse(request.query);
      const result = await services.rules.listRuleSets(query);

      return ok(result.items, {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize)
      });
    }
  );

  app.post(
    "/rule-sets",
    {
      schema: {
        tags: ["Rules"],
        summary: "Create rule set",
        body: toSwaggerSchema(createRuleSetSchema),
        response: {
          201: successResponseSchema(ruleSetResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request, reply) => {
      const input = createRuleSetSchema.parse(request.body);
      const created = await services.rules.createRuleSet({
        module: input.module,
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        status: input.status,
        isDefault: input.isDefault
      });

      reply.status(201);
      return ok(created);
    }
  );

  app.get(
    "/rule-sets/:ruleSetId",
    {
      schema: {
        tags: ["Rules"],
        summary: "Get rule set detail",
        params: toSwaggerSchema(ruleSetIdParamSchema),
        response: {
          200: successResponseSchema(ruleSetDetailResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const params = ruleSetIdParamSchema.parse(request.params);
      return ok(await services.rules.getRuleSet(params.ruleSetId));
    }
  );

  app.patch(
    "/rule-sets/:ruleSetId",
    {
      schema: {
        tags: ["Rules"],
        summary: "Update rule set",
        params: toSwaggerSchema(ruleSetIdParamSchema),
        body: toSwaggerSchema(updateRuleSetSchema),
        response: {
          200: successResponseSchema(ruleSetResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const params = ruleSetIdParamSchema.parse(request.params);
      const input = updateRuleSetSchema.parse(request.body);
      return ok(await services.rules.updateRuleSet(params.ruleSetId, input));
    }
  );

  app.post(
    "/rule-sets/:ruleSetId/versions",
    {
      schema: {
        tags: ["Rules"],
        summary: "Create rule set version",
        params: toSwaggerSchema(ruleSetIdParamSchema),
        body: toSwaggerSchema(createRuleSetVersionSchema),
        response: {
          201: successResponseSchema(ruleSetVersionResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request, reply) => {
      const params = ruleSetIdParamSchema.parse(request.params);
      const input = createRuleSetVersionSchema.parse(request.body);

      const created = await services.rules.createVersion(params.ruleSetId, {
        participantCountMin: input.participantCountMin,
        participantCountMax: input.participantCountMax,
        effectiveFrom: input.effectiveFrom ?? new Date().toISOString(),
        effectiveTo: input.effectiveTo ?? null,
        isActive: input.isActive,
        summaryJson: input.summaryJson ?? null,
        rules: input.rules.map((rule) => ({
          code: rule.code,
          name: rule.name,
          description: rule.description ?? null,
          ruleKind: rule.ruleKind,
          priority: rule.priority,
          status: rule.status,
          stopProcessingOnMatch: rule.stopProcessingOnMatch,
          metadata: rule.metadata ?? null,
          conditions: rule.conditions.map((condition) => ({
            conditionKey: condition.conditionKey,
            operator: condition.operator,
            valueJson: condition.valueJson,
            sortOrder: condition.sortOrder
          })),
          actions: rule.actions.map((action) => ({
            actionType: action.actionType,
            amountVnd: action.amountVnd,
            sourceSelectorType: action.sourceSelectorType,
            sourceSelectorJson: action.sourceSelectorJson,
            destinationSelectorType: action.destinationSelectorType,
            destinationSelectorJson: action.destinationSelectorJson,
            descriptionTemplate: action.descriptionTemplate ?? null,
            sortOrder: action.sortOrder
          }))
        }))
      });

      reply.status(201);
      return ok(created);
    }
  );

  app.get(
    "/rule-sets/:ruleSetId/versions/:versionId",
    {
      schema: {
        tags: ["Rules"],
        summary: "Get rule set version detail",
        params: toSwaggerSchema(ruleSetVersionParamSchema),
        response: {
          200: successResponseSchema(ruleSetVersionResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const params = ruleSetVersionParamSchema.parse(request.params);
      return ok(await services.rules.getVersion(params.ruleSetId, params.versionId));
    }
  );

  app.patch(
    "/rule-sets/:ruleSetId/versions/:versionId",
    {
      schema: {
        tags: ["Rules"],
        summary: "Update rule set version metadata",
        params: toSwaggerSchema(ruleSetVersionParamSchema),
        body: toSwaggerSchema(updateRuleSetVersionSchema),
        response: {
          200: successResponseSchema(ruleSetVersionResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const params = ruleSetVersionParamSchema.parse(request.params);
      const input = updateRuleSetVersionSchema.parse(request.body);

      return ok(
        await services.rules.updateVersion(params.ruleSetId, params.versionId, {
          isActive: input.isActive,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo,
          summaryJson: input.summaryJson ?? undefined
        })
      );
    }
  );

  app.get(
    "/rule-sets/default/by-module/:module",
    {
      schema: {
        tags: ["Rules"],
        summary: "Get default rule set by module",
        params: toSwaggerSchema(moduleParamSchema),
        response: {
          200: successResponseSchema(defaultByModuleResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const params = moduleParamSchema.parse(request.params);
      return ok(await services.rules.getDefaultByModule(params.module));
    }
  );
}
