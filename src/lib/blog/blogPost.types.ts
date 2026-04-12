import type { TimelineModel } from "@/lib/products/mapProductToTimelineModel";

/** PR-BLOG-9: 동일 상품 기준 3종 톤(정보형 / 특가형 / 비교형) */
export type BlogPostType = "info" | "deal" | "compare";

export type BlogPostsThreePack = Record<BlogPostType, string>;

/**
 * 블로그 plain text 조립 전용 ViewModel.
 * 스마트스토어 HTML ViewModel·safety/meta 구조와 분리.
 */
export type BlogPostViewModel = {
  productId: string;
  title: string;
  oneLiner: string;
  priceText: string;
  durationText: string;
  regionText?: string;
  /** PR-BLOG-6: 제목·도입·CTA용 지역 키워드(상품 메타에서 추출, 없으면 미설정) */
  seoRegionKeyword?: string;
  categoryText?: string;
  minDeparturePeopleText?: string;
  fuelIncludedText?: string;
  includedLines: string[];
  excludedLines: string[];
  optionalLines: string[];
  bookingConditionLines: string[];
  bookingNotesLines: string[];
  travelNotesLines: string[];
  refundPolicyLines: string[];
  timeline: TimelineModel;
  recommendedTargetLines: string[];
  /** 내부 참조용 (상대 경로) */
  productUrlPath: string;
  /** 텍스트 본문에는 넣지 않아도 되는 메타 */
  heroImageUrl?: string;
  /**
   * PR-BLOG-4: 제목·CTA 후보는 `buildBlogPostWithMeta` 결과에 포함됩니다.
   * `mapProductToBlogPostViewModel` 입력 경로에서는 설정하지 않습니다.
   */
  titleCandidates?: string[];
  ctaCandidates?: string[];
};

export type BlogPostBuildMeta = {
  title: string;
  characterCount: number;
  sectionCount: number;
  hasTimelineSummary: boolean;
  hasIncludedSection: boolean;
  hasNoticeSection: boolean;
};

export type BlogPostBuildResult = {
  text: string;
  meta: BlogPostBuildMeta;
  titleCandidates: string[];
  ctaCandidates: string[];
};

export type BlogPostApiResponse =
  | {
      ok: true;
      posts: BlogPostsThreePack;
      metaByType: Record<BlogPostType, BlogPostBuildMeta>;
      titleCandidatesByType: Record<BlogPostType, string[]>;
      ctaCandidates: string[];
    }
  | { ok: false; message: string };
