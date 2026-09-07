import "server-only";

export type TravelpayoutsConfig = {
  apiToken: string;
  /** Partner marker (unique partner ID). */
  partnerId: string;
  /** Project ID (trs). */
  projectId: string;
};

export class TravelpayoutsConfigError extends Error {
  readonly code = "config_missing" as const;

  constructor(message = "Travelpayouts configuration is incomplete") {
    super(message);
    this.name = "TravelpayoutsConfigError";
  }
}

/**
 * Lazy server-only config. Missing env does not fail import/build —
 * throws only when Partner Links is actually invoked.
 */
export function getTravelpayoutsConfig(): TravelpayoutsConfig {
  const apiToken = process.env.TRAVELPAYOUTS_API_TOKEN?.trim() ?? "";
  const partnerId = process.env.TRAVELPAYOUTS_PARTNER_ID?.trim() ?? "";
  const projectId = process.env.TRAVELPAYOUTS_PROJECT_ID?.trim() ?? "";

  if (!apiToken || !partnerId || !projectId) {
    throw new TravelpayoutsConfigError();
  }

  return { apiToken, partnerId, projectId };
}

export function hasTravelpayoutsConfig(): boolean {
  try {
    getTravelpayoutsConfig();
    return true;
  } catch {
    return false;
  }
}

export const TRAVELPAYOUTS_PARTNER_LINKS_URL =
  "https://api.travelpayouts.com/links/v1/create";

export const TRAVELPAYOUTS_PARTNER_LINKS_TIMEOUT_MS = 10_000;
