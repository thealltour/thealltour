import type { ManagerToContentHandoffResult } from "@/lib/marketing/content/types";
import type { ResearchBriefEditorialIntelligence } from "@/lib/marketing/research/types/editorialIntelligence";

export type ResearchQueryPurpose =
  | "factual_verification"
  | "audience_questions"
  | "competitor_content_gap";

export type ResearchQueryPlanItem = {
  query: string;
  purpose: ResearchQueryPurpose;
  language: "ko" | "en";
};

export type ResearchQueryPlan = {
  queries: ResearchQueryPlanItem[];
  maxQueries: number;
};

const DEFAULT_MAX_QUERIES = 6;

function uniqQueries(items: ResearchQueryPlanItem[], max: number): ResearchQueryPlanItem[] {
  const seen = new Set<string>();
  const out: ResearchQueryPlanItem[] = [];
  for (const item of items) {
    const key = item.query.replace(/\s+/g, " ").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...item, query: item.query.replace(/\s+/g, " ").trim() });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Bounded query plan from agenda + Meta seeds — not keyword spam.
 */
export function buildResearchQueryPlan(input: {
  handoff: ManagerToContentHandoffResult;
  editorial?: ResearchBriefEditorialIntelligence | null;
  maxQueries?: number;
}): ResearchQueryPlan {
  const maxQueries = input.maxQueries ?? DEFAULT_MAX_QUERIES;
  const title = input.handoff.selectedAgenda.title;
  const summary = input.handoff.selectedAgenda.summary;
  const destinations = input.handoff.selectedAgenda.destinations ?? [];
  const topics = input.handoff.selectedAgenda.topics ?? [];
  const entities = input.handoff.selectedAgenda.entities ?? [];
  const blob = `${title} ${summary} ${destinations.join(" ")} ${topics.join(" ")} ${entities.join(" ")}`;

  const hasCruise = /크루즈|cruise/i.test(blob);
  const hasBusan = /부산|busan/i.test(blob);
  const hasBoarding = /탑승|동선|터미널|출항|boarding/i.test(blob);
  const hasChuseok = /추석|연휴/i.test(blob);
  const entityHint = entities[0]?.trim() || (hasCruise ? "MSC" : "");

  const planned: ResearchQueryPlanItem[] = [];

  if (hasCruise && hasBusan) {
    planned.push({
      query: entityHint
        ? `${entityHint} 부산 출항 공식`
        : "부산 출발 크루즈 공식 안내",
      purpose: "factual_verification",
      language: "ko",
    });
    planned.push({
      query: "부산항 크루즈 터미널 공식",
      purpose: "factual_verification",
      language: "ko",
    });
  } else if (destinations[0]) {
    planned.push({
      query: `${destinations[0]} ${topics[0] ?? title.slice(0, 20)} 공식 안내`,
      purpose: "factual_verification",
      language: "ko",
    });
  }

  if (hasBoarding || hasCruise) {
    planned.push({
      query: hasBusan ? "부산 출발 크루즈 처음 탑승 준비" : "크루즈 처음 탑승 준비",
      purpose: "audience_questions",
      language: "ko",
    });
  }
  if (hasChuseok && hasCruise) {
    planned.push({
      query: "추석 연휴 크루즈 여행 준비",
      purpose: "audience_questions",
      language: "ko",
    });
  }
  planned.push({
    query: hasBusan ? "부모님 부산 크루즈 여행" : `${title.slice(0, 24)} 처음`,
    purpose: "audience_questions",
    language: "ko",
  });

  if (hasCruise && hasBusan) {
    planned.push({
      query: entityHint ? `${entityHint} 부산 후기` : "부산 출발 크루즈 후기",
      purpose: "competitor_content_gap",
      language: "ko",
    });
  } else {
    planned.push({
      query: `${title.slice(0, 28)} 후기`,
      purpose: "competitor_content_gap",
      language: "ko",
    });
  }

  for (const q of input.editorial?.audienceQuestions?.slice(0, 2) ?? []) {
    const cleaned = q.replace(/[?？]/g, "").trim();
    if (cleaned.length >= 4) {
      planned.push({
        query: cleaned.slice(0, 48),
        purpose: "audience_questions",
        language: "ko",
      });
    }
  }

  return {
    queries: uniqQueries(planned, maxQueries),
    maxQueries,
  };
}
