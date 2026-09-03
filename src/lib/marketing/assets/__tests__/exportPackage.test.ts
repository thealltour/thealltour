import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import { createInMemoryDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import {
  exportMarketingCandidatePackage,
  parseExportMarketingCandidateAssetsArgs,
  parseMarketingAssetManifest,
  runExportMarketingCandidateAssetsCommand,
  sha256Buffer,
} from "@/lib/marketing/assets";
import { MarketingAssetConflictError } from "@/lib/marketing/assets/errors";
import { buildDraft, buildTestCandidate, CANDIDATE_ID, NOW } from "@/lib/marketing/assets/__tests__/fixtures";

const tempDirs: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "marketing-export-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("candidate package export", () => {
  it("22-24. writes post.txt, media brief, and a coherent manifest last", () => {
    const root = tempRoot();
    const result = exportMarketingCandidatePackage({
      candidate: buildTestCandidate(),
      assetRoot: root,
      now: NOW,
    });
    expect(result.plannedRelativePaths.at(-1)).toBe("manifest.json");
    expect(existsSync(join(result.packageRoot, "copy/post.txt"))).toBe(true);
    expect(readFileSync(join(result.packageRoot, "copy/post.txt"), "utf8")).toContain(
      "Official guidance says autumn travel planning is easier.",
    );
    const briefOnDisk = JSON.parse(readFileSync(join(result.packageRoot, "context/media-brief.json"), "utf8"));
    expect(briefOnDisk.contract).toBe("media-brief-v1");
    const manifest = parseMarketingAssetManifest(
      JSON.parse(readFileSync(join(result.packageRoot, "manifest.json"), "utf8")),
    );
    expect(manifest.artifacts.every((artifact) => !artifact.relativePath.startsWith("/"))).toBe(true);
    expect(manifest.artifacts.every((artifact) => !artifact.relativePath.includes(".."))).toBe(true);
    for (const artifact of manifest.artifacts) {
      const bytes = readFileSync(join(result.packageRoot, artifact.relativePath));
      expect(artifact.byteSize).toBe(bytes.byteLength);
      expect(artifact.sha256).toBe(sha256Buffer(bytes));
    }
    expect(manifest.integrity.artifactCount).toBe(manifest.artifacts.length);
    expect(existsSync(join(result.packageRoot, "manifest.json"))).toBe(true);
  });

  it("25. dry-run performs zero filesystem writes", () => {
    const root = join(tempRoot(), "does-not-exist-yet");
    const result = exportMarketingCandidatePackage({
      candidate: buildTestCandidate(),
      assetRoot: root,
      dryRun: true,
      now: NOW,
    });
    expect(result.dryRun).toBe(true);
    expect(result.wrote).toBe(false);
    expect(existsSync(root)).toBe(false);
    expect(result.plannedRelativePaths).toContain("copy/post.txt");
    expect(result.plannedRelativePaths).toContain("context/media-brief.json");
    expect(result.plannedRelativePaths.at(-1)).toBe("manifest.json");
  });

  it("26. export performs zero DB mutation", async () => {
    const root = tempRoot();
    const repository = createInMemoryDailyMarketingRunRepository();
    const candidate = buildTestCandidate();
    await repository.saveCandidate(candidate);
    const original = {
      saveRun: repository.saveRun.bind(repository),
      saveCandidate: repository.saveCandidate.bind(repository),
    };
    let mutations = 0;
    repository.saveRun = async (run) => {
      mutations += 1;
      return original.saveRun(run);
    };
    repository.saveCandidate = async (value) => {
      mutations += 1;
      return original.saveCandidate(value);
    };

    await runExportMarketingCandidateAssetsCommand({
      options: { candidateId: candidate.candidateId, root, dryRun: false },
      repository,
    });
    expect(mutations).toBe(0);
  });

  it("27. does not expose secret-like fields", () => {
    const root = tempRoot();
    const result = exportMarketingCandidatePackage({
      candidate: buildTestCandidate(),
      assetRoot: root,
      now: NOW,
    });
    const context = JSON.parse(readFileSync(join(result.packageRoot, "context/export-context.json"), "utf8"));
    const manifest = JSON.parse(readFileSync(join(result.packageRoot, "manifest.json"), "utf8"));
    expect(jsonContainsForbiddenBotLeak(context)).toBe(false);
    expect(jsonContainsForbiddenBotLeak(manifest)).toBe(false);
    expect(jsonContainsForbiddenBotLeak(result.manifest)).toBe(false);
    const serialized = `${JSON.stringify(context)}\n${JSON.stringify(manifest)}`;
    expect(serialized).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|api[_-]?key|authorization|embedding/i);
    expect(context).not.toHaveProperty("observability");
    expect(context).not.toHaveProperty("correlationId");
  });

  it("28. repeated candidate export creates no duplicate package", () => {
    const root = tempRoot();
    const candidate = buildTestCandidate();
    const first = exportMarketingCandidatePackage({ candidate, assetRoot: root, now: NOW });
    const second = exportMarketingCandidatePackage({ candidate, assetRoot: root, now: NOW });
    expect(second.packageRoot).toBe(first.packageRoot);
    expect(second.reused).toBe(true);
    expect(second.wrote).toBe(false);
    const dateDir = join(root, "2026", "09", "03");
    expect(readdirSync(dateDir)).toEqual([CANDIDATE_ID]);
  });

  it("rejects conflicting generated content instead of overwriting", () => {
    const root = tempRoot();
    const candidate = buildTestCandidate();
    const first = exportMarketingCandidatePackage({ candidate, assetRoot: root, now: NOW });
    writeFileSync(join(first.packageRoot, "copy/post.txt"), "tampered human-looking overwrite\n");
    expect(() => exportMarketingCandidatePackage({ candidate, assetRoot: root, now: NOW })).toThrow(
      MarketingAssetConflictError,
    );
    expect(readFileSync(join(first.packageRoot, "copy/post.txt"), "utf8")).toBe(
      "tampered human-looking overwrite\n",
    );
  });

  it("parses CLI args including dry-run and explicit root", () => {
    expect(
      parseExportMarketingCandidateAssetsArgs([
        "--candidateId",
        "cmc_one",
        "--root",
        "/tmp/assets",
        "--dry-run",
      ]),
    ).toEqual({
      candidateId: "cmc_one",
      root: "/tmp/assets",
      dryRun: true,
    });
    expect(parseExportMarketingCandidateAssetsArgs(["--candidateId=cmc_two"])).toEqual({
      candidateId: "cmc_two",
      root: undefined,
      dryRun: false,
    });
  });

  it("keeps human-edited files untouched during generated reuse", () => {
    const root = tempRoot();
    const first = exportMarketingCandidatePackage({
      candidate: buildTestCandidate(),
      assetRoot: root,
      now: NOW,
    });
    mkdirSync(join(first.packageRoot, "human-edited"), { recursive: true });
    writeFileSync(join(first.packageRoot, "human-edited", "caption.txt"), "editor note");
    exportMarketingCandidatePackage({
      candidate: buildTestCandidate(),
      assetRoot: root,
      now: NOW,
    });
    expect(readFileSync(join(first.packageRoot, "human-edited/caption.txt"), "utf8")).toBe("editor note");
  });

  it("skips copy/post.txt when draft text is absent", () => {
    const root = tempRoot();
    const result = exportMarketingCandidatePackage({
      candidate: buildTestCandidate({
        draft: buildDraft({ title: null, body: "   " }),
      }),
      assetRoot: root,
      now: NOW,
    });
    expect(result.plannedRelativePaths).not.toContain("copy/post.txt");
    expect(existsSync(join(result.packageRoot, "copy/post.txt"))).toBe(false);
    expect(existsSync(join(result.packageRoot, "context/media-brief.json"))).toBe(true);
  });
});
