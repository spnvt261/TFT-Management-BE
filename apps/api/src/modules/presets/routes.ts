import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { uuidSchema } from "../../core/validation/uuid.js";
import { moduleTypeSchema } from "../../domain/models/enums.js";
import { ok } from "../../core/types/api.js";
import type { AppServices } from "../../core/types/container.js";
import { errorResponseSchemas, successResponseSchema, toSwaggerSchema } from "../../core/docs/swagger.js";

const upsertPresetSchema = z.object({
  lastRuleSetId: uuidSchema.nullable().optional(),
  lastRuleSetVersionId: uuidSchema.nullable().optional(),
  lastSelectedPlayerIds: z.array(uuidSchema).default([]),
  lastParticipantCount: z.number().int().min(3).max(4)
});

const presetModuleParamSchema = z.object({ module: moduleTypeSchema });

const recentPresetResponseSchema = z.object({
  module: moduleTypeSchema,
  lastRuleSetId: uuidSchema.nullable(),
  lastRuleSetVersionId: uuidSchema.nullable(),
  lastSelectedPlayerIds: z.array(uuidSchema),
  lastParticipantCount: z.number().int().nullable(),
  lastUsedAt: z.string().nullable()
});

export async function registerPresetRoutes(app: FastifyInstance, services: AppServices): Promise<void> {
  app.get(
    "/recent-match-presets/:module",
    {
      schema: {
        tags: ["Presets"],
        summary: "Get recent match preset by module",
        params: toSwaggerSchema(presetModuleParamSchema),
        response: {
          200: successResponseSchema(recentPresetResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const params = presetModuleParamSchema.parse(request.params);
      return ok(await services.presets.getByModule(params.module));
    }
  );

  app.put(
    "/recent-match-presets/:module",
    {
      schema: {
        tags: ["Presets"],
        summary: "Upsert recent match preset by module",
        params: toSwaggerSchema(presetModuleParamSchema),
        body: toSwaggerSchema(upsertPresetSchema),
        response: {
          200: successResponseSchema(recentPresetResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const params = presetModuleParamSchema.parse(request.params);
      const body = upsertPresetSchema.parse(request.body);

      return ok(
        await services.presets.upsert({
          module: params.module,
          lastRuleSetId: body.lastRuleSetId ?? null,
          lastRuleSetVersionId: body.lastRuleSetVersionId ?? null,
          lastSelectedPlayerIds: body.lastSelectedPlayerIds,
          lastParticipantCount: body.lastParticipantCount
        })
      );
    }
  );
}
