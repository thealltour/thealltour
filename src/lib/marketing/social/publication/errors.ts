/**
 * Marketing publication control-plane errors (PUB-2).
 */

export class MarketingPublicationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "MarketingPublicationError";
    this.code = code;
  }
}

export const MARKETING_PUBLICATION_ERROR_CODES = {
  APPROVAL_REQUIRED: "APPROVAL_REQUIRED",
  ACCOUNT_REQUIRED: "ACCOUNT_REQUIRED",
  CHANNEL_UNSUPPORTED: "CHANNEL_UNSUPPORTED",
  SIDE_EFFECTS_DENIED: "SIDE_EFFECTS_DENIED",
  ALREADY_PUBLISHED: "ALREADY_PUBLISHED",
  CREDENTIAL_UNRESOLVED: "CREDENTIAL_UNRESOLVED",
  ADAPTER_FAILED: "ADAPTER_FAILED",
  INVALID_INPUT: "INVALID_INPUT",
} as const;
