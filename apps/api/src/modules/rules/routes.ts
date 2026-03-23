import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { uuidSchema } from "../../core/validation/uuid.js";
import { ok } from "../../core/types/api.js";
import type { AppServices } from "../../core/types/container.js";
import {
  moduleTypeSchema,
  ruleStatusSchema,
  ruleKindSchema,
  conditionOperatorSchema,
  actionTypeSchema,
  selectorTypeSchema
} from "../../domain/models/enums.js";
import { errorResponseSchemas, paginationMetaSchema, successResponseSchema, toSwaggerSchema } from "../../core/docs/swagger.js";
import { matchStakesBuilderConfigInputSchema, ruleBuilderTypeSchema } from "./builder-types.js";

const modulesQuerySchema = z
  .preprocess((value) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (Array.isArray(value)) {
      const normalized = value
        .flatMap((item) => String(item).split(","))
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      return normalized.length > 0 ? normalized : undefined;
    }

    if (typeof value === "string") {
      const normalized = value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      return normalized.length > 0 ? normalized : undefined;
    }

    return value;
  }, z.array(moduleTypeSchema).min(1))
  .optional();

const searchQuerySchema = z
  .preprocess((value) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value === "string") {
      const normalized = value.trim();
      return normalized.length > 0 ? normalized : undefined;
    }

    return value;
  }, z.string().max(150))
  .optional();

