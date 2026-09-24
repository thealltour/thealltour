/**
 * Inference gateway token resolution for Hermes named-profile (`-p`) children.
 *
 * Named `hermes -p <profile>` remaps HERMES_HOME to the profile directory and
 * does NOT automatically inherit parent `~/.hermes/.env`. The child process
 * therefore needs `AI_RUNTIME_INFERENCE_GATEWAY_TOKEN` in its environment
 * (launcher inject and/or profile-local `.env`).
 *
 * Precedence (first nonempty wins):
 * 1. explicit `env` argument
 * 2. `process.env`
 * 3. `resolveRuntimeEnv` / same-file fallback (`.env` → `.env.local` → `~/.hermes/.env`)
 *
 * Never logs the token value.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV } from "@/ai-runtime/integration/constants";
import type { EnvBag } from "@/lib/envBag";

export const HERMES_GATEWAY_TOKEN_ENV = AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV;

function nonemptyEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseEnvFileForToken(filePath: string): string | undefined {
  if (!existsSync(filePath)) return undefined;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim().replace(/^export\s+/, "");
    if (key !== HERMES_GATEWAY_TOKEN_ENV) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return nonemptyEnvValue(value);
  }
  return undefined;
}

function looksLikeProjectRoot(dir: string): boolean {
  return (
    existsSync(join(dir, "package.json")) &&
    (existsSync(join(dir, "next.config.ts")) ||
      existsSync(join(dir, "next.config.mjs")) ||
      existsSync(join(dir, "next.config.js")))
  );
}

function resolveProjectRootForToken(): string {
  const fromEnv = process.env.THEALL_PROJECT_ROOT?.trim();
  if (fromEnv && looksLikeProjectRoot(fromEnv)) return fromEnv;
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (looksLikeProjectRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function resolveHermesHomeForToken(env: EnvBag): string {
  const fromEnv = env.HERMES_HOME?.trim() || process.env.HERMES_HOME?.trim();
  if (fromEnv) return fromEnv;
  const home = process.env.HOME?.trim() || homedir();
  return join(home, ".hermes");
}

/**
 * Same file sources as `resolveRuntimeEnv` for this one key — used when the
 * server-only loader cannot be imported (tsx scripts / non-Next entrypoints).
 */
function readInferenceGatewayTokenFromRuntimeEnvFiles(env: EnvBag): string | undefined {
  const root = resolveProjectRootForToken();
  const hermesHome = resolveHermesHomeForToken(env);
  return (
    parseEnvFileForToken(join(root, ".env")) ??
    parseEnvFileForToken(join(root, ".env.local")) ??
    parseEnvFileForToken(join(hermesHome, ".env"))
  );
}

type ResolveRuntimeEnvFn = (options?: {
  syncCompatibility?: boolean;
}) => Record<string, string | undefined>;

/** Test-only seam so unit tests do not load `server-only` or real secret files. */
export const hermesGatewayTokenTestHooks: {
  resolveRuntimeEnv: ResolveRuntimeEnvFn | null;
} = {
  resolveRuntimeEnv: null,
};

function resolveInferenceGatewayTokenViaRuntimeEnv(env: EnvBag): string | undefined {
  try {
    const resolveRuntimeEnv: ResolveRuntimeEnvFn =
      hermesGatewayTokenTestHooks.resolveRuntimeEnv ??
      // Lazy require: keeps `server-only` out of the static graph for script
      // entrypoints until this path runs; Next route handlers use the real loader.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("@/lib/server/loadRuntimeEnv") as { resolveRuntimeEnv: ResolveRuntimeEnvFn })
        .resolveRuntimeEnv;
    return nonemptyEnvValue(resolveRuntimeEnv({ syncCompatibility: false })[HERMES_GATEWAY_TOKEN_ENV]);
  } catch {
    return readInferenceGatewayTokenFromRuntimeEnvFiles(env);
  }
}

/**
 * Gateway token for Hermes named-profile (`-p`) children.
 * Does not log the token value.
 */
export function resolveInferenceGatewayTokenForHermesChild(
  env: EnvBag = process.env,
): string | undefined {
  return (
    nonemptyEnvValue(env[HERMES_GATEWAY_TOKEN_ENV]) ??
    nonemptyEnvValue(process.env[HERMES_GATEWAY_TOKEN_ENV]) ??
    resolveInferenceGatewayTokenViaRuntimeEnv(env)
  );
}

export const DEFAULT_HERMES_HOME = "/home/ysh/.hermes";

/** Spawn env for Hermes profile oneshots — merges bags, then injects gateway token if resolved. */
export function buildHermesProfileSpawnEnv(env: EnvBag = process.env): NodeJS.ProcessEnv {
  const spawnEnv: NodeJS.ProcessEnv = Object.assign({}, process.env, env, {
    HERMES_HOME: env.HERMES_HOME ?? DEFAULT_HERMES_HOME,
  });
  const token = resolveInferenceGatewayTokenForHermesChild(env);
  if (token) {
    spawnEnv[HERMES_GATEWAY_TOKEN_ENV] = token;
  }
  return spawnEnv;
}
