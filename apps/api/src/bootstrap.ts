import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { env } from "./core/config/env.js";
import { logger } from "./core/logger/logger.js";
import { ensureDatabaseExists } from "./db/bootstrap/ensure-database.js";
import { runFlywayMigrations } from "./db/migrations/flyway-runner.js";
import { createPgPool } from "./db/postgres/pool.js";
import { buildServices } from "./core/types/container.js";
import { createApp } from "./app.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const apiRootDirectory = resolve(currentDirectory, "..");

export interface BootstrappedApp {
  app: FastifyInstance;
  pool: Pool;
}

export interface BootstrapOptions {
  runStartupTasks?: boolean;
}

export async function bootstrapApp(options: BootstrapOptions = {}): Promise<BootstrappedApp> {
  const runStartupTasks = options.runStartupTasks ?? true;

  if (runStartupTasks) {
    logger.info("Startup stage 1/3: ensuring target database exists");

    const bootstrapResult = await ensureDatabaseExists({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      adminDatabase: env.db.adminDatabase,
      targetDatabase: env.db.database,
      ssl: env.db.ssl,
      enabled: env.db.bootstrapEnabled
    });

    logger.info({ bootstrapResult }, "Database bootstrap stage complete");

    logger.info("Startup stage 2/3: running Flyway migrations");
    await runFlywayMigrations({
      enabled: env.flyway.enabled,
      command: env.flyway.command,
      host: env.db.host,
      port: env.db.port,
      database: env.db.database,
      user: env.db.user,
      password: env.db.password,
      locations: env.flyway.locations,
      cwd: apiRootDirectory
    });

    logger.info("Migration stage complete");
  } else {
    logger.info("Startup tasks skipped for this runtime");
  }

  const pool = createPgPool();

  try {
    const services = await buildServices(pool);
    const app = await createApp(services);

    app.addHook("onClose", async () => {
      await pool.end();
    });

    return { app, pool };
  } catch (error) {
    await pool.end();
    throw error;
  }
}
