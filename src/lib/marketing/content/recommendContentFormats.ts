import type {
  CommercialIntent,
  ContentAssignment,
  ContentFormatKind,
  ContentFormatRecommendation,
} from "@/lib/marketing/content/types";

type FormatSignals = {
  commercialIntent: CommercialIntent;
  destinationCount: number;
  factCount: number;
  hasOfficialEvidence: boolean;
  urgency: "low" | "normal" | "high";
  channel?: string;
};

function scoreFormat(
  format: ContentFormatKind,
  signals: FormatSignals,
): ContentFormatRecommendation | null {
  switch (format) {
    case "threads_text": {
      let score = 0.55;
      const rationale: string[] = [];
      if (signals.urgency === "high") {
        score += 0.2;
        rationale.push("timely topic suits short-form");
      }
      if (signals.factCount <= 4) {
        score += 0.1;
        rationale.push("moderate information density");
      }
      if (signals.commercialIntent !== "commercial") {
        score += 0.05;
        rationale.push("informational angle fits concise text");
      }
      return { format, score: Math.min(1, score), rationale: rationale.join("; ") || "default short-form" };
    }
    case "instagram_carousel": {
      let score = 0.45;
      const rationale: string[] = [];
      if (signals.destinationCount >= 1) {
        score += 0.15;
        rationale.push("destination imagery value");
      }
      if (signals.factCount >= 3) {
        score += 0.1;
        rationale.push("multiple facts suit carousel structure");
      }
      if (signals.commercialIntent === "commercial" || signals.commercialIntent === "mixed") {
        score += 0.05;
        rationale.push("visual product linkage possible");
      }
      return { format, score: Math.min(1, score), rationale: rationale.join("; ") || "visual storytelling" };
    }
    case "blog_article": {
      let score = 0.4;
      const rationale: string[] = [];
      if (signals.factCount >= 4) {
        score += 0.2;
        rationale.push("high information density");
      }
      if (signals.hasOfficialEvidence) {
        score += 0.1;
        rationale.push("official evidence supports long-form explanation");
      }
      if (signals.commercialIntent === "informational") {
        score += 0.1;
        rationale.push("informational depth without hard sell");
      }
      return { format, score: Math.min(1, score), rationale: rationale.join("; ") || "long-form usefulness" };
    }
    case "short_video_concept": {
      let score = 0.35;
      const rationale: string[] = [];
      if (signals.destinationCount >= 1 && signals.urgency !== "low") {
        score += 0.15;
        rationale.push("destination visual hook");
      }
      if (signals.factCount <= 3) {
        score += 0.05;
        rationale.push("simple narrative arc");
      }
      return { format, score: Math.min(1, score), rationale: rationale.join("; ") || "concept-only in this step" };
    }
    default:
      return null;
  }
}

const ALL_FORMATS: ContentFormatKind[] = [
  "threads_text",
  "instagram_carousel",
  "blog_article",
  "short_video_concept",
];

export function recommendContentFormats(input: {
  commercialIntent: CommercialIntent;
  destinations: string[];
  factsCount: number;
  evidenceRefs: ContentAssignment["evidenceRefs"];
  urgency: "low" | "normal" | "high";
  channel?: string;
}): ContentFormatRecommendation[] {
  const signals: FormatSignals = {
    commercialIntent: input.commercialIntent,
    destinationCount: input.destinations.length,
    factCount: input.factsCount,
    hasOfficialEvidence: input.evidenceRefs.some((ref) => ref.isOfficial),
    urgency: input.urgency,
    channel: input.channel,
  };

  const ranked = ALL_FORMATS.map((format) => scoreFormat(format, signals))
    .filter((item): item is ContentFormatRecommendation => item != null)
    .sort((a, b) => b.score - a.score);

  if (input.channel === "threads") {
    const threads = ranked.find((item) => item.format === "threads_text");
    if (threads) threads.score = Math.min(1, threads.score + 0.05);
    ranked.sort((a, b) => b.score - a.score);
  }

  return ranked.slice(0, 4);
}
