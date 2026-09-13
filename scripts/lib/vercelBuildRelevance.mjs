/**
 * Pure Vercel build-relevance classification (no Node deps beyond builtins).
 *
 * Used by scripts/vercel-should-build.mjs (Ignored Build Step).
 *
 * Exit-code convention is handled by the CLI wrapper:
 *   Vercel ignoreCommand: exit 0 = SKIP deploy, exit 1 = BUILD
 */

/** @typedef {'WEB_RELEVANT' | 'WEB_IRRELEVANT' | 'UNKNOWN'} PathClass */

/** Exact root files that always trigger a build. */
export const WEB_RELEVANT_ROOT_FILES = new Set([
  "package.json",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "next.config.cjs",
  "middleware.js",
  "middleware.ts",
  "middleware.mjs",
  "tsconfig.json",
  "jsconfig.json",
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  "postcss.config.js",
  "postcss.config.mjs",
  "postcss.config.cjs",
  "tailwind.config.js",
  "tailwind.config.ts",
  "tailwind.config.mjs",
  "vercel.json",
  "vercel.ts",
  ".npmrc",
  ".nvmrc",
  "next-env.d.ts",
  "instrumentation.ts",
  "instrumentation.js",
  "vitest.config.ts",
  "vitest.config.mjs",
  "vitest.setup.ts",
]);

/** Prefixes that always trigger a build (positive relevance). */
export const WEB_RELEVANT_PREFIXES = [
  "src/",
  "public/",
  // Guard script changes must deploy (stricter/looser rules affect future skips).
  "scripts/vercel-should-build.mjs",
  "scripts/lib/vercelBuildRelevance.mjs",
];

/**
 * Prefixes that may SKIP only when EVERY changed path matches one of these
 * (and none are web-relevant / unknown).
 *
 * Re-audited for VB-1A:
 * - docs/, deploy/, tools/: not imported by Next build; tools package separately.
 * - scripts/: local/ops helpers; NOT invoked by Vercel install/build commands
 *   EXCEPT the ignore guard scripts listed as web-relevant above.
 * - supabase/: SQL/config only; app uses runtime client, no generated types from here.
 * - .github/, .cursor/, .agents/: CI/editor only.
 */
export const WEB_IRRELEVANT_PREFIXES = [
  "docs/",
  "deploy/",
  "tools/",
  "scripts/",
  "supabase/",
  ".github/",
  ".cursor/",
  ".agents/",
];

/** Exact root files that are verified non-web (ops/editor only). */
export const WEB_IRRELEVANT_ROOT_FILES = new Set([
  "EMPTY",
  "README.md",
  "skills-lock.json",
  ".gitignore",
]);

/**
 * Normalize git path (strip quotes, unify slashes, drop leading ./).
 * @param {string} raw
 * @returns {string}
 */
export function normalizeRepoPath(raw) {
  let p = String(raw ?? "").trim();
  if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
    p = p.slice(1, -1);
  }
  p = p.replace(/\\/g, "/");
  while (p.startsWith("./")) p = p.slice(2);
  if (p.startsWith("/")) p = p.slice(1);
  return p;
}

/**
 * @param {string} relativePath
 * @returns {PathClass}
 */
export function classifyPath(relativePath) {
  const p = normalizeRepoPath(relativePath);
  if (!p || p === ".") return "UNKNOWN";

  // Positive relevance first.
  if (WEB_RELEVANT_ROOT_FILES.has(p)) return "WEB_RELEVANT";
  for (const prefix of WEB_RELEVANT_PREFIXES) {
    if (prefix.endsWith(".mjs") || prefix.endsWith(".ts") || prefix.endsWith(".js")) {
      if (p === prefix) return "WEB_RELEVANT";
    } else if (p === prefix.slice(0, -1) || p.startsWith(prefix)) {
      return "WEB_RELEVANT";
    }
  }

  if (WEB_IRRELEVANT_ROOT_FILES.has(p)) return "WEB_IRRELEVANT";
  for (const prefix of WEB_IRRELEVANT_PREFIXES) {
    if (p === prefix.slice(0, -1) || p.startsWith(prefix)) {
      // Guard scripts under scripts/ are web-relevant (handled above).
      return "WEB_IRRELEVANT";
    }
  }

  return "UNKNOWN";
}

