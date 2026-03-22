import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { uuidSchema } from "../../core/validation/uuid.js";
import { ok } from "../../core/types/api.js";
import type { AppServices } from "../../core/types/container.js";
import { errorResponseSchemas, paginationMetaSchema, successResponseSchema, toSwaggerSchema } from "../../core/docs/swagger.js";

const listQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

const createSchema = z.object({
  displayName: z.string().min(1).max(120),
  slug: z.string().min(1).max(120).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  isActive: z.boolean().optional().default(true)
});

const updateSchema = z
  .object({
    displayName: z.string().min(1).max(120).optional(),
    slug: z.string().min(1).max(120).nullable().optional(),
    avatarUrl: z.string().url().nullable().optional(),
    isActive: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

const playerIdParamSchema = z.object({ playerId: uuidSchema });

const playerResponseSchema = z.object({
  id: uuidSchema,
  displayName: z.string(),
  slug: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

const playerDeleteResponseSchema = z.object({
  id: uuidSchema,
  isActive: z.boolean()
});

export async function registerPlayerRoutes(app: FastifyInstance, services: AppServices): Promise<void> {
  app.get(
    "/players",
    {
      schema: {
        tags: ["Players"],
        summary: "List players",
        querystring: toSwaggerSchema(listQuerySchema),
        response: {
          200: successResponseSchema(z.array(playerResponseSchema), paginationMetaSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const query = listQuerySchema.parse(request.query);
      const result = await services.players.list(query);

      return ok(result.items, {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize)
      });
    }
  );

  app.post(
    "/players",
    {
      schema: {
        tags: ["Players"],
        summary: "Create player",
        body: toSwaggerSchema(createSchema),
        response: {
          201: successResponseSchema(playerResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request, reply) => {
      const input = createSchema.parse(request.body);
      const created = await services.players.create({
        displayName: input.displayName,
        slug: input.slug ?? null,
        avatarUrl: input.avatarUrl ?? null,
        isActive: input.isActive
      });

      reply.status(201);
      return ok(created);
    }
  );

  app.get(
    "/players/:playerId",
    {
      schema: {
        tags: ["Players"],
        summary: "Get player by id",
        params: toSwaggerSchema(playerIdParamSchema),
        response: {
          200: successResponseSchema(playerResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const params = playerIdParamSchema.parse(request.params);
      return ok(await services.players.getById(params.playerId));
    }
  );

  app.patch(
    "/players/:playerId",
    {
      schema: {
        tags: ["Players"],
        summary: "Update player",
        params: toSwaggerSchema(playerIdParamSchema),
        body: toSwaggerSchema(updateSchema),
        response: {
          200: successResponseSchema(playerResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const params = playerIdParamSchema.parse(request.params);
      const input = updateSchema.parse(request.body);
      const updated = await services.players.update(params.playerId, input);
      return ok(updated);
    }
  );

  app.delete(
    "/players/:playerId",
    {
      schema: {
        tags: ["Players"],
        summary: "Soft delete player",
        params: toSwaggerSchema(playerIdParamSchema),
        response: {
          200: successResponseSchema(playerDeleteResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const params = playerIdParamSchema.parse(request.params);
      const deleted = await services.players.softDelete(params.playerId);
      return ok({ id: deleted.id, isActive: deleted.isActive });
    }
  );
}
