import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { AppServices } from "./core/types/container.js";
import { env } from "./core/config/env.js";
import { registerErrorHandler } from "./core/errors/error-handler.js";
import { registerSystemRoutes } from "./modules/system/routes.js";
import { registerPlayerRoutes } from "./modules/players/routes.js";
import { registerRuleRoutes } from "./modules/rules/routes.js";
import { registerMatchRoutes } from "./modules/matches/routes.js";
import { registerPresetRoutes } from "./modules/presets/routes.js";
import { registerMatchStakesRoutes } from "./modules/match-stakes/routes.js";
import { registerGroupFundRoutes } from "./modules/group-fund/routes.js";
import { registerDashboardRoutes } from "./modules/dashboard/routes.js";
import { openApiTags } from "./core/docs/swagger.js";
import { registerJwtPlugin } from "./modules/auth/jwt-plugin.js";
import { createAuthPreHandler } from "./modules/auth/guard.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { AuthService } from "./modules/auth/auth-service.js";

export async function createApp(services: AppServices) {
  const app = Fastify({
    logger: {
      level: env.app.logLevel
    }
  });

  const allowAllOrigins = env.app.corsAllowedOrigins.includes("*");
  const allowedOrigins = new Set(env.app.corsAllowedOrigins);

  await app.register(cors, {
    origin: (origin, callback) => {
      if (origin === undefined || allowAllOrigins || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin not allowed"), false);
    },
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  });

  registerErrorHandler(app);
  await app.register(swagger, {
    openapi: {
      info: {
        title: "TFT History API",
        description: "Backend API for TFT History Manager",
        version: "0.1.0"
      },
      components: {
        securitySchemes: {
          BearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          }
        }
      },
      security: [{ BearerAuth: [] }],
      tags: openApiTags
    }
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs"
  });

  app.get("/", async () => ({
    success: true,
    data: { service: "tft-history-api", status: "ready" }
  }));

  await registerJwtPlugin(app);

  if (!app.hasRequestDecorator("authUser")) {
    app.decorateRequest("authUser", null);
  }

  app.addHook("preHandler", createAuthPreHandler(app.jwtAuth));

  await app.register(async (api) => {
    const authService = new AuthService(services.repositories, api.jwtAuth);

    await registerSystemRoutes(api);
    await registerAuthRoutes(api, authService);
    await registerPlayerRoutes(api, services);
    await registerRuleRoutes(api, services);
    await registerMatchRoutes(api, services);
    await registerPresetRoutes(api, services);
    await registerMatchStakesRoutes(api, services);
    await registerGroupFundRoutes(api, services);
    await registerDashboardRoutes(api, services);
  }, { prefix: "/api/v1" });

  return app;
}
