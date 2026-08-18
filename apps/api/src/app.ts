import { createHash, timingSafeEqual } from "node:crypto";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { CoolPathRepository, type StoredSource } from "@coolpath/db";
import { formatInstantInTimeZone } from "@coolpath/domain";
import {
  BrightDataScraperStudioClient,
  MockScraperStudioClient,
  normalizePa211RowsWithMetrics,
  type ScraperStudioClient
} from "@coolpath/source-adapters";
import { DEMO_SOURCE_ID } from "@coolpath/test-fixtures";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import { type AppConfig, getConfig } from "./config.js";
import { ApiError } from "./errors.js";
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
  now?: () => Date;
}

interface Envelope<T> {
  data: T;
  meta: { generatedAt: string };
}

const publicCacheControl = "public, max-age=0, must-revalidate";

function envelope<T>(data: T, now: () => Date): Envelope<T> {
  return { data, meta: { generatedAt: now().toISOString() } };
}

function stableForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableForHash);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableForHash(entry)])
  );
}

function semanticEtag(data: unknown): string {
  const hash = createHash("sha256").update(JSON.stringify(stableForHash(data))).digest("hex");
  return `"${hash}"`;
}

function matchesEtag(header: string | string[] | undefined, expected: string): boolean {
  if (!header) return false;
  const values = Array.isArray(header) ? header : [header];
  return values
    .flatMap((value) => value.split(","))
    .some((value) => {
      const candidate = value.trim();
      if (candidate === "*") return true;
      return (candidate.startsWith("W/") ? candidate.slice(2) : candidate) === expected;
    });
}

function cacheableEnvelope<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  data: T,
  now: () => Date
): Envelope<T> | FastifyReply {
  const tag = semanticEtag(data);
  reply.header("etag", tag);
  reply.header("cache-control", publicCacheControl);
  if (matchesEtag(request.headers["if-none-match"], tag)) {
    return reply.status(304).send();
  }
  return envelope(data, now);
}

function noStore(reply: FastifyReply): void {
  reply.header("cache-control", "no-store");
}

