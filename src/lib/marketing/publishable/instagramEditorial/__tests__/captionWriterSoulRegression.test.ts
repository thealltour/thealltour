/**
 * Instagram Caption Writer SOUL / materialize regressions (A–M).
 * Instruction-level locks — no live LLM.
 */

import { describe, expect, it } from "vitest";

import { requireMarketingAgentSemanticContract } from "@/lib/marketing/agentContracts/semanticRegistry";
import { INSTAGRAM_CAPTION_WRITER_SOUL } from "@/lib/marketing/publishable/instagramEditorial/hermesIdentity";
import { materializeInstagramCaption } from "@/lib/marketing/publishable/instagramEditorial/materialize";
import {
  INSTAGRAM_CAPTION_MAX_CHARS,
  INSTAGRAM_HASHTAG_MAX,
  INSTAGRAM_HASHTAG_MIN,
  INSTAGRAM_HOOK_VISIBLE_CHARS,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";
import { mergeInstagramHashtagsIntoBody } from "@/lib/marketing/publishable/instagram/hashtagMerge";

function materializeOk(llm: Record<string, unknown>) {
  return materializeInstagramCaption({
    assetId: "cma_caption_reg",
    assetVersion: 1,
    sourceCardCopyFingerprint: "fp_card_copy",
    modelProfile: "instagram-caption-writer",
    hashtagMax: INSTAGRAM_HASHTAG_MAX,
    llm,
  });
}

describe("instagram caption writer — SOUL / materialize regressions", () => {
  it("A. planner wording is semantic guidance, not lexical source", () => {
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /semantic\/context references, not lexical sources/i,
    );
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /rewrite abstract planner language[\s\S]*natural consumer-facing Korean/i,
    );
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(/This is not a blacklist/);
  });

  it("B. abstract upstream takeaway may be rewritten concretely (instruction lock)", () => {
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /Do not surface planner\/editorial wording such as perspective/i,
    );
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /diversity, criteria, insight, frame, lens, or awareness/i,
    );
    // Concrete rewrite still materializes.
    const caption = materializeOk({
      opening: "다낭·푸꾸옥만 알던 베트남에, 북부 국경 마을이 있습니다.",
      body: "공식 기록에는 Dao족과 nhà trình tường(흙다짐 주택)이 등장합니다. 세부 체험은 아직 단정하기 어렵습니다.",
      cta: null,
      hashtags: ["#베트남여행", "#Dao족", "#냐찐뜨엉"],
      altText: "북부 산악 마을의 흙다짐 주택",
    });
    expect(caption.body).toMatch(/Dao족|nhà trình tường/i);
    expect(caption.body).not.toMatch(/지역적 다양성|비교 관점/);
  });

  it("C. discovery caption may have cta=null", () => {
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /For discovery \/ cultural-curiosity content, no CTA is fully valid/i,
    );
    const caption = materializeOk({
      opening: "북부 국경지대의 흙다짐 주택을 아나요?",
      body: "Dao족 마을의 nhà trình tường은 해변 리조트와는 출발점이 다릅니다.",
      cta: null,
      hashtags: ["#베트남북부", "#다오족", "#전통가옥"],
      altText: "흙다짐 벽체 가옥",
    });
    expect(caption.cta).toBeNull();
  });

  it("D. no forced reflective soft-question CTA (instruction lock)", () => {
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /Do not turn upstream takeaway, perspective, diversity/i,
    );
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /abstract soft-question CTA/i,
    );
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /Do not force conclusions like "try a new perspective"/i,
    );
  });

  it("E. concrete factual comparison still allowed", () => {
    const caption = materializeOk({
      opening: "해변 휴양지와 북부 산악 마을, 같은 나라라도 풍경이 다릅니다.",
      body: "다낭·푸꾸옥의 리조트와 달리, 랑선 일대 기록에는 Dao족과 흙다짐 주택이 나옵니다.",
      cta: null,
      hashtags: ["#베트남여행", "#랑선", "#흙다짐주택"],
      altText: "산악 마을과 흙벽",
    });
    expect(caption.body).toMatch(/달리|다릅니다|비교|차이/);
  });

  it("F. promotional hook still allowed", () => {
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /Marketing hooks may remain vivid\/promotional when evidence-safe/i,
    );
    const caption = materializeOk({
      opening: "다낭의 해변만 베트남일까요? 지도 맨 위 국경으로 시선을 옮겨 보세요.",
      body: "공식 기록 속 Dao족과 nhà trình tường이 다른 지역의 얼굴을 보여줍니다.",
      cta: null,
      hashtags: ["#베트남여행", "#북부국경", "#Dao족"],
      altText: "북부 국경 풍경",
    });
    expect(caption.opening).toMatch(/\?|보세요/);
  });

  it("G. no forced abstract final paragraph (instruction lock)", () => {
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /Do not add a separate paragraph whose only job is to explain/i,
    );
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /what the Story "means" for the reader/i,
    );
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /Avoid ending with a synthesized lesson about perspective/i,
    );
  });

  it("H. concrete topic hashtags preferred (instruction lock)", () => {
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /Prefer concrete destination, people, architecture, culture/i,
    );
    const caption = materializeOk({
      opening: "북부 산악 마을의 흙다짐 주택.",
      body: "nhà trình tường과 Dao족 기록이 남아 있습니다.",
      cta: null,
      hashtags: ["#베트남여행", "#냐찐뜨엉", "#다오족", "#베트남북부"],
      altText: "전통 가옥",
    });
    expect(caption.hashtags.every((t) => t.startsWith("#"))).toBe(true);
    expect(caption.hashtags.length).toBeGreaterThanOrEqual(INSTAGRAM_HASHTAG_MIN);
  });

  it("I. abstract meta hashtag generation discouraged (instruction lock)", () => {
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /Avoid abstract editorial\/meta tags whose primary meaning is/i,
    );
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /perspective, insight, awareness, viewpoint, or interpretation/i,
    );
    // Soft guidance only — materialize still accepts any tag (no blacklist).
    const caption = materializeOk({
      opening: "북부 국경 이야기.",
      body: "Dao족과 흙다짐 주택 기록.",
      cta: null,
      hashtags: ["#여행관점", "#새로운시선", "#베트남여행"],
      altText: "산악 마을",
    });
    expect(caption.hashtags).toContain("#여행관점");
  });

  it("J. card copy is not re-copied verbatim (instruction lock)", () => {
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(/re-copy every card verbatim/i);
  });

  it("K. evidence boundary unchanged", () => {
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(/invent new facts beyond Canonical/i);
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(/evidence-safe explanation/i);
  });

  it("L. fold guidance present; validation limits unchanged", () => {
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /within roughly the first 125 characters/i,
    );
    expect(INSTAGRAM_HOOK_VISIBLE_CHARS).toBe(125);
    expect(INSTAGRAM_CAPTION_MAX_CHARS).toBe(2200);
    expect(INSTAGRAM_HASHTAG_MAX).toBe(12);
  });

  it("M. existing materialize/validation behavior unchanged", () => {
    const caption = materializeOk({
      opening: "다낭만 알던 베트남에 북부 국경이 있습니다.",
      body: "공식 기록의 Dao족과 nhà trình tường. 세부 체험은 자료가 더 필요합니다.",
      cta: "다음에 북부 일정을 넣을지 메모해 두세요.",
      hashtags: ["베트남여행", "##Dao족", " 냐찐뜨엉 "],
      altText: "흙다짐 주택 사진",
    });
    expect(caption.hashtags).toEqual(["#베트남여행", "#Dao족", "#냐찐뜨엉"]);
    expect(caption.cta).toMatch(/메모/);
    const merged = mergeInstagramHashtagsIntoBody(
      [caption.opening, caption.body, caption.cta].join("\n\n"),
      caption.hashtags,
    );
    const validation = validatePublishableText(merged.body, { channel: "instagram" });
    expect(validation.ok).toBe(true);
    expect(caption.body.length).toBeLessThanOrEqual(INSTAGRAM_CAPTION_MAX_CHARS);
  });

  it("semanticRegistry: production reads required + notes", () => {
    const caption = requireMarketingAgentSemanticContract("instagram-caption-writer");
    expect(caption.inputs.required).toEqual(
      expect.arrayContaining([
        "instagram.cardCopy",
        "instagram.carouselStructure",
        "editorialNarrative.storySequence",
        "canonical.factualBoundary",
      ]),
    );
    expect(caption.inputs.optional ?? []).toHaveLength(0);
    const notes = caption.docs?.notes?.join("\n") ?? "";
    expect(notes).toMatch(/not lexical sources/i);
    expect(notes).toMatch(/125 characters/i);
  });
});

