import { randomUUID } from "node:crypto";
import {
  classifyTransportFailure,
  evaluateCandidate,
  isWithinTtl,
  transitionSourceState,
  type EvaluatedValidationSummary,
  type ReasonCode,
  type ValidationSummary
} from "@coolpath/domain";
import type { CoolPathRepository, StoredIncident, StoredSnapshot } from "@coolpath/db";
import {
  BrightDataHttpError,
  BrightDataTimeoutError,
  buildFieldSpecificHealPrompt,
  type CollectorRunResult,
  type HealResult,
  type NormalizationResult,
  type RecordNormalizer,
  type ScraperStudioClient
} from "@coolpath/source-adapters";
import { SourceOperationStateError } from "./errors.js";
import { SourceLifecycleService } from "./source-lifecycle-service.js";
import { SourceOperationCoordinator } from "./source-operation-coordinator.js";

interface IngestionLogger {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
}

export interface IngestionServiceOptions {
  now?: () => Date;
  coordinator?: SourceOperationCoordinator;
  logger?: IngestionLogger;
}

const noOpLogger: IngestionLogger = {
  info: () => undefined,
  warn: () => undefined
};

const identityNormalizer: RecordNormalizer = (records) => ({
  records,
  coverage: {
    providerRecordsReceived: records.length,
    normalizedRecordsAccepted: records.length,
    recordsFilteredNotLocations: 0,
    exactDuplicatesRemoved: 0,
    recordsRejectedBySourceValidation: 0
  }
});

export class IngestionService {
  private readonly now: () => Date;
  private readonly coordinator: SourceOperationCoordinator;
  private readonly logger: IngestionLogger;
  private readonly lifecycle: SourceLifecycleService;

  constructor(
    private readonly repository: CoolPathRepository,
    private readonly client: ScraperStudioClient,
    private readonly normalizeRecords: RecordNormalizer = identityNormalizer,
    options: IngestionServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
    this.coordinator = options.coordinator ?? new SourceOperationCoordinator();
    this.logger = options.logger ?? noOpLogger;
    this.lifecycle = new SourceLifecycleService(this.repository, this.coordinator, this.now);
  }

  runSource(sourceId: string): Promise<{
    runId: string;
    validation: EvaluatedValidationSummary;
    snapshot: StoredSnapshot;
  }> {
    this.lifecycle.requireSource(sourceId);
    return this.coordinator.run(sourceId, () => this.runSourceUnlocked(sourceId, false));
  }

  reconcileFreshness(sourceId: string): boolean {
    return this.lifecycle.reconcileFreshness(sourceId);
  }

  recoverInterruptedOperation(sourceId: string): boolean {
    return this.lifecycle.recoverInterruptedOperation(sourceId);
  }

  requestHeal(sourceId: string): Promise<StoredIncident> {
    this.lifecycle.requireSource(sourceId);
    return this.coordinator.run(sourceId, () => this.requestHealUnlocked(sourceId));
  }

  decideHeal(sourceId: string, approve: boolean): Promise<StoredIncident | null> {
    this.lifecycle.requireSource(sourceId);
    return this.coordinator.run(sourceId, () => this.decideHealUnlocked(sourceId, approve));
  }

