import { createHash } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export type Clock = () => Date;

export interface Envelope<T> {
  data: T;
  meta: { generatedAt: string };
}

const publicCacheControl = "public, max-age=0, must-revalidate";

export function envelope<T>(data: T, now: Clock): Envelope<T> {
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
  const serialized = JSON.stringify(stableForHash(data));
  if (serialized === undefined) {
    throw new Error("Semantic representations must be JSON serializable");
  }
  const hash = createHash("sha256").update(serialized).digest("hex");
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

export function cacheableEnvelope<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  data: T,
  now: Clock
): Envelope<T> | FastifyReply {
  const tag = semanticEtag(data);
  reply.header("etag", tag);
  reply.header("cache-control", publicCacheControl);
  if (matchesEtag(request.headers["if-none-match"], tag)) {
    return reply.status(304).send();
  }
  return envelope(data, now);
}

export function noStore(reply: FastifyReply): void {
  reply.header("cache-control", "no-store");
}
