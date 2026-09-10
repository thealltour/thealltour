/**
 * Resolve the Hermes CLI binary for Pi systemd / cron workers.
 * systemd units often set a minimal PATH that excludes ~/.local/bin.
 */
import { existsSync } from "node:fs";

const DEFAULT_CANDIDATES = [
  "/home/ysh/.local/bin/hermes",
  "/home/ysh/.hermes/hermes-agent/venv/bin/hermes",
] as const;

export function resolveHermesExecutable(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  const fromEnv = env.HERMES_BIN?.trim();
  if (fromEnv) return fromEnv;

  for (const candidate of DEFAULT_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }

  // Last resort: rely on PATH (interactive shells / Hermes cron wrappers).
  return "hermes";
}
