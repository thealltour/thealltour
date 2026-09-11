import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildAssignment,
  buildContentPlan,
  buildDraft,
  buildTestCandidate,
  NOW,
} from "@/lib/marketing/assets/__tests__/fixtures";
import { createInMemoryMarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/inMemorySourceCatalogRepository";
import { SHORT_VIDEO_BRIEF_RELATIVE_PATH } from "@/lib/marketing/assets/shortVideoBrief/paths";
import {
  DAILY_SHORTFORM_COMMITMENT_RELATIVE_PATH,
  decideDailyShortformCommitment,
  maybeGenerateShortformBriefAndResolve,
  MAX_DAILY_SHORTFORM_COMMITMENTS,
} from "@/lib/marketing/assets/shortform/dailyShortformBridge";
import { SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH } from "@/lib/marketing/assets/shortform/resolver/paths";

const tempDirs: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "cg2-shortform-bridge-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

const env = {
  PEXELS_API_KEY: undefined,
  PIXABAY_API_KEY: undefined,
  NEXT_PUBLIC_SUPABASE_URL: undefined,
  SUPABASE_SERVICE_ROLE_KEY: undefined,
} as const;

describe("CG-2 daily shortform bridge", () => {
  it("commits at most one shortform-intended candidate per businessDate", async () => {
    const assetRoot = tempRoot();
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const first = buildTestCandidate({ candidateId: "cmc_cg2_first" });
    const second = buildTestCandidate({ candidateId: "cmc_cg2_second" });

    const a = await maybeGenerateShortformBriefAndResolve({
      candidate: first,
      assetRoot,
      catalog,
      env,
      now: NOW,
    });
    expect(a.outcome).toMatch(/^(committed|reused)$/);
    expect(a.shortformIntended).toBe(true);
    expect(a.shortVideoBriefPersisted).toBe(true);
    expect(a.sourceResolutionPersisted).toBe(true);
    expect(existsSync(join(a.packageRoot!, DAILY_SHORTFORM_COMMITMENT_RELATIVE_PATH))).toBe(true);
    expect(existsSync(join(a.packageRoot!, SHORT_VIDEO_BRIEF_RELATIVE_PATH))).toBe(true);
    expect(existsSync(join(a.packageRoot!, SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH))).toBe(true);

    const decision = decideDailyShortformCommitment({ candidate: second, assetRoot, env });
    expect(decision.commit).toBe(false);
    expect(decision.reason).toBe("daily_slot_taken");
    expect(MAX_DAILY_SHORTFORM_COMMITMENTS).toBe(1);

    const b = await maybeGenerateShortformBriefAndResolve({
      candidate: second,
      assetRoot,
      catalog,
      env,
      now: NOW,
    });
    expect(b.outcome).toBe("skipped");
    expect(b.shortformIntended).toBe(false);
    expect(b.reason).toBe("daily_slot_taken");
    expect(b.holderCandidateId).toBe(first.candidateId);
  });

  it("is idempotent on repeat for the same committed candidate", async () => {
    const assetRoot = tempRoot();
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const candidate = buildTestCandidate({ candidateId: "cmc_cg2_idempotent" });

    const first = await maybeGenerateShortformBriefAndResolve({
      candidate,
      assetRoot,
      catalog,
      env,
      now: NOW,
    });
    expect(first.shortVideoBriefPersisted).toBe(true);
    const brief1 = readFileSync(join(first.packageRoot!, SHORT_VIDEO_BRIEF_RELATIVE_PATH), "utf8");
    const commitment1 = readFileSync(
      join(first.packageRoot!, DAILY_SHORTFORM_COMMITMENT_RELATIVE_PATH),
      "utf8",
    );

    const second = await maybeGenerateShortformBriefAndResolve({
      candidate,
      assetRoot,
      catalog,
      env,
      now: NOW,
    });
    expect(second.shortformIntended).toBe(true);
    expect(second.packageRoot).toBe(first.packageRoot);
    const brief2 = readFileSync(join(second.packageRoot!, SHORT_VIDEO_BRIEF_RELATIVE_PATH), "utf8");
    const commitment2 = readFileSync(
      join(second.packageRoot!, DAILY_SHORTFORM_COMMITMENT_RELATIVE_PATH),
      "utf8",
    );
    expect(brief2).toBe(brief1);
    expect(JSON.parse(commitment2).candidateId).toBe(JSON.parse(commitment1).candidateId);
    expect(JSON.parse(commitment2).shortformIntended).toBe(true);
  });

  it("skips non-shortform candidates (zero shortforms)", async () => {
    const assetRoot = tempRoot();
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const candidate = buildTestCandidate({
      candidateId: "cmc_cg2_text_only",
      contentAssignment: buildAssignment({
        formatHints: [{ format: "threads_text", score: 0.9, rationale: "text only" }],
      }),
      contentPlan: buildContentPlan({
        recommendedFormats: [{ format: "threads_text", score: 0.9, rationale: "text only" }],
      }),
    });

    const result = await maybeGenerateShortformBriefAndResolve({
      candidate,
      assetRoot,
      catalog,
      env,
      now: NOW,
    });
    expect(result.outcome).toBe("skipped");
    expect(result.reason).toBe("not_shortform_eligible");
    expect(result.shortformIntended).toBe(false);
  });

  it("survives missing external provider credentials without enqueueing render", async () => {
    const assetRoot = tempRoot();
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const candidate = buildTestCandidate({
      candidateId: "cmc_cg2_no_keys",
      draft: buildDraft({
        body: "Japan autumn update for travelers.\n\nCheck official guidance before you go.",
      }),
    });

    const result = await maybeGenerateShortformBriefAndResolve({
      candidate,
      assetRoot,
      catalog,
      env: { ...env, PEXELS_API_KEY: "", PIXABAY_API_KEY: "" },
      now: NOW,
    });
    expect(result.shortformIntended).toBe(true);
    expect(result.shortVideoBriefPersisted).toBe(true);
    expect(result.sourceResolutionPersisted).toBe(true);
    expect(result.sceneCount).toBeGreaterThan(0);

    const plan = JSON.parse(
      readFileSync(join(result.packageRoot!, SHORTFORM_SOURCE_RESOLUTION_RELATIVE_PATH), "utf8"),
    ) as {
      scenes: Array<{ attemptedSources: Array<{ providerId: string; status: string }> }>;
    };
    for (const scene of plan.scenes) {
      const pexels = scene.attemptedSources.find((a) => a.providerId === "pexels");
      const pixabay = scene.attemptedSources.find((a) => a.providerId === "pixabay");
      if (pexels) expect(["disabled", "skipped", "empty"]).toContain(pexels.status);
      if (pixabay) expect(["disabled", "skipped", "empty"]).toContain(pixabay.status);
    }

    // CG-2 must not create render-job artifacts in the package.
    expect(existsSync(join(result.packageRoot!, "jobs"))).toBe(false);
    expect(existsSync(join(result.packageRoot!, "context/video-render-job.json"))).toBe(false);
  });
});