/**
 * @typedef {{ path: string, status?: string, fromPath?: string | null }} ChangedPath
 */

/**
 * Parse `git diff --name-status -z` or line-oriented name-status output into entries.
 * Handles renames (R*) and copies (C*) with two paths.
 *
 * @param {string} nameStatusText
 * @returns {ChangedPath[]}
 */
export function parseNameStatus(nameStatusText) {
  const text = String(nameStatusText ?? "");
  /** @type {ChangedPath[]} */
  const out = [];

  if (text.includes("\0")) {
    const parts = text.split("\0").filter((p) => p.length > 0);
    let i = 0;
    while (i < parts.length) {
      const status = parts[i++] ?? "";
      const code = status.charAt(0);
      if ((code === "R" || code === "C") && i + 1 < parts.length) {
        const fromPath = parts[i++];
        const toPath = parts[i++];
        out.push({ status, path: toPath, fromPath });
      } else if (i < parts.length) {
        const path = parts[i++];
        out.push({ status, path, fromPath: null });
      }
    }
    return out;
  }

  for (const line of text.split("\n")) {
    const trimmed = line.trimEnd();
    if (!trimmed) continue;
    const tab = trimmed.indexOf("\t");
    if (tab < 0) {
      out.push({ path: trimmed, status: "M", fromPath: null });
      continue;
    }
    const status = trimmed.slice(0, tab);
    const rest = trimmed.slice(tab + 1);
    const code = status.charAt(0);
    if (code === "R" || code === "C") {
      const parts = rest.split("\t");
      if (parts.length >= 2) {
        out.push({ status, path: parts[1], fromPath: parts[0] });
        continue;
      }
    }
    out.push({ status, path: rest, fromPath: null });
  }
  return out;
}

/**
 * Collect all paths that must be classified for a change (including rename sources).
 * @param {ChangedPath[]} changes
 * @returns {string[]}
 */
export function expandPathsForClassification(changes) {
  /** @type {string[]} */
  const paths = [];
  for (const change of changes) {
    if (change.fromPath) paths.push(normalizeRepoPath(change.fromPath));
    if (change.path) paths.push(normalizeRepoPath(change.path));
  }
  return [...new Set(paths.filter(Boolean))];
}

/**
 * @param {string[]} paths
 * @returns {{
 *   decision: 'BUILD' | 'SKIP',
 *   reason: string,
 *   classes: Record<string, PathClass>,
 *   matchedRelevant: string[],
 *   matchedIrrelevant: string[],
 *   matchedUnknown: string[],
 * }}
 */
export function decideFromPaths(paths) {
  /** @type {Record<string, PathClass>} */
  const classes = {};
  /** @type {string[]} */
  const matchedRelevant = [];
  /** @type {string[]} */
  const matchedIrrelevant = [];
  /** @type {string[]} */
  const matchedUnknown = [];

  const normalized = [...new Set(paths.map(normalizeRepoPath).filter(Boolean))];

  if (normalized.length === 0) {
    return {
      decision: "BUILD",
      reason: "empty_path_list",
      classes,
      matchedRelevant,
      matchedIrrelevant,
      matchedUnknown,
    };
  }

  for (const p of normalized) {
    const c = classifyPath(p);
    classes[p] = c;
    if (c === "WEB_RELEVANT") matchedRelevant.push(p);
    else if (c === "WEB_IRRELEVANT") matchedIrrelevant.push(p);
    else matchedUnknown.push(p);
  }

  if (matchedRelevant.length > 0) {
    return {
      decision: "BUILD",
      reason: "web_relevant_change",
      classes,
      matchedRelevant,
      matchedIrrelevant,
      matchedUnknown,
    };
  }

  if (matchedUnknown.length > 0) {
    return {
      decision: "BUILD",
      reason: "unknown_path_defaults_to_build",
      classes,
      matchedRelevant,
      matchedIrrelevant,
      matchedUnknown,
    };
  }

  return {
    decision: "SKIP",
    reason: "only_web_irrelevant_changes",
    classes,
    matchedRelevant,
    matchedIrrelevant,
    matchedUnknown,
  };
}

/**
 * @param {ChangedPath[]} changes
 */
export function decideFromChanges(changes) {
  return decideFromPaths(expandPathsForClassification(changes));
}
