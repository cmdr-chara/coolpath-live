import { createHash, timingSafeEqual } from "node:crypto";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { CoolPathRepository } from "@coolpath/db";
import { formatInstantInTimeZone } from "@coolpath/domain";
import {
  BrightDataScraperStudioClient,
  MockScraperStudioClient,
  normalizePa211Rows,
  type ScraperStudioClient
} from "@coolpath/source-adapters";
import { DEMO_SOURCE_ID } from "@coolpath/test-fixtures";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import { type AppConfig, getConfig } from "./config.js";
import { IngestionService } from "./ingestion-service.js";
import {
  PRIMARY_SOURCE_ID,
  seedPrimarySourceConfiguration,
  seedSourceConfiguration
} from "./seed.js";

export interface AppDependencies {
  config?: AppConfig;
  repository?: CoolPathRepository;
  scraperClient?: ScraperStudioClient;
}

function envelope<T>(data: T) {
  return { data, meta: { generatedAt: new Date().toISOString() } };
}

function withEtag(reply: FastifyReply, payload: unknown, contentHash?: string): unknown {
  const tag = contentHash ?? createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  reply.header("etag", `"${tag}"`);
  return payload;
}

function validBearerToken(authorization: string | undefined, expected: string): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice("Bearer ".length), "utf8");
  const target = Buffer.from(expected, "utf8");
  return supplied.length === target.length && timingSafeEqual(supplied, target);
}

