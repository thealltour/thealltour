import { describe, expect, it } from "vitest";

import {
  SHORTFORM_RETENTION_POLICY_V1,
  SHORTFORM_WORKER_STORAGE_POLICY_V1,
  defaultDispositionForSource,
  defaultStorageClassForSource,
  evaluateShortformWorkerStorage,
  evaluateStoragePressure,
  impliesPermanentLocalBinary,
  isAutoDeleteEligible,
  ShortformStoragePolicyError,
} from "@/lib/marketing/assets/shortform/storagePolicy";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("SV-1 source mapping", () => {
  it("maps source kinds to storage classes", () => {
    expect(defaultStorageClassForSource("own")).toBe("local_master");
    expect(defaultStorageClassForSource("partner")).toBe("local_master");
    expect(defaultStorageClassForSource("pexels")).toBe("external_ref");
    expect(defaultStorageClassForSource("pixabay")).toBe("external_ref");
    expect(defaultStorageClassForSource("generated_ai")).toBe("generated_source");
    expect(defaultStorageClassForSource("unknown")).toBe("external_ref");
  });

  it("maps dispositions: stock pick_only, partner ingest, pin never default", () => {
    expect(defaultDispositionForSource("pexels")).toBe("pick_only");
    expect(defaultDispositionForSource("pixabay")).toBe("pick_only");
    expect(impliesPermanentLocalBinary(defaultDispositionForSource("pexels"))).toBe(false);
    expect(defaultDispositionForSource("partner")).toBe("ingest");
    expect(impliesPermanentLocalBinary(defaultDispositionForSource("partner"))).toBe(true);
    expect(defaultDispositionForSource("generated_ai")).toBe("pick_only");
    expect(defaultDispositionForSource("own")).toBe("ingest");
  });
});

describe("SV-1 auto-delete eligibility", () => {
  const t0 = 1_700_000_000_000;

  it("ephemeral success is immediately eligible; failed waits 24h", () => {
    expect(
      isAutoDeleteEligible({
        storageClass: "ephemeral",
        sourceKind: "pexels",
        createdAtMs: t0,
        nowMs: t0,
        ephemeralOutcome: "success",
      }).eligible,
    ).toBe(true);

    expect(
      isAutoDeleteEligible({
        storageClass: "ephemeral",
        sourceKind: "pexels",
        createdAtMs: t0,
        nowMs: t0 + SHORTFORM_RETENTION_POLICY_V1.ephemeralFailedTtlMs - 1,
        ephemeralOutcome: "failed",
      }).eligible,
    ).toBe(false);

    expect(
      isAutoDeleteEligible({
        storageClass: "ephemeral",
        sourceKind: "pexels",
        createdAtMs: t0,
        nowMs: t0 + SHORTFORM_RETENTION_POLICY_V1.ephemeralFailedTtlMs,
        ephemeralOutcome: "failed",
      }).eligible,
    ).toBe(true);
  });

  it("preview retention 30d normal / 7d rejected", () => {
    expect(
      isAutoDeleteEligible({
        storageClass: "candidate_preview",
        sourceKind: "generated_ai",
        createdAtMs: t0,
        nowMs: t0 + 30 * DAY - 1,
        previewOutcome: "normal",
      }).eligible,
    ).toBe(false);
    expect(
      isAutoDeleteEligible({
        storageClass: "candidate_preview",
        sourceKind: "generated_ai",
        createdAtMs: t0,
        nowMs: t0 + 30 * DAY,
        previewOutcome: "normal",
      }).eligible,
    ).toBe(true);
    expect(
      isAutoDeleteEligible({
        storageClass: "candidate_preview",
        sourceKind: "generated_ai",
        createdAtMs: t0,
        nowMs: t0 + 7 * DAY,
        previewOutcome: "rejected",
      }).eligible,
    ).toBe(true);
  });

  it("unpublished final 90d; published/local_master/pin/unknown never", () => {
    expect(
      isAutoDeleteEligible({
        storageClass: "unpublished_final",
        sourceKind: "generated_ai",
        createdAtMs: t0,
        nowMs: t0 + 90 * DAY,
      }).eligible,
    ).toBe(true);

    expect(
      isAutoDeleteEligible({
        storageClass: "published_final",
        sourceKind: "generated_ai",
        createdAtMs: t0,
        nowMs: t0 + 365 * DAY,
      }).eligible,
    ).toBe(false);

    expect(
      isAutoDeleteEligible({
        storageClass: "local_master",
        sourceKind: "own",
        createdAtMs: t0,
        nowMs: t0 + 365 * DAY,
      }).eligible,
    ).toBe(false);

    expect(
      isAutoDeleteEligible({
        storageClass: "generated_source",
        sourceKind: "generated_ai",
        pinned: true,
        createdAtMs: t0,
        nowMs: t0 + 365 * DAY,
        generatedUsedInContent: true,
      }).eligible,
    ).toBe(false);

    expect(
      isAutoDeleteEligible({
        storageClass: "ephemeral",
        sourceKind: "unknown",
        createdAtMs: t0,
        nowMs: t0 + 365 * DAY,
        ephemeralOutcome: "success",
      }).eligible,
    ).toBe(false);

    expect(
      isAutoDeleteEligible({
        storageClass: "generated_source",
        sourceKind: "generated_ai",
        createdAtMs: t0,
        nowMs: t0 + 90 * DAY,
        generatedUsedInContent: true,
      }).eligible,
    ).toBe(true);
  });

  it("partner/own protected even if class were ephemeral", () => {
    expect(
      isAutoDeleteEligible({
        storageClass: "ephemeral",
        sourceKind: "partner",
        createdAtMs: t0,
        nowMs: t0 + 365 * DAY,
        ephemeralOutcome: "success",
      }).eligible,
    ).toBe(false);
  });
});

