/**
 * Server-only runtime env bootstrap.
 * Fills missing process.env keys from project .env/.env.local and HERMES_HOME/.env.
 * Never overwrites non-empty already-set keys. Never logs secret values.
 *
 * IMPORTANT: Do not gate on a one-shot `loaded` flag. Next.js may hot-reload
 * `.env.local` (wiping dynamically injected Hermes keys) or start before flags
 * are present — Admin status / Cron must re-apply missing keys on each call.
 */
import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function applyEnvFile(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
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
    // Fill only when missing or whitespace — never clobber real values.
    if (!process.env[key]?.trim()) {
      process.env[key] = value;
    }
  }
  return true;
}

function looksLikeProjectRoot(dir: string): boolean {
  return (
    existsSync(join(dir, "package.json")) &&
    (existsSync(join(dir, "next.config.ts")) ||
      existsSync(join(dir, "next.config.mjs")) ||
      existsSync(join(dir, "next.config.js")))
  );
}

/**
 * Prefer explicit root, then cwd walk, then module path walk.
 * Avoids fragile cwd-only resolution under some Next worker layouts.
 */
export function resolveRuntimeProjectRoot(explicit?: string): string {
  if (explicit?.trim()) return explicit.trim();

  const fromEnv = process.env.THEALL_PROJECT_ROOT?.trim();
  if (fromEnv && looksLikeProjectRoot(fromEnv)) return fromEnv;

  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (looksLikeProjectRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  try {
    const moduleDir = dirname(fileURLToPath(import.meta.url));
    dir = moduleDir;
    for (let i = 0; i < 12; i++) {
      if (looksLikeProjectRoot(dir)) return dir;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // import.meta.url unavailable in some CJS test shims — cwd fallback below
  }

  return process.cwd();
}

export function resolveHermesHome(): string {
  const fromEnv = process.env.HERMES_HOME?.trim();
  if (fromEnv) return fromEnv;
  return join(homedir(), ".hermes");
}

export type EnsureRuntimeEnvOptions = {
  /** Project root (defaults to resolved project root). */
  root?: string;
  /** @deprecated No longer skips re-apply; kept for call-site compatibility. */
  force?: boolean;
  /** Include HERMES_HOME/.env fallback (default true). */
  includeHermesEnv?: boolean;
};

/**
 * Idempotent fill of *missing* keys. Safe to call on every Admin status request.
 * Next.js already loads .env.local at boot — this also re-reads disk so Hermes
 * provider keys and flags added after boot remain visible.
 */
export function ensureRuntimeEnv(options: EnsureRuntimeEnvOptions = {}): void {
  const root = resolveRuntimeProjectRoot(options.root);
  // Literal basenames — avoids Turbopack treating join(root, dynamic) as a tree glob.
  applyEnvFile(join(root, ".env"));
  applyEnvFile(join(root, ".env.local"));

  const includeHermes = options.includeHermesEnv !== false;
  if (includeHermes) {
    applyEnvFile(join(resolveHermesHome(), ".env"));
  }
}

/** Test helper — retained so older tests can reset between cases (no-op gate). */
export function resetRuntimeEnvLoadedForTests(): void {
  // Re-apply is always allowed; nothing to reset.
}

/** Boolean presence only — never returns secret values. */
export function isRuntimeCredentialEnvPresent(envName: string): boolean {
  return Boolean(process.env[envName]?.trim());
}

/** Call-time flag reader (never import-time snapshot). */
export function isSharedObservabilityEnabledFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const raw = env.AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

export type RuntimeEnvSourceProbe = {
  projectRoot: string;
  projectEnvLocalFound: boolean;
  projectEnvFound: boolean;
  hermesHome: string;
  hermesEnvFound: boolean;
  sharedObservabilityFlagPresent: boolean;
  sharedObservabilityEnabled: boolean;
  credentials: {
    gemini: boolean;
    openrouter: boolean;
    nvidia: boolean;
  };
  /** cwd / HOME / HERMES_HOME presence only — no secret values */
  process: {
    cwd: string;
    homePresent: boolean;
    hermesHomeEnvPresent: boolean;
  };
};

/**
 * Safe diagnostic: file presence + boolean credential/flag state.
 * Uses dummy-safe reads only — never returns raw key material.
 */
export function probeRuntimeEnvSources(
  options: EnsureRuntimeEnvOptions = {},
): RuntimeEnvSourceProbe {
  const root = resolveRuntimeProjectRoot(options.root);
  const hermesHome = resolveHermesHome();
  const projectEnvLocalFound = existsSync(join(root, ".env.local"));
  const projectEnvFound = existsSync(join(root, ".env"));
  const hermesEnvFound = existsSync(join(hermesHome, ".env"));

  ensureRuntimeEnv(options);

  return {
    projectRoot: root,
    projectEnvLocalFound,
    projectEnvFound,
    hermesHome,
    hermesEnvFound,
    sharedObservabilityFlagPresent: Boolean(
      process.env.AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED?.trim(),
    ),
    sharedObservabilityEnabled: isSharedObservabilityEnabledFromEnv(),
    credentials: {
      gemini:
        isRuntimeCredentialEnvPresent("GOOGLE_GENERATIVE_AI_API_KEY") ||
        isRuntimeCredentialEnvPresent("GEMINI_API_KEY") ||
        isRuntimeCredentialEnvPresent("GOOGLE_API_KEY"),
      openrouter: isRuntimeCredentialEnvPresent("OPENROUTER_API_KEY"),
      nvidia: isRuntimeCredentialEnvPresent("NVIDIA_API_KEY"),
    },
    process: {
      cwd: process.cwd(),
      homePresent: Boolean(homedir()?.trim()),
      hermesHomeEnvPresent: Boolean(process.env.HERMES_HOME?.trim()),
    },
  };
}
