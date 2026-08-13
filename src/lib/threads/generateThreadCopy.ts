import "server-only";

import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getGoogleGenerativeAiKey } from "@/lib/admin/ai/importAiModel";
import type { BlogPostViewModel } from "@/lib/blog/blogPost.types";
import {
  threadCopySchema,
  type ThreadCopy,
  type ThreadsMarketingMode,
} from "@/lib/threads/threadCopy.types";

export {
  composeThreadDraft,
  isThreadsMarketingMode,
  THREADS_MARKETING_MODES,
  threadCopySchema,
} from "@/lib/threads/threadCopy.types";
export type { ThreadCopy, ThreadsMarketingMode } from "@/lib/threads/threadCopy.types";

export const DEFAULT_THREADS_AI_MODEL = "gemini-3.6-flash";

const MODE_INSTRUCTIONS: Record<ThreadsMarketingMode, string> = {
  TIMEDEAL:
    "가격, 혜택, 잔여 수량/기간 중심의 실속형 큐레이션. 숫자와 조건을 정확히 쓰고 허위 마감 압박은 하지 마세요.",
  CURATION:
    "부모님/커플/아이 동반 등 특정 타겟 맞춤 테마 랭킹 톤. 누구를 위한 상품인지 한 문장으로 분명히 하세요.",
  SEASONAL_EXPERIENCE:
    "계절, 트렌드, 현지 독점 경험 중심의 유용한 정보. 지금 가기 좋은 이유를 구체적으로 쓰세요.",
};

function resolveThreadsModelId(): string {
  return process.env.THREADS_AI_MODEL?.trim() || DEFAULT_THREADS_AI_MODEL;
}

function resolveThreadsLanguageModel() {
  const apiKey = getGoogleGenerativeAiKey();
  if (!apiKey) {
    throw new Error(
      "스레드 카피 생성용 Google AI 키가 없습니다. GOOGLE_GENERATIVE_AI_API_KEY(또는 GEMINI_API_KEY)를 설정해 주세요.",
    );
  }
  return createGoogleGenerativeAI({ apiKey })(resolveThreadsModelId());
}

function buildProductBrief(product: BlogPostViewModel): string {
  const included = product.includedLines.slice(0, 8).join(" / ") || "(없음)";
  return [
    `상품명: ${product.title}`,
    `한줄소개: ${product.oneLiner || "(없음)"}`,
    `가격: ${product.priceText}`,
    `기간: ${product.durationText}`,
    `지역: ${product.regionText || product.seoRegionKeyword || "(미기재)"}`,
    `컨셉: ${product.concept ?? "일반"}`,
    `포함: ${included}`,
    `상품경로: ${product.productUrlPath}`,
    `대표이미지: ${product.heroImageUrl || "(없음)"}`,
  ].join("\n");
}

export function buildThreadCopySystemPrompt(mode: ThreadsMarketingMode): string {
  return `당신은 더올투어 공식 Threads 마케팅 카피라이터입니다.
규칙:
- 낚시성 제목, 허위 한정, 근거 없는 최저가 주장은 금지합니다.
- 솔직하고 전문성 있는 한국어 대화체로 씁니다.
- mainContent는 150~250자 내외.
- hashtags는 최대 3개, # 기호 없이 단어만.
- callToAction은 댓글로 targetKeyword를 남기도록 유도합니다. 예: "댓글로 [키워드] 남겨주시면 상세 일정표 바로 남겨드릴게요!"
- 상품에 없는 가격·혜택·일정을 만들지 마세요.

이번 마케팅 모드: ${mode}
${MODE_INSTRUCTIONS[mode]}`;
}

export async function generateThreadCopy(
  product: BlogPostViewModel,
  marketingMode: ThreadsMarketingMode,
): Promise<ThreadCopy> {
  const { object } = await generateObject({
    model: resolveThreadsLanguageModel(),
    schema: threadCopySchema,
    system: buildThreadCopySystemPrompt(marketingMode),
    prompt: ["다음 상품 정보로 Threads 카피를 작성하세요.", "", buildProductBrief(product)].join(
      "\n",
    ),
  });
  return object;
}
