import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { AppError } from "./app-error.js";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: error.issues
        }
      });
      return;
    }

    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      });
      return;
    }

    app.log.error(error);
    reply.status(500).send({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error"
      }
    });
  });
}
