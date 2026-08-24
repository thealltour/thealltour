export class ContextValidationError extends Error {
  readonly code = "invalid_input" as const;

  constructor(message: string) {
    super(message);
    this.name = "ContextValidationError";
  }
}