describe("SV-1 Pi storage pressure boundaries", () => {
  const total = 1_000_000;

  it("classifies 20/15/10 percent boundaries", () => {
    expect(evaluateStoragePressure({ totalBytes: total, freeBytes: 200_000 }).level).toBe("normal");
    expect(evaluateStoragePressure({ totalBytes: total, freeBytes: 199_990 }).level).toBe("warning");
    expect(evaluateStoragePressure({ totalBytes: total, freeBytes: 150_000 }).level).toBe("warning");
    expect(evaluateStoragePressure({ totalBytes: total, freeBytes: 149_990 }).level).toBe("pressure");
    expect(evaluateStoragePressure({ totalBytes: total, freeBytes: 100_000 }).level).toBe("pressure");
    expect(evaluateStoragePressure({ totalBytes: total, freeBytes: 99_990 }).level).toBe("protected");
  });

  it("encodes pressure behavior", () => {
    const protectedDecision = evaluateStoragePressure({ totalBytes: total, freeBytes: 50_000 });
    expect(protectedDecision.allowOptionalIngest).toBe(false);
    expect(protectedDecision.blockNonEssentialPersistentWrites).toBe(true);
    expect(protectedDecision.cleanupRecommended).toBe(true);

    const warning = evaluateStoragePressure({ totalBytes: total, freeBytes: 180_000 });
    expect(warning.allowOptionalIngest).toBe(true);
    expect(warning.cleanupRecommended).toBe(true);
  });

  it("rejects invalid capacity stats", () => {
    expect(() => evaluateStoragePressure({ totalBytes: 0, freeBytes: 0 })).toThrow(
      ShortformStoragePolicyError,
    );
    expect(() => evaluateStoragePressure({ totalBytes: 100, freeBytes: 101 })).toThrow(
      ShortformStoragePolicyError,
    );
    expect(() => evaluateStoragePressure({ totalBytes: 100, freeBytes: -1 })).toThrow(
      ShortformStoragePolicyError,
    );
  });
});

describe("SV-1 worker storage policy", () => {
  const GB = 1024 * 1024 * 1024;

  it("ready / cleanup / block boundaries including workspace budget", () => {
    expect(
      evaluateShortformWorkerStorage({
        rootFreeBytes: 100 * GB,
        workspaceUsedBytes: 0,
      }).status,
    ).toBe("READY");

    expect(
      evaluateShortformWorkerStorage({
        rootFreeBytes: 100 * GB - 1,
        workspaceUsedBytes: 0,
      }).status,
    ).toBe("CLEANUP_REQUIRED");

    expect(
      evaluateShortformWorkerStorage({
        rootFreeBytes: 75 * GB,
        workspaceUsedBytes: 0,
      }).status,
    ).toBe("CLEANUP_REQUIRED");

    expect(
      evaluateShortformWorkerStorage({
        rootFreeBytes: 75 * GB - 1,
        workspaceUsedBytes: 0,
      }).status,
    ).toBe("BLOCK_NEW_JOB");

    expect(
      evaluateShortformWorkerStorage({
        rootFreeBytes: 200 * GB,
        workspaceUsedBytes: SHORTFORM_WORKER_STORAGE_POLICY_V1.workspaceBudgetBytes + 1,
      }).status,
    ).toBe("CLEANUP_REQUIRED");
  });
});
