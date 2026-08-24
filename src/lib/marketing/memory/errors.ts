export class MemoryValidationError extends Error {
  readonly code = "invalid_input" as const;

  constructor(message: string) {
    super(message);
    this.name = "MemoryValidationError";
  }
}

export class MemoryIngestionError extends Error {
  readonly code = "ingestion_error" as const;

  constructor(message: string) {
    super(message);
    this.name = "MemoryIngestionError";
  }
}
