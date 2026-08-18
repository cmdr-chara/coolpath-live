import { type CoolPathRepository } from "@coolpath/db";
import { MockScraperStudioClient } from "@coolpath/source-adapters";
import { DEMO_SOURCE_ID } from "@coolpath/test-fixtures";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { envelope, noStore, type Clock } from "../http-response.js";
import type { IngestionService } from "../ingestion-service.js";
import { seedSourceConfiguration } from "../seed.js";

interface DemoRouteDependencies {
  repository: CoolPathRepository;
  mockClient: MockScraperStudioClient;
  ingestion: IngestionService;
  now: Clock;
}

export function registerDemoRoutes(
  app: FastifyInstance,
  dependencies: DemoRouteDependencies
): void {
  const { repository, mockClient, ingestion, now } = dependencies;

  app.post("/api/demo/reset", async (_request, reply) => {
    noStore(reply);
    repository.reset();
    mockClient.reset();
    seedSourceConfiguration(repository);
    await ingestion.runSource(DEMO_SOURCE_ID);
    return reply.send(envelope({ stage: "healthy", sourceId: DEMO_SOURCE_ID }, now));
  });

  app.post("/api/demo/drift", async (_request, reply) => {
    noStore(reply);
    mockClient.setLayout("v2");
    const result = await ingestion.runSource(DEMO_SOURCE_ID);
    return reply.send(
      envelope(
        {
          stage: "incident",
          disposition: result.validation.disposition,
          reasons: [...result.validation.hardFailures, ...result.validation.softAnomalies]
        },
        now
      )
    );
  });

  app.post("/api/demo/heal", async (_request, reply) => {
    noStore(reply);
    return reply.send(envelope(await ingestion.requestHeal(DEMO_SOURCE_ID), now));
  });

  app.post("/api/demo/heal/decision", async (request, reply) => {
    noStore(reply);
    const { approve } = z.object({ approve: z.boolean() }).parse(request.body);
    const incident = await ingestion.decideHeal(DEMO_SOURCE_ID, approve);
    return reply.send(envelope({ approved: approve, recovered: approve && incident === null }, now));
  });
}
