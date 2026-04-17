import * as Sentry from "@sentry/nextjs";

/** `SENTRY_DSN`이 있고 `instrumentation`에서 init된 경우에만 전송됩니다. */
export function captureServerException(
  error: unknown,
  extra?: Record<string, string | number | boolean | undefined>,
): void {
  if (!process.env.SENTRY_DSN?.trim()) return;
  const cleaned: Record<string, string | number | boolean> = {};
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) continue;
      cleaned[k] = v;
    }
  }
  Sentry.captureException(error, Object.keys(cleaned).length ? { extra: cleaned } : undefined);
}
