export const SHARED_VISUAL_ASSETS_RELATIVE_PATH = "context/shared-visual-assets.json" as const;
export const SHARED_VISUAL_ASSETS_MEDIA_TYPE = "application/json" as const;

/** Binary storage directory under package root (server-controlled). */
export const SHARED_VISUAL_MEDIA_DIR = "media/shared-visuals" as const;

export const MAX_SHARED_VISUAL_UPLOAD_BYTES = 15 * 1024 * 1024;