  private async runSourceUnlocked(
    sourceId: string,
    recoveredByHealing: boolean
  ): Promise<{
    runId: string;
    validation: EvaluatedValidationSummary;
    snapshot: StoredSnapshot;
  }> {
    const source = this.lifecycle.requireSource(sourceId);
    const startedAt = this.nowIso();
    this.repository.setSourceState(
      sourceId,
      transitionSourceState(source.currentState, {
        type: recoveredByHealing ? "HEAL_RERUN_STARTED" : "CHECK_STARTED"
      })
    );
    this.repository.addTimelineEvent({
      sourceId,
      occurredAt: startedAt,
      kind: "check_started",
      title: "Collector check started",
      detail: `Collector ${source.collectorId} started in ${source.mode} mode.`,
      tone: "neutral"
    });

    let result: CollectorRunResult;
    try {
      result = await this.client.runCollector({
        collectorId: source.collectorId,
        sourceId,
        canonicalUrl: source.canonicalUrl
      });
    } catch (error) {
      const failure = this.recordTransportFailure(sourceId, startedAt, error);
      this.logCompletion({
        sourceId,
        runId: failure.runId,
        startedAt,
        completedAt: failure.completedAt,
        disposition: "inconclusive",
        normalizedRecordCount: 0,
        reasonCodes: [failure.reason]
      });
      throw error;
    }

    const normalization = this.normalize(result.records, result.fetchedAt, sourceId);
    const baseline = source.publishedSnapshotId
      ? this.repository.getSnapshot(source.publishedSnapshotId)
      : null;
    const baselineRun = baseline ? this.repository.getRun(baseline.runId) : null;
    let validation: EvaluatedValidationSummary = evaluateCandidate({
      records: normalization.records,
      allowedOrigins: source.allowedOrigins,
      candidate: {
        collectorId: result.collectorId,
        collectorVersion: result.collectorVersion,
        schemaVersion: result.schemaVersion
      },
      coverage: normalization.coverage,
      ...(baseline
        ? {
            baseline: {
              collectorId: baselineRun?.collectorId ?? source.collectorId,
              collectorVersion: baselineRun?.collectorVersion ?? "unknown",
              schemaVersion: baselineRun?.schemaVersion ?? "1",
              sites: baseline.sites,
              contentHash: baseline.contentHash
            }
          }
        : {})
    });
    if (normalization.failed) {
      validation = {
        ...validation,
        disposition: "quarantined",
        hardFailures: [...new Set([...validation.hardFailures, "INVALID_SCHEMA" as const])],
        coverage: {
          ...validation.coverage,
          recordsQuarantined: validation.sites.length
        }
      };
    }

    const runId = randomUUID();
    const completedAt = this.nowIso();
    const reasons = [...validation.hardFailures, ...validation.softAnomalies];
    this.repository.recordRun({
      id: runId,
      sourceId,
      startedAt,
      fetchedAt: result.fetchedAt,
      completedAt,
      outcome: validation.disposition,
      collectorId: result.collectorId,
      collectorVersion: result.collectorVersion,
      schemaVersion: result.schemaVersion,
      recordCount: validation.recordCount,
      rawSha256: result.rawSha256,
      reasonCodes: reasons,
      validationSummary: validation
    });
    const observedAt = validation.sites[0]?.observedAt ?? result.fetchedAt;
    const snapshot = this.repository.createSnapshot({
      sourceId,
      runId,
      observedAt,
      contentHash: validation.contentHash,
      status: validation.disposition === "publishable" ? "candidate" : "quarantined",
      sites: validation.sites
    });

    if (validation.disposition === "publishable") {
      const publishedState = transitionSourceState("CHECKING", {
        type: "RUN_PASSED",
        recovered: recoveredByHealing
      });
      if (publishedState !== "HEALTHY" && publishedState !== "RECOVERED") {
        throw new Error("RUN_PASSED must produce a publishable source state");
      }
      this.repository.publishSnapshot({
        sourceId,
        snapshotId: snapshot.id,
        runId,
        promotedAt: completedAt,
        sourceState: publishedState,
        recoveredByHealing,
        recordCount: validation.recordCount
      });
    } else {
      const hasTrustedSnapshot = baseline !== null;
      const withinTtl = baseline
        ? isWithinTtl(baseline.observedAt, source.freshnessTtlMinutes, new Date(completedAt))
        : false;
      this.repository.setSourceState(
        sourceId,
        transitionSourceState("CHECKING", {
          type: "RUN_FAILED",
          hasTrustedSnapshot,
          withinTtl,
          inconclusive: false
        })
      );
      this.repository.openIncident({
        sourceId,
        runId,
        severity: validation.hardFailures.length > 0 ? "critical" : "warning",
        reasonCodes: reasons,
        openedAt: completedAt
      });
      this.repository.addTimelineEvent({
        sourceId,
        occurredAt: completedAt,
        kind: "quarantined",
        title: "Candidate quarantined",
        detail: `${reasons.join(", ")}. The last trusted snapshot was not replaced.`,
        tone: "critical"
      });
    }

    this.logCompletion({
      sourceId,
      runId,
      startedAt,
      completedAt,
      disposition: validation.disposition,
      normalizedRecordCount: validation.coverage.normalizedRecordsAccepted,
      reasonCodes: reasons
    });
    return { runId, validation, snapshot };
  }

