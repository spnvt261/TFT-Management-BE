import Fastify from "fastify";
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

export async function createApp(services: AppServices) {
  const app = Fastify({
    logger: {
      level: env.app.logLevel
    }
  });

  registerErrorHandler(app);

  app.get("/", async () => ({
    success: true,
    data: { service: "tft-history-api", status: "ready" }
  }));

  await app.register(async (api) => {
    await registerSystemRoutes(api);
    await registerPlayerRoutes(api, services);
    await registerRuleRoutes(api, services);
    await registerMatchRoutes(api, services);
    await registerPresetRoutes(api, services);
    await registerMatchStakesRoutes(api, services);
    await registerGroupFundRoutes(api, services);
  }, { prefix: "/api/v1" });

  return app;
}
