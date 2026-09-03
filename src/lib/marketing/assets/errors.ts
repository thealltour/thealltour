export class MarketingAssetConfigError extends Error {
  readonly code = "marketing_asset_config" as const;

  constructor(message: string) {
    super(message);
    this.name = "MarketingAssetConfigError";
  }
}

export class MarketingAssetPathError extends Error {
  readonly code = "marketing_asset_path" as const;

  constructor(message: string) {
    super(message);
    this.name = "MarketingAssetPathError";
  }
}

export class MarketingAssetConflictError extends Error {
  readonly code = "marketing_asset_conflict" as const;
  readonly relativePath: string;
  readonly existingSha256: string;
  readonly incomingSha256: string;

  constructor(input: { relativePath: string; existingSha256: string; incomingSha256: string }) {
    super(
      `Marketing asset conflict at ${input.relativePath}: existing ${input.existingSha256} != incoming ${input.incomingSha256}`,
    );
    this.name = "MarketingAssetConflictError";
    this.relativePath = input.relativePath;
    this.existingSha256 = input.existingSha256;
    this.incomingSha256 = input.incomingSha256;
  }
}

export class MarketingAssetContractError extends Error {
  readonly code = "marketing_asset_contract" as const;

  constructor(message: string) {
    super(message);
    this.name = "MarketingAssetContractError";
  }
}

export class MarketingAssetExportError extends Error {
  readonly code = "marketing_asset_export" as const;

  constructor(message: string) {
    super(message);
    this.name = "MarketingAssetExportError";
  }
}
