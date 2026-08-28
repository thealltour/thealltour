import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Parsed env keys from a Hermes-style .env file (values never returned). */
export type HermesEnvKeySet = {
  path: string;
  keys: Set<string>;
  present: boolean;
};

export type HermesExecutionEnvScope = {
  profileEnv: HermesEnvKeySet;
  globalEnv: HermesEnvKeySet;
  processEnvKeys: Set<string>;
};

function parseEnvKeys(filePath: string): HermesEnvKeySet {
  if (!existsSync(filePath)) {
    return { path: filePath, keys: new Set(), present: false };
  }
  const keys = new Set<string>();
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const eq = t.indexOf("=");
    const key = t.slice(0, eq).trim().replace(/^export\s+/i, "");
    if (key) keys.add(key);
  }
  return { path: filePath, keys, present: true };
}

export function defaultHermesHome(): string {
  return process.env.HERMES_HOME?.trim() || join(homedir(), ".hermes");
}

export function loadHermesExecutionEnvScope(
  profileId: string,
  processEnv: Record<string, string | undefined> = process.env,
  hermesHome = defaultHermesHome(),
): HermesExecutionEnvScope {
  const profileEnv = parseEnvKeys(join(hermesHome, "profiles", profileId, ".env"));
  const globalEnv = parseEnvKeys(join(hermesHome, ".env"));
  const processEnvKeys = new Set(
    Object.entries(processEnv)
      .filter(([, value]) => Boolean(value?.trim()))
      .map(([key]) => key),
  );
  return { profileEnv, globalEnv, processEnvKeys };
}

/**
 * Mirrors Hermes secret_scope.get_secret fallthrough when multiplexing is off:
 * profile scope → process environment. Global ~/.hermes/.env is loaded by
 * get_env_value after scope/process for non-scoped reads; we treat it as an
 * additional supported source for gateway cutover preflight.
 */
export function isEnvKeyAvailableInHermesScope(
  key: string,
  scope: HermesExecutionEnvScope,
): { available: boolean; source: "profile_env" | "global_env" | "process_env" | "missing" } {
  if (scope.profileEnv.keys.has(key)) {
    return { available: true, source: "profile_env" };
  }
  if (scope.globalEnv.keys.has(key)) {
    return { available: true, source: "global_env" };
  }
  if (scope.processEnvKeys.has(key)) {
    return { available: true, source: "process_env" };
  }
  return { available: false, source: "missing" };
}
