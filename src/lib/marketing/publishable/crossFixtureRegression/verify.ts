/**
 * Automated verify layer for production-backed fixtures.
 * Semantic quality remains manual / report-assisted — not regex-golden.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { assertProductionFixtureEligible } from "@/lib/marketing/publishable/crossFixtureRegression/eligibility";
import type {
  ChannelAutomatedCheck,
  CrossFixtureChannel,
  CrossFixtureVerdict,
  FixtureVerifyResult,
  ProductionBackedFixture,
} from "@/lib/marketing/publishable/crossFixtureRegression/types";

type ArtifactSpec = {
  channel: CrossFixtureChannel;
  /** Preferred dedicated context file (relative to packageRoot). */
  relativePath: string;
  requiredKeys?: string[];
  /**
   * Optional fallback: read nested channel blob from publishable-content.json
   * when the dedicated file is absent (e.g. Kakao / Shortform editors).
   */
  publishableFallback?: {
    channelKey: string;
    requiredKeys?: string[];
  };
};

const CHANNEL_ARTIFACTS: ArtifactSpec[] = [
  {
    channel: "narrative",
    relativePath: "context/editorial-narrative-plan.json",
    requiredKeys: ["beats"],
  },
  {
    channel: "threads",
    relativePath: "context/threads-copy.json",
    requiredKeys: ["body"],
    publishableFallback: { channelKey: "threads", requiredKeys: ["body"] },
  },
  {
    channel: "instagramCarousel",
    relativePath: "context/instagram-carousel-plan.json",
    requiredKeys: ["cards"],
  },
  {
    channel: "instagramCardCopy",
    relativePath: "context/instagram-card-copy.json",
    requiredKeys: ["cards"],
  },
  {
    channel: "instagramCaption",
    relativePath: "context/instagram-caption.json",
    requiredKeys: ["body"],
  },
  {
    channel: "blogStructure",
    relativePath: "context/naver-blog-structure-plan.json",
    requiredKeys: ["sectionPlan"],
  },
  {
    channel: "blogCopy",
    relativePath: "context/naver-blog-copy.json",
    requiredKeys: ["title"],
    publishableFallback: { channelKey: "naver_blog", requiredKeys: ["body"] },
  },
  {
    channel: "band",
    relativePath: "context/naver-band-copy.json",
    requiredKeys: ["body"],
    publishableFallback: { channelKey: "naver_band", requiredKeys: ["body"] },
  },
  {
    channel: "kakao",
    relativePath: "context/kakao-channel-copy.json",
    requiredKeys: ["body"],
    publishableFallback: { channelKey: "kakao_channel", requiredKeys: ["body"] },
  },
  {
    channel: "shortform",
    relativePath: "context/shortform-script.json",
    requiredKeys: ["spokenScript"],
    publishableFallback: { channelKey: "shortform", requiredKeys: ["body"] },
  },
];

function worstVerdict(a: CrossFixtureVerdict, b: CrossFixtureVerdict): CrossFixtureVerdict {
  const rank: Record<CrossFixtureVerdict, number> = {
    PASS: 0,
    PASS_WITH_MINOR: 1,
    UNTESTED: 2,
    BLOCKED: 3,
    FAIL: 4,
  };
  return rank[a] >= rank[b] ? a : b;
}

function overallFromParts(parts: CrossFixtureVerdict[]): CrossFixtureVerdict {
  return parts.reduce<CrossFixtureVerdict>((acc, v) => worstVerdict(acc, v), "PASS");
}