function requireConfigured(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required in real mode`);
  return value;
}

function validBearerToken(authorization: string | undefined, expected: string): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice("Bearer ".length), "utf8");
  const target = Buffer.from(expected, "utf8");
  return supplied.length === target.length && timingSafeEqual(supplied, target);
}

export async function buildApp(dependencies: AppDependencies = {}): Promise<FastifyInstance> {
  const config = dependencies.config ?? getConfig();
  const now = dependencies.now ?? (() => new Date());
  const primaryCollectorId =
    config.COOLPATH_MODE === "real"
      ? requireConfigured(config.PRIMARY_COLLECTOR_ID, "PRIMARY_COLLECTOR_ID")
      : "mock-collector";
  const operatorToken =
    config.COOLPATH_MODE === "real"
      ? requireConfigured(config.OPERATOR_API_TOKEN, "OPERATOR_API_TOKEN")
      : "";
  const brightDataApiToken =
    config.COOLPATH_MODE === "real"
      ? requireConfigured(config.BRIGHT_DATA_API_TOKEN, "BRIGHT_DATA_API_TOKEN")
      : "";

  const ownsRepository = dependencies.repository === undefined;
  const repository = dependencies.repository ?? new CoolPathRepository(config.DATABASE_URL);
  const mockClient =
    dependencies.scraperClient instanceof MockScraperStudioClient
      ? dependencies.scraperClient
      : new MockScraperStudioClient();
  const ownsClient = dependencies.scraperClient === undefined;
  const client =
    dependencies.scraperClient ??
    (config.COOLPATH_MODE === "real"
      ? new BrightDataScraperStudioClient({
          apiToken: brightDataApiToken,
          apiBaseUrl: config.BRIGHT_DATA_API_BASE_URL,
          pollIntervalMs: config.BRIGHT_DATA_POLL_INTERVAL_MS,
          pollTimeoutMs: config.BRIGHT_DATA_POLL_TIMEOUT_MS,
          now
        })
      : mockClient);
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "test" ? "silent" : "info",
      redact: [
        "req.headers.authorization",
        "headers.authorization",
        "BRIGHT_DATA_API_TOKEN",
        "OPERATOR_API_TOKEN",
        "*.token",
        "*.apiToken"
      ]
    }
  });
  const ingestion = new IngestionService(
    repository,
    client,
    config.COOLPATH_MODE === "real" ? normalizePa211RowsWithMetrics : undefined,
    {
      now,
      logger: {
        info: (fields, message) => app.log.info(fields, message),
        warn: (fields, message) => app.log.warn(fields, message)
      }
    }
  );
  const initialSourceId = config.COOLPATH_MODE === "real" ? PRIMARY_SOURCE_ID : DEMO_SOURCE_ID;
  let backgroundCheck: Promise<void> | null = null;

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

  app.get("/healthz", (_request, reply) => {
    noStore(reply);
    return envelope({ status: "ok", mode: config.COOLPATH_MODE }, now);
  });

  app.get("/readyz", (_request, reply) => {
    noStore(reply);
    const databaseUsable = repository.checkHealth();
    let source: StoredSource | null = null;
    let trustedSnapshotAvailable = false;
    if (databaseUsable) {
      try {
        source = repository.getSource(initialSourceId);
        trustedSnapshotAvailable = source
          ? repository.getPublishedSnapshot(initialSourceId) !== null
          : false;
      } catch (error) {
        app.log.warn(
          { err: error, sourceId: initialSourceId },
          "readiness repository check failed"
        );
      }
    }
    const ready = databaseUsable && source !== null && trustedSnapshotAvailable;
    return reply.status(ready ? 200 : 503).send(
      envelope(
        {
          status: ready ? "ready" : "not_ready",
          mode: config.COOLPATH_MODE,
          checks: {
            database: databaseUsable ? "usable" : "unavailable",
            source: source ? "initialized" : "unavailable",
            trustedSnapshot: trustedSnapshotAvailable ? "available" : "unavailable"
          },
          sourceState: source?.currentState ?? null
        },
        now
      )
    );
  });

  app.get("/api/cities", async (request, reply) => {
    for (const city of repository.listCities()) {
      ingestion.reconcileFreshness(city.source.id);
    }
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
    return cacheableEnvelope(request, reply, data, now);
  });

  app.get("/api/cities/:slug", async (request, reply) => {
    const { slug } = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/) }).parse(request.params);
    let city = repository.getCityBySlug(slug);
    if (!city) {
      noStore(reply);
      return reply.status(404).send(envelope(null, now));
    }
    ingestion.reconcileFreshness(city.source.id);
    city = repository.getCityBySlug(slug);
    if (!city) {
      noStore(reply);
      return reply.status(404).send(envelope(null, now));
    }
    const data = {
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
      incident: repository.getCurrentIncident(city.source.id),
      timeline: repository.listTimeline(city.source.id, 50)
    };
    return cacheableEnvelope(request, reply, data, now);
  });

  app.get("/api/incidents/:sourceId/current", async (request, reply) => {
    const { sourceId } = z.object({ sourceId: z.string().min(1).max(80) }).parse(request.params);
    if (!repository.getSource(sourceId)) {
      noStore(reply);
      return reply.status(404).send(envelope(null, now));
    }
    const data = repository.getCurrentIncident(sourceId);
    return cacheableEnvelope(request, reply, data, now);
  });

  if (config.COOLPATH_MODE === "mock") {
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
      return reply.send(
        envelope({ approved: approve, recovered: approve && incident === null }, now)
      );
    });
  } else {
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
        const { sourceId } = z
          .object({ sourceId: z.string().min(1).max(80) })
          .parse(request.params);
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
        const { sourceId } = z
          .object({ sourceId: z.string().min(1).max(80) })
          .parse(request.params);
        return reply.send(envelope(await ingestion.requestHeal(sourceId), now));
      }
    );

    app.post(
      "/api/operator/sources/:sourceId/heal/decision",
      { preHandler: requireOperator },
      async (request, reply) => {
        noStore(reply);
        const { sourceId } = z
          .object({ sourceId: z.string().min(1).max(80) })
          .parse(request.params);
        const { approve } = z.object({ approve: z.boolean() }).parse(request.body);
        const incident = await ingestion.decideHeal(sourceId, approve);
        return reply.send(
          envelope({ approved: approve, recovered: approve && incident === null, incident }, now)
        );
      }
    );
  }

  app.addHook("onClose", async () => {
    if (ownsClient) {
      try {
        await client.close?.();
      } catch (error) {
        app.log.warn({ err: error }, "scraper client cleanup failed");
      }
      await backgroundCheck;
    }
    if (ownsRepository) repository.close();
  });

  if (config.COOLPATH_MODE === "real") {
    seedPrimarySourceConfiguration(repository, primaryCollectorId);
  } else {
    seedSourceConfiguration(repository);
  }

  ingestion.reconcileFreshness(initialSourceId);

  if (config.COOLPATH_MODE === "mock" && !repository.getPublishedSnapshot(initialSourceId)) {
    await ingestion.runSource(initialSourceId);
  }

  if (
    config.COOLPATH_MODE === "real" &&
    config.AUTO_START_REAL_CHECK &&
    !repository.getPublishedSnapshot(initialSourceId)
  ) {
    backgroundCheck = Promise.resolve()
      .then(() => ingestion.runSource(initialSourceId))
      .then(() => undefined)
      .catch((error: unknown) => {
        try {
          const source = repository.getSource(initialSourceId);
          if (source?.currentState === "CHECKING") {
            repository.setSourceState(
              initialSourceId,
              repository.getPublishedSnapshot(initialSourceId) ? "DEGRADED" : "BROKEN"
            );
          }
        } catch (stateError) {
          app.log.warn(
            { err: stateError, sourceId: initialSourceId },
            "background source state could not be updated"
          );
        }
        app.log.warn({ err: error, sourceId: initialSourceId }, "background source check failed");
      });
  }

  return app;
}
