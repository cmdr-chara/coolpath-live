export class ApiError extends Error {
  constructor(
    public readonly statusCode: 400 | 404 | 409,
    public readonly code: "INVALID_REQUEST" | "NOT_FOUND" | "CONFLICT",
    public readonly publicMessage: string,
    internalMessage: string
  ) {
    super(internalMessage);
    this.name = "ApiError";
  }
}

export class SourceNotFoundError extends ApiError {
  constructor() {
    super(
      404,
      "NOT_FOUND",
      "The requested source was not found.",
      "Source is not allowlisted or is disabled"
    );
  }
}

export class SourceOperationConflictError extends ApiError {
  constructor() {
    super(
      409,
      "CONFLICT",
      "Another operation is already active for this source.",
      "A source operation is already active"
    );
  }
}

export class SourceOperationStateError extends ApiError {
  constructor(internalMessage: string) {
    super(
      409,
      "CONFLICT",
      "The source is not in the required state for this operation.",
      internalMessage
    );
  }
}
