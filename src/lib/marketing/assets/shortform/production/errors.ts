import "server-only";

export class ShortformProductionError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "ShortformProductionError";
    this.code = code;
  }
}
