export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    try {
      const { ensureRuntimeEnv, logRuntimeEnvDiagnostics } = await import(
        "./lib/server/loadRuntimeEnv"
      );
      ensureRuntimeEnv();
      logRuntimeEnvDiagnostics("[ai-runtime-env:boot]");
      const { ensureSharedObservabilityRecorder } = await import(
        "./ai-runtime/observability/persistence/factory"
      );
      await ensureSharedObservabilityRecorder();
    } catch {
      // best-effort — missing hermes env must not block boot
    }
  }
}
