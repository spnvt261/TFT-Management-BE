import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { moduleTypeSchema } from "../../domain/models/enums.js";
import { ok } from "../../core/types/api.js";
import type { AppServices } from "../../core/types/container.js";

const upsertPresetSchema = z.object({
  lastRuleSetId: z.string().uuid().nullable().optional(),
  lastRuleSetVersionId: z.string().uuid().nullable().optional(),
  lastSelectedPlayerIds: z.array(z.string().uuid()).default([]),
  lastParticipantCount: z.number().int().min(3).max(4)
});

export async function registerPresetRoutes(app: FastifyInstance, services: AppServices): Promise<void> {
  app.get("/recent-match-presets/:module", async (request) => {
    const params = z.object({ module: moduleTypeSchema }).parse(request.params);
    return ok(await services.presets.getByModule(params.module));
  });

  app.put("/recent-match-presets/:module", async (request) => {
    const params = z.object({ module: moduleTypeSchema }).parse(request.params);
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
  });
}