const listRuleSetsQuerySchema = z.object({
  module: moduleTypeSchema.optional(),
  modules: modulesQuerySchema,
  status: ruleStatusSchema.optional(),
  isDefault: z.coerce.boolean().optional(),
  default: z.coerce.boolean().optional(),
  search: searchQuerySchema,
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

const ruleConditionSchema = z.object({
  conditionKey: z.enum([
    "participantCount",
    "module",
    "subjectRelativeRank",
    "subjectAbsolutePlacement",
    "matchContainsAbsolutePlacements"
  ]),
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

const ruleVersionMutationSchema = z
  .object({
    description: z.string().nullable(),
    participantCountMin: z.coerce.number().int().min(2).max(8),
    participantCountMax: z.coerce.number().int().min(2).max(8),
    effectiveTo: z.string().datetime().nullable().optional(),
    isActive: z.boolean().optional().default(true),
    summaryJson: z.record(z.string(), z.unknown()).nullable().optional(),
    builderType: ruleBuilderTypeSchema.nullable().optional(),
    builderConfig: z.union([matchStakesBuilderConfigInputSchema, z.record(z.string(), z.unknown())]).nullable().optional(),
    rules: z.array(ruleSchema).min(1).optional()
  })
  .refine((value) => value.participantCountMin <= value.participantCountMax, {
    message: "participantCountMin must be less than or equal to participantCountMax"
  });

const createRuleSetSchema = ruleVersionMutationSchema
  .extend({
    module: moduleTypeSchema,
    name: z.string().min(1).max(150),
    status: ruleStatusSchema.optional().default("ACTIVE"),
    isDefault: z.boolean().optional().default(false)
  })
  .strict();

const updateRuleSetSchema = ruleVersionMutationSchema
  .extend({
    name: z.string().min(1).max(150).optional(),
    status: ruleStatusSchema.optional(),
    isDefault: z.boolean().optional()
  })
  .strict();

const ruleSetIdParamSchema = z.object({ ruleSetId: uuidSchema });
const moduleParamSchema = z.object({ module: moduleTypeSchema });
const defaultByModuleQuerySchema = z.object({
  participantCount: z.coerce.number().int().pipe(z.union([z.literal(3), z.literal(4)])).optional()
});

const ruleConditionResponseSchema = z.object({
  id: uuidSchema.optional(),
  conditionKey: z.string(),
  operator: z.string(),
  valueJson: z.unknown(),
  sortOrder: z.number().int().positive()
});

const ruleActionResponseSchema = z.object({
  id: uuidSchema.optional(),
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
  id: uuidSchema.optional(),
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
  id: uuidSchema,
  ruleSetId: uuidSchema,
  versionNo: z.number().int().positive(),
  description: z.string().nullable(),
  participantCountMin: z.number().int(),
  participantCountMax: z.number().int(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  isActive: z.boolean(),
  summaryJson: z.unknown(),
  builderType: z.string().nullable(),
  builderConfig: z.unknown().nullable(),
  createdAt: z.string(),
  rules: z.array(ruleResponseSchema)
});

const ruleSetResponseSchema = z.object({
  id: uuidSchema,
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
  latestVersion: ruleSetVersionResponseSchema.nullable(),
  versions: z.array(ruleSetVersionResponseSchema)
});

const defaultByModuleResponseSchema = z.object({
  ruleSet: ruleSetResponseSchema,
  activeVersion: ruleSetVersionResponseSchema.nullable()
});

function mapRuleInput(input: z.infer<typeof ruleSchema>) {
  return {
    code: input.code,
    name: input.name,
    description: input.description ?? null,
    ruleKind: input.ruleKind,
    priority: input.priority,
    status: input.status,
    stopProcessingOnMatch: input.stopProcessingOnMatch,
    metadata: input.metadata ?? null,
    conditions: input.conditions.map((condition) => ({
      conditionKey: condition.conditionKey,
      operator: condition.operator,
      valueJson: condition.valueJson,
      sortOrder: condition.sortOrder
    })),
    actions: input.actions.map((action) => ({
      actionType: action.actionType,
      amountVnd: action.amountVnd,
      sourceSelectorType: action.sourceSelectorType,
      sourceSelectorJson: action.sourceSelectorJson,
      destinationSelectorType: action.destinationSelectorType,
      destinationSelectorJson: action.destinationSelectorJson,
      descriptionTemplate: action.descriptionTemplate ?? null,
      sortOrder: action.sortOrder
    }))
  };
}

export async function registerRuleRoutes(app: FastifyInstance, services: AppServices): Promise<void> {
  app.get(
    "/rule-sets",
    {
      schema: {
        tags: ["Rules"],
        summary: "List rules",
        querystring: toSwaggerSchema(listRuleSetsQuerySchema),
        response: {
          200: successResponseSchema(z.array(ruleSetResponseSchema), paginationMetaSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const query = listRuleSetsQuerySchema.parse(request.query);
      const result = await services.rules.listRuleSets({
        modules: query.modules ?? (query.module ? [query.module] : undefined),
        status: query.status,
        isDefault: query.isDefault ?? query.default,
        search: query.search,
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

  app.post(
    "/rule-sets",
    {
      schema: {
        tags: ["Rules"],
        summary: "Create rule and initial version",
        description:
          "Creates a rule-set identity and the first immutable version in one request. Rule code is generated by the backend.",
        body: toSwaggerSchema(createRuleSetSchema),
        response: {
          201: successResponseSchema(ruleSetDetailResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request, reply) => {
      const input = createRuleSetSchema.parse(request.body);
      const created = await services.rules.createRule({
        module: input.module,
        name: input.name,
        status: input.status,
        isDefault: input.isDefault,
        version: {
          description: input.description,
          participantCountMin: input.participantCountMin,
          participantCountMax: input.participantCountMax,
          effectiveTo: input.effectiveTo ?? null,
          isActive: input.isActive,
          summaryJson: input.summaryJson ?? null,
          builderType: input.builderType,
          builderConfig: input.builderConfig,
          rules: input.rules?.map(mapRuleInput)
        }
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
        summary: "Get rule detail",
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
        summary: "Edit rule by creating a new version",
        description:
          "Applies root metadata updates (name/status/isDefault) and creates a brand-new immutable version snapshot for rule logic/config.",
        params: toSwaggerSchema(ruleSetIdParamSchema),
        body: toSwaggerSchema(updateRuleSetSchema),
        response: {
          200: successResponseSchema(ruleSetDetailResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const params = ruleSetIdParamSchema.parse(request.params);
      const input = updateRuleSetSchema.parse(request.body);

      return ok(
        await services.rules.editRule(params.ruleSetId, {
          name: input.name,
          status: input.status,
          isDefault: input.isDefault,
          version: {
            description: input.description,
            participantCountMin: input.participantCountMin,
            participantCountMax: input.participantCountMax,
            effectiveTo: input.effectiveTo ?? null,
            isActive: input.isActive,
            summaryJson: input.summaryJson ?? null,
            builderType: input.builderType,
            builderConfig: input.builderConfig,
            rules: input.rules?.map(mapRuleInput)
          }
        })
      );
    }
  );

  app.get(
    "/rule-sets/default/by-module/:module",
    {
      schema: {
        tags: ["Rules"],
        summary: "Get default rule by module",
        params: toSwaggerSchema(moduleParamSchema),
        querystring: toSwaggerSchema(defaultByModuleQuerySchema),
        response: {
          200: successResponseSchema(defaultByModuleResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const params = moduleParamSchema.parse(request.params);
      const query = defaultByModuleQuerySchema.parse(request.query);
      return ok(await services.rules.getDefaultByModule(params.module, query.participantCount));
    }
  );
}
