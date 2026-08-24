export class SemanticNotConfiguredError extends Error {
  readonly code = "provider_not_configured" as const;

  constructor(message = "Embedding provider is not configured") {
    super(message);
    this.name = "SemanticNotConfiguredError";
  }
}

export class SemanticUnsupportedError extends Error {
  readonly code = "provider_unsupported" as const;

  constructor(message = "Embedding provider is not enabled in this step") {
    super(message);
    this.name = "SemanticUnsupportedError";
  }
}
