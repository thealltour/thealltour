#!/usr/bin/env node
/**
 * Fail if forbidden theallcloud filesystem/repository paths appear in source/docs/config.
 *
 *   npm run check:canonical-paths
 *
 * Does NOT flag legacy logical identifiers (ORCHESTRATION_PROJECT_ID=theallcloud, etc.).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  CANONICAL_APP_REPO,
  findCanonicalPathViolationsInText,
  shouldScanCanonicalPathFile,
  CANONICAL_PATH_SKIP_DIR_NAMES,
  type CanonicalPathViolation,
} from "../src/lib/repoHygiene/canonicalPathGuard";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

function walk(dir: string, root: string, out: string[]): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const name = entry.name;
    if (CANONICAL_PATH_SKIP_DIR_NAMES.has(name)) continue;
    const absolute = join(dir, name);
    if (entry.isDirectory()) {
      walk(absolute, root, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!shouldScanCanonicalPathFile(relative(root, absolute), name)) continue;
    out.push(absolute);
  }
}

function main(): void {
  const root = resolve(process.cwd());
  const files: string[] = [];
  walk(root, root, files);

  const violations: CanonicalPathViolation[] = [];
  for (const absolute of files) {
    let st;
    try {
      st = statSync(absolute);
    } catch {
      continue;
    }
    if (!st.isFile() || st.size <= 0 || st.size > MAX_FILE_BYTES) continue;

    let content: string;
    try {
      content = readFileSync(absolute, "utf8");
    } catch {
      continue;
    }
    // Skip obvious binary
    if (content.includes("\u0000")) continue;

    const rel = relative(root, absolute).split("\\").join("/");
    violations.push(...findCanonicalPathViolationsInText(content, rel));
  }

  if (violations.length > 0) {
    for (const v of violations) {
      console.error("CANONICAL_PATH_VIOLATION");
      console.error(`file: ${v.file}`);
      console.error(`line: ${v.line}`);
      console.error(`match: ${v.match}`);
      console.error(`expected: ${CANONICAL_APP_REPO}`);
      console.error("");
    }
    console.error(`CANONICAL_PATH_VIOLATIONS: ${violations.length}`);
    process.exit(1);
  }

  console.log("CANONICAL_PATH_CHECK_OK");
}

main();
