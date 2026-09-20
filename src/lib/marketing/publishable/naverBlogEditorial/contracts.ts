/**
 * Naver Blog editorial split — Structure Planner + Copy Writer.
 */

export const NAVER_BLOG_STRUCTURE_PLAN_CONTRACT = "naver-blog-structure-plan-v1" as const;
export const NAVER_BLOG_COPY_CONTRACT = "naver-blog-copy-v1" as const;

export const NAVER_BLOG_STRUCTURE_PLANNER_HERMES_PROFILE =
  "naver-blog-structure-planner" as const;
export const NAVER_BLOG_COPY_WRITER_HERMES_PROFILE = "naver-blog-copy-writer" as const;

export const NAVER_BLOG_SECTION_PURPOSES = [
  "opening",
  "context",
  "evidence",
  "detail",
  "contrast",
  "limitation",
  "closing",
  "faq_support",
] as const;

export type NaverBlogSectionPurpose = (typeof NAVER_BLOG_SECTION_PURPOSES)[number];

export const NAVER_BLOG_TARGET_DEPTHS = ["brief", "standard", "deep"] as const;
export type NaverBlogTargetDepth = (typeof NAVER_BLOG_TARGET_DEPTHS)[number];

export type NaverBlogEditorialProvenance = {
  sourceAssetId: string;
  sourceVersion: number;
  modelProfile: string;
  generatedAt: string;
  sourceUpstreamFingerprint: string;
};

export type NaverBlogStructureSection = {
  sectionId: string;
  purpose: NaverBlogSectionPurpose;
  heading: string;
  narrativeBeatRefs: string[];
  evidenceRefs: string[];
  targetDepth: NaverBlogTargetDepth;
};

export type NaverBlogStructurePlan = {
  contract: typeof NAVER_BLOG_STRUCTURE_PLAN_CONTRACT;
  assetId: string;
  assetVersion: number;
  titleStrategy: string;
  selectedTitle: string;
  titleCandidates: string[];
  sectionPlan: NaverBlogStructureSection[];
  openingIntent: string;
  conclusionIntent: string;
  ctaIntent: string | null;
  faqPlan: Array<{ question: string; answerability: "supported" | "unsupported" }>;
  searchIntent: string | null;
  primaryTopic: string;
  evidenceCoverage: string;
  sourceNarrativeFingerprint: string;
  provenance: NaverBlogEditorialProvenance;
};

export type NaverBlogSectionOutput = {
  sectionId: string;
  heading: string;
  bodyMarkdown: string;
};

export type NaverBlogCopy = {
  contract: typeof NAVER_BLOG_COPY_CONTRACT;
  assetId: string;
  assetVersion: number;
  title: string;
  bodyMarkdown: string;
  sectionOutputs: NaverBlogSectionOutput[];
  faq: Array<{ question: string; answer: string }>;
  cta: string | null;
  evidenceRefs: string[];
  sourceStructureFingerprint: string;
  provenance: NaverBlogEditorialProvenance;
};
