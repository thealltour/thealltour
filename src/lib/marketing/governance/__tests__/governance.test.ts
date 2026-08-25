import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseContentGovernanceCliArgs } from "@/lib/marketing/governance/cli";
import { combineGovernanceSignals } from "@/lib/marketing/governance/combineGovernanceSignals";
import {
  GOVERNANCE_ALLOW_MAX_RISK,
  GOVERNANCE_BLOCK_MIN_RISK,
  GOVERNANCE_REVIEW_MAX_RISK,
  GOVERNANCE_REVIEW_MIN_RISK,
  GOVERNANCE_SEMANTIC_REVIEW_MATCH,
  GOVERNANCE_SEMANTIC_STRONG_MATCH,
} from "@/lib/marketing/governance/constants";
import { evaluateContentGovernance } from "@/lib/marketing/governance/evaluateContentGovernance";
import { emptyAgendaStats } from "@/lib/marketing/governance/evaluators";
import { GovernanceValidationError } from "@/lib/marketing/governance/errors";
import {
  governanceContentHash,
  governanceNormalizedHash,
  normalizedGovernanceText,
} from "@/lib/marketing/governance/hashes";
import type { GovernanceLookups } from "@/lib/marketing/governance/lookups";
import type {
  GovernanceAgendaStats,
  GovernanceCandidate,
  GovernanceChannelStats,
  GovernanceMatchedMemory,
} from "@/lib/marketing/governance/types";
import type { SemanticMemoryMatch, SemanticRetrievalResult } from "@/lib/marketing/semantic/types";

const CONTENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AGENDA_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const AGENDA_ID_B = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = new Date("2026-08-25T00:00:00.000Z");

function candidate(overrides: Partial<GovernanceCandidate> = {}): GovernanceCandidate {
  return {
    title: "효도여행 일정",
    body: "부모님과 함께 떠나는 스페인 10일 일정입니다.",
    channel: "threads",
    agendaId: AGENDA_ID,
    ...overrides,
  };
}

function channelStats(overrides: Partial<GovernanceChannelStats> = {}): GovernanceChannelStats {
  return {
    channel: "threads",
    dailyCount: 0,
    dailyMax: 3,
    cooldownDays: 7,
    sameAgendaRecentCount: 0,
    ...overrides,
  };
}

function agendaStats(overrides: Partial<GovernanceAgendaStats> = {}): GovernanceAgendaStats {
  return {
    ...emptyAgendaStats(),
    agendaId: AGENDA_ID,
    agendaKey: "filial-trip",
    ...overrides,
  };
}

function memoryMatch(overrides: Partial<GovernanceMatchedMemory> = {}): GovernanceMatchedMemory {
  return {
    memoryId: "mem-1",
    contentId: CONTENT_ID,
    score: 0.84,
    title: "효도여행",
    channels: ["threads"],
    agendaId: AGENDA_ID,
    ...overrides,
  };
}

function semanticMatch(overrides: Partial<SemanticMemoryMatch> = {}): SemanticMemoryMatch {
  return {
    memoryId: "mem-1",
    score: 0.84,
    memory: {
      id: "mem-1",
      memoryType: "content_knowledge",
      title: "효도여행",
      content: "본문",
      sourceType: "ai_content",
      sourceId: CONTENT_ID,
    },
    source: { sourceType: "memory", sourceTable: "ai_memory", sourceId: "mem-1" },
    ...overrides,
  };
}

function lookups(overrides: Partial<GovernanceLookups> = {}): GovernanceLookups {
  return {
    findByContentHash: async () => null,
    findByNormalizedHash: async () => null,
    retrieveSimilar: async () => ({ status: "ok", matches: [] }),
    loadAgendaStats: async () => agendaStats(),
    loadChannelStats: async () => channelStats(),
    loadMatchedMemories: async (matches) =>
      matches.map((match) => ({
        memoryId: match.memoryId,
        contentId: match.memory.sourceId,
        score: match.score,
        title: match.memory.title,
        channels: ["threads"],
        agendaId: AGENDA_ID,
      })),
    ...overrides,
  };
}

async function evaluate(
  input: Partial<GovernanceCandidate> = {},
  lookupOverrides: Partial<GovernanceLookups> = {},
) {
  return evaluateContentGovernance(candidate(input), { now: NOW, lookups: lookups(lookupOverrides) });
}

