/**
 * Canonical repository path guard (repo hygiene).
 * Detects forbidden filesystem paths pointing at theallcloud stub — not legacy identifiers.
 * Also rejects the wrong internal systemd unit identity (legacy id + "-internal").
 */

export const CANONICAL_APP_REPO = "/home/ysh/thealltour" as const;

/** Production / internal Next.js systemd unit (Pi). Not derived from legacy theallcloud ids. */
export const CANONICAL_INTERNAL_SYSTEMD_UNIT = "thealltour-internal.service" as const;

/** Line/file marker: intentional documented forbidden-path examples (rules, historical ops notes). */
export const CANONICAL_PATH_DOCUMENTED_FORBIDDEN_MARKER =
  "canonical-path-documented-forbidden" as const;

export type CanonicalPathViolation = {
  file: string;
  line: number;
  match: string;
  expected?: string;
};

/** Built without embedding a contiguous forbidden path / service literal in this source file. */
const FORBIDDEN_LEAF = ["theall", "cloud"].join("");
const FORBIDDEN_INTERNAL_SERVICE = [FORBIDDEN_LEAF, "-internal"].join("");
const BAD_PATH_PATTERNS: RegExp[] = [
  new RegExp(`/home/ysh/${FORBIDDEN_LEAF}\\b`, "g"),
  new RegExp(`~/${FORBIDDEN_LEAF}\\b`, "g"),
];
const BAD_INTERNAL_SERVICE_PATTERN = new RegExp(
  `\\b${FORBIDDEN_INTERNAL_SERVICE}(?:\\.service)?\\b`,
  "g",
);

/**
 * Scan a single text blob for forbidden theallcloud filesystem paths
 * and the wrong internal systemd service name.
 * Skips any line that contains CANONICAL_PATH_DOCUMENTED_FORBIDDEN_MARKER.
 * Does not flag legacy logical identifiers (ORCHESTRATION_PROJECT_ID, MCP ids, gateway aliases).
 */
export function findCanonicalPathViolationsInText(
  content: string,
  filePath = "<memory>",
): CanonicalPathViolation[] {
  const violations: CanonicalPathViolation[] = [];
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.includes(CANONICAL_PATH_DOCUMENTED_FORBIDDEN_MARKER)) {
      continue;
    }

    for (const pattern of BAD_PATH_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line)) !== null) {
        violations.push({
          file: filePath,
          line: index + 1,
          match: match[0]!,
          expected: CANONICAL_APP_REPO,
        });
      }
    }

    BAD_INTERNAL_SERVICE_PATTERN.lastIndex = 0;
    let serviceMatch: RegExpExecArray | null;
    while ((serviceMatch = BAD_INTERNAL_SERVICE_PATTERN.exec(line)) !== null) {
      violations.push({
        file: filePath,
        line: index + 1,
        match: serviceMatch[0]!,
        expected: CANONICAL_INTERNAL_SYSTEMD_UNIT,
      });
    }
  }

  return violations;
}

export const CANONICAL_PATH_SCAN_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdc",
  ".mdx",
  ".yml",
  ".yaml",
  ".sh",
  ".bash",
  ".service",
  ".timer",
  ".env",
  ".example",
  ".toml",
  ".Dockerfile",
  ".dockerfile",
  ".txt",
  ".css",
  ".scss",
  ".html",
  ".svg",
]);

export const CANONICAL_PATH_SKIP_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "build",
  ".cache",
  "playwright-report",
  "test-results",
  ".vercel",
]);

export function shouldScanCanonicalPathFile(relativePath: string, fileName: string): boolean {
  const base = fileName.toLowerCase();
  if (base === "dockerfile" || base.startsWith("dockerfile.")) return true;
  if (base === ".env" || base.startsWith(".env.")) return true;
  if (base.endsWith(".service") || base.endsWith(".timer")) return true;

  const dot = base.lastIndexOf(".");
  if (dot < 0) return false;
  const ext = base.slice(dot);
  if (CANONICAL_PATH_SCAN_EXTENSIONS.has(ext)) return true;
  // package.json scripts etc. already covered by .json
  if (base === "makefile") return true;
  return false;
}
