export class MarketingSourceCatalogError extends Error {
  readonly code: string;

  constructor(message: string, code = "marketing_source_catalog") {
    super(message);
    this.name = "MarketingSourceCatalogError";
    this.code = code;
  }
}
