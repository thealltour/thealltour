import type { AuthProviderId } from "@/lib/auth/types";

export function startOAuthLogin(providerId: AuthProviderId, options?: { nextPath?: string; mode?: "login" | "link" }) {
  const params = new URLSearchParams({ mode: options?.mode ?? "login" });
  if (options?.nextPath) params.set("next", options.nextPath);
  window.location.href = `/api/auth/${providerId}/start?${params.toString()}`;
}
