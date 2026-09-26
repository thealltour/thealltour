/**
 * Cross-Channel Copy — Natural Korean Syntax Contracts (A–J).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CROSS_CHANNEL_ABSTRACT_NOUNS_RECONSIDER,
  CROSS_CHANNEL_NATURAL_KOREAN_CHANNELS,
  CROSS_CHANNEL_NATURAL_KOREAN_SEMANTIC_NOTES,
  CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN,
  CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_NOTE,
  CROSS_CHANNEL_PROMOTIONAL_FRAMING_ALLOWED,
  CROSS_CHANNEL_REVIEW_SCAN_PATTERNS,
  CROSS_CHANNEL_TRANSLATIONESE_SCAFFOLDS,
  KAKAO_NATURAL_KOREAN_TONE_EN,
  NAVER_BAND_NATURAL_KOREAN_TONE_EN,
  NAVER_BLOG_NATURAL_KOREAN_TONE_EN,
  SHORTFORM_NATURAL_KOREAN_TONE_EN,
  buildCrossChannelNaturalKoreanSoulSection,
  countCrossChannelReviewPatternHits,
} from "@/lib/marketing/agentContracts/crossChannelNaturalKoreanSyntaxContract";
import { CARD_COPY_UPSTREAM_VOCABULARY_BOUNDARY } from "@/lib/marketing/agentContracts/plannerVocabularyBoundary";
import { requireMarketingAgentSemanticContract } from "@/lib/marketing/agentContracts/semanticRegistry";
import { NAVER_BAND_COPY_WRITER_SOUL } from "@/lib/marketing/publishable/naverBandCopy/hermesIdentity";
import { NAVER_BLOG_COPY_WRITER_SOUL } from "@/lib/marketing/publishable/naverBlogEditorial/hermesIdentity";
import { kakaoChannelWritingContract } from "@/lib/marketing/publishable/kakao_channel/writingContract";
import { SHORTFORM_NARRATION_WRITING_CONTRACT } from "@/lib/marketing/publishable/shortform/writingContract";
import { naverBlogWritingContract } from "@/lib/marketing/publishable/naver_blog/writingContract";

const root = process.cwd();
const U = CARD_COPY_UPSTREAM_VOCABULARY_BOUNDARY;

describe("Cross-Channel Natural Korean Syntax", () => {
  it("A. shared Natural Korean syntax invariant present", () => {
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toMatch(/NATURAL KOREAN SYNTAX/);
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toContain(U.semanticNotPhrasing);
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toMatch(/ANTI-OVER-NOMINALIZATION/);
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toMatch(
      /Upstream wording is semantic instruction, not phrasing to preserve/,
    );
    expect(CROSS_CHANNEL_NATURAL_KOREAN_CHANNELS).toEqual(
      expect.arrayContaining([
        "threads",
        "instagram_caption",
        "instagram_card_copy",
        "naver_blog",
        "naver_band",
        "kakao_channel",
        "shortform",
      ]),
    );
  });

  it("B. channel-specific tone preservation (not Instagram Card Copy clone)", () => {
    expect(NAVER_BLOG_NATURAL_KOREAN_TONE_EN).toMatch(/NAVER BLOG/);
    expect(NAVER_BLOG_NATURAL_KOREAN_TONE_EN).toMatch(/written Korean/i);
    expect(NAVER_BAND_NATURAL_KOREAN_TONE_EN).toMatch(/NAVER BAND/);
    expect(NAVER_BAND_NATURAL_KOREAN_TONE_EN).toMatch(/community/i);
    expect(KAKAO_NATURAL_KOREAN_TONE_EN).toMatch(/KAKAO/);
    expect(KAKAO_NATURAL_KOREAN_TONE_EN).toMatch(/promotional/i);
    expect(SHORTFORM_NATURAL_KOREAN_TONE_EN).toMatch(/SHORTFORM/);
    expect(SHORTFORM_NATURAL_KOREAN_TONE_EN).toMatch(/spoken/i);
    expect(NAVER_BLOG_NATURAL_KOREAN_TONE_EN).not.toEqual(KAKAO_NATURAL_KOREAN_TONE_EN);
    expect(buildCrossChannelNaturalKoreanSoulSection("naver_blog")).toContain(
      NAVER_BLOG_NATURAL_KOREAN_TONE_EN,
    );
    expect(buildCrossChannelNaturalKoreanSoulSection("shortform")).toContain(
      SHORTFORM_NATURAL_KOREAN_TONE_EN,
    );
  });

  it("C. anti-over-nominalization guidance (pattern-first, minimal examples)", () => {
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toMatch(/ANTI-OVER-NOMINALIZATION/);
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toMatch(
      /Prefer saying what differs/,
    );
    for (const s of CROSS_CHANNEL_TRANSLATIONESE_SCAFFOLDS) {
      expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toContain(s);
    }
    // Do not repeat long bad samples as lexical seeds
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).not.toMatch(
      /베트남을 단일한 휴양지가 아니라/,
    );
  });

  it("D. passive allowed when natural (no long passive inventory)", () => {
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toMatch(
      /Passive is allowed when it is the natural Korean choice/,
    );
  });

  it("E. no blacklist / replacement map", () => {
    const contractSrc = readFileSync(
      join(root, "src/lib/marketing/agentContracts/crossChannelNaturalKoreanSyntaxContract.ts"),
      "utf8",
    );
    expect(contractSrc).toMatch(/NOT a blacklist/);
    expect(contractSrc).not.toMatch(/replaceAll\(|\.replace\(\s*\/|bannedWords|BLOCKLIST/);
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toMatch(/not a blacklist/i);
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toMatch(
      /No deterministic replacement/,
    );
    expect(CROSS_CHANNEL_ABSTRACT_NOUNS_RECONSIDER.length).toBeGreaterThan(5);
  });

  it("F. evidence safety preserved", () => {
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toMatch(/EVIDENCE SAFETY UNCHANGED/);
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toMatch(/must NOT strengthen claims/);
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toMatch(/supportedClaimBoundary/);
  });

  it("G. upstream wording non-authoritative", () => {
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toContain(U.semanticNotPhrasing);
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_NOTE).toMatch(/not phrasing to preserve/);
  });

  it("H. Blog/Band SOUL + Kakao/Shortform writing contracts wired", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/NATURAL KOREAN SYNTAX/);
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/NAVER BLOG/);
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(/NATURAL KOREAN SYNTAX/);
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(/NAVER BAND/);
    const kakao = kakaoChannelWritingContract({ hasApprovedCanonicalAsset: true });
    expect(kakao).toMatch(/NATURAL KOREAN SYNTAX/);
    expect(kakao).toMatch(/KAKAO/);
    expect(SHORTFORM_NARRATION_WRITING_CONTRACT).toMatch(/NATURAL KOREAN SYNTAX/);
    expect(SHORTFORM_NARRATION_WRITING_CONTRACT).toMatch(/SHORTFORM/);
    expect(SHORTFORM_NARRATION_WRITING_CONTRACT).toMatch(/Story를 바꾸지/);
    const blogLegacy = naverBlogWritingContract({ hasApprovedCanonicalAsset: true });
    expect(blogLegacy).toMatch(/NATURAL KOREAN SYNTAX/);
  });

  it("I. semantic registry parity for Blog/Band copy writers", () => {
    const blog = requireMarketingAgentSemanticContract("naver-blog-copy-writer");
    const band = requireMarketingAgentSemanticContract("naver-band-copy-writer");
    const blogNotes = (blog.docs?.notes ?? []).join("\n");
    const bandNotes = (band.docs?.notes ?? []).join("\n");
    expect(blogNotes.length).toBeGreaterThan(0);
    expect(bandNotes.length).toBeGreaterThan(0);
    for (const note of CROSS_CHANNEL_NATURAL_KOREAN_SEMANTIC_NOTES) {
      expect(blogNotes).toContain(note);
      expect(bandNotes).toContain(note);
    }
  });

  it("J. production prompt composition parity + promotional framing allowed", () => {
    expect(CROSS_CHANNEL_PROMOTIONAL_FRAMING_ALLOWED.length).toBeGreaterThan(3);
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toMatch(/PROMOTIONAL FRAMING/);
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toMatch(
      /Marketing energy is allowed/,
    );
    const pipelineBlog = readFileSync(
      join(root, "src/lib/marketing/publishable/naverBlogEditorial/pipeline.ts"),
      "utf8",
    );
    const pipelineBand = readFileSync(
      join(root, "src/lib/marketing/publishable/naverBandCopy/pipeline.ts"),
      "utf8",
    );
    expect(pipelineBlog).toMatch(/naturalKoreanSyntaxNote:\s*CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_NOTE/);
    expect(pipelineBand).toMatch(/naturalKoreanSyntaxNote:\s*CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_NOTE/);
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_NOTE.length).toBeGreaterThan(40);
  });

  it("review scan helper supports Dao qualitative reports (no zero-count)", () => {
    const sample =
      "인식하는 것은 의미가 있습니다. 문화적 맥락을 통해 읽을 수 있다. 프레임과 리듬.";
    const hits = countCrossChannelReviewPatternHits(sample);
    expect(hits.recognition_scaffold).toBeGreaterThan(0);
    expect(hits.through_can).toBeGreaterThan(0);
    expect(CROSS_CHANNEL_REVIEW_SCAN_PATTERNS.length).toBeGreaterThan(5);
  });
});
