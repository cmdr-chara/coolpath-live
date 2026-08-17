import { randomUUID } from "node:crypto";
import {
  classifyTransportFailure,
  evaluateCandidate,
  isWithinTtl,
  transitionSourceState,
  type ReasonCode,
  type ValidationSummary
} from "@coolpath/domain";
import type { CoolPathRepository, StoredIncident, StoredSnapshot } from "@coolpath/db";
import {
  BrightDataHttpError,
  buildFieldSpecificHealPrompt,
  type ScraperStudioClient
} from "@coolpath/source-adapters";

export class IngestionService {
  constructor(
    private readonly repository: CoolPathRepository,
    private readonly client: ScraperStudioClient,
    private readonly normalizeRecords: (records: unknown[]) => unknown[] = (records) => records
  ) {}

  async runSource(
    sourceId: string,
    recovered = false
  ): Promise<{
    runId: string;
    validation: ValidationSummary;
    snapshot: StoredSnapshot;
  }> {
    const source = this.requireSource(sourceId);
    const startedAt = new Date().toISOString();
    this.repository.setSourceState(
      sourceId,
      transitionSourceState(source.currentState, { type: "CHECK_STARTED" })
    );
    this.repository.addTimelineEvent({
      sourceId,
      occurredAt: startedAt,
      kind: "check_started",
      title: "Collector check started",
      detail: `Collector ${source.collectorId} started in ${source.mode} mode.`,
      tone: "neutral"
    });

    let result;
    try {
      result = await this.client.runCollector({
        collectorId: source.collectorId,
        sourceId,
        canonicalUrl: source.canonicalUrl
      });
    } catch (error) {
      await this.recordTransportFailure(sourceId, startedAt, error);
      throw error;
    }
    let candidateRecords: unknown[];
    try {
      candidateRecords = this.normalizeRecords(result.records);
    } catch {
      candidateRecords = result.records;
    }
    const baseline = this.repository.getPublishedSnapshot(sourceId);
    const baselineRun = baseline ? this.repository.getRun(baseline.runId) : null;
    const validation = evaluateCandidate({
      records: candidateRecords,
      allowedOrigins: source.allowedOrigins,
      candidate: {
        collectorId: result.collectorId,
        collectorVersion: result.collectorVersion,
        schemaVersion: result.schemaVersion
      },
      ...(baseline
        ? {
            baseline: {
              collectorId:
                typeof baselineRun?.collectorId === "string"
                  ? baselineRun.collectorId
                  : source.collectorId,
              collectorVersion:
                typeof baselineRun?.collectorVersion === "string"
                  ? baselineRun.collectorVersion
                  : "unknown",
              schemaVersion:
                typeof baselineRun?.schemaVersion === "string" ? baselineRun.schemaVersion : "1",
              sites: baseline.sites,
              contentHash: baseline.contentHash
            }
          }
        : {})
    });
    const runId = randomUUID();
    const completedAt = new Date().toISOString();
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
      this.repository.promoteSnapshot(sourceId, snapshot.id, completedAt);
      this.repository.setSourceState(
        sourceId,
        transitionSourceState("CHECKING", { type: "RUN_PASSED", recovered })
      );
      if (recovered) this.repository.resolveIncident(sourceId, runId, completedAt);
      this.repository.addTimelineEvent({
        sourceId,
        occurredAt: completedAt,
        kind: recovered ? "recovered" : "published",
        title: recovered ? "Recovered snapshot published" : "Trusted snapshot published",
        detail: `${validation.recordCount} records passed the complete contract suite.`,
        tone: "positive"
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

    return { runId, validation, snapshot };
  }

  async requestHeal(sourceId: string): Promise<StoredIncident> {
    const source = this.requireSource(sourceId);
    const incident = this.repository.getCurrentIncident(sourceId);
    if (!incident) throw new Error("No active incident to heal");
    if (incident.healState === "running" || incident.healState === "review_pending") {
      throw new Error("A healing operation is already active");
    }
    const prompt = buildFieldSpecificHealPrompt(incident.reasonCodes as ReasonCode[]);
    this.repository.setSourceState(
      sourceId,
      transitionSourceState(source.currentState, { type: "HEAL_REQUESTED" })
    );
    this.repository.updateIncidentHeal({ incidentId: incident.id, healState: "running", prompt });
    let result;
    try {
      result = await this.client.requestHeal({
        collectorId: source.collectorId,
        sourceId,
        canonicalUrl: source.canonicalUrl,
        prompt
      });
    } catch (error) {
      this.repository.updateIncidentHeal({ incidentId: incident.id, healState: "failed", prompt });
      this.repository.setSourceState(sourceId, source.currentState);
      this.repository.addTimelineEvent({
        sourceId,
        occurredAt: new Date().toISOString(),
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
    this.repository.setSourceState(sourceId, "REVIEW_PENDING");
    this.repository.addTimelineEvent({
      sourceId,
      occurredAt: new Date().toISOString(),
      kind: "heal_preview",
      title: "Healing preview ready",
      detail: `${result.diff.length} field-specific selector changes require manual approval.`,
      tone: "warning"
    });
    return this.repository.getCurrentIncident(sourceId) as StoredIncident;
  }

  async decideHeal(sourceId: string, approve: boolean): Promise<StoredIncident | null> {
    const source = this.requireSource(sourceId);
    const incident = this.repository.getCurrentIncident(sourceId);
    if (!incident?.healJobId || incident.healState !== "review_pending") {
      throw new Error("No healing preview is pending review");
    }
    await this.client.decideHeal({
      collectorId: source.collectorId,
      jobId: incident.healJobId,
      approve,
      canonicalUrl: source.canonicalUrl
    });
    if (!approve) {
      this.repository.updateIncidentHeal({ incidentId: incident.id, healState: "rejected" });
      this.repository.setSourceState(sourceId, "BROKEN");
      this.repository.addTimelineEvent({
        sourceId,
        occurredAt: new Date().toISOString(),
        kind: "heal_rejected",
        title: "Healing preview rejected",
        detail: "No collector change was applied.",
        tone: "critical"
      });
      return this.repository.getCurrentIncident(sourceId);
    }
    try {
      const rerun = await this.runSource(sourceId, true);
      if (rerun.validation.disposition !== "publishable") {
        this.repository.updateIncidentHeal({ incidentId: incident.id, healState: "failed" });
      }
    } catch (error) {
      this.repository.updateIncidentHeal({ incidentId: incident.id, healState: "failed" });
      throw error;
    }
    return this.repository.getCurrentIncident(sourceId);
  }

  private requireSource(sourceId: string) {
    const source = this.repository.getSource(sourceId);
    if (!source || !source.enabled) throw new Error("Source is not allowlisted or is disabled");
    return source;
  }

  private async recordTransportFailure(
    sourceId: string,
    startedAt: string,
    error: unknown
  ): Promise<void> {
    const source = this.requireSource(sourceId);
    const completedAt = new Date().toISOString();
    const reason = classifyTransportFailure(
      error instanceof BrightDataHttpError
        ? { kind: "http", status: error.status }
        : error instanceof DOMException && error.name === "AbortError"
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
    await Promise.resolve();
  }
}

function isDnsFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("cause" in error)) return false;
  const cause = error.cause;
  if (typeof cause !== "object" || cause === null || !("code" in cause)) return false;
  return cause.code === "ENOTFOUND" || cause.code === "EAI_AGAIN";
}
