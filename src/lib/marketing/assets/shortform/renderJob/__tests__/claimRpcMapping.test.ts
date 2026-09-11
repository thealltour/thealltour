import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DEFAULT_SHORTFORM_VIDEO_RENDER_LEASE_MS } from "@/lib/marketing/assets/shortform/renderJob/contracts";
import { ShortformVideoRenderJobError } from "@/lib/marketing/assets/shortform/renderJob/errors";
import { mapClaimShortformVideoRenderJobRpcData } from "@/lib/marketing/assets/shortform/renderJob/supabaseRepository";

const SYSTEMD_TIMEOUT_START_SEC = 1800;
const SAFETY_MARGIN_MS = 15 * 60 * 1000; // TimeoutStartSec 30m → lease 45m

function validClaimRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    job_id: "svr_valid_claim_row",
    logical_run_key: "shortform-video-render:cmc:abc123",
    candidate_id: "cmc_claim",
    production_request_id: null,
    business_date_kst: "2026-09-11",
    status: "RUNNING",
    short_video_brief_artifact_path: "brief/short-video-brief.json",
    source_resolution_artifact_path: null,
    render_profile: "shortform-video-render-profile-v1",
    input_snapshot: {
      briefContract: "short-video-brief-v1",
      briefSha256: "a".repeat(64),
      selectionHash: "b".repeat(64),
      scenes: [],
    },
    attempt_count: 1,
    max_attempts: 3,
    claimed_by: "mini-pc-a",
    claimed_at: "2026-09-11T00:00:00.000Z",
    lease_expires_at: "2026-09-11T00:45:00.000Z",
    claim_token: "tok_claim_abc",
    next_attempt_at: null,
    output_artifact_path: null,
    error_code: null,
    error_summary: null,
    created_at: "2026-09-11T00:00:00.000Z",
    updated_at: "2026-09-11T00:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
}

describe("SV-8C4-B claim RPC mapping", () => {
  it("A: RPC null / no-row returns null", () => {
    expect(mapClaimShortformVideoRenderJobRpcData(null)).toBeNull();
    expect(mapClaimShortformVideoRenderJobRpcData(undefined)).toBeNull();
  });

  it("A2: PostgREST null-composite object returns null (no phantom job)", () => {
    const phantomLike = {
      id: null,
      job_id: null,
      logical_run_key: null,
      candidate_id: null,
      status: null,
      claim_token: null,
    };
    expect(mapClaimShortformVideoRenderJobRpcData(phantomLike)).toBeNull();
  });

  it("C: valid claim row still maps correctly", () => {
    const mapped = mapClaimShortformVideoRenderJobRpcData(validClaimRow());
    expect(mapped).not.toBeNull();
    expect(mapped!.jobId).toBe("svr_valid_claim_row");
    expect(mapped!.logicalRunKey).toBe("shortform-video-render:cmc:abc123");
    expect(mapped!.status).toBe("RUNNING");
    expect(mapped!.claimToken).toBe("tok_claim_abc");
    expect(mapped!.claimedBy).toBe("mini-pc-a");
  });

  it("D: malformed non-null row is rejected (not coerced to phantom)", () => {
    expect(() =>
      mapClaimShortformVideoRenderJobRpcData({
        id: "x",
        job_id: null,
        logical_run_key: "k",
        status: "RUNNING",
        claim_token: "t",
      }),
    ).toThrow(ShortformVideoRenderJobError);

    expect(() =>
      mapClaimShortformVideoRenderJobRpcData({
        id: "x",
        job_id: "null",
        logical_run_key: "null",
        status: "RUNNING",
        claim_token: "t",
      }),
    ).toThrow(ShortformVideoRenderJobError);

    expect(() => mapClaimShortformVideoRenderJobRpcData(["not-a-row"])).toThrow(
      ShortformVideoRenderJobError,
    );
  });
});

describe("SV-8C4-B lease safety invariant", () => {
  it("default lease outlives systemd TimeoutStartSec with margin", () => {
    const timeoutMs = SYSTEMD_TIMEOUT_START_SEC * 1000;
    expect(DEFAULT_SHORTFORM_VIDEO_RENDER_LEASE_MS).toBeGreaterThan(timeoutMs);
    expect(DEFAULT_SHORTFORM_VIDEO_RENDER_LEASE_MS - timeoutMs).toBeGreaterThanOrEqual(
      SAFETY_MARGIN_MS,
    );
    expect(DEFAULT_SHORTFORM_VIDEO_RENDER_LEASE_MS).toBe(45 * 60 * 1000);
  });

  it("canonical unit keeps TimeoutStartSec below lease and WorkingDirectory canonical", () => {
    const unitPath = join(
      process.cwd(),
      "deploy/systemd/thealltour-shortform-video-render-queue.service",
    );
    const unit = readFileSync(unitPath, "utf8");
    expect(unit).toMatch(/TimeoutStartSec=1800/);
    expect(unit).toMatch(/WorkingDirectory=\/home\/ysh\/thealltour/);
    expect(unit).toMatch(
      /ExecStart=\/usr\/bin\/npx tsx scripts\/process-shortform-video-render-queue\.ts/,
    );
    expect(unit).not.toMatch(/WorkingDirectory=\/home\/ysh\/theallcloud/);
  });
});
