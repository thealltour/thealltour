export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    try {
      const { resolveRuntimeEnv, logRuntimeEnvDiagnostics } = await import(
        "./lib/server/loadRuntimeEnv"
      );
      // Best-effort boot preload only — Admin status must not depend on this.
      const env = resolveRuntimeEnv({ syncCompatibility: true });
      logRuntimeEnvDiagnostics("[ai-runtime-env:boot]", env);
      const { ensureSharedObservabilityRecorder } = await import(
        "./ai-runtime/observability/persistence/factory"
      );
      await ensureSharedObservabilityRecorder({ env });
    } catch {
      // best-effort — missing hermes env must not block boot
    }
  }
}
