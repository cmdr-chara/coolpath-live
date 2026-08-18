import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApiError } from "./errors.js";
import { noStore, type Clock } from "./http-response.js";

export function registerErrorHandler(app: FastifyInstance, now: Clock): void {
  app.setErrorHandler((error, request, reply) => {
    const reportedStatus =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : undefined;
    const statusCode =
      error instanceof ApiError
        ? error.statusCode
        : error instanceof z.ZodError
          ? 400
          : reportedStatus !== undefined && reportedStatus >= 400 && reportedStatus < 500
            ? reportedStatus
            : 500;
    const code =
      error instanceof ApiError
        ? error.code
        : statusCode === 404
          ? "NOT_FOUND"
          : statusCode === 409
            ? "CONFLICT"
            : statusCode < 500
              ? "INVALID_REQUEST"
              : "INTERNAL_ERROR";
    const message =
      error instanceof ApiError
        ? error.publicMessage
        : statusCode === 404
          ? "The requested resource was not found."
          : statusCode === 409
            ? "The request conflicts with the current source state."
            : statusCode < 500
              ? "The request is invalid."
              : "The request could not be completed.";

    if (statusCode >= 500) request.log.error({ err: error }, "request failed");
    else request.log.warn({ err: error }, "request rejected");

    noStore(reply);
    void reply.status(statusCode).send({
      error: { code, message },
      meta: { generatedAt: now().toISOString() }
    });
  });
}
