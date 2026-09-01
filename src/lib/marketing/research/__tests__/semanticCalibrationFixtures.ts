import type { EmbeddingProvider } from "@/lib/marketing/semantic/types";
import type { ResearchSignal } from "@/lib/marketing/research/types/researchSignal";
import { buildSemanticResearchText } from "@/lib/marketing/research/services/semanticText";

function hashVector(text: string, dimension = 8): number[] {
  const vec = new Array<number>(dimension).fill(0);
  for (let i = 0; i < text.length; i += 1) {
    vec[i % dimension]! += text.charCodeAt(i) / 1000;
  }
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/** Deterministic test embedding provider keyed by semantic text content. */
export type DeterministicEmbeddingProvider = EmbeddingProvider & {
  pinSimilar(textA: string, textB: string): void;
};

export function createDeterministicEmbeddingProvider(dimension = 8): DeterministicEmbeddingProvider {
  const overrides = new Map<string, number[]>();

  const provider: DeterministicEmbeddingProvider = {
    model: "test-deterministic",
    async embed(text: string) {
      if (overrides.has(text)) return overrides.get(text)!;
      return hashVector(text, dimension);
    },
    async embedMany(texts: string[]) {
      return Promise.all(texts.map((text) => provider.embed(text)));
    },
    pinSimilar(textA: string, textB: string) {
      const base = hashVector(textA, dimension);
      overrides.set(textB, base.map((v) => v * 0.99));
    },
  };

  return provider;
}

export function signalFixture(overrides: Partial<ResearchSignal> & Pick<ResearchSignal, "id" | "title" | "summary" | "signalType">): ResearchSignal {
  const now = "2026-09-02T00:00:00.000Z";
  return {
    sourceId: "11111111-1111-4111-8111-111111111101",
    sourceType: "official_government",
    claim: overrides.summary,
    claimSource: "source",
    evidence: [
      {
        id: `${overrides.id}-ev`,
        sourceId: "11111111-1111-4111-8111-111111111101",
        url: "https://example.com/source",
        excerpt: overrides.summary,
        observedAt: now,
        evidenceType: "official_statement",
      },
    ],
    geography: [],
    destinations: overrides.destinations ?? ["thailand"],
    topics: overrides.topics ?? ["visa", "travel"],
    entities: [],
    language: "en",
    observedAt: now,
    publishedAt: overrides.publishedAt ?? "2026-09-01T00:00:00.000Z",
    status: "eligible",
    rawFingerprint: `${overrides.id}-raw`,
    normalizedFingerprint: `${overrides.id}-norm`,
    duplicateOfSignalId: null,
    corroborationCount: 0,
    freshness: {
      observedAt: now,
      publishedAt: overrides.publishedAt ?? "2026-09-01T00:00:00.000Z",
      freshnessScore: 0.9,
    },
    credibility: { score: 0.85, level: "high", reasons: ["official"] },
    travelRelevance: { score: 0.8, reasons: ["travel_topic_keyword"] },
    publicInterestScore: 0.7,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function semanticTextFor(signal: ResearchSignal): string {
  return buildSemanticResearchText(signal);
}

export type CalibrationPairLabel = "same_event" | "related_but_distinct" | "unrelated";

export type CalibrationPairFixture = {
  label: CalibrationPairLabel;
  expectMerge: boolean;
  a: Partial<ResearchSignal> & Pick<ResearchSignal, "id" | "title" | "summary" | "signalType">;
  b: Partial<ResearchSignal> & Pick<ResearchSignal, "id" | "title" | "summary" | "signalType">;
  pinSimilar?: boolean;
};

/** Engineering calibration fixture — not ML training data. */
export const SEMANTIC_CALIBRATION_PAIRS: CalibrationPairFixture[] = [
  {
    label: "same_event",
    expectMerge: true,
    pinSimilar: true,
    a: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaac101",
      title: "Thailand updates entry requirements for travelers",
      summary: "Thailand updates entry requirements for travelers.",
      signalType: "entry_requirement",
      destinations: ["thailand"],
    },
    b: {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbc101",
      title: "New Thailand arrival rules announced for foreign visitors",
      summary: "New Thailand arrival rules announced for foreign visitors.",
      signalType: "entry_requirement",
      destinations: ["thailand"],
      rawFingerprint: "cal-b01-raw",
      normalizedFingerprint: "cal-b01-n",
    },
  },
  {
    label: "related_but_distinct",
    expectMerge: false,
    a: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaac102",
      title: "Thailand entry requirements changed",
      summary: "Thailand entry requirements changed for foreign visitors.",
      signalType: "entry_requirement",
      destinations: ["thailand"],
    },
    b: {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbc102",
      title: "Thailand tourism arrivals hit record high",
      summary: "Thailand tourism arrivals hit record high this quarter.",
      signalType: "destination_trend",
      destinations: ["thailand"],
      rawFingerprint: "cal-b02-raw",
      normalizedFingerprint: "cal-b02-n",
    },
  },
  {
    label: "unrelated",
    expectMerge: false,
    a: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaac103",
      title: "Travel travel travel destination visit journey",
      summary: "Travel travel travel destination visit journey worldwide tourism.",
      signalType: "general_travel_news",
      destinations: ["global"],
      topics: ["travel"],
    },
    b: {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbc103",
      title: "Travel travel travel destination visit journey",
      summary: "Completely different event: airline strike in Europe next week.",
      signalType: "disruption",
      destinations: ["europe"],
      topics: ["travel"],
      rawFingerprint: "cal-b03-raw",
      normalizedFingerprint: "cal-b03-n",
    },
  },
];

export type SemanticCalibrationMetrics = {
  trueMerge: number;
  falseMerge: number;
  missedDuplicate: number;
  precision: number;
  recall: number;
  f1: number;
};

export function evaluateSemanticCalibration(input: {
  pairs: CalibrationPairFixture[];
  mergeDecisions: Map<string, boolean>;
}): SemanticCalibrationMetrics {
  let trueMerge = 0;
  let falseMerge = 0;
  let missedDuplicate = 0;
  let expectedMerge = 0;
  let predictedMerge = 0;

  for (const pair of input.pairs) {
    const key = `${pair.a.id}:${pair.b.id}`;
    const merged = input.mergeDecisions.get(key) ?? false;
    if (pair.expectMerge) {
      expectedMerge += 1;
      if (merged) trueMerge += 1;
      else missedDuplicate += 1;
    } else if (merged) {
      falseMerge += 1;
    }
    if (merged) predictedMerge += 1;
  }

  const precision = predictedMerge === 0 ? 1 : trueMerge / predictedMerge;
  const recall = expectedMerge === 0 ? 1 : trueMerge / expectedMerge;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return { trueMerge, falseMerge, missedDuplicate, precision, recall, f1 };
}
