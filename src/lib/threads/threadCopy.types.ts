import { z } from "zod";

export const THREADS_MARKETING_MODES = ["TIMEDEAL", "CURATION", "SEASONAL_EXPERIENCE"] as const;
export type ThreadsMarketingMode = (typeof THREADS_MARKETING_MODES)[number];

export const threadCopySchema = z.object({
  mainContent: z
    .string()
    .min(80)
    .max(500)
    .describe(
      "150~200자 내외. 2~3문장마다 빈 줄, 핵심 혜택은 • 불렛 2~3개. 친근한 구어체. 낚시성 과장 금지.",
    ),
  targetKeyword: z
    .string()
    .min(1)
    .max(40)
    .describe("댓글 자동 감지용 핵심 단어. 예: 동유럽, 발리, 효도"),
  hashtags: z
    .array(z.string().min(1).max(30))
    .max(3)
    .describe("해시태그. # 없이 단어만, 최대 3개"),
  callToAction: z
    .string()
    .min(8)
    .max(160)
    .describe(
      "댓글로 [targetKeyword] 남겨주시면 3초 만에 상세 일정표 바로 쏘아드릴게요! 형태의 반응 유도. targetKeyword 필수.",
    ),
});

export type ThreadCopy = z.infer<typeof threadCopySchema>;

export function isThreadsMarketingMode(value: unknown): value is ThreadsMarketingMode {
  return (
    typeof value === "string" &&
    (THREADS_MARKETING_MODES as readonly string[]).includes(value)
  );
}

export function composeThreadDraft(copy: ThreadCopy): string {
  const tags = copy.hashtags
    .map((tag) => tag.trim().replace(/^#+/, ""))
    .filter(Boolean)
    .map((tag) => `#${tag}`)
    .join(" ");
  return [copy.mainContent.trim(), tags, copy.callToAction.trim()].filter(Boolean).join("\n\n");
}
