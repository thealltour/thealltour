import { randomBytes } from "node:crypto";

/** Opaque Travelpayouts SubID — never reuse tracking UUID / session / member ids. */
export const TRAVELPAYOUTS_SUB_ID_PREFIX = "tp_";
export const TRAVELPAYOUTS_SUB_ID_HEX_LENGTH = 24;
export const TRAVELPAYOUTS_SUB_ID_PATTERN = /^tp_[a-z0-9]{24}$/;

export function createTravelpayoutsSubId(): string {
  // 12 bytes → 24 hex chars; ASCII [a-z0-9] + underscore via prefix only
  const hex = randomBytes(12).toString("hex");
  return `${TRAVELPAYOUTS_SUB_ID_PREFIX}${hex}`;
}

export function validateTravelpayoutsSubId(value: string): boolean {
  return TRAVELPAYOUTS_SUB_ID_PATTERN.test(value);
}