export async function buildApp(dependencies: AppDependencies = {}): Promise<FastifyInstance> {
  const config = dependencies.config ?? getConfig();
  if (config.COOLPATH_MODE === "real" && !config.PRIMARY_COLLECTOR_ID) {
    throw new Error("PRIMARY_COLLECTOR_ID is required in real mode");
  }
  if (config.COOLPATH_MODE === "real" && !config.OPERATOR_API_TOKEN) {
    throw new Error("OPERATOR_API_TOKEN is required in real mode");
  }
  const repository = dependencies.repository ?? new CoolPathRepository(config.DATABASE_URL);
  const mockClient =
    dependencies.scraperClient instanceof MockScraperStudioClient
      ? dependencies.scraperClient
      : new MockScraperStudioClient();
  const client =
    dependencies.scraperClient ??
    (config.COOLPATH_MODE === "real"
      ? new BrightDataScraperStudioClient({
          apiToken: config.BRIGHT_DATA_API_TOKEN ?? "",
          apiBaseUrl: config.BRIGHT_DATA_API_BASE_URL,
          pollIntervalMs: config.BRIGHT_DATA_POLL_INTERVAL_MS,
          pollTimeoutMs: config.BRIGHT_DATA_POLL_TIMEOUT_MS
        })
      : mockClient);
  const ingestion = new IngestionService(
    repository,
    client,
    config.COOLPATH_MODE === "real" ? normalizePa211Rows : undefined
  );
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "test" ? "silent" : "info",
      redact: [
        "req.headers.authorization",
        "headers.authorization",
        "BRIGHT_DATA_API_TOKEN",
        "*.token",
        "*.apiToken"
      ]
    }
  });

  await app.register(cors, { origin: config.WEB_ORIGIN, methods: ["GET", "POST"] });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", config.WEB_ORIGIN],
        imgSrc: ["'self'", "data:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"]
      }
    }
  });

  app.setErrorHandler((error, request, reply) => {
    const reportedStatus =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : undefined;
    const statusCode =
      error instanceof z.ZodError
        ? 400
        : reportedStatus !== undefined && reportedStatus >= 400 && reportedStatus < 500
          ? reportedStatus
          : 500;
    if (statusCode >= 500) request.log.error({ err: error }, "request failed");
    else request.log.warn({ err: error }, "request rejected");
    void reply.status(statusCode).send({
      error: {
        code: statusCode < 500 ? "INVALID_REQUEST" : "INTERNAL_ERROR",
        message:
          statusCode < 500 ? "The request is invalid." : "The request could not be completed."
      },
      meta: { generatedAt: new Date().toISOString() }
    });
  });

  app.get("/healthz", () => envelope({ status: "ok", mode: config.COOLPATH_MODE }));

  app.get("/api/cities", async (_request, reply) => {
    const data = repository.listCities().map((city) => ({
      id: city.id,
      slug: city.slug,
      displayName: city.displayName,
      region: city.region,
      timezone: city.timezone,
      sourceStatus: city.source.currentState,
      lastVerified: city.publishedSnapshot?.observedAt ?? null,
      lastVerifiedLocal: city.publishedSnapshot
        ? formatInstantInTimeZone(city.publishedSnapshot.observedAt, city.timezone)
        : null,
      siteCount: city.publishedSnapshot?.sites.length ?? 0,
      mode: city.source.mode
    }));
    const payload = envelope(data);
    return withEtag(reply, payload);
  });

  app.get("/api/cities/:slug", async (request, reply) => {
    const { slug } = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/) }).parse(request.params);
    const city = repository.getCityBySlug(slug);
    if (!city) return reply.status(404).send(envelope(null));
    const payload = envelope({
      city: {
        id: city.id,
        slug: city.slug,
        displayName: city.displayName,
        region: city.region,
        timezone: city.timezone
      },
      source: {
        id: city.source.id,
        agencyName: city.source.agencyName,
        canonicalUrl: city.source.canonicalUrl,
        collectorId: city.source.collectorId,
        freshnessTtlMinutes: city.source.freshnessTtlMinutes,
        policyVersion: city.source.policyVersion,
        status: city.source.currentState,
        mode: city.source.mode
      },
      snapshot: city.publishedSnapshot
        ? {
            ...city.publishedSnapshot,
            observedAtLocal: formatInstantInTimeZone(
              city.publishedSnapshot.observedAt,
              city.timezone
            )
          }
        : null,
      latestRun: repository.getLatestRun(city.source.id),
      timeline: repository.listTimeline(city.source.id)
    });
    return withEtag(reply, payload, city.publishedSnapshot?.contentHash);
  });

  app.get("/api/incidents/:sourceId/current", async (request, reply) => {
    const { sourceId } = z.object({ sourceId: z.string().min(1).max(80) }).parse(request.params);
    if (!repository.getSource(sourceId)) return reply.status(404).send(envelope(null));
    const payload = envelope(repository.getCurrentIncident(sourceId));
    return withEtag(reply, payload);
  });

  if (config.COOLPATH_MODE === "mock") {
    app.post("/api/demo/reset", async (_request, reply) => {
      repository.reset();
      mockClient.reset();
      seedSourceConfiguration(repository);
      await ingestion.runSource(DEMO_SOURCE_ID);
      return reply.send(envelope({ stage: "healthy", sourceId: DEMO_SOURCE_ID }));
    });

    app.post("/api/demo/drift", async (_request, reply) => {
      mockClient.setLayout("v2");
      const result = await ingestion.runSource(DEMO_SOURCE_ID);
      return reply.send(
        envelope({
          stage: "incident",
          disposition: result.validation.disposition,
          reasons: [...result.validation.hardFailures, ...result.validation.softAnomalies]
        })
      );
    });

    app.post("/api/demo/heal", async (_request, reply) => {
      return reply.send(envelope(await ingestion.requestHeal(DEMO_SOURCE_ID)));
    });

    app.post("/api/demo/heal/decision", async (request, reply) => {
      const { approve } = z.object({ approve: z.boolean() }).parse(request.body);
      const incident = await ingestion.decideHeal(DEMO_SOURCE_ID, approve);
      return reply.send(envelope({ approved: approve, recovered: approve && incident === null }));
    });
  } else {
    const requireOperator = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (validBearerToken(request.headers.authorization, config.OPERATOR_API_TOKEN as string)) {
        return;
      }
      await reply.status(401).send({
        error: { code: "UNAUTHORIZED", message: "Operator authentication is required." },
        meta: { generatedAt: new Date().toISOString() }
      });
    };

    app.post(
      "/api/operator/sources/:sourceId/check",
      { preHandler: requireOperator },
      async (request, reply) => {
        const { sourceId } = z
          .object({ sourceId: z.string().min(1).max(80) })
          .parse(request.params);
        const result = await ingestion.runSource(sourceId);
        return reply.send(
          envelope({
            runId: result.runId,
            disposition: result.validation.disposition,
            reasons: [...result.validation.hardFailures, ...result.validation.softAnomalies],
            recordCount: result.validation.recordCount
          })
        );
      }
    );

    app.post(
      "/api/operator/sources/:sourceId/heal",
      { preHandler: requireOperator },
      async (request, reply) => {
        const { sourceId } = z
          .object({ sourceId: z.string().min(1).max(80) })
          .parse(request.params);
        return reply.send(envelope(await ingestion.requestHeal(sourceId)));
      }
    );

    app.post(
      "/api/operator/sources/:sourceId/heal/decision",
      { preHandler: requireOperator },
      async (request, reply) => {
        const { sourceId } = z
          .object({ sourceId: z.string().min(1).max(80) })
          .parse(request.params);
        const { approve } = z.object({ approve: z.boolean() }).parse(request.body);
        const incident = await ingestion.decideHeal(sourceId, approve);
        return reply.send(
          envelope({ approved: approve, recovered: approve && incident === null, incident })
        );
      }
    );
  }

  app.addHook("onClose", () => {
    if (!dependencies.repository) repository.close();
  });

  const initialSourceId = config.COOLPATH_MODE === "real" ? PRIMARY_SOURCE_ID : DEMO_SOURCE_ID;
  if (config.COOLPATH_MODE === "real") {
    seedPrimarySourceConfiguration(repository, config.PRIMARY_COLLECTOR_ID as string);
  } else {
    seedSourceConfiguration(repository);
  }
  if (!repository.getPublishedSnapshot(initialSourceId)) {
    try {
      await ingestion.runSource(initialSourceId);
    } catch (error) {
      if (config.COOLPATH_MODE !== "real") throw error;
      app.log.warn({ err: error, sourceId: initialSourceId }, "initial source check failed");
    }
  }

  return app;
}
