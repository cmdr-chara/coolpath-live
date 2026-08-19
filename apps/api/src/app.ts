import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { CoolPathRepository } from "@coolpath/db";
import { isWithinTtl, transitionSourceState } from "@coolpath/domain";
import {
  BrightDataScraperStudioClient,
  MockScraperStudioClient,
  normalizePa211RowsWithMetrics,
  type ScraperStudioClient
} from "@coolpath/source-adapters";
import { DEMO_SOURCE_ID } from "@coolpath/test-fixtures";
import Fastify, { type FastifyInstance } from "fastify";
import { type AppConfig, getConfig } from "./config.js";
import { registerErrorHandler } from "./error-handler.js";
import { IngestionService } from "./ingestion-service.js";
import { requireConfigured } from "./operator-auth.js";
import { registerDemoRoutes } from "./routes/demo-routes.js";
import { registerOperatorRoutes } from "./routes/operator-routes.js";
import { registerProbeRoutes } from "./routes/probe-routes.js";
import { registerPublicRoutes } from "./routes/public-routes.js";
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

  app.addHook("onClose", async () => {
    if (ownsClient) {
      try {
        await client.close?.();
      } catch (error) {
        app.log.warn({ err: error }, "scraper client cleanup failed");
      }
    }
    await backgroundCheck;
    if (ownsRepository) repository.close();
  });

  try {
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

    registerErrorHandler(app, now);
    registerProbeRoutes(app, { config, repository, initialSourceId, now });
    registerPublicRoutes(app, { repository, ingestion, now });
    if (config.COOLPATH_MODE === "mock") {
      registerDemoRoutes(app, { repository, mockClient, ingestion, now });
    } else {
      registerOperatorRoutes(app, { ingestion, operatorToken, now });
    }

    if (config.COOLPATH_MODE === "real") {
      seedPrimarySourceConfiguration(repository, primaryCollectorId);
    } else {
      seedSourceConfiguration(repository);
    }

    ingestion.recoverInterruptedOperation(initialSourceId);
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
          reconcileBackgroundFailure(app, repository, initialSourceId, error, now);
        });
    }

    return app;
  } catch (error) {
    try {
      await app.close();
    } catch (closeError) {
      app.log.warn({ err: closeError }, "startup cleanup failed");
    }
    throw error;
  }
}

function reconcileBackgroundFailure(
  app: FastifyInstance,
  repository: CoolPathRepository,
  sourceId: string,
  error: unknown,
  now: () => Date
): void {
  try {
    const source = repository.getSource(sourceId);
    if (source?.currentState === "CHECKING") {
      const published = repository.getPublishedSnapshot(sourceId);
      repository.setSourceState(
        sourceId,
        transitionSourceState(source.currentState, {
          type: "RUN_FAILED",
          hasTrustedSnapshot: published !== null,
          withinTtl: published
            ? isWithinTtl(published.observedAt, source.freshnessTtlMinutes, now())
            : false,
          inconclusive: true
        })
      );
    }
  } catch (stateError) {
    app.log.warn({ err: stateError, sourceId }, "background source state could not be updated");
  }
  app.log.warn({ err: error, sourceId }, "background source check failed");
}
