export class MarketingBotValidationError extends Error {
  readonly code = "invalid_bot_input" as const;

  constructor(message: string) {
    super(message);
    this.name = "MarketingBotValidationError";
  }
}

export class MarketingBotAuthError extends Error {
  readonly code = "unauthorized_bot" as const;

  constructor(message = "Unauthorized") {
    super(message);
    this.name = "MarketingBotAuthError";
  }
}
