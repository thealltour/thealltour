export class MarketingAssetTransportError extends Error {
  readonly code: string;
  readonly httpStatus: number | null;

  constructor(message: string, code: string, httpStatus: number | null = null) {
    super(message);
    this.name = "MarketingAssetTransportError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
