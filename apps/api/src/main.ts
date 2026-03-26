import { env } from "./core/config/env.js";
import { logger } from "./core/logger/logger.js";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { bootstrapApp } from "./bootstrap.js";

export async function bootstrapAndStart(): Promise<void> {
  const { app } = await bootstrapApp({ runStartupTasks: true });
  logger.info("Startup stage 3/3: starting HTTP server");

  try {
    await app.listen({ host: env.app.host, port: env.app.port });
    logger.info({ port: env.app.port, host: env.app.host }, "HTTP server started");
  } catch (error) {
    await app.close();
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
