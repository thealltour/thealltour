/**
 * Server-only runtime env bootstrap + request-scoped resolve.
 * Admin status credential SoT is resolveRuntimeEnv() immutable bags.
 * Overlay / process.env mutation remains best-effort compatibility only.
 * Never logs secret values.
 */
import "server-only";

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RUNTIME_ENV_STORE_INSTANCE_ID,
  fillRuntimeEnvIfMissing,
  getRuntimeEnvBag,
  isRuntimeEnvValuePresent,
  resetRuntimeEnvOverlayForTests,
} from "@/lib/runtimeEnvStore";

function parseEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(filePath)) return out;
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
    if (!(key in out)) out[key] = value;
  }
  return out;
}

function mergeMissing(
  bag: Record<string, string | undefined>,
  incoming: Record<string, string>,
): void {
  for (const [key, value] of Object.entries(incoming)) {
    if (!bag[key]?.trim()) bag[key] = value;
  }
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

export function resolveHermesHome(explicit?: string): string {
  if (explicit?.trim()) return explicit.trim();
  const fromEnv = process.env.HERMES_HOME?.trim();
  if (fromEnv) return fromEnv;
  const home = process.env.HOME?.trim() || homedir();
  return join(home, ".hermes");
}

export type ResolveRuntimeEnvOptions = {
  root?: string;
  hermesHome?: string;
  includeHermesEnv?: boolean;
  /**
   * Also fill process.env + module overlay for legacy callers.
   * Must not be required for Admin status correctness.
   */
  syncCompatibility?: boolean;
};

/**
 * Request-scoped immutable env bag — source of truth for Admin status credentials.
 * Does not depend on instrumentation preload or module-scoped overlay visibility.
 */
export function resolveRuntimeEnv(
  options: ResolveRuntimeEnvOptions = {},
): Record<string, string | undefined> {
  const bag: Record<string, string | undefined> = {};
  try {
    for (const key of Object.keys(process.env)) {
      bag[key] = process.env[key];
    }
  } catch {
    // ignore Next env proxy failures
  }

  const root = resolveRuntimeProjectRoot(options.root);
  mergeMissing(bag, parseEnvFile(join(root, ".env")));
  mergeMissing(bag, parseEnvFile(join(root, ".env.local")));

  if (options.includeHermesEnv !== false) {
    const hermesHome = resolveHermesHome(options.hermesHome);
    mergeMissing(bag, parseEnvFile(join(hermesHome, ".env")));
  }

  if (options.syncCompatibility !== false) {
    for (const [key, value] of Object.entries(bag)) {
      if (value?.trim()) fillRuntimeEnvIfMissing(key, value);
    }
  }

  return { ...bag };
}

export type EnsureRuntimeEnvOptions = {
  root?: string;
  hermesHome?: string;
  /** @deprecated Kept for call-site compatibility. */
  force?: boolean;
  includeHermesEnv?: boolean;
};

/**
 * Best-effort fill of process.env + overlay. Prefer resolveRuntimeEnv() for status.
 */
export function ensureRuntimeEnv(options: EnsureRuntimeEnvOptions = {}): void {
  resolveRuntimeEnv({
    root: options.root,
    hermesHome: options.hermesHome,
    includeHermesEnv: options.includeHermesEnv,
    syncCompatibility: true,
  });
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

function presence(bag: Record<string, string | undefined> | NodeJS.ProcessEnv, key: string): boolean {
  try {
    return Boolean(bag[key]?.trim());
  } catch {
    return false;
  }
}

/** Live Next-process diagnostics — booleans + paths only, never secrets. */
export type RuntimeEnvLiveDiagnostics = {
  cwd: string;
  HOME_present: boolean;
  HERMES_HOME_present: boolean;
  hermesEnvPathResolved: string;
  hermesEnvFileExists: boolean;
  runtimeEnvStoreInstanceId: string;
  GEMINI_API_KEY_present: boolean;
  GOOGLE_GENERATIVE_AI_API_KEY_present: boolean;
  GOOGLE_API_KEY_present: boolean;
  OPENROUTER_API_KEY_present: boolean;
  NVIDIA_API_KEY_present: boolean;
  sharedObservabilityFlagPresent: boolean;
  sharedObservabilityEnabled: boolean;
};

export function collectRuntimeEnvDiagnostics(
  env: Record<string, string | undefined> = resolveRuntimeEnv({ syncCompatibility: false }),
): RuntimeEnvLiveDiagnostics {
  const hermesEnvPathResolved = join(resolveHermesHome(), ".env");
  return {
    cwd: process.cwd(),
    HOME_present: Boolean((process.env.HOME ?? homedir())?.trim()),
    HERMES_HOME_present: Boolean(process.env.HERMES_HOME?.trim()),
    hermesEnvPathResolved,
    hermesEnvFileExists: existsSync(hermesEnvPathResolved),
    runtimeEnvStoreInstanceId: RUNTIME_ENV_STORE_INSTANCE_ID,
    GEMINI_API_KEY_present: presence(env, "GEMINI_API_KEY"),
    GOOGLE_GENERATIVE_AI_API_KEY_present: presence(env, "GOOGLE_GENERATIVE_AI_API_KEY"),
    GOOGLE_API_KEY_present: presence(env, "GOOGLE_API_KEY"),
    OPENROUTER_API_KEY_present: presence(env, "OPENROUTER_API_KEY"),
    NVIDIA_API_KEY_present: presence(env, "NVIDIA_API_KEY"),
    sharedObservabilityFlagPresent: Boolean(
      env.AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED?.trim(),
    ),
    sharedObservabilityEnabled: isSharedObservabilityEnabledFromEnv(env),
  };
}

/**
 * Dev/diagnostic only. Never attach to API JSON responses.
 */
export function logRuntimeEnvDiagnostics(
  tag = "[ai-runtime-env]",
  env?: Record<string, string | undefined>,
): RuntimeEnvLiveDiagnostics {
  const diagnostics = collectRuntimeEnvDiagnostics(env);
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

export type RuntimeEnvPresenceSnapshot = {
  processEnv: {
    OPENROUTER_API_KEY: boolean;
    NVIDIA_API_KEY: boolean;
    GOOGLE_API_KEY: boolean;
  };
  overlayBag: {
    OPENROUTER_API_KEY: boolean;
    NVIDIA_API_KEY: boolean;
    GOOGLE_API_KEY: boolean;
  };
  resolvedBag?: {
    OPENROUTER_API_KEY: boolean;
    NVIDIA_API_KEY: boolean;
    GOOGLE_API_KEY: boolean;
  };
};

export function snapshotCredentialPresence(
  resolvedBag?: Record<string, string | undefined>,
): RuntimeEnvPresenceSnapshot {
  const overlayBag = getRuntimeEnvBag();
  return {
    processEnv: {
      OPENROUTER_API_KEY: presence(process.env, "OPENROUTER_API_KEY"),
      NVIDIA_API_KEY: presence(process.env, "NVIDIA_API_KEY"),
      GOOGLE_API_KEY: presence(process.env, "GOOGLE_API_KEY"),
    },
    overlayBag: {
      OPENROUTER_API_KEY: presence(overlayBag, "OPENROUTER_API_KEY"),
      NVIDIA_API_KEY: presence(overlayBag, "NVIDIA_API_KEY"),
      GOOGLE_API_KEY: presence(overlayBag, "GOOGLE_API_KEY"),
    },
    resolvedBag: resolvedBag
      ? {
          OPENROUTER_API_KEY: presence(resolvedBag, "OPENROUTER_API_KEY"),
          NVIDIA_API_KEY: presence(resolvedBag, "NVIDIA_API_KEY"),
          GOOGLE_API_KEY: presence(resolvedBag, "GOOGLE_API_KEY"),
        }
      : undefined,
  };
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
  const hermesHome = resolveHermesHome(options.hermesHome);
  const projectEnvLocalFound = existsSync(join(root, ".env.local"));
  const projectEnvFound = existsSync(join(root, ".env"));
  const hermesEnvFound = existsSync(join(hermesHome, ".env"));

  const env = resolveRuntimeEnv({
    root: options.root,
    hermesHome: options.hermesHome,
    includeHermesEnv: options.includeHermesEnv,
    syncCompatibility: false,
  });

  return {
    projectRoot: root,
    projectEnvLocalFound,
    projectEnvFound,
    hermesHome,
    hermesEnvFound,
    sharedObservabilityFlagPresent: Boolean(
      env.AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED?.trim(),
    ),
    sharedObservabilityEnabled: isSharedObservabilityEnabledFromEnv(env),
    credentials: {
      gemini:
        presence(env, "GOOGLE_GENERATIVE_AI_API_KEY") ||
        presence(env, "GEMINI_API_KEY") ||
        presence(env, "GOOGLE_API_KEY"),
      openrouter: presence(env, "OPENROUTER_API_KEY"),
      nvidia: presence(env, "NVIDIA_API_KEY"),
    },
    process: {
      cwd: process.cwd(),
      homePresent: Boolean(homedir()?.trim()),
      hermesHomeEnvPresent: Boolean(process.env.HERMES_HOME?.trim()),
    },
  };
}

export { getRuntimeEnvBag, RUNTIME_ENV_STORE_INSTANCE_ID };
