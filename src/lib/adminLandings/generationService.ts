import { createAdminLanding } from "@/lib/adminLandings/service";
import { listLandingGenerationCandidates, toCandidateKey } from "@/lib/adminLandings/generationRepository";
import type {
  LandingGenerationCandidatesResponse,
  LandingGenerationRequestItem,
  LandingGenerationResult,
  LandingGenerationResultEntry,
} from "@/types/adminLanding";

function toSummary(item: {
  taxonomyId: string;
  taxonomyType: "destination" | "theme";
  taxonomyName: string;
  landingId?: string | null;
  landingSlug?: string | null;
  reason?: string;
}): LandingGenerationResultEntry {
  return {
    taxonomyId: item.taxonomyId,
    taxonomyType: item.taxonomyType,
    taxonomyName: item.taxonomyName,
    landingId: item.landingId ?? undefined,
    landingSlug: item.landingSlug ?? undefined,
    reason: item.reason,
  };
}

export async function getLandingGenerationCandidates(input: {
  taxonomyType?: "all" | "destination" | "theme";
  alreadyGenerated?: boolean | null;
}): Promise<LandingGenerationCandidatesResponse> {
  const items = await listLandingGenerationCandidates({
    taxonomyType: input.taxonomyType ?? "all",
    alreadyGenerated: input.alreadyGenerated ?? null,
  });
  return { items, total: items.length };
}

export async function generateLandingsFromTaxonomy(
  items: LandingGenerationRequestItem[],
): Promise<LandingGenerationResult> {
  const candidates = await listLandingGenerationCandidates({
    taxonomyType: "all",
    alreadyGenerated: null,
  });
  const byKey = new Map(candidates.map((candidate) => [toCandidateKey(candidate), candidate]));

  const created: LandingGenerationResultEntry[] = [];
  const skipped: LandingGenerationResultEntry[] = [];
  const failed: LandingGenerationResultEntry[] = [];

  for (const requestItem of items) {
    const key = toCandidateKey(requestItem);
    const candidate = byKey.get(key);
    if (!candidate) {
      failed.push(
        toSummary({
          taxonomyId: requestItem.taxonomyId,
          taxonomyType: requestItem.taxonomyType,
          taxonomyName: requestItem.taxonomyId,
          reason: "CANDIDATE_NOT_FOUND",
        }),
      );
      continue;
    }

    if (candidate.isAlreadyGenerated) {
      skipped.push(
        toSummary({
          taxonomyId: candidate.taxonomyId,
          taxonomyType: candidate.taxonomyType,
          taxonomyName: candidate.taxonomyName,
          landingId: candidate.existingLandingId,
          landingSlug: candidate.existingLandingSlug,
          reason: "ALREADY_EXISTS",
        }),
      );
      continue;
    }

    try {
      const item = await createAdminLanding({
        title: candidate.suggestedTitle,
        slug: candidate.suggestedSlug,
        templateType: candidate.suggestedTemplateType,
        status: "draft",
        summary: `${candidate.taxonomyName} 기준 맞춤 상담 랜딩 초안입니다.`,
        quoteCategory: candidate.suggestedQuoteCategory,
        sourceTaxonomyId: candidate.taxonomyId,
        sourceTaxonomyType: candidate.taxonomyType,
        sourceTaxonomySlug: candidate.taxonomySlug,
        sourcePath: null,
      });
      created.push(
        toSummary({
          taxonomyId: candidate.taxonomyId,
          taxonomyType: candidate.taxonomyType,
          taxonomyName: candidate.taxonomyName,
          landingId: item.id,
          landingSlug: item.slug,
        }),
      );
      // same request batch duplicate guard
      byKey.set(key, { ...candidate, isAlreadyGenerated: true, existingLandingId: item.id, existingLandingSlug: item.slug });
    } catch (error) {
      const message = error instanceof Error ? error.message : "생성 실패";
      if (message.includes("SLUG_CONFLICT") || message.includes("이미 사용 중인 slug")) {
        skipped.push(
          toSummary({
            taxonomyId: candidate.taxonomyId,
            taxonomyType: candidate.taxonomyType,
            taxonomyName: candidate.taxonomyName,
            reason: "SLUG_CONFLICT",
          }),
        );
      } else {
        failed.push(
          toSummary({
            taxonomyId: candidate.taxonomyId,
            taxonomyType: candidate.taxonomyType,
            taxonomyName: candidate.taxonomyName,
            reason: message,
          }),
        );
      }
    }
  }

  return { created, skipped, failed };
}
