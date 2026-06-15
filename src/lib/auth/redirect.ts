const BLOCKED_NEXT_PATHS = ["/login", "/signup", "/auth/link-account"];

export function sanitizeNextPath(raw: string | null | undefined, fallback = "/"): string {
  const value = raw?.trim() ?? "";
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (BLOCKED_NEXT_PATHS.some((p) => value === p || value.startsWith(`${p}?`))) {
    return fallback;
  }
  return value;
}

export function getAppBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

export function getOAuthRedirectUri(provider: string): string {
  return `${getAppBaseUrl()}/api/auth/${provider}/callback`;
}
