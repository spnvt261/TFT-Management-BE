import type { FastifyInstance } from "fastify";
import { env } from "../../core/config/env.js";
import { createJwtService } from "./jwt.service.js";

export async function registerJwtPlugin(app: FastifyInstance): Promise<void> {
  if (app.hasDecorator("jwtAuth")) {
    return;
  }

  app.decorate(
    "jwtAuth",
    createJwtService({
      secret: env.auth.jwtSecret,
      expiresIn: env.auth.jwtExpiresIn
    })
  );
}
