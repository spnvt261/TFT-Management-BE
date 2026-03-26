import type { FastifyInstance } from "fastify";
import type { IncomingMessage, ServerResponse } from "node:http";
import { logger } from "./core/logger/logger.js";
import { bootstrapApp } from "./bootstrap.js";

let appPromise: Promise<FastifyInstance> | null = null;

async function getApp(): Promise<FastifyInstance> {
  if (appPromise === null) {
    appPromise = (async () => {
      const { app } = await bootstrapApp({ runStartupTasks: true });
      await app.ready();
      return app;
    })().catch((error) => {
      appPromise = null;
      throw error;
    });
  }

  return appPromise;
}

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const app = await getApp();
    app.server.emit("request", request, response);
  } catch (error) {
    logger.error(error, "Vercel handler failed");

    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Internal server error"
          }
        })
      );
    }
  }
}
