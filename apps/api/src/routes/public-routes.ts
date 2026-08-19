import { type CoolPathRepository } from "@coolpath/db";
import {
  apiCityResponseSchema,
  apiCitySummarySchema,
  apiIncidentReadModelSchema,
  formatInstantInTimeZone
} from "@coolpath/domain";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { cacheableEnvelope, envelope, noStore, type Clock } from "../http-response.js";
import type { IngestionService } from "../ingestion-service.js";

interface PublicRouteDependencies {
  repository: CoolPathRepository;
  ingestion: IngestionService;
  now: Clock;
}

export function registerPublicRoutes(
  app: FastifyInstance,
  dependencies: PublicRouteDependencies
): void {
  const { repository, ingestion, now } = dependencies;

  app.get("/api/cities", async (request, reply) => {
    for (const city of repository.listCities()) {
      ingestion.reconcileFreshness(city.source.id);
    }
    const data = apiCitySummarySchema.array().parse(
      repository.listCities().map((city) => ({
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
      }))
    );
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

    const data = apiCityResponseSchema.parse({
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
    });
    return cacheableEnvelope(request, reply, data, now);
  });

  app.get("/api/incidents/:sourceId/current", async (request, reply) => {
    const { sourceId } = z.object({ sourceId: z.string().min(1).max(80) }).parse(request.params);
    if (!repository.getSource(sourceId)) {
      noStore(reply);
      return reply.status(404).send(envelope(null, now));
    }
    const incident = apiIncidentReadModelSchema
      .nullable()
      .parse(repository.getCurrentIncident(sourceId));
    return cacheableEnvelope(request, reply, incident, now);
  });
}