describe("governance hashes", () => {
  it("uses the same exact hash for identical title and body", () => {
    expect(governanceContentHash("효도", "본문")).toBe(governanceContentHash("효도", "본문"));
    expect(governanceContentHash("효도", "본문")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("treats punctuation-only changes as the same normalized hash", () => {
    expect(normalizedGovernanceText("hello, world!")).toBe("hello world");
    expect(governanceNormalizedHash("효도", "본문!")).toBe(governanceNormalizedHash("효도", "본문"));
    expect(governanceContentHash("효도", "본문!")).not.toBe(governanceContentHash("효도", "본문"));
  });
});

describe("exact and normalized duplicate", () => {
  it("blocks identical content", async () => {
    const result = await evaluate({}, { findByContentHash: async () => CONTENT_ID });
    expect(result.decision).toBe("BLOCK");
    expect(result.reasons.map((reason) => reason.code)).toContain("EXACT_DUPLICATE");
    expect(result.riskScore).toBeGreaterThanOrEqual(GOVERNANCE_BLOCK_MIN_RISK);
  });

  it("blocks punctuation-only duplicates via normalized hash", async () => {
    const result = await evaluate({}, { findByNormalizedHash: async () => CONTENT_ID });
    expect(result.decision).toBe("BLOCK");
    expect(result.reasons.map((reason) => reason.code)).toContain("NORMALIZED_DUPLICATE");
  });

  it("does not block a hash match on the same sourceContentId", async () => {
    const result = await evaluate(
      { sourceContentId: CONTENT_ID },
      { findByContentHash: async () => CONTENT_ID, findByNormalizedHash: async () => CONTENT_ID },
    );
    expect(result.reasons.map((reason) => reason.code)).not.toContain("EXACT_DUPLICATE");
    expect(result.reasons.map((reason) => reason.code)).not.toContain("NORMALIZED_DUPLICATE");
  });
});

describe("semantic similarity decisions", () => {
  it("blocks high similarity with the same agenda and a recent same-channel post", async () => {
    const result = await evaluate(
      {},
      {
        retrieveSimilar: async () => ({ status: "ok", matches: [semanticMatch()] }),
        loadMatchedMemories: async () => [memoryMatch({ score: GOVERNANCE_SEMANTIC_STRONG_MATCH + 0.02 })],
        loadAgendaStats: async () => agendaStats({ publicationsLast7Days: 1 }),
      },
    );
    expect(result.decision).toBe("BLOCK");
    expect(result.reasons.map((reason) => reason.code)).toContain("SEMANTIC_SIMILARITY_HIGH");
    expect(result.riskScore).toBeGreaterThanOrEqual(GOVERNANCE_BLOCK_MIN_RISK);
  });

  it("reviews high similarity when the agenda differs", async () => {
    const result = await evaluate(
      { agendaId: AGENDA_ID_B },
      {
        retrieveSimilar: async () => ({ status: "ok", matches: [semanticMatch()] }),
        loadMatchedMemories: async () => [
          memoryMatch({ score: 0.86, agendaId: AGENDA_ID, channels: ["instagram"] }),
        ],
      },
    );
    expect(result.decision).toBe("REVIEW");
    expect(result.reasons.map((reason) => reason.code)).toContain("SEMANTIC_SIMILARITY_HIGH");
    expect(result.riskScore).toBeGreaterThanOrEqual(GOVERNANCE_REVIEW_MIN_RISK);
    expect(result.riskScore).toBeLessThanOrEqual(GOVERNANCE_REVIEW_MAX_RISK);
  });

  it("reviews medium similarity", async () => {
    const result = await evaluate(
      {},
      {
        retrieveSimilar: async () => ({ status: "ok", matches: [semanticMatch({ score: 0.74 })] }),
        loadMatchedMemories: async () => [
          memoryMatch({ score: GOVERNANCE_SEMANTIC_REVIEW_MATCH + 0.04, channels: ["instagram"] }),
        ],
      },
    );
    expect(result.decision).toBe("REVIEW");
    expect(result.reasons.map((reason) => reason.code)).toContain("SEMANTIC_SIMILARITY_REVIEW");
  });

  it("allows low similarity with no other history", async () => {
    const result = await evaluate(
      { agendaId: null },
      {
        loadAgendaStats: async () => emptyAgendaStats(),
        retrieveSimilar: async () => ({ status: "ok", matches: [] }),
      },
    );
    expect(result.decision).toBe("ALLOW");
    expect(result.reasons.map((reason) => reason.code)).toContain("NO_RISK_SIGNAL");
    expect(result.riskScore).toBeLessThanOrEqual(GOVERNANCE_ALLOW_MAX_RISK);
  });
});

describe("agenda and channel frequency", () => {
  it("reviews a recent agenda repeat and blocks overuse", async () => {
    const review = await evaluate({}, { loadAgendaStats: async () => agendaStats({ publicationsLast7Days: 2 }) });
    expect(review.decision).toBe("REVIEW");
    expect(review.reasons.map((reason) => reason.code)).toContain("AGENDA_RECENT_REPEAT");

    const blocked = await evaluate({}, { loadAgendaStats: async () => agendaStats({ publicationsLast7Days: 3 }) });
    expect(blocked.decision).toBe("BLOCK");
    expect(blocked.reasons.map((reason) => reason.code)).toContain("AGENDA_OVERUSED");
  });

  it("blocks when the channel daily max is already reached", async () => {
    const result = await evaluate({}, { loadChannelStats: async () => channelStats({ dailyCount: 3, dailyMax: 3 }) });
    expect(result.decision).toBe("BLOCK");
    expect(result.reasons.map((reason) => reason.code)).toContain("CHANNEL_DAILY_LIMIT");
  });

  it("allows a normal channel count", async () => {
    const result = await evaluate(
      { agendaId: null },
      {
        loadAgendaStats: async () => emptyAgendaStats(),
        loadChannelStats: async () => channelStats({ dailyCount: 1, dailyMax: 3 }),
      },
    );
    expect(result.decision).toBe("ALLOW");
  });
});

describe("cross-channel adaptation", () => {
  it("does not hard-block the same master on a different channel", async () => {
    const result = await evaluate(
      { sourceContentId: CONTENT_ID, channel: "instagram", agendaId: null },
      {
        loadAgendaStats: async () => emptyAgendaStats(),
        retrieveSimilar: async () => ({ status: "ok", matches: [semanticMatch({ score: 0.91 })] }),
        loadMatchedMemories: async () => [
          memoryMatch({
            contentId: CONTENT_ID,
            score: 0.91,
            channels: ["threads"],
            agendaId: AGENDA_ID,
          }),
        ],
      },
    );
    expect(result.decision).toBe("ALLOW");
    expect(result.reasons.map((reason) => reason.code)).toContain("CROSS_CHANNEL_ADAPTATION");
    expect(result.reasons.map((reason) => reason.code)).not.toContain("SEMANTIC_SIMILARITY_HIGH");
  });
});

describe("semantic fail-safe", () => {
  it("continues exact/normalized/agenda/channel checks when semantic is unavailable", async () => {
    const failed: SemanticRetrievalResult = { status: "failed", reason: "provider_error", matches: [] };
    const result = await evaluate(
      {},
      {
        retrieveSimilar: async () => failed,
        findByContentHash: async () => CONTENT_ID,
      },
    );
    expect(result.semanticAvailable).toBe(false);
    expect(result.matchedMemories).toEqual([]);
    expect(result.decision).toBe("BLOCK");
    expect(result.reasons.map((reason) => reason.code)).toContain("EXACT_DUPLICATE");
  });

  it("allows a candidate with no history when semantic is down", async () => {
    const result = await evaluate(
      { agendaId: null },
      {
        retrieveSimilar: async () => ({ status: "skipped", reason: "provider_not_configured", matches: [] }),
        loadAgendaStats: async () => emptyAgendaStats(),
      },
    );
    expect(result.semanticAvailable).toBe(false);
    expect(result.decision).toBe("ALLOW");
  });
});

describe("risk score alignment", () => {
  it("keeps BLOCK / REVIEW / ALLOW risk bands consistent", () => {
    const blocked = combineGovernanceSignals({
      exact: { hash: "x", matchedContentId: CONTENT_ID, reasons: [{ code: "EXACT_DUPLICATE", severity: "critical" }] },
      normalized: { hash: "y", matchedContentId: null, reasons: [] },
      semantic: {
        available: true,
        reasons: [],
        matches: [],
        topScore: null,
        sameAgenda: false,
        sameChannelRecent: false,
        crossChannelAdaptation: false,
      },
      agenda: { stats: emptyAgendaStats(), reasons: [], recentRepeat: false, overused: false },
      channel: {
        stats: channelStats(),
        reasons: [],
        dailyLimitExceeded: false,
      },
    });
    expect(blocked.decision).toBe("BLOCK");
    expect(blocked.riskScore).toBeGreaterThanOrEqual(GOVERNANCE_BLOCK_MIN_RISK);
  });
});

describe("governance CLI", () => {
  it("requires body and channel", () => {
    expect(() => parseContentGovernanceCliArgs([])).toThrow(GovernanceValidationError);
    expect(parseContentGovernanceCliArgs(["--body", "본문", "--channel", "threads", "--title", "제목"])).toMatchObject({
      body: "본문",
      channel: "threads",
      title: "제목",
    });
  });
});
