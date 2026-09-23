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
import {
  buildDraft,
  buildTestCandidate,
  buildTestLlmPublishableBundle,
  CANDIDATE_ID,
  NOW,
} from "@/lib/marketing/assets/__tests__/fixtures";

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


const publishableBundleByCandidateId = new Map<
  string,
  ReturnType<typeof buildTestLlmPublishableBundle>
>();

function exportWithPublishable(
  args: Omit<Parameters<typeof exportMarketingCandidatePackage>[0], "publishableBundle"> & {
    publishableBundle?: Parameters<typeof exportMarketingCandidatePackage>[0]["publishableBundle"];
  },
) {
  const candidate = args.candidate;
  let publishableBundle = args.publishableBundle;
  if (!publishableBundle) {
    const cached = publishableBundleByCandidateId.get(candidate.candidateId);
    if (cached) {
      publishableBundle = cached;
    } else {
      publishableBundle = buildTestLlmPublishableBundle(candidate, args.now ?? NOW);
      publishableBundleByCandidateId.set(candidate.candidateId, publishableBundle);
    }
  }
  return exportMarketingCandidatePackage({ ...args, publishableBundle });
}

describe("candidate package export", () => {
  it("22-24. writes post.txt, media brief, and a coherent manifest last", () => {
    const root = tempRoot();
    const result = exportWithPublishable({
      candidate: buildTestCandidate(),
      assetRoot: root,
      now: NOW,
    });
    expect(result.plannedRelativePaths.at(-1)).toBe("manifest.json");
    expect(existsSync(join(result.packageRoot, "copy/post.txt"))).toBe(true);
    expect(existsSync(join(result.packageRoot, "context/publishable-content.json"))).toBe(true);
    const post = readFileSync(join(result.packageRoot, "copy/post.txt"), "utf8");
    expect(post).not.toMatch(/Key verified facts/i);
    expect(post).not.toMatch(/Context\n/);
    // Publishable Threads body should include usable fact substance (not raw outline draft).
    expect(post.toLowerCase()).toMatch(/autumn|travel|japan/);
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
    const result = exportWithPublishable({
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
    const result = exportWithPublishable({
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
    const first = exportWithPublishable({ candidate, assetRoot: root, now: NOW });
    const second = exportWithPublishable({ candidate, assetRoot: root, now: NOW });
    expect(second.packageRoot).toBe(first.packageRoot);
    expect(second.reused).toBe(true);
    expect(second.wrote).toBe(false);
    const dateDir = join(root, "2026", "09", "03");
    expect(readdirSync(dateDir)).toEqual([CANDIDATE_ID]);
  });

  it("rejects conflicting generated content instead of overwriting", () => {
    const root = tempRoot();
    const candidate = buildTestCandidate();
    const first = exportWithPublishable({ candidate, assetRoot: root, now: NOW });
    writeFileSync(join(first.packageRoot, "copy/post.txt"), "tampered human-looking overwrite\n");
    expect(() => exportWithPublishable({ candidate, assetRoot: root, now: NOW })).toThrow(
      MarketingAssetConflictError,
    );
    expect(readFileSync(join(first.packageRoot, "copy/post.txt"), "utf8")).toBe(
      "tampered human-looking overwrite\n",
    );
  });

  it("overwriteArtifacts refreshes context/copy and preserves shared visuals", () => {
    const root = tempRoot();
    const candidate = buildTestCandidate();
    const first = exportWithPublishable({ candidate, assetRoot: root, now: NOW });
    const sharedDir = join(first.packageRoot, "media/shared-visuals");
    mkdirSync(sharedDir, { recursive: true });
    writeFileSync(join(sharedDir, "social_visual_01.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    writeFileSync(
      join(first.packageRoot, "context/shared-visual-assets.json"),
      JSON.stringify({ keep: true }),
    );
    writeFileSync(join(first.packageRoot, "copy/post.txt"), "tampered human-looking overwrite\n");

    const second = exportWithPublishable({
      candidate,
      assetRoot: root,
      now: NOW,
      overwriteArtifacts: true,
    });
    expect(second.wrote || second.reused).toBe(true);
    expect(readFileSync(join(first.packageRoot, "copy/post.txt"), "utf8")).not.toBe(
      "tampered human-looking overwrite\n",
    );
    expect(existsSync(join(sharedDir, "social_visual_01.png"))).toBe(true);
    expect(JSON.parse(readFileSync(join(first.packageRoot, "context/shared-visual-assets.json"), "utf8"))).toEqual({
      keep: true,
    });
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
    const first = exportWithPublishable({
      candidate: buildTestCandidate(),
      assetRoot: root,
      now: NOW,
    });
    mkdirSync(join(first.packageRoot, "human-edited"), { recursive: true });
    writeFileSync(join(first.packageRoot, "human-edited", "caption.txt"), "editor note");
    exportWithPublishable({
      candidate: buildTestCandidate(),
      assetRoot: root,
      now: NOW,
    });
    expect(readFileSync(join(first.packageRoot, "human-edited/caption.txt"), "utf8")).toBe("editor note");
  });

  it("writes publishable Threads copy even when strategist draft body is blank", () => {
    const root = tempRoot();
    const result = exportWithPublishable({
      candidate: buildTestCandidate({
        draft: buildDraft({ title: null, body: "   " }),
      }),
      assetRoot: root,
      now: NOW,
    });
    expect(result.plannedRelativePaths).toContain("copy/post.txt");
    expect(existsSync(join(result.packageRoot, "copy/post.txt"))).toBe(true);
    const post = readFileSync(join(result.packageRoot, "copy/post.txt"), "utf8");
    expect(post.trim().length).toBeGreaterThan(20);
    expect(post).not.toMatch(/Key verified facts/i);
    expect(existsSync(join(result.packageRoot, "context/publishable-content.json"))).toBe(true);
    expect(existsSync(join(result.packageRoot, "context/media-brief.json"))).toBe(true);
  });
});
