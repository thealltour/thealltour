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

export class CardNewsNotApplicableError extends Error {
  readonly code = "cardnews_not_applicable" as const;
  readonly reason: "cardnews_disabled" | "no_cards";

  constructor(reason: "cardnews_disabled" | "no_cards") {
    super(
      reason === "cardnews_disabled"
        ? "CardNews is not enabled on this MediaBrief"
        : "CardNews is enabled but the brief contains no cards",
    );
    this.name = "CardNewsNotApplicableError";
    this.reason = reason;
  }
}

export class CardNewsRenderOverflowError extends Error {
  readonly code = "cardnews_render_overflow" as const;
  readonly cardId: string;
  readonly field: "headline" | "body";

  constructor(input: { cardId: string; field: "headline" | "body"; message: string }) {
    super(input.message);
    this.name = "CardNewsRenderOverflowError";
    this.cardId = input.cardId;
    this.field = input.field;
  }
}

export class CardNewsVisualError extends Error {
  readonly code = "cardnews_visual" as const;

  constructor(message: string) {
    super(message);
    this.name = "CardNewsVisualError";
  }
}

export const VIDEO_SHOT_ERROR_CODES = [
  "media_brief_missing",
  "narration_mismatch",
  "invalid_shot_list",
] as const;

export type VideoShotErrorCode = (typeof VIDEO_SHOT_ERROR_CODES)[number];

export class VideoShotError extends Error {
  readonly name = "VideoShotError";
  readonly code: VideoShotErrorCode;

  constructor(code: VideoShotErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export const VIDEO_CLIP_ERROR_CODES = [
  "shot_list_missing",
  "unsupported_shot_list",
  "invalid_shot_list",
  "clip_probe_unavailable",
  "clip_probe_failed",
  "clip_probe_timeout",
  "invalid_clip_metadata",
  "incoming_rejected",
] as const;

export type VideoClipErrorCode = (typeof VIDEO_CLIP_ERROR_CODES)[number];

export class VideoClipError extends Error {
  readonly name = "VideoClipError";
  readonly code: VideoClipErrorCode;

  constructor(code: VideoClipErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