async function readJson(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractFreshness(doc: Record<string, unknown> | null): {
  generatedAt: string | null;
  modelProfile: string | null;
  publishableSuccess: boolean | null;
  sourceFingerprint: string | null;
  forceRegenerate: boolean | null;
} {
  if (!doc) {
    return {
      generatedAt: null,
      modelProfile: null,
      publishableSuccess: null,
      sourceFingerprint: null,
      forceRegenerate: null,
    };
  }
  const provenance =
    doc.provenance && typeof doc.provenance === "object"
      ? (doc.provenance as Record<string, unknown>)
      : {};

  const generatedAt =
    typeof doc.generatedAt === "string"
      ? doc.generatedAt
      : typeof provenance.generatedAt === "string"
        ? provenance.generatedAt
        : typeof doc.createdAt === "string"
          ? doc.createdAt
          : null;

  const modelProfile =
    typeof doc.modelProfile === "string"
      ? doc.modelProfile
      : typeof provenance.modelProfile === "string"
        ? provenance.modelProfile
        : typeof provenance.model === "string"
          ? provenance.model
          : typeof doc.model === "string"
            ? doc.model
            : null;

  const status = typeof doc.status === "string" ? doc.status : null;
  const publishableSuccess =
    typeof doc.publishableSuccess === "boolean"
      ? doc.publishableSuccess
      : typeof doc.ok === "boolean"
        ? doc.ok
        : status === "generated"
          ? true
          : status === "failed"
            ? false
            : null;

  const sourceFingerprint =
    typeof doc.sourceFingerprint === "string"
      ? doc.sourceFingerprint
      : typeof doc.sourceNarrativeFingerprint === "string"
        ? doc.sourceNarrativeFingerprint
        : typeof doc.sourceCanonicalFingerprint === "string"
          ? doc.sourceCanonicalFingerprint
          : typeof provenance.sourceNarrativeFingerprint === "string"
            ? provenance.sourceNarrativeFingerprint
            : typeof provenance.sourceUpstreamFingerprint === "string"
              ? provenance.sourceUpstreamFingerprint
              : typeof doc.upstreamFingerprint === "string"
                ? doc.upstreamFingerprint
                : null;

  const forceRegenerate =
    typeof doc.forceRegenerate === "boolean"
      ? doc.forceRegenerate
      : typeof provenance.forceRegenerate === "boolean"
        ? provenance.forceRegenerate
        : null;

  return {
    generatedAt,
    modelProfile,
    publishableSuccess,
    sourceFingerprint,
    forceRegenerate,
  };
}

function hasRequiredKeys(
  doc: Record<string, unknown>,
  keys: string[] | undefined,
): boolean {
  if (!keys || keys.length === 0) return true;
  return keys.every((k) => {
    const v = doc[k];
    if (v === undefined || v === null) return false;
    if (typeof v === "string" && v.trim().length === 0) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });
}

async function loadChannelDocument(
  packageRoot: string,
  spec: ArtifactSpec,
): Promise<{
  doc: Record<string, unknown> | null;
  artifactPath: string;
  source: "dedicated" | "publishable_fallback" | "missing";
  notes: string[];
}> {
  const notes: string[] = [];
  const dedicatedPath = path.join(packageRoot, spec.relativePath);
  const dedicated = await readJson(dedicatedPath);
  if (dedicated) {
    return { doc: dedicated, artifactPath: dedicatedPath, source: "dedicated", notes };
  }

  if (spec.publishableFallback) {
    const pubPath = path.join(packageRoot, "context/publishable-content.json");
    const pub = await readJson(pubPath);
    const nested = pub?.[spec.publishableFallback.channelKey];
    if (nested && typeof nested === "object") {
      notes.push(
        `dedicated artifact missing (${spec.relativePath}); using publishable-content.${spec.publishableFallback.channelKey}`,
      );
      return {
        doc: nested as Record<string, unknown>,
        artifactPath: `${pubPath}#${spec.publishableFallback.channelKey}`,
        source: "publishable_fallback",
        notes,
      };
    }
  }

  return { doc: null, artifactPath: dedicatedPath, source: "missing", notes };
}

/**
 * Automated channel check — existence, freshness field, materialization keys.
 * Style / archetypeFit / evidence default to UNTESTED (manual semantic review).
 * Stale/missing artifacts never earn content PASS.
 */
export async function verifyChannelArtifact(
  packageRoot: string,
  spec: ArtifactSpec,
  options?: {
    maxAgeMs?: number;
    expectedUpstreamFingerprint?: string | null;
  },
): Promise<ChannelAutomatedCheck> {
  const loaded = await loadChannelDocument(packageRoot, spec);
  const notes = [...loaded.notes];
  const blockers: string[] = [];
  const doc = loaded.doc;
  const artifactPath = loaded.artifactPath;

  if (!doc) {
    blockers.push(`missing artifact: ${spec.relativePath}`);
    return {
      channel: spec.channel,
      freshness: "FAIL",
      materialize: "FAIL",
      style: "BLOCKED",
      archetypeFit: "BLOCKED",
      evidence: "BLOCKED",
      overall: "FAIL",
      generatedAt: null,
      modelProfile: null,
      publishableSuccess: null,
      artifactPath,
      notes,
      blockers,
    };
  }

  const meta = extractFreshness(doc);
  let freshness: CrossFixtureVerdict = "PASS";
  let materialize: CrossFixtureVerdict = "PASS";

  if (!meta.generatedAt) {
    freshness = "PASS_WITH_MINOR";
    notes.push("generatedAt missing — freshness cannot be fully attested");
  } else if (options?.maxAgeMs != null) {
    const age = Date.now() - Date.parse(meta.generatedAt);
    if (Number.isFinite(age) && age > options.maxAgeMs) {
      freshness = "FAIL";
      blockers.push(
        `stale artifact: generatedAt=${meta.generatedAt} exceeds maxAgeMs=${options.maxAgeMs}`,
      );
    }
  }

  const requiredKeys =
    loaded.source === "publishable_fallback"
      ? spec.publishableFallback?.requiredKeys ?? spec.requiredKeys
      : spec.requiredKeys;

  if (!hasRequiredKeys(doc, requiredKeys)) {
    materialize = "FAIL";
    blockers.push(
      `failed materialization: missing keys ${JSON.stringify(requiredKeys ?? [])}`,
    );
  }

  if (meta.publishableSuccess === false) {
    materialize = worstVerdict(materialize, "FAIL");
    blockers.push("publishableSuccess=false");
  }

  if (
    options?.expectedUpstreamFingerprint &&
    meta.sourceFingerprint &&
    meta.sourceFingerprint !== options.expectedUpstreamFingerprint
  ) {
    materialize = worstVerdict(materialize, "FAIL");
    blockers.push(
      `mismatched upstream fingerprint: got=${meta.sourceFingerprint} expected=${options.expectedUpstreamFingerprint}`,
    );
  }

  if (meta.forceRegenerate != null) {
    notes.push(`forceRegenerate=${meta.forceRegenerate}`);
  }
  if (loaded.source === "publishable_fallback") {
    notes.push("source=publishable_fallback");
  }

  const style: CrossFixtureVerdict =
    freshness === "FAIL" || materialize === "FAIL" ? "BLOCKED" : "UNTESTED";
  const archetypeFit: CrossFixtureVerdict =
    freshness === "FAIL" || materialize === "FAIL" ? "BLOCKED" : "UNTESTED";
  const evidence: CrossFixtureVerdict =
    freshness === "FAIL" || materialize === "FAIL" ? "BLOCKED" : "UNTESTED";

  const overall = overallFromParts([freshness, materialize, style, archetypeFit, evidence]);

  return {
    channel: spec.channel,
    freshness,
    materialize,
    style,
    archetypeFit,
    evidence,
    overall,
    generatedAt: meta.generatedAt,
    modelProfile: meta.modelProfile,
    publishableSuccess: meta.publishableSuccess,
    artifactPath,
    notes,
    blockers,
  };
}

export async function verifyProductionFixture(
  fixture: ProductionBackedFixture,
  options?: {
    maxAgeMs?: number;
    canonicalOverride?: import("@/lib/marketing/canonicalAsset/contracts").CanonicalMarketingAsset | null;
  },
): Promise<FixtureVerifyResult> {
  const eligibility = await assertProductionFixtureEligible(fixture, {
    canonicalOverride: options?.canonicalOverride,
  });

  if (!eligibility.ok) {
    return {
      fixtureId: fixture.fixtureId,
      eligible: false,
      eligibilityBlockers: eligibility.blockers,
      channels: fixture.channelsToTest.map((channel) => ({
        channel,
        freshness: "BLOCKED" as const,
        materialize: "BLOCKED" as const,
        style: "BLOCKED" as const,
        archetypeFit: "BLOCKED" as const,
        evidence: "BLOCKED" as const,
        overall: "BLOCKED" as const,
        generatedAt: null,
        modelProfile: null,
        publishableSuccess: null,
        artifactPath: null,
        notes: [],
        blockers: [...eligibility.blockers],
      })),
      overall: "BLOCKED",
    };
  }

  const specs = CHANNEL_ARTIFACTS.filter((s) => fixture.channelsToTest.includes(s.channel));
  const channels: ChannelAutomatedCheck[] = [];
  for (const spec of specs) {
    channels.push(
      await verifyChannelArtifact(fixture.packageRoot, spec, {
        maxAgeMs: options?.maxAgeMs,
      }),
    );
  }

  const overall = overallFromParts(channels.map((c) => c.overall));
  return {
    fixtureId: fixture.fixtureId,
    eligible: true,
    eligibilityBlockers: [],
    channels,
    overall,
  };
}

/** Pure helper for tests — exact prose is never required for PASS. */
export function contentPassRequiresExactProse(): boolean {
  return false;
}

/** Pure helper — FAIL/BLOCKED/UNTESTED must not be coerced to PASS. */
export function preserveNonPassVerdict(v: CrossFixtureVerdict): CrossFixtureVerdict {
  if (v === "PASS" || v === "PASS_WITH_MINOR") return v;
  return v;
}

/** Exported for tests that exercise missing dedicated paths. */
export const CROSS_FIXTURE_CHANNEL_ARTIFACTS = CHANNEL_ARTIFACTS;
