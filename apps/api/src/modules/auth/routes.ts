import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AuthService } from "./auth-service.js";
import { ok } from "../../core/types/api.js";
import { errorResponseSchemas, successResponseSchema, toSwaggerSchema } from "../../core/docs/swagger.js";

const loginBodySchema = z.object({
  accessCode: z.string()
});

const loginResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number().int().positive(),
  role: z.enum(["ADMIN", "USER"])
});

export async function registerAuthRoutes(app: FastifyInstance, authService: AuthService): Promise<void> {
  app.post(
    "/auth/login",
    {
      schema: {
        tags: ["Auth"],
        summary: "Login with internal access code",
        body: toSwaggerSchema(loginBodySchema),
        security: [],
        response: {
          200: successResponseSchema(loginResponseSchema),
          ...errorResponseSchemas
        }
      }
    },
    async (request) => {
      const body = loginBodySchema.parse(request.body);
      return ok(await authService.login(body.accessCode));
    }
  );
}
