/**
 * Detect direct Hermes binary invocations outside the unified launcher allowlist.
 * Test/CI only — not on the hot path.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { MARKETING_HERMES_DIRECT_SPAWN_ALLOWLIST } from "@/lib/marketing/hermesRuntime/directSpawnDebt";

export type DirectHermesSpawnViolation = {
  file: string;
  line: number;
  match: string;
};

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "coverage",
  "data",
  "artifacts",
  ".wip-build-quarantine",
  "__fixtures__",
]);

const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

/** Patterns that indicate a Hermes CLI spawn (marketing oneshot or chat). */
const HERMES_SPAWN_LINE_RE =
  /\b(?:spawnSync|spawn|execFile|exec)\s*\(\s*(?:hermesBin|["'`]hermes["'`]|resolveHermesExecutable\s*\()/;

/**
 * Lines that construct `-p` oneshot argv without going through the launcher
 * (heuristic for duplicated script helpers).
 */
const HERMES_P_ARGV_RE = /\[\s*["']-p["']\s*,/;

function shouldScanFile(relPath: string, name: string): boolean {
  const ext = name.includes(".") ? `.${name.split(".").pop()}` : "";
  if (!SCAN_EXTENSIONS.has(ext)) return false;
  if (relPath.includes("/__tests__/") || relPath.includes(".test.")) return false;
  if (relPath.includes("/__fixtures__/")) return false;
  return true;
}

function walk(dir: string, root: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue;
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, root, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const rel = relative(root, absolute).replace(/\\/g, "/");
    if (!shouldScanFile(rel, entry.name)) continue;
    out.push(absolute);
  }
}

function isAllowlisted(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, "/");
  return MARKETING_HERMES_DIRECT_SPAWN_ALLOWLIST.some((allowed) => {
    const a = allowed.replace(/\\/g, "/");
    return normalized === a || normalized.endsWith("/" + a);
  });
}

/**
 * Scan marketing production sources + scripts for direct Hermes spawns.
 * Allowlisted paths (launcher, sync adapter, known desktop e2e) are skipped.
 */
export function findDirectHermesSpawnViolations(
  repoRoot: string = process.cwd(),
): DirectHermesSpawnViolation[] {
  const root = resolve(repoRoot);
  const files: string[] = [];
  walk(join(root, "src/lib/marketing"), root, files);
  walk(join(root, "scripts"), root, files);

  const violations: DirectHermesSpawnViolation[] = [];

  for (const absolute of files) {
    const rel = relative(root, absolute).replace(/\\/g, "/");
    if (isAllowlisted(rel)) continue;

    let st;
    try {
      st = statSync(absolute);
    } catch {
      continue;
    }
    if (!st.isFile() || st.size <= 0 || st.size > 2_000_000) continue;
    if (!existsSync(absolute)) continue;

    const content = readFileSync(absolute, "utf8");
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      if (line.includes("marketing-hermes-direct-spawn-allowlisted")) continue;
      const spawnHit = HERMES_SPAWN_LINE_RE.test(line);
      const argvHit = HERMES_P_ARGV_RE.test(line) && /hermes|Hermes|HERMES/.test(content);
      if (spawnHit || (argvHit && /spawnSync|spawn\s*\(/.test(content))) {
        // Only flag argv copies when the file also spawns (avoid false positives on docs)
        if (spawnHit || (argvHit && /spawnSync\s*\(|\bspawn\s*\(/.test(line))) {
          violations.push({
            file: rel,
            line: i + 1,
            match: line.trim().slice(0, 160),
          });
        }
      }
    }
  }

  return violations;
}

export function assertNoUnregisteredDirectHermesSpawns(repoRoot?: string): void {
  const violations = findDirectHermesSpawnViolations(repoRoot);
  if (violations.length === 0) return;
  throw new Error(
    `Unregistered direct Hermes spawn(s) — add to MARKETING_HERMES_DIRECT_SPAWN_ALLOWLIST only if intentional debt:\n${violations
      .map((v) => `- ${v.file}:${v.line}: ${v.match}`)
      .join("\n")}`,
  );
}
