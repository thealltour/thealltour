import type { LandingTaxonomyType } from "@/types/adminLanding";

export type BuildLandingDraftCopyInput = {
  taxonomyName: string;
  taxonomyType: LandingTaxonomyType;
  suggestedSlug: string;
  suggestedSourcePath?: string | null;
  suggestedQuoteCategory?: string | null;
};

export type LandingSectionBlockCopy = {
  title: string;
  description: string;
  body: string;
};

/** hero / intro / cta / consulting_points 시드용 (FAQ는 템플릿에서 라벨만 치환) */
export type LandingSectionDraftCopy = {
  hero: LandingSectionBlockCopy;
  intro: LandingSectionBlockCopy;
  cta: LandingSectionBlockCopy;
  consultingPoints: LandingSectionBlockCopy;
};

export type LandingDraftCopy = {
  /** 목록·메타용 짧은 제목 (히어로 헤드라인과 별도) */
  title: string;
  summary: string;
  seoTitle: string;
  seoDescription: string;
  sourcePath: string;
  quoteCategory: string;
  sections: LandingSectionDraftCopy;
};

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function rootSlugFromLandingSlug(slug: string): string {
  const s = normalizeSlug(slug);
  if (!s) return "";
  return s.endsWith("-travel") ? s.slice(0, -"-travel".length) : s;
}

function nonEmptyDisplayName(name: string, slug: string): string {
  const t = name.trim();
  if (t) return t;
  const fromSlug = rootSlugFromLandingSlug(slug).replace(/-/g, " ").trim();
  if (fromSlug) return fromSlug;
  return "여행";
}

const CTA_BODY =
  "상품을 둘러보신 뒤 맞춤 상담을 요청하시면\n일정과 예산에 맞춰 여행을 설계해드립니다.";

const CONSULTING_BODY =
  "항공, 숙소, 이동 동선, 일정 구성까지 함께 고려해\n실제 여행에 맞는 구성을 안내합니다.";

/**
 * taxonomy 상담형 랜딩 기본 섹션 문구 (수동 생성 시 templates에서도 동일 규칙 사용)
 */
export function buildConsultingSectionCopyForLabel(
  label: string,
  taxonomyType: "destination" | "theme" | "product_line",
): LandingSectionDraftCopy {
  const name = label.trim() || "여행";

  const ctaTitle = `${name} 여행 상담 신청`;
  const ctaDescription = "상품을 먼저 살펴보신 뒤 맞춤 상담을 요청해 보세요.";

  if (taxonomyType === "destination") {
    return {
      hero: {
        title: `${name} 여행 상품을 먼저 확인해보세요`,
        description: `${name} 여행은 일정, 예산, 지역에 따라 추천 구성이 달라집니다.`,
        body: "마음에 드는 상품이 없다면 맞춤 상담으로 여행을 함께 설계해드립니다.",
      },
      intro: {
        title: `${name} 여행 안내`,
        description: "",
        body: `${name} 여행은 지역과 일정에 따라 추천 구성이 달라집니다.\n추천 상품을 먼저 살펴보신 뒤, 원하시는 조건이 없다면 상담으로 이어가세요.`,
      },
      cta: {
        title: ctaTitle,
        description: ctaDescription,
        body: CTA_BODY,
      },
      consultingPoints: {
        title: `${name} 여행 체크 포인트`,
        description: "동선·일정을 기준으로 구체적으로 짚어드립니다.",
        body: CONSULTING_BODY,
      },
    };
  }

  if (taxonomyType === "theme") {
    return {
      hero: {
        title: `${name} 테마 여행 상품을 먼저 확인해보세요`,
        description: `${name} 테마 여행은 일정, 예산, 스타일에 따라 추천 구성이 달라집니다.`,
        body: "마음에 드는 상품이 없다면 맞춤 상담으로 여행을 함께 설계해드립니다.",
      },
      intro: {
        title: `${name} 여행 안내`,
        description: "",
        body: `${name} 테마 여행은 지역과 일정에 따라 추천 구성이 달라집니다.\n추천 상품을 먼저 살펴보신 뒤, 원하시는 조건이 없다면 상담으로 이어가세요.`,
      },
      cta: {
        title: ctaTitle,
        description: ctaDescription,
        body: CTA_BODY,
      },
      consultingPoints: {
        title: `${name} 여행 체크 포인트`,
        description: "테마에 맞는 동선·일정을 기준으로 정리합니다.",
        body: CONSULTING_BODY,
      },
    };
  }

  return {
    hero: {
      title: `${name} 여행 상품을 먼저 확인해보세요`,
      description: `${name} 상품은 일정, 예산, 포함 조건에 따라 구성이 달라집니다.`,
      body: "마음에 드는 상품이 없다면 맞춤 상담으로 여행을 함께 설계해드립니다.",
    },
    intro: {
      title: `${name} 상품 안내`,
      description: "",
      body: `${name} 상품은 일정과 포함 조건에 따라 추천이 달라집니다.\n추천 상품을 먼저 살펴보신 뒤, 원하시는 조건이 없다면 상담으로 이어가세요.`,
    },
    cta: {
      title: ctaTitle,
      description: ctaDescription,
      body: CTA_BODY,
    },
    consultingPoints: {
      title: `${name} 선택 포인트`,
      description: "포함·일정 기준으로 구체적으로 짚어드립니다.",
      body: CONSULTING_BODY,
    },
  };
}

