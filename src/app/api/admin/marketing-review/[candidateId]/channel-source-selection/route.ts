import { requireAdminPermission } from "@/lib/apiAuth";
import { z } from "zod";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { humanReviewErrorResponse } from "@/lib/marketing/review/apiErrors";
import { resolveCanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/persistence";
import { resolveCandidatePackageRoot } from "@/lib/marketing/editorialDirector/researchHandoff/loadResearchHandoffSource";
import {
  listChannelSourceViews,
  listExternalEditorialCandidates,
  selectChannelSource,
} from "@/lib/marketing/publishable/channelSources";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    channel: z.enum(["threads", "shortform", "naver_blog", "naver_band", "kakao_channel", "instagram"]),
    source: z.enum(["hermes_auto", "external_editorial"]),
    importId: z.string().max(64).optional(),
    allowOverwriteHuman: z.boolean().optional(),
  })
  .refine((v) => v.source !== "external_editorial" || Boolean(v.importId), {
    message: "importId required for external_editorial",
  });

type RouteContext = { params: Promise<{ candidateId: string }> };

async function loadContext(candidateId: string) {
  const service = await createHumanMarketingReviewService();
  const detail = await service.getHumanReviewDetail(candidateId);
  if (!detail?.candidate) return { service, detail: null, packageRoot: null } as const;
  return { service, detail, packageRoot: resolveCandidatePackageRoot(detail.candidate) } as const;
}

/** Per-channel current source + imported External Editorial candidates (read-only). */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;
  const { candidateId } = await context.params;
  try {
    const { detail, packageRoot } = await loadContext(candidateId);
    if (!detail) return Response.json({ message: "후보를 찾을 수 없습니다." }, { status: 404 });
    if (!packageRoot) return Response.json({ channels: [], candidates: [] });
    return Response.json({
      channels: listChannelSourceViews(packageRoot, detail.review),
      candidates: listExternalEditorialCandidates(packageRoot).map((c) => ({
        importId: c.importId,
        importedAt: c.importedAt,
        importedBy: c.importedBy,
        canonicalVersion: c.canonicalVersion,
        warnings: c.warnings,
        channelReadiness: c.channelReadiness,
      })),
    });
  } catch (error) {
    return humanReviewErrorResponse(error);
  }
}

/**
 * Select Hermes Auto or an External Editorial candidate for one channel.
 * Rewrites only that channel's slot/sidecars and syncs the review aiDraft.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const { service, detail, packageRoot } = await loadContext(candidateId);
    if (!detail) return Response.json({ message: "후보를 찾을 수 없습니다." }, { status: 404 });
    if (!packageRoot) {
      return Response.json({ message: "마케팅 패키지 폴더가 없습니다.", code: "package_missing" }, { status: 409 });
    }
    const review =
      detail.review ?? (await service.getOrCreateHumanReview(candidateId, auth.session.username ?? "admin"));
    const approvedCanonical = resolveCanonicalMarketingAsset({ candidate: detail.candidate, packageRoot });

    const result = selectChannelSource({
      packageRoot,
      candidateId,
      approvedCanonical,
      channel: parsed.data.channel,
      source: parsed.data.source,
      importId: parsed.data.importId ?? null,
      selectedBy: auth.session.username ?? null,
      allowOverwriteHuman: Boolean(parsed.data.allowOverwriteHuman),
      review,
    });
    if (!result.ok) {
      return Response.json(
        { message: result.messageKo, code: result.code, details: result.details, channel: parsed.data.channel },
        { status: result.status },
      );
    }

    let updatedReview = result.review;
    if (result.reviewChanged) {
      const { createHumanMarketingReviewRepository } = await import(
        "@/lib/marketing/review/repository/createHumanMarketingReviewRepository"
      );
      const repo = await createHumanMarketingReviewRepository();
      updatedReview = await repo.update(result.review);
    }

    return Response.json({
      review: updatedReview,
      channel: parsed.data.channel,
      changed: result.changed,
      view: result.view,
      warnings: result.warnings,
      message: result.changed
        ? parsed.data.source === "external_editorial"
          ? "외부 편집 결과로 전환했습니다. 시각 계획(SVP/VRA)은 stale 상태가 됩니다."
          : "Hermes Auto 결과로 복원했습니다. 시각 계획(SVP/VRA)은 stale 상태가 됩니다."
        : "이미 Hermes Auto 결과가 적용되어 있습니다.",
    });
  } catch (error) {
    return humanReviewErrorResponse(error);
  }
}
