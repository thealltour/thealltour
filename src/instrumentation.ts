export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    try {
      const { ensureRuntimeEnv } = await import("./lib/server/loadRuntimeEnv");
      ensureRuntimeEnv();
    } catch {
      // best-effort — missing hermes env must not block boot
    }
  }
}
