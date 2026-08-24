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

export class SemanticTimeoutError extends Error {
  readonly code = "provider_error" as const;

  constructor(message = "Embedding request timed out") {
    super(message);
    this.name = "SemanticTimeoutError";
  }
}

export class SemanticProviderError extends Error {
  readonly code = "provider_error" as const;

  constructor(message = "Embedding provider request failed") {
    super(message);
    this.name = "SemanticProviderError";
  }
}
