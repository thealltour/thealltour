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
    "[긴급성+올포함 실속] 취소석·이 가격에 이 구성은 당분간 없음처럼 긴박감을 쓰되, 상품에 없는 잔여 수량·마감 숫자는 만들지 마세요. 왕복·호텔·그린피 등 실제 포함만 불렛으로 보여 주세요.",
  CURATION:
    "[타겟 명확화+저장 욕구] 부모님 환갑/칠순, 커플, 아이 동반 등 누구를 위한 추천인지 한 방에 박히게. '이거 보내드리면 100점'처럼 저장하고 싶은 한 줄을 넣으세요.",
  SEASONAL_EXPERIENCE:
    "[시의성+현지 독점 경험] 지금 이 시기에만 볼 수 있는 현지 장관·제철 경험을 중심에 두세요. 계절·트렌드를 구체적으로 쓰고 일반 카탈로그 안내는 피하세요.",
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
  return `너는 스레드(Threads)에서 가장 반응률이 높은 2030 대표 여행 전문 에디터야.
목표는 유저가 피드를 내리다가 3초 만에 읽고, 당장 댓글로 키워드를 적게 만드는 스레드 카피를 쓰는 거야.
카탈로그체·딱딱한 안내문은 금지. 여행 덕후 마케터가 친한 유저에게 말하듯, 친근하고 군더더기 없이 써.

[핵심 작성 원칙]
1. 분량:
   - mainContent는 CTA·해시태그 제외, 불렛·개행 포함 150~200자 내외.
   - 빼곡한 장문 절대 금지.

2. mainContent 4블록 구조 (블록 사이는 반드시 빈 줄 \\n\\n):
   - [1줄 훅] 핵심 혜택을 한 방에. 이모지 0~1개 가능.
   - [1문장] 올포함·구성을 구어체로.
   - [불렛] 핵심 혜택/포함을 기호(•) 2~3개. 상품 정보에 있는 포함만.
   - [한 줄] 추천 또는 긴박감. 예: 이 조합은 진짜 보기 힘듦
   - callToAction은 별도 필드. 본문에 CTA를 넣지 마.

3. 댓글 유도(CTA):
   - callToAction 필드에만 작성하고, targetKeyword를 반드시 포함해.
   - 단순 안내("일정표를 전해드릴게요") 금지.
   - 기본 형식: 댓글로 **[targetKeyword]** 남겨주시면 3초 만에 상세 일정표+할인 링크 쏴드릴게요!
   - 선착순 쿠폰·쿠폰 금액·자동 발송은 상품 정보에 근거가 있을 때만. 없으면 위 기본 형식만 사용해.

4. 낚시글 금지:
   - 실체 없는 자극적 거짓 떡밥, 허위 한정, 근거 없는 최저가 금지.
   - 상품에 없는 가격·좌석 수·혜택·일정을 만들지 마.
   - 확실한 장점만 솔직하게 언급해.

5. hashtags는 최대 3개, # 기호 없이 단어만.

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
