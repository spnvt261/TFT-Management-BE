import "fastify";
import type { AuthenticatedUser } from "../../modules/auth/auth.types.js";
import type { JwtService } from "../../modules/auth/jwt.service.js";

declare module "fastify" {
  interface FastifyInstance {
    jwtAuth: JwtService;
  }

  interface FastifyRequest {
    authUser: AuthenticatedUser | null;
  }
}