  private async requestHealUnlocked(sourceId: string): Promise<StoredIncident> {
    const source = this.lifecycle.requireSource(sourceId);
    const incident = this.repository.getCurrentIncident(sourceId);
    if (!incident) throw new SourceOperationStateError("No active incident to heal");
    if (incident.healState === "running" || incident.healState === "review_pending") {
      throw new SourceOperationStateError("A healing operation is already active");
    }
    const prompt = buildFieldSpecificHealPrompt(incident.reasonCodes);
    this.repository.setSourceState(
      sourceId,
      transitionSourceState(source.currentState, { type: "HEAL_REQUESTED" })
    );
    this.repository.updateIncidentHeal({ incidentId: incident.id, healState: "running", prompt });
    let result: HealResult;
    try {
      result = await this.client.requestHeal({
        collectorId: source.collectorId,
        sourceId,
        canonicalUrl: source.canonicalUrl,
        prompt
      });
    } catch (error) {
      this.repository.updateIncidentHeal({ incidentId: incident.id, healState: "failed", prompt });
      this.repository.setSourceState(
        sourceId,
        this.lifecycle.healingFailureState(sourceId, "HEALING")
      );
      this.repository.addTimelineEvent({
        sourceId,
        occurredAt: this.nowIso(),
        kind: "heal_failed",
        title: "Healing request failed",
        detail:
          "The provider did not produce a reviewable repair. No collector change was applied.",
        tone: "critical"
      });
      throw error;
    }
    this.repository.updateIncidentHeal({
      incidentId: incident.id,
      healState: "review_pending",
      jobId: result.jobId,
      prompt,
      diff: result.diff
    });
    const healingSource = this.lifecycle.requireSource(sourceId);
    this.repository.setSourceState(
      sourceId,
      transitionSourceState(healingSource.currentState, { type: "HEAL_PREVIEW_READY" })
    );
    this.repository.addTimelineEvent({
      sourceId,
      occurredAt: this.nowIso(),
      kind: "heal_preview",
      title: "Healing preview ready",
      detail: `${result.diff.length} field-specific selector changes require manual approval.`,
      tone: "warning"
    });
    const current = this.repository.getCurrentIncident(sourceId);
    if (!current) throw new Error("Incident disappeared while preparing healing preview");
    return current;
  }

  private async decideHealUnlocked(
    sourceId: string,
    approve: boolean
  ): Promise<StoredIncident | null> {
    const source = this.lifecycle.requireSource(sourceId);
    const incident = this.repository.getCurrentIncident(sourceId);
    if (!incident?.healJobId || incident.healState !== "review_pending") {
      throw new SourceOperationStateError("No healing preview is pending review");
    }
    let decision;
    try {
      decision = await this.client.decideHeal({
        collectorId: source.collectorId,
        jobId: incident.healJobId,
        approve,
        canonicalUrl: source.canonicalUrl
      });
    } catch (error) {
      this.repository.updateIncidentHeal({ incidentId: incident.id, healState: "failed" });
      this.repository.setSourceState(
        sourceId,
        this.lifecycle.healingFailureState(sourceId, "REVIEW_PENDING")
      );
      this.repository.addTimelineEvent({
        sourceId,
        occurredAt: this.nowIso(),
        kind: "heal_failed",
        title: "Healing decision failed",
        detail: "The provider did not apply the reviewed decision. The incident remains open.",
        tone: "critical"
      });
      throw error;
    }
    if (!approve) {
      const context = this.lifecycle.trustedSnapshotContext(sourceId);
      this.repository.updateIncidentHeal({ incidentId: incident.id, healState: "rejected" });
      this.repository.setSourceState(
        sourceId,
        transitionSourceState(source.currentState, { type: "HEAL_REJECTED", ...context })
      );
      this.repository.addTimelineEvent({
        sourceId,
        occurredAt: this.nowIso(),
        kind: "heal_rejected",
        title: "Healing preview rejected",
        detail: "No collector change was applied.",
        tone: "critical"
      });
      return this.repository.getCurrentIncident(sourceId);
    }
    if (decision.status === "review_pending") {
      const diff = decision.diff ?? [];
      this.repository.updateIncidentHeal({
        incidentId: incident.id,
        healState: "review_pending",
        diff
      });
      this.repository.addTimelineEvent({
        sourceId,
        occurredAt: this.nowIso(),
        kind: "heal_preview",
        title: "Additional healing review required",
        detail: `${diff.length} additional selector changes require manual approval before any rerun.`,
        tone: "warning"
      });
      return this.repository.getCurrentIncident(sourceId);
    }
    if (decision.status !== "ready") {
      this.repository.updateIncidentHeal({ incidentId: incident.id, healState: "failed" });
      this.repository.setSourceState(
        sourceId,
        this.lifecycle.healingFailureState(sourceId, "REVIEW_PENDING")
      );
      throw new Error("The approved Bright Data healing job did not become ready for rerun");
    }
    try {
      const rerun = await this.runSourceUnlocked(sourceId, true);
      if (rerun.validation.disposition !== "publishable") {
        this.repository.updateIncidentHeal({ incidentId: incident.id, healState: "failed" });
      }
    } catch (error) {
      this.repository.updateIncidentHeal({ incidentId: incident.id, healState: "failed" });
      throw error;
    }
    return this.repository.getCurrentIncident(sourceId);
  }