function metaForType(
  name: string,
  taxonomyType: LandingTaxonomyType,
): { summary: string; seoTitle: string; seoDescription: string } {
  switch (taxonomyType) {
    case "destination":
      return {
        summary: `${name} 추천 여행 상품을 먼저 확인해 보세요. 원하는 조건이 있으면 일정·예산에 맞춰 상담으로 이어가실 수 있습니다.`,
        seoTitle: `${name} 여행 상품 | 추천 일정`,
        seoDescription: `${name} 여행 상품을 살펴보고, 일정과 예산에 맞는 구성은 맞춤 상담으로 확인해 보세요.`,
      };
    case "theme":
      return {
        summary: `${name} 테마 추천 상품을 먼저 확인해 보세요. 스타일·일정에 맞는 구성은 상담으로 이어가실 수 있습니다.`,
        seoTitle: `${name} 테마 여행 상품 | 추천`,
        seoDescription: `${name} 테마 여행 상품을 살펴보고, 원하는 일정·예산은 맞춤 상담으로 확인해 보세요.`,
      };
    case "product_line":
      return {
        summary: `${name} 상품을 먼저 확인해 보세요. 포함 조건·일정에 맞는 선택은 상담으로 이어가실 수 있습니다.`,
        seoTitle: `${name} 여행 상품 | 일정·포함 안내`,
        seoDescription: `${name} 상품을 살펴보고, 일정과 포함 조건에 맞는 구성은 맞춤 상담으로 확인해 보세요.`,
      };
  }
}

export function buildLandingDraftCopy(input: BuildLandingDraftCopyInput): LandingDraftCopy {
  const slug = normalizeSlug(input.suggestedSlug);
  const name = nonEmptyDisplayName(input.taxonomyName, slug);

  const quoteFromSuggested = String(input.suggestedQuoteCategory ?? "").trim();
  const quoteCategory = quoteFromSuggested || rootSlugFromLandingSlug(slug) || slug || "landing";

  const pathFromSuggested = String(input.suggestedSourcePath ?? "").trim();
  const sourcePath =
    pathFromSuggested || (slug ? `/recommended/${encodeURIComponent(slug)}` : "/recommended");

  const sections = buildConsultingSectionCopyForLabel(name, input.taxonomyType);

  const title = `${name} 여행 상품`;

  const { summary, seoTitle, seoDescription } = metaForType(name, input.taxonomyType);

  return {
    title,
    summary,
    seoTitle,
    seoDescription,
    sourcePath,
    quoteCategory,
    sections,
  };
}
