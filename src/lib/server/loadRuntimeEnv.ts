/**
 * Server-only runtime env bootstrap.
 * Fills missing keys from project .env/.env.local and HERMES_HOME/.env into
 * the runtime env overlay (+ best-effort process.env).
 * Never overwrites non-empty already-set keys. Never logs secret values.
 */
import "server-only";

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fillRuntimeEnvIfMissing,
  getRuntimeEnvBag,
  isRuntimeEnvValuePresent,
  readRuntimeEnvValue,
  resetRuntimeEnvOverlayForTests,
} from "@/lib/runtimeEnvStore";

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
    fillRuntimeEnvIfMissing(key, value);
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
    // import.meta.url unavailable in some CJS test shims
  }

  return process.cwd();
}

export function resolveHermesHome(): string {
  const fromEnv = process.env.HERMES_HOME?.trim();
  if (fromEnv) return fromEnv;
  const home = process.env.HOME?.trim() || homedir();
  return join(home, ".hermes");
}

export type EnsureRuntimeEnvOptions = {
  root?: string;
  /** @deprecated Kept for call-site compatibility. */
  force?: boolean;
  includeHermesEnv?: boolean;
};

/**
 * Idempotent fill of *missing* keys into overlay (+ process.env best-effort).
 * Safe to call on every Admin status request.
 */
export function ensureRuntimeEnv(options: EnsureRuntimeEnvOptions = {}): void {
  const root = resolveRuntimeProjectRoot(options.root);
  applyEnvFile(join(root, ".env"));
  applyEnvFile(join(root, ".env.local"));

  const includeHermes = options.includeHermesEnv !== false;
  if (includeHermes) {
    applyEnvFile(join(resolveHermesHome(), ".env"));
  }
}

export function resetRuntimeEnvLoadedForTests(): void {
  resetRuntimeEnvOverlayForTests();
}

export function isRuntimeCredentialEnvPresent(envName: string): boolean {
  return isRuntimeEnvValuePresent(envName);
}

export function isSharedObservabilityEnabledFromEnv(
  env: Record<string, string | undefined> = getRuntimeEnvBag(),
): boolean {
  const raw = env.AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

/** Live Next-process diagnostics — booleans + paths only, never secrets. */
export type RuntimeEnvLiveDiagnostics = {
  cwd: string;
  HOME_present: boolean;
  HERMES_HOME_present: boolean;
  hermesEnvPathResolved: string;
  hermesEnvFileExists: boolean;
  GEMINI_API_KEY_present: boolean;
  GOOGLE_GENERATIVE_AI_API_KEY_present: boolean;
  GOOGLE_API_KEY_present: boolean;
  OPENROUTER_API_KEY_present: boolean;
  NVIDIA_API_KEY_present: boolean;
  sharedObservabilityFlagPresent: boolean;
  sharedObservabilityEnabled: boolean;
};

export function collectRuntimeEnvDiagnostics(): RuntimeEnvLiveDiagnostics {
  const hermesEnvPathResolved = join(resolveHermesHome(), ".env");
  return {
    cwd: process.cwd(),
    HOME_present: Boolean((process.env.HOME ?? homedir())?.trim()),
    HERMES_HOME_present: Boolean(process.env.HERMES_HOME?.trim()),
    hermesEnvPathResolved,
    hermesEnvFileExists: existsSync(hermesEnvPathResolved),
    GEMINI_API_KEY_present: isRuntimeEnvValuePresent("GEMINI_API_KEY"),
    GOOGLE_GENERATIVE_AI_API_KEY_present: isRuntimeEnvValuePresent(
      "GOOGLE_GENERATIVE_AI_API_KEY",
    ),
    GOOGLE_API_KEY_present: isRuntimeEnvValuePresent("GOOGLE_API_KEY"),
    OPENROUTER_API_KEY_present: isRuntimeEnvValuePresent("OPENROUTER_API_KEY"),
    NVIDIA_API_KEY_present: isRuntimeEnvValuePresent("NVIDIA_API_KEY"),
    sharedObservabilityFlagPresent: Boolean(
      readRuntimeEnvValue("AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED")?.trim(),
    ),
    sharedObservabilityEnabled: isSharedObservabilityEnabledFromEnv(),
  };
}

/**
 * Dev/diagnostic only. Never attach to API JSON responses.
 * Writes /tmp/ai-runtime-env-diag.json when allowed.
 */
export function logRuntimeEnvDiagnostics(tag = "[ai-runtime-env]"): RuntimeEnvLiveDiagnostics {
  const diagnostics = collectRuntimeEnvDiagnostics();
  const allow =
    process.env.NODE_ENV !== "production" ||
    process.env.AI_RUNTIME_ENV_DIAGNOSTIC === "1";
  if (allow) {
    console.info(tag, JSON.stringify(diagnostics));
    try {
      writeFileSync(
        "/tmp/ai-runtime-env-diag.json",
        `${JSON.stringify(diagnostics, null, 2)}\n`,
        { encoding: "utf8", mode: 0o600 },
      );
    } catch {
      // ignore write failures
    }
  }
  return diagnostics;
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
  process: {
    cwd: string;
    homePresent: boolean;
    hermesHomeEnvPresent: boolean;
  };
};

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
      readRuntimeEnvValue("AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED")?.trim(),
    ),
    sharedObservabilityEnabled: isSharedObservabilityEnabledFromEnv(),
    credentials: {
      gemini:
        isRuntimeEnvValuePresent("GOOGLE_GENERATIVE_AI_API_KEY") ||
        isRuntimeEnvValuePresent("GEMINI_API_KEY") ||
        isRuntimeEnvValuePresent("GOOGLE_API_KEY"),
      openrouter: isRuntimeEnvValuePresent("OPENROUTER_API_KEY"),
      nvidia: isRuntimeEnvValuePresent("NVIDIA_API_KEY"),
    },
    process: {
      cwd: process.cwd(),
      homePresent: Boolean(homedir()?.trim()),
      hermesHomeEnvPresent: Boolean(process.env.HERMES_HOME?.trim()),
    },
  };
}

export { getRuntimeEnvBag };