  private normalize(
    records: unknown[],
    observedAt: string,
    sourceId: string
  ): NormalizationResult & { failed: boolean } {
    try {
      return { ...this.normalizeRecords(records, observedAt), failed: false };
    } catch (error) {
      this.logger.warn(
        {
          sourceId,
          errorName: error instanceof Error ? error.name : "UnknownError",
          providerRecordCount: records.length
        },
        "source normalization failed"
      );
      return {
        records: [],
        coverage: {
          providerRecordsReceived: records.length,
          normalizedRecordsAccepted: 0,
          recordsFilteredNotLocations: 0,
          exactDuplicatesRemoved: 0,
          recordsRejectedBySourceValidation: records.length
        },
        failed: true
      };
    }
  }

  private recordTransportFailure(
    sourceId: string,
    startedAt: string,
    error: unknown
  ): { runId: string; completedAt: string; reason: ReasonCode } {
    const source = this.lifecycle.requireSource(sourceId);
    const completedAt = this.nowIso();
    const reason = classifyTransportFailure(
      error instanceof BrightDataHttpError
        ? { kind: "http", status: error.status }
        : isTimeoutFailure(error)
          ? { kind: "timeout" }
          : isDnsFailure(error)
            ? { kind: "dns" }
            : { kind: "provider_temporary" }
    );
    const published = this.repository.getPublishedSnapshot(sourceId);
    const summary: ValidationSummary = {
      disposition: "inconclusive",
      hardFailures: [],
      softAnomalies: [],
      recordCount: 0,
      requiredFieldCompleteness: 0,
      optionalClaimCoverage: 0,
      contentHash: "",
      coverage: {
        providerRecordsReceived: 0,
        normalizedRecordsAccepted: 0,
        recordsFilteredNotLocations: 0,
        exactDuplicatesRemoved: 0,
        recordsRejectedByValidation: 0,
        recordsQuarantined: 0
      },
      sites: []
    };
    const runId = randomUUID();
    this.repository.recordRun({
      id: runId,
      sourceId,
      startedAt,
      fetchedAt: completedAt,
      completedAt,
      outcome: "inconclusive",
      collectorId: source.collectorId,
      collectorVersion: "unknown",
      schemaVersion: "1",
      recordCount: 0,
      rawSha256: "",
      reasonCodes: [reason],
      validationSummary: summary
    });
    this.repository.setSourceState(
      sourceId,
      transitionSourceState("CHECKING", {
        type: "RUN_FAILED",
        hasTrustedSnapshot: published !== null,
        withinTtl: published
          ? isWithinTtl(published.observedAt, source.freshnessTtlMinutes, new Date(completedAt))
          : false,
        inconclusive: true
      })
    );
    this.repository.addTimelineEvent({
      sourceId,
      occurredAt: completedAt,
      kind: "transport_failure",
      title: "Source check inconclusive",
      detail: `${reason}. This is not classified as layout drift.`,
      tone: "warning"
    });
    return { runId, completedAt, reason };
  }

  private logCompletion(input: {
    sourceId: string;
    runId: string;
    startedAt: string;
    completedAt: string;
    disposition: string;
    normalizedRecordCount: number;
    reasonCodes: readonly ReasonCode[];
  }): void {
    const durationMs = Math.max(
      0,
      new Date(input.completedAt).getTime() - new Date(input.startedAt).getTime()
    );
    this.logger.info(
      {
        sourceId: input.sourceId,
        runId: input.runId,
        durationMs,
        disposition: input.disposition,
        normalizedRecordCount: input.normalizedRecordCount,
        reasonCodes: [...input.reasonCodes]
      },
      "source ingestion completed"
    );
  }

  private nowIso(): string {
    return this.now().toISOString();
  }
}

function isTimeoutFailure(error: unknown): boolean {
  return (
    error instanceof BrightDataTimeoutError ||
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function isDnsFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("cause" in error)) return false;
  const cause = error.cause;
  if (typeof cause !== "object" || cause === null || !("code" in cause)) return false;
  return cause.code === "ENOTFOUND" || cause.code === "EAI_AGAIN";
}
