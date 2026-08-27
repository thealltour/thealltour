/**
 * Server-only runtime env bootstrap.
 * Fills missing process.env keys from project .env/.env.local and HERMES_HOME/.env.
 * Never overwrites already-set keys. Never logs secret values.
 */
import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

let loaded = false;

function applyEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim().replace(/^export\s+/, "");
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

export type EnsureRuntimeEnvOptions = {
  /** Project root (defaults to cwd). */
  root?: string;
  /** Force reload (tests). */
  force?: boolean;
  /** Include HERMES_HOME/.env fallback (default true on hermes-pi / local). */
  includeHermesEnv?: boolean;
};

/**
 * Idempotent. Safe to call from Admin API, Cron, and instrumentation.
 * Next.js already loads .env.local — this only fills *missing* provider keys
 * (e.g. OPENROUTER_API_KEY / NVIDIA_API_KEY from HERMES_HOME/.env).
 */
export function ensureRuntimeEnv(options: EnsureRuntimeEnvOptions = {}): void {
  if (loaded && !options.force) return;

  const root = options.root ?? process.cwd();
  applyEnvFile(join(root, ".env"));
  applyEnvFile(join(root, ".env.local"));

  const includeHermes = options.includeHermesEnv !== false;
  if (includeHermes) {
    const hermesHome =
      process.env.HERMES_HOME?.trim() || join(homedir(), ".hermes");
    applyEnvFile(join(hermesHome, ".env"));
  }

  loaded = true;
}

/** Test helper */
export function resetRuntimeEnvLoadedForTests(): void {
  loaded = false;
}

/** Boolean presence only — never returns secret values. */
export function isRuntimeCredentialEnvPresent(envName: string): boolean {
  return Boolean(process.env[envName]?.trim());
}
