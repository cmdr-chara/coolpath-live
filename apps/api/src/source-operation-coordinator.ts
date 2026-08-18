import { SourceOperationConflictError } from "./errors.js";

export class SourceOperationCoordinator {
  private readonly activeSources = new Set<string>();

  async run<T>(sourceId: string, operation: () => Promise<T>): Promise<T> {
    if (this.activeSources.has(sourceId)) throw new SourceOperationConflictError();
    this.activeSources.add(sourceId);
    try {
      return await operation();
    } finally {
      this.activeSources.delete(sourceId);
    }
  }
}
