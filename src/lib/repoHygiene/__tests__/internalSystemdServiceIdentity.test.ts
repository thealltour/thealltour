import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CANONICAL_APP_REPO,
  CANONICAL_INTERNAL_SYSTEMD_UNIT,
  findCanonicalPathViolationsInText,
} from "@/lib/repoHygiene/canonicalPathGuard";

/** Split so the repo-wide scanner does not treat this file as a violation. */
const FORBIDDEN_INTERNAL_UNIT = ["theall", "cloud", "-internal.service"].join("");

const REPO_REFERENCES = [
  "docs/hermes/marketing/internal-runtime.md",
  "docs/hermes/marketing/runtime-inference-gateway.md",
  "docs/hermes/marketing/agenda-production-queue-worker.md",
  "deploy/systemd/thealltour-marketing-production-queue.service",
] as const;

describe("internal systemd service identity", () => {
  it("does not ship a unit file with the legacy internal service name", () => {
    expect(existsSync(join(process.cwd(), "deploy/systemd", FORBIDDEN_INTERNAL_UNIT))).toBe(
      false,
    );
    const units = readdirSync(join(process.cwd(), "deploy/systemd"));
    expect(units).not.toContain(FORBIDDEN_INTERNAL_UNIT);
    expect(units.every((name) => !name.includes(FORBIDDEN_INTERNAL_UNIT))).toBe(true);
  });

  it("keeps documented and deploy references on thealltour-internal.service", () => {
    for (const relative of REPO_REFERENCES) {
      const text = readFileSync(join(process.cwd(), relative), "utf8");
      expect(text).toContain(CANONICAL_INTERNAL_SYSTEMD_UNIT);
      expect(findCanonicalPathViolationsInText(text, relative)).toHaveLength(0);
    }
  });

  it("documents WorkingDirectory and ExecStart under the canonical repo", () => {
    const text = readFileSync(
      join(process.cwd(), "docs/hermes/marketing/internal-runtime.md"),
      "utf8",
    );
    expect(text).toMatch(new RegExp(`WorkingDirectory=${CANONICAL_APP_REPO}\\b`));
    expect(text).toContain(`${CANONICAL_APP_REPO}/node_modules/next/dist/bin/next start`);
    expect(text.includes(`WorkingDirectory=${["/home/ysh/", "theallcloud"].join("")}`)).toBe(
      false,
    );
  });
});
