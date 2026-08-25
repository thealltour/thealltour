export class SocialRepositoryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SocialRepositoryError";
    this.code = code;
  }
}

export class SocialInvariantError extends SocialRepositoryError {
  constructor(message: string) {
    super("invariant_violation", message);
    this.name = "SocialInvariantError";
  }
}

export class SocialIdempotencyConflictError extends SocialRepositoryError {
  readonly existingPublicationId: string;

  constructor(existingPublicationId: string) {
    super(
      "idempotency_conflict",
      `Publication already exists for account+idempotency_key: ${existingPublicationId}`,
    );
    this.name = "SocialIdempotencyConflictError";
    this.existingPublicationId = existingPublicationId;
  }
}

export class SocialAuthorizationNotUsableError extends SocialRepositoryError {
  constructor(message: string) {
    super("authorization_not_usable", message);
    this.name = "SocialAuthorizationNotUsableError";
  }
}
