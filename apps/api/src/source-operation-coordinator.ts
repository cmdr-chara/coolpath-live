import { SourceOperationConflictError } from "./errors.js";

export class SourceOperationCoordinator {
  private readonly activeSources = new Set<string>();

  isActive(sourceId: string): boolean {
    return this.activeSources.has(sourceId);
  }

  async run<T>(sourceId: string, operation: () => Promise<T>): Promise<T> {
    if (this.isActive(sourceId)) throw new SourceOperationConflictError();
    this.activeSources.add(sourceId);
    try {
      return await operation();
    } finally {
      this.activeSources.delete(sourceId);
    }
  }
}
