export class ResearchRepositoryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ResearchRepositoryError";
    this.code = code;
  }
}

export class ResearchIdempotencyConflictError extends ResearchRepositoryError {
  constructor(message = "duplicate") {
    super("idempotency_conflict", message);
    this.name = "ResearchIdempotencyConflictError";
  }
}

export class ResearchValidationError extends ResearchRepositoryError {
  constructor(message: string) {
    super("validation_error", message);
    this.name = "ResearchValidationError";
  }
}
