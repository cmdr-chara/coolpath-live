import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { validBearerToken } from "../operator-auth.js";
import { envelope, noStore, type Clock } from "../http-response.js";
import type { IngestionService } from "../ingestion-service.js";

interface OperatorRouteDependencies {
  ingestion: IngestionService;
  operatorToken: string;
  now: Clock;
}

export function registerOperatorRoutes(
  app: FastifyInstance,
  dependencies: OperatorRouteDependencies
): void {
  const { ingestion, operatorToken, now } = dependencies;

  const requireOperator = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (validBearerToken(request.headers.authorization, operatorToken)) return;
    noStore(reply);
    await reply.status(401).send({
      error: { code: "UNAUTHORIZED", message: "Operator authentication is required." },
      meta: { generatedAt: now().toISOString() }
    });
  };

  app.post(
    "/api/operator/sources/:sourceId/check",
    { preHandler: requireOperator },
    async (request, reply) => {
      noStore(reply);
      const { sourceId } = z.object({ sourceId: z.string().min(1).max(80) }).parse(request.params);
      const result = await ingestion.runSource(sourceId);
      return reply.send(
        envelope(
          {
            runId: result.runId,
            disposition: result.validation.disposition,
            reasons: [...result.validation.hardFailures, ...result.validation.softAnomalies],
            recordCount: result.validation.recordCount,
            coverage: result.validation.coverage
          },
          now
        )
      );
    }
  );

  app.post(
    "/api/operator/sources/:sourceId/heal",
    { preHandler: requireOperator },
    async (request, reply) => {
      noStore(reply);
      const { sourceId } = z.object({ sourceId: z.string().min(1).max(80) }).parse(request.params);
      return reply.send(envelope(await ingestion.requestHeal(sourceId), now));
    }
  );

  app.post(
    "/api/operator/sources/:sourceId/heal/decision",
    { preHandler: requireOperator },
    async (request, reply) => {
      noStore(reply);
      const { sourceId } = z.object({ sourceId: z.string().min(1).max(80) }).parse(request.params);
      const { approve } = z.object({ approve: z.boolean() }).parse(request.body);
      const incident = await ingestion.decideHeal(sourceId, approve);
      return reply.send(
        envelope({ approved: approve, recovered: approve && incident === null, incident }, now)
      );
    }
  );
}
