/**
 * Canonical repository path guard (repo hygiene).
 * Detects forbidden filesystem paths pointing at theallcloud stub — not legacy identifiers.
 */

export const CANONICAL_APP_REPO = "/home/ysh/thealltour" as const;

/** Line/file marker: intentional documented forbidden-path examples (rules, historical ops notes). */
export const CANONICAL_PATH_DOCUMENTED_FORBIDDEN_MARKER =
  "canonical-path-documented-forbidden" as const;

export type CanonicalPathViolation = {
  file: string;
  line: number;
  match: string;
};

/** Built without embedding a contiguous forbidden path literal in this source file. */
const FORBIDDEN_LEAF = ["theall", "cloud"].join("");
const BAD_PATH_PATTERNS: RegExp[] = [
  new RegExp(`/home/ysh/${FORBIDDEN_LEAF}\\b`, "g"),
  new RegExp(`~/${FORBIDDEN_LEAF}\\b`, "g"),
];

/**
 * Scan a single text blob for forbidden theallcloud filesystem paths.
 * Skips any line that contains CANONICAL_PATH_DOCUMENTED_FORBIDDEN_MARKER.
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
        });
      }
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
