import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN?.trim()),
  tracesSampleRate: 0.05,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
});
