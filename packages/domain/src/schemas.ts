import { z } from "zod";

const isoDateTime = z.iso.datetime({ offset: true });
const isoDate = z.iso.date();
const httpsUrl = z.url().refine((value) => new URL(value).protocol === "https:", {
  message: "URL must use HTTPS"
});

export const weeklyWindowSchema = z.object({
  day: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
  opensAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  closesAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  sourceText: z.string().trim().min(1).max(500)
});

export const temporalClaimSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("weekly_windows"),
    timezone: z.string().trim().min(1),
    windows: z.array(weeklyWindowSchema).min(1),
    evidenceText: z.string().trim().min(1).max(1000)
  }),
  z
    .object({
      kind: z.literal("activation_range"),
      startsOn: isoDate,
      endsOn: isoDate,
      evidenceText: z.string().trim().min(1).max(1000)
    })
    .superRefine((value, context) => {
      if (value.startsOn > value.endsOn) {
        context.addIssue({ code: "custom", message: "Activation start must precede end" });
      }
    }),
  z.object({
    kind: z.literal("source_text"),
    text: z.string().trim().min(1).max(1000)
  }),
  z.object({ kind: z.literal("not_provided") })
]);

export const explicitClaimSchema = z.object({
  kind: z.enum(["accessibility", "amenity", "other"]),
  label: z.string().trim().min(1).max(120),
  evidenceText: z.string().trim().min(1).max(500),
  sourceUrl: httpsUrl,
  evidenceLocator: z.string().trim().min(1).max(240).optional()
});

export const coolingSiteSchema = z.object({
  id: z.string().trim().min(1).max(180),
  cityId: z.string().trim().min(1).max(80),
  sourceKey: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(240),
  addressText: z.string().trim().min(1).max(500),
  evidenceUrl: httpsUrl,
  temporalClaim: temporalClaimSchema,
  explicitClaims: z.array(explicitClaimSchema).max(32),
  sourceReportedUpdatedAt: isoDateTime.optional(),
  observedAt: isoDateTime
});

export const citySchema = z.object({
  id: z.string().trim().min(1).max(80),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  displayName: z.string().trim().min(1).max(160),
  region: z.string().trim().min(1).max(160),
  timezone: z.string().trim().min(1).max(80)
});

export const sourceSchema = z.object({
  id: z.string().trim().min(1).max(80),
  cityId: z.string().trim().min(1).max(80),
  agencyName: z.string().trim().min(1).max(240),
  canonicalUrl: httpsUrl,
  allowedOrigins: z.array(z.url()).min(1).max(8),
  collectorId: z.string().trim().min(1).max(180),
  freshnessTtlMinutes: z.number().int().positive(),
  policyVersion: z.string().trim().min(1).max(40),
  enabled: z.boolean(),
  publishedSnapshotId: z.string().nullable()
});

export const snapshotStatusSchema = z.enum(["candidate", "quarantined", "published", "superseded"]);

export const incidentSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  runId: z.string(),
  severity: z.enum(["warning", "critical"]),
  reasonCodes: z.array(z.string()),
  openedAt: isoDateTime,
  healState: z.enum([
    "not_requested",
    "running",
    "review_pending",
    "approved",
    "rejected",
    "failed"
  ]),
  resolvedByRunId: z.string().nullable(),
  resolvedAt: isoDateTime.nullable()
});

export type WeeklyWindow = z.infer<typeof weeklyWindowSchema>;
export type TemporalClaim = z.infer<typeof temporalClaimSchema>;
export type ExplicitClaim = z.infer<typeof explicitClaimSchema>;
export type CoolingSite = z.infer<typeof coolingSiteSchema>;
export type City = z.infer<typeof citySchema>;
export type Source = z.infer<typeof sourceSchema>;
export type SnapshotStatus = z.infer<typeof snapshotStatusSchema>;
export type Incident = z.infer<typeof incidentSchema>;
