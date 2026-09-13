/**
 * Focused tests for Vercel build-relevance guard (VB-1A).
 * Pure classification — no Vercel deploy.
 */
import { describe, expect, it } from "vitest";

import {
  classifyPath,
  decideFromChanges,
  decideFromPaths,
  parseNameStatus,
} from "../../scripts/lib/vercelBuildRelevance.mjs";

describe("vercelBuildRelevance classifyPath", () => {
  it("marks src/public/package/vercel configs relevant", () => {
    expect(classifyPath("src/app/page.tsx")).toBe("WEB_RELEVANT");
    expect(classifyPath("src/lib/marketing/foo.ts")).toBe("WEB_RELEVANT");
    expect(classifyPath("src/ai-runtime/foo.ts")).toBe("WEB_RELEVANT");
    expect(classifyPath("public/extension-builds/foo.zip")).toBe("WEB_RELEVANT");
    expect(classifyPath("package-lock.json")).toBe("WEB_RELEVANT");
    expect(classifyPath("vercel.json")).toBe("WEB_RELEVANT");
    expect(classifyPath("scripts/vercel-should-build.mjs")).toBe("WEB_RELEVANT");
  });

  it("marks verified ops paths irrelevant", () => {
    expect(classifyPath("docs/readme.md")).toBe("WEB_IRRELEVANT");
    expect(classifyPath("deploy/systemd/foo.service")).toBe("WEB_IRRELEVANT");
    expect(classifyPath("tools/modetour-extractor-extension/foo.ts")).toBe("WEB_IRRELEVANT");
    expect(classifyPath(".github/workflows/foo.yml")).toBe("WEB_IRRELEVANT");
    expect(classifyPath("scripts/cron-daily-marketing-plan.ts")).toBe("WEB_IRRELEVANT");
    expect(classifyPath("supabase/guides.sql")).toBe("WEB_IRRELEVANT");
  });

  it("defaults unknown root files to UNKNOWN", () => {
    expect(classifyPath("new.config.js")).toBe("UNKNOWN");
    expect(classifyPath("schema.ts")).toBe("UNKNOWN");
  });
});

describe("vercelBuildRelevance decisions", () => {
  it("docs only → SKIP", () => {
    expect(decideFromPaths(["docs/readme.md"]).decision).toBe("SKIP");
  });

  it("deploy only → SKIP", () => {
    expect(decideFromPaths(["deploy/systemd/foo.service"]).decision).toBe("SKIP");
  });

  it("tools only → SKIP", () => {
    expect(decideFromPaths(["tools/modetour-extractor-extension/foo.ts"]).decision).toBe("SKIP");
  });

  it("github only → SKIP", () => {
    expect(decideFromPaths([".github/workflows/foo.yml"]).decision).toBe("SKIP");
  });

  it("src app → BUILD", () => {
    expect(decideFromPaths(["src/app/page.tsx"]).decision).toBe("BUILD");
  });

  it("marketing src → BUILD", () => {
    expect(decideFromPaths(["src/lib/marketing/foo.ts"]).decision).toBe("BUILD");
  });

  it("ai-runtime → BUILD", () => {
    expect(decideFromPaths(["src/ai-runtime/foo.ts"]).decision).toBe("BUILD");
  });

  it("public extension build → BUILD", () => {
    expect(decideFromPaths(["public/extension-builds/foo.zip"]).decision).toBe("BUILD");
  });

  it("package-lock → BUILD", () => {
    expect(decideFromPaths(["package-lock.json"]).decision).toBe("BUILD");
  });

  it("vercel.json → BUILD", () => {
    expect(decideFromPaths(["vercel.json"]).decision).toBe("BUILD");
  });

  it("unknown root → BUILD", () => {
    const d = decideFromPaths(["new.config.js"]);
    expect(d.decision).toBe("BUILD");
    expect(d.reason).toBe("unknown_path_defaults_to_build");
  });

  it("mixed docs + src → BUILD", () => {
    expect(decideFromPaths(["docs/foo.md", "src/app/page.tsx"]).decision).toBe("BUILD");
  });

  it("rename out of src → BUILD (source path counts)", () => {
    const d = decideFromChanges([
      { status: "R100", fromPath: "src/foo.ts", path: "docs/foo.ts" },
    ]);
    expect(d.decision).toBe("BUILD");
    expect(d.matchedRelevant).toContain("src/foo.ts");
  });

  it("delete from src → BUILD", () => {
    const d = decideFromChanges([{ status: "D", path: "src/foo.ts" }]);
    expect(d.decision).toBe("BUILD");
  });

  it("empty path list → BUILD", () => {
    expect(decideFromPaths([]).decision).toBe("BUILD");
  });
});

describe("parseNameStatus", () => {
  it("parses rename lines", () => {
    const changes = parseNameStatus("R100\tsrc/foo.ts\tdocs/foo.ts\n");
    expect(changes).toEqual([
      { status: "R100", path: "docs/foo.ts", fromPath: "src/foo.ts" },
    ]);
  });

  it("parses nul-separated rename", () => {
    const changes = parseNameStatus("R100\0src/a.ts\0docs/a.ts\0M\0docs/b.md\0");
    expect(changes).toHaveLength(2);
    expect(changes[0]).toEqual({ status: "R100", path: "docs/a.ts", fromPath: "src/a.ts" });
    expect(changes[1]).toEqual({ status: "M", path: "docs/b.md", fromPath: null });
  });
});
