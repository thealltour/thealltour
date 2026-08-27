/**
 * Cron/tsx entry: load project + Hermes env without Next "server-only" boundary.
 * Mirrors src/lib/server/loadRuntimeEnv.ts (keep behavior in sync).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, "..");

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

/** Next.js loads these automatically; `npx tsx` does not. */
export function loadLocalEnv(): void {
  applyEnvFile(join(ROOT, ".env"));
  applyEnvFile(join(ROOT, ".env.local"));
  const hermesHome = process.env.HERMES_HOME?.trim() || join(homedir(), ".hermes");
  applyEnvFile(join(hermesHome, ".env"));
}
