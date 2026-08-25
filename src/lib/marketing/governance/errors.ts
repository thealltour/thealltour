export class GovernanceValidationError extends Error {
  readonly code = "invalid_governance_input" as const;

  constructor(message: string) {
    super(message);
    this.name = "GovernanceValidationError";
  }
}
