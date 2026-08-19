import { isWithinTtl, transitionSourceState } from "@coolpath/domain";
import type { CoolPathRepository, StoredSource } from "@coolpath/db";
import { SourceNotFoundError } from "./errors.js";
import { SourceOperationCoordinator } from "./source-operation-coordinator.js";

export class SourceLifecycleService {
  constructor(
    private readonly repository: CoolPathRepository,
    private readonly coordinator: SourceOperationCoordinator,
    private readonly now: () => Date
  ) {}

  requireSource(sourceId: string): StoredSource {
    const source = this.repository.getSource(sourceId);
    if (!source || !source.enabled) throw new SourceNotFoundError();
    return source;
  }

  reconcileFreshness(sourceId: string): boolean {
    if (this.coordinator.isActive(sourceId)) return false;
    const source = this.requireSource(sourceId);
    if (["CHECKING", "HEALING", "REVIEW_PENDING"].includes(source.currentState)) return false;
    const snapshot = this.repository.getPublishedSnapshot(sourceId);
    const now = this.now();
    if (!snapshot || isWithinTtl(snapshot.observedAt, source.freshnessTtlMinutes, now)) {
      return false;
    }
    return this.repository.markSourceStale({
      sourceId,
      occurredAt: now.toISOString(),
      observedAt: snapshot.observedAt,
      state: transitionSourceState(source.currentState, {
        type: "TTL_EXPIRED",
        hasTrustedSnapshot: true
      })
    });
  }

  recoverInterruptedOperation(sourceId: string): boolean {
    if (this.coordinator.isActive(sourceId)) return false;
    const source = this.requireSource(sourceId);
    const occurredAt = this.now().toISOString();

    if (source.currentState === "CHECKING") {
      this.repository.setSourceState(
        sourceId,
        transitionSourceState("CHECKING", {
          type: "RUN_FAILED",
          ...this.trustedSnapshotContext(sourceId),
          inconclusive: true
        })
      );
      this.repository.addTimelineEvent({
        sourceId,
        occurredAt,
        kind: "operation_interrupted",
        title: "Interrupted source check recovered",
        detail:
          "The process restarted before the source check completed. No candidate was promoted and the trusted snapshot pointer was preserved.",
        tone: "warning"
      });
      return true;
    }

    if (source.currentState === "HEALING") {
      const incident = this.repository.getCurrentIncident(sourceId);
      if (incident?.healState === "running") {
        this.repository.updateIncidentHeal({ incidentId: incident.id, healState: "failed" });
      }
      this.repository.setSourceState(sourceId, this.healingFailureState(sourceId, "HEALING"));
      this.repository.addTimelineEvent({
        sourceId,
        occurredAt,
        kind: "operation_interrupted",
        title: "Interrupted healing request recovered",
        detail:
          "The process restarted before a reviewable repair was recorded. The incident remains open and no repair is trusted.",
        tone: "warning"
      });
      return true;
    }

    if (source.currentState === "REVIEW_PENDING") {
      const incident = this.repository.getCurrentIncident(sourceId);
      if (incident?.healState === "review_pending" && incident.healJobId) return false;
      if (incident) {
        this.repository.updateIncidentHeal({ incidentId: incident.id, healState: "failed" });
      }
      this.repository.setSourceState(
        sourceId,
        this.healingFailureState(sourceId, "REVIEW_PENDING")
      );
      this.repository.addTimelineEvent({
        sourceId,
        occurredAt,
        kind: "operation_interrupted",
        title: "Invalid review state recovered",
        detail:
          "The persisted review state did not contain a resumable healing job. The incident remains open and the trusted snapshot pointer was preserved.",
        tone: "warning"
      });
      return true;
    }

    return false;
  }

  trustedSnapshotContext(sourceId: string): {
    hasTrustedSnapshot: boolean;
    withinTtl: boolean;
  } {
    const source = this.requireSource(sourceId);
    const published = this.repository.getPublishedSnapshot(sourceId);
    return {
      hasTrustedSnapshot: published !== null,
      withinTtl: published
        ? isWithinTtl(published.observedAt, source.freshnessTtlMinutes, this.now())
        : false
    };
  }

  healingFailureState(
    sourceId: string,
    state: "HEALING" | "REVIEW_PENDING"
  ): StoredSource["currentState"] {
    return transitionSourceState(state, {
      type: "HEAL_FAILED",
      ...this.trustedSnapshotContext(sourceId)
    });
  }
}
