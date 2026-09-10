export class ShortformVideoRenderJobError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "ShortformVideoRenderJobError";
    this.code = code;
  }
}
