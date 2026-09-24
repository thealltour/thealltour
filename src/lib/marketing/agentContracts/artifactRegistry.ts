/**
 * Marketing Artifact Registry (Phase 3A).
 * Paths/contract versions must match existing domain contracts.
 */

import type { MarketingArtifactContract } from "@/lib/marketing/agentContracts/artifactContract";
import { CANONICAL_MARKETING_ASSET_CONTRACT } from "@/lib/marketing/canonicalAsset/contracts";
import { CANONICAL_MARKETING_ASSET_RELATIVE_PATH } from "@/lib/marketing/canonicalAsset/paths";
import { ASSET_SOURCE_WRITER_ROLE } from "@/lib/marketing/canonicalAsset/contracts";
import { EDITORIAL_NARRATIVE_PLAN_CONTRACT } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import { EDITORIAL_NARRATIVE_PLAN_RELATIVE_PATH } from "@/lib/marketing/publishable/editorialNarrative/paths";
import {
  INSTAGRAM_CAPTION_CONTRACT,
  INSTAGRAM_CARD_COPY_CONTRACT,
  INSTAGRAM_CAROUSEL_PLAN_CONTRACT,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";
import {
  INSTAGRAM_CAPTION_RELATIVE_PATH,
  INSTAGRAM_CARD_COPY_RELATIVE_PATH,
  INSTAGRAM_CAROUSEL_PLAN_RELATIVE_PATH,
} from "@/lib/marketing/publishable/instagramEditorial/paths";
import { INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT } from "@/lib/marketing/publishable/instagramVisualRole/contracts";
import { INSTAGRAM_VISUAL_ROLE_PLAN_RELATIVE_PATH } from "@/lib/marketing/publishable/instagramVisualRole/paths";
import { SHARED_VISUAL_PLAN_CONTRACT } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import { SHARED_VISUAL_PLAN_RELATIVE_PATH } from "@/lib/marketing/publishable/sharedVisualPlan/paths";
import {
  CARD_PRESENTATION_PLAN_CONTRACT,
  CARD_PRESENTATION_PLAN_RELATIVE_PATH,
} from "@/lib/marketing/assets/cardnews/presentation/contracts";
import { MANUAL_ASTRA_HANDOFF_CONTRACT } from "@/lib/marketing/publishable/manualAstraHandoff/contracts";
import { MANUAL_ASTRA_HANDOFF_RELATIVE_PATH } from "@/lib/marketing/publishable/manualAstraHandoff/paths";
import { PUBLISHABLE_CONTENT_BUNDLE_CONTRACT } from "@/lib/marketing/publishable/contracts";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import { THREADS_COPY_CONTRACT } from "@/lib/marketing/publishable/threadsCopy/contracts";
import { THREADS_COPY_RELATIVE_PATH } from "@/lib/marketing/publishable/threadsCopy/paths";
import {
  NAVER_BLOG_COPY_CONTRACT,
  NAVER_BLOG_STRUCTURE_PLAN_CONTRACT,
} from "@/lib/marketing/publishable/naverBlogEditorial/contracts";
import {
  NAVER_BLOG_COPY_RELATIVE_PATH,
  NAVER_BLOG_STRUCTURE_PLAN_RELATIVE_PATH,
} from "@/lib/marketing/publishable/naverBlogEditorial/paths";

export const MARKETING_ARTIFACT_REGISTRY: readonly MarketingArtifactContract[] = [
  // Upstream roots (not Phase 3A agent migration, but required for DAG)
  {
    artifactId: CANONICAL_MARKETING_ASSET_CONTRACT,
    contractVersion: CANONICAL_MARKETING_ASSET_CONTRACT,
    relativePath: CANONICAL_MARKETING_ASSET_RELATIVE_PATH,
    producedBy: ASSET_SOURCE_WRITER_ROLE,
    dependsOn: [],
    lifecycle: {
      fingerprintSources: ["canonical.content"],
      reuseWhen: "canonical content identity unchanged",
      staleWhen: "canonical content / approval identity changes",
    },
    failurePolicy: {
      onGenerateFail: "fail_closed",
      repairAttempts: 2,
      materializeInRepairLoop: true,
    },
  },
  {
    artifactId: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    contractVersion: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    relativePath: PUBLISHABLE_CONTENT_RELATIVE_PATH,
    producedBy: "pipeline:publishable-bundle",
    dependsOn: [
      INSTAGRAM_CAPTION_CONTRACT,
      // Bundle aggregates channels; visual chain also consumes Instagram cards from bundle
    ],
    lifecycle: {
      fingerprintSources: ["publishable.channelSnapshot"],
      reuseWhen: "channel publishable contents unchanged",
      staleWhen: "any channel publishable content regenerates",
    },
    failurePolicy: { onGenerateFail: "fail_closed" },
    legacy: {
      fallbackAllowed: true,
      notes: ["Bundle assembly is pipeline-owned; listed for SVP dependsOn."],
    },
  },

  {
    artifactId: EDITORIAL_NARRATIVE_PLAN_CONTRACT,
    contractVersion: EDITORIAL_NARRATIVE_PLAN_CONTRACT,
    relativePath: EDITORIAL_NARRATIVE_PLAN_RELATIVE_PATH,
    producedBy: "editorial-narrative-planner",
    dependsOn: [CANONICAL_MARKETING_ASSET_CONTRACT],
    lifecycle: {
      fingerprintSources: ["sourceCanonicalFingerprint"],
      reuseWhen: "sourceCanonicalFingerprint matches expected canonical fingerprint",
      staleWhen: "Canonical changes (sourceCanonicalFingerprint mismatch)",
    },
    failurePolicy: {
      // ensureEditorialNarrativePlan catch returns existing ?? null (preserve_previous).
      onGenerateFail: "preserve_previous",
      repairAttempts: 2,
      materializeInRepairLoop: false,
    },
  },
  {
    artifactId: INSTAGRAM_CAROUSEL_PLAN_CONTRACT,
    contractVersion: INSTAGRAM_CAROUSEL_PLAN_CONTRACT,
    relativePath: INSTAGRAM_CAROUSEL_PLAN_RELATIVE_PATH,
    producedBy: "instagram-carousel-planner",
    dependsOn: [EDITORIAL_NARRATIVE_PLAN_CONTRACT],
    lifecycle: {
      fingerprintSources: ["sourceNarrativeFingerprint"],
      reuseWhen: "sourceNarrativeFingerprint matches Narrative content fingerprint",
      staleWhen: "Narrative content fingerprint changes",
    },
    failurePolicy: {
      onGenerateFail: "fail_closed",
      repairAttempts: 2,
      materializeInRepairLoop: false,
    },
  },
  {
    artifactId: INSTAGRAM_CARD_COPY_CONTRACT,
    contractVersion: INSTAGRAM_CARD_COPY_CONTRACT,
    relativePath: INSTAGRAM_CARD_COPY_RELATIVE_PATH,
    producedBy: "instagram-card-copy-writer",
    dependsOn: [INSTAGRAM_CAROUSEL_PLAN_CONTRACT],
    lifecycle: {
      fingerprintSources: ["sourceCarouselFingerprint"],
      reuseWhen: "sourceCarouselFingerprint matches Carousel content fingerprint",
      staleWhen: "Carousel content fingerprint changes",
    },
    failurePolicy: {
      onGenerateFail: "fail_closed",
      repairAttempts: 2,
      materializeInRepairLoop: false,
    },
  },
  {
    artifactId: INSTAGRAM_CAPTION_CONTRACT,
    contractVersion: INSTAGRAM_CAPTION_CONTRACT,
    relativePath: INSTAGRAM_CAPTION_RELATIVE_PATH,
    producedBy: "instagram-caption-writer",
    dependsOn: [INSTAGRAM_CARD_COPY_CONTRACT],
    lifecycle: {
      fingerprintSources: ["sourceCardCopyFingerprint"],
      reuseWhen: "sourceCardCopyFingerprint matches Card Copy content fingerprint",
      staleWhen: "Card Copy content fingerprint changes",
    },
    failurePolicy: {
      onGenerateFail: "fail_closed",
      repairAttempts: 2,
      materializeInRepairLoop: false,
    },
  },
  {
    artifactId: INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT,
    contractVersion: INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT,
    relativePath: INSTAGRAM_VISUAL_ROLE_PLAN_RELATIVE_PATH,
    producedBy: "instagram-visual-role-architect",
    dependsOn: [INSTAGRAM_CAROUSEL_PLAN_CONTRACT, INSTAGRAM_CARD_COPY_CONTRACT],
    lifecycle: {
      fingerprintSources: ["sourceCarouselFingerprint", "sourceCardCopyFingerprint"],
      reuseWhen:
        "sourceCarouselFingerprint and sourceCardCopyFingerprint match current Carousel + Card Copy",
      staleWhen: "Carousel FP or Card Copy FP changes",
    },
    failurePolicy: {
      onGenerateFail: "fail_closed",
      repairAttempts: 2,
      materializeInRepairLoop: true,
    },
  },
  {
    artifactId: SHARED_VISUAL_PLAN_CONTRACT,
    contractVersion: SHARED_VISUAL_PLAN_CONTRACT,
    relativePath: SHARED_VISUAL_PLAN_RELATIVE_PATH,
    producedBy: "shared-visual-planner",
    dependsOn: [PUBLISHABLE_CONTENT_BUNDLE_CONTRACT, INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT],
    lifecycle: {
      fingerprintSources: [
        "sourceVisualPlanFingerprint",
        "sourceInstagramVisualRoleFingerprint",
      ],
      reuseWhen: "bundle channel snapshot FP and VRA content FP still match recorded sources",
      staleWhen: "bundle snapshot or VRA FP changes",
    },
    failurePolicy: {
      onGenerateFail: "preserve_previous",
      repairAttempts: 1,
      materializeInRepairLoop: false,
    },
    legacy: {
      fallbackAllowed: true,
      notes: ["legacy visualHints remain advisory when VRA absent"],
    },
  },
  {
    artifactId: CARD_PRESENTATION_PLAN_CONTRACT,
    contractVersion: CARD_PRESENTATION_PLAN_CONTRACT,
    relativePath: CARD_PRESENTATION_PLAN_RELATIVE_PATH,
    producedBy: "deterministic:card-layout-director",
    dependsOn: [INSTAGRAM_CARD_COPY_CONTRACT, SHARED_VISUAL_PLAN_CONTRACT],
    lifecycle: {
      fingerprintSources: [
        "provenance.sourceInstagramFingerprint",
        "provenance.sourceVisualPlanFingerprint",
      ],
      reuseWhen: "Instagram presentation source FP matches (optional VP FP when present)",
      staleWhen: "IG cards/visual inputs change (instagram fingerprint and/or visual plan FP)",
    },
    failurePolicy: {
      onGenerateFail: "deterministic_fallback",
      materializeInRepairLoop: false,
    },
    legacy: {
      fallbackAllowed: true,
      notes: ["Production Layout is deterministic; Hermes card-layout-director not wired."],
    },
  },
  {
    artifactId: MANUAL_ASTRA_HANDOFF_CONTRACT,
    contractVersion: MANUAL_ASTRA_HANDOFF_CONTRACT,
    relativePath: MANUAL_ASTRA_HANDOFF_RELATIVE_PATH,
    producedBy: "astra-handoff-writer",
    dependsOn: [SHARED_VISUAL_PLAN_CONTRACT],
    lifecycle: {
      fingerprintSources: ["sourceSharedVisualPlanFingerprint"],
      reuseWhen: "sourceSharedVisualPlanFingerprint matches current SVP and SVP is fresh",
      staleWhen: "SVP stale or SVP fingerprint mismatch",
    },
    failurePolicy: {
      onGenerateFail: "preserve_previous",
      repairAttempts: 1,
      materializeInRepairLoop: false,
    },
  },

  // Channel copy metadata (Phase 3A register only)
  {
    artifactId: THREADS_COPY_CONTRACT,
    contractVersion: THREADS_COPY_CONTRACT,
    relativePath: THREADS_COPY_RELATIVE_PATH,
    producedBy: "threads-copy-writer",
    dependsOn: [EDITORIAL_NARRATIVE_PLAN_CONTRACT],
    lifecycle: {
      fingerprintSources: ["sourceNarrativeFingerprint"],
      reuseWhen: "sourceNarrativeFingerprint matches Narrative",
      staleWhen: "Narrative content fingerprint changes",
    },
    failurePolicy: {
      onGenerateFail: "fail_closed",
      repairAttempts: 2,
      materializeInRepairLoop: false,
    },
  },
  {
    artifactId: NAVER_BLOG_STRUCTURE_PLAN_CONTRACT,
    contractVersion: NAVER_BLOG_STRUCTURE_PLAN_CONTRACT,
    relativePath: NAVER_BLOG_STRUCTURE_PLAN_RELATIVE_PATH,
    producedBy: "naver-blog-structure-planner",
    dependsOn: [EDITORIAL_NARRATIVE_PLAN_CONTRACT],
    lifecycle: {
      fingerprintSources: ["sourceNarrativeFingerprint"],
      reuseWhen: "sourceNarrativeFingerprint matches Narrative",
      staleWhen: "Narrative content fingerprint changes",
    },
    failurePolicy: {
      onGenerateFail: "fail_closed",
      repairAttempts: 2,
      materializeInRepairLoop: false,
    },
  },
  {
    artifactId: NAVER_BLOG_COPY_CONTRACT,
    contractVersion: NAVER_BLOG_COPY_CONTRACT,
    relativePath: NAVER_BLOG_COPY_RELATIVE_PATH,
    producedBy: "naver-blog-copy-writer",
    dependsOn: [NAVER_BLOG_STRUCTURE_PLAN_CONTRACT],
    lifecycle: {
      fingerprintSources: ["sourceStructureFingerprint"],
      reuseWhen: "structure fingerprint matches Blog Structure plan",
      staleWhen: "Blog Structure fingerprint changes",
    },
    failurePolicy: {
      onGenerateFail: "fail_closed",
      repairAttempts: 2,
      materializeInRepairLoop: false,
    },
  },
];

const BY_ID = new Map(MARKETING_ARTIFACT_REGISTRY.map((e) => [e.artifactId, e]));

export function listMarketingArtifactContracts(): readonly MarketingArtifactContract[] {
  return MARKETING_ARTIFACT_REGISTRY;
}

export function getMarketingArtifactContract(
  artifactId: string,
): MarketingArtifactContract | undefined {
  return BY_ID.get(artifactId);
}

export function requireMarketingArtifactContract(artifactId: string): MarketingArtifactContract {
  const entry = getMarketingArtifactContract(artifactId);
  if (!entry) {
    throw new Error(`Unknown marketing artifact contract: ${artifactId}`);
  }
  return entry;
}