describe("instagram caption writer — geographic / interpretive compression hotfix", () => {
  /** Mixed familiar-frame examples as in Dao Canonical (not a single region). */
  const MIXED_CANONICAL_DESTINATIONS = ["다낭", "푸꾸옥", "호치민", "하노이"] as const;

  it('A. mixed Canonical destinations must not be compressed to "중남부"', () => {
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(/Geographic \/ factual compression/);
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(/중남부/);
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /do not relabel them as[\s\S]*"중남부"/i,
    );
    const unsafe = "중남부 중심의 휴양지와 대도시 경험에서 벗어나 북부로 갑니다.";
    expect(unsafe).toMatch(/중남부/);
    // Safe: keep or select supported names — no invented bucket.
    const safe =
      "다낭·푸꾸옥·호치민으로 익숙한 휴양·도심 경험과 달리, 북부 국경지대에는 Dao족과 nhà trình tường이 있습니다.";
    expect(safe).not.toMatch(/중남부|남부|남쪽/);
    expect(MIXED_CANONICAL_DESTINATIONS.some((d) => safe.includes(d))).toBe(true);
  });

  it('B. mixed destinations must not be compressed to "남부"/"남쪽"', () => {
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(/"남부", "남쪽"/);
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /another unsupported regional bucket/i,
    );
    const unsafeSouth = "남부 휴양지 프레임을 벗어나 북부로 시선을 옮깁니다.";
    const unsafeSouthDir = "남쪽만 알던 베트남과 다른 북부 풍경입니다.";
    expect(unsafeSouth).toMatch(/남부/);
    expect(unsafeSouthDir).toMatch(/남쪽/);
  });

  it("C. selecting a subset of supported destinations is allowed", () => {
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /Shorten by selecting or restating supported examples/i,
    );
    const subset =
      "다낭과 호치민만 떠올렸다면, 북부 국경지대 Dao족 마을 기록이 다른 출발점을 보여줍니다.";
    expect(subset).toMatch(/다낭/);
    expect(subset).toMatch(/호치민/);
    expect(subset).not.toMatch(/중남부|남부|남쪽/);
    const caption = materializeOk({
      opening: subset.slice(0, 80),
      body: "공식 기록에는 nhà trình tường(흙다짐 주택)이 등장합니다.",
      cta: null,
      hashtags: ["#베트남여행", "#다낭", "#호치민"],
      altText: "북부 산악 마을",
    });
    expect(caption.body).toMatch(/nhà trình tường/i);
  });

  it("D. restating supported destinations is allowed", () => {
    const restated =
      "다낭의 해변, 푸꾸옥의 리조트, 호치민의 도심 — 익숙한 베트남 풍경입니다. 북부 국경지대로 가면 Dao족과 흙다짐 주택이 등장합니다.";
    expect(restated).toMatch(/다낭/);
    expect(restated).toMatch(/푸꾸옥/);
    expect(restated).toMatch(/호치민/);
    expect(restated).not.toMatch(/중남부|남부 프레임|남쪽만/);
  });

  it("E. supported geographic category may still be used when Canonical explicitly provides it", () => {
    // Instruction forbids inventing buckets — not forbidding Canonical-stated regions (e.g. 북부 국경지대).
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /Geographic compression must not change source meaning/i,
    );
    const canonicalProvided =
      "Canonical이 말하는 북부 국경지대에는 Dao족과 nhà trình tường이 있습니다.";
    expect(canonicalProvided).toMatch(/북부 국경지대/);
    expect(canonicalProvided).not.toMatch(/중남부/);
  });

  it("F. no unsupported interpretive adjective strengthening (instruction lock)", () => {
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /Do not strengthen a factual noun phrase with unsupported[\s\S]*interpretive adjectives/i,
    );
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(/독창적인 삶/);
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(/not an adjective blacklist/i);
    const preferred = "Dao족과 전통 주택 nhà trình tường이 공식 기록에 등장합니다.";
    const risky = "다오(Dao)족의 독창적인 삶이 펼쳐집니다.";
    expect(preferred).not.toMatch(/독창적인|특별한/);
    expect(risky).toMatch(/독창적인/);
  });

  it("G. previous Caption Natural Korean / CTA / hashtag guidance still present", () => {
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(/Prefer direct Korean sentences/i);
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /For discovery \/ cultural-curiosity content, no CTA is fully valid/i,
    );
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /Prefer concrete destination, people, architecture, culture/i,
    );
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(
      /within roughly the first 125 characters/i,
    );
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(/not lexical sources/i);
  });
});
