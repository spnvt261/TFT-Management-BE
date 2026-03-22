import { env } from "./core/config/env.js";
import { logger } from "./core/logger/logger.js";
import { ensureDatabaseExists } from "./db/bootstrap/ensure-database.js";
import { runFlywayMigrations } from "./db/migrations/flyway-runner.js";
import { createPgPool } from "./db/postgres/pool.js";
import { buildServices } from "./core/types/container.js";
import { createApp } from "./app.js";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export async function bootstrapAndStart(): Promise<void> {
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
    cwd: process.cwd()
  });

  logger.info("Migration stage complete");
  logger.info("Startup stage 3/3: starting HTTP server");

  const pool = createPgPool();

  try {
    const services = await buildServices(pool);
    const app = await createApp(services);

    app.addHook("onClose", async () => {
      await pool.end();
    });

    await app.listen({ host: env.app.host, port: env.app.port });
    logger.info({ port: env.app.port, host: env.app.host }, "HTTP server started");
  } catch (error) {
    await pool.end();
    throw error;
  }
}

const currentModulePath = resolve(fileURLToPath(import.meta.url));
const invokedModulePath = process.argv[1] !== undefined ? resolve(process.argv[1]) : undefined;
const isEntrypoint =
  invokedModulePath !== undefined &&
  (process.platform === "win32"
    ? currentModulePath.toLowerCase() === invokedModulePath.toLowerCase()
    : currentModulePath === invokedModulePath);

if (isEntrypoint) {
  bootstrapAndStart().catch((error) => {
    logger.error(error, "Startup failed before HTTP server could start");
    process.exit(1);
  });
}
