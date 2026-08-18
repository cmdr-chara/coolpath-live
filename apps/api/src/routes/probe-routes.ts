import { type CoolPathRepository, type StoredSource } from "@coolpath/db";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
import { envelope, noStore, type Clock } from "../http-response.js";

interface ProbeRouteDependencies {
  config: AppConfig;
  repository: CoolPathRepository;
  initialSourceId: string;
  now: Clock;
}

export function registerProbeRoutes(
  app: FastifyInstance,
  dependencies: ProbeRouteDependencies
): void {
  const { config, repository, initialSourceId, now } = dependencies;

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
}
