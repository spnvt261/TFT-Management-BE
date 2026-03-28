import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AuthService } from "./auth-service.js";
import { ok } from "../../core/types/api.js";
import { errorResponseSchemas, successResponseSchema, toSwaggerSchema } from "../../core/docs/swagger.js";

const checkAccessCodeBodySchema = z.object({
  accessCode: z.string()
});

const userLoginResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number().int().positive(),
  role: z.literal("USER")
});

const adminLoginResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number().int().positive(),
  role: z.literal("ADMIN")
});

export async function registerAuthRoutes(app: FastifyInstance, authService: AuthService): Promise<void> {
  app.post(
    "/auth/login",
    {
      schema: {
        tags: ["Auth"],
        summary: "Login as default USER",
        description: "Issues a USER token for public read access.",
        security: [],
        response: {
          200: successResponseSchema(userLoginResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async () => {
      return ok(await authService.loginAsUser());
    }
  );

  app.post(
    "/auth/check-access-code",
    {
      schema: {
        tags: ["Auth"],
        summary: "Login as ADMIN with access code",
        description: "Validates admin access code and issues an ADMIN token when code is correct.",
        body: toSwaggerSchema(checkAccessCodeBodySchema),
        security: [],
        response: {
          200: successResponseSchema(adminLoginResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const body = checkAccessCodeBodySchema.parse(request.body);
      return ok(await authService.loginAsAdmin(body.accessCode));
    }
  );
}
