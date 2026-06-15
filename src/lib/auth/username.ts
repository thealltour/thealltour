import { randomBytes } from "node:crypto";
import type { AuthProviderId } from "@/lib/auth/types";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{4,20}$/;

export function buildSocialUsernameBase(provider: AuthProviderId, providerUserId: string): string {
  const slug = providerUserId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toLowerCase();
  const suffix = slug.length >= 4 ? slug : randomBytes(4).toString("hex");
  const candidate = `${provider}_${suffix}`.slice(0, 20);
  return USERNAME_PATTERN.test(candidate) ? candidate : `${provider}_${randomBytes(4).toString("hex")}`.slice(0, 20);
}

export async function generateUniqueUsername(
  provider: AuthProviderId,
  providerUserId: string,
  isTaken: (username: string) => Promise<boolean>,
): Promise<string> {
  const base = buildSocialUsernameBase(provider, providerUserId);
  if (!(await isTaken(base))) return base;

  for (let i = 0; i < 8; i += 1) {
    const suffix = randomBytes(3).toString("hex");
    const candidate = `${provider}_${suffix}`.slice(0, 20);
    if (USERNAME_PATTERN.test(candidate) && !(await isTaken(candidate))) {
      return candidate;
    }
  }

  return `${provider}_${randomBytes(5).toString("hex")}`.slice(0, 20);
}
