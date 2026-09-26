/**
 * Cross-Channel Copy — Remove Forced Abstract Synthesis (A–O).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CROSS_CHANNEL_NATURAL_KOREAN_SEMANTIC_NOTES,
  CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN,
  CROSS_CHANNEL_NO_FORCED_ABSTRACT_SYNTHESIS_EN,
  CROSS_CHANNEL_PROMOTIONAL_FRAMING_ALLOWED,
  buildCrossChannelNaturalKoreanSoulSection,
} from "@/lib/marketing/agentContracts/crossChannelNaturalKoreanSyntaxContract";
import { CARD_COPY_NATURAL_KOREAN_CONTRACT_EN } from "@/lib/marketing/agentContracts/cardCopyNaturalKoreanContract";
import { requireMarketingAgentSemanticContract } from "@/lib/marketing/agentContracts/semanticRegistry";
import { INSTAGRAM_CAPTION_WRITER_SOUL, INSTAGRAM_CARD_COPY_WRITER_SOUL } from "@/lib/marketing/publishable/instagramEditorial/hermesIdentity";
import { NAVER_BAND_COPY_WRITER_SOUL } from "@/lib/marketing/publishable/naverBandCopy/hermesIdentity";
import {
  NAVER_BLOG_COPY_WRITER_SOUL,
  NAVER_BLOG_STRUCTURE_PLANNER_SOUL,
} from "@/lib/marketing/publishable/naverBlogEditorial/hermesIdentity";
import { THREADS_COPY_WRITER_SOUL } from "@/lib/marketing/publishable/threadsCopy/hermesIdentity";
import { THREADS_WRITING_CONTRACT } from "@/lib/marketing/publishable/threads/writingContract";
import { kakaoChannelWritingContract } from "@/lib/marketing/publishable/kakao_channel/writingContract";
import { SHORTFORM_NARRATION_WRITING_CONTRACT } from "@/lib/marketing/publishable/shortform/writingContract";
import { CHANNEL_EDITOR_CHANNEL_EXTENSIONS } from "@/lib/marketing/publishable/channelEditorIdentity";

const root = process.cwd();

describe("Remove Forced Abstract Synthesis", () => {
  it("A. shared no-forced-abstract-synthesis invariant", () => {
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toContain(
      CROSS_CHANNEL_NO_FORCED_ABSTRACT_SYNTHESIS_EN,
    );
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toMatch(/NO FORCED ABSTRACT SYNTHESIS/);
    expect(CROSS_CHANNEL_NO_FORCED_ABSTRACT_SYNTHESIS_EN).toMatch(/concrete fact, contrast, or observation/i);
  });

  it("B. Threads concrete ending allowed", () => {
    expect(THREADS_COPY_WRITER_SOUL).toMatch(/concrete observation/);
    expect(THREADS_COPY_WRITER_SOUL).toMatch(/concrete contrast/);
    expect(THREADS_COPY_WRITER_SOUL).toMatch(/or no ending/i);
    expect(THREADS_COPY_WRITER_SOUL).toMatch(/semantic outcome/);
    expect(THREADS_COPY_WRITER_SOUL).toMatch(/"rhythm" is internal craft/);
    expect(THREADS_COPY_WRITER_SOUL).toMatch(/NATURAL KOREAN SYNTAX/);
    expect(THREADS_WRITING_CONTRACT).toMatch(/Do not force abstract synthesis/);
  });

  it("C. IG Caption Natural Korean section actually active", () => {
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(/NATURAL KOREAN SYNTAX/);
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(/INSTAGRAM CAPTION/);
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toContain(
      buildCrossChannelNaturalKoreanSoulSection("instagram_caption"),
    );
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(/Do not force a final abstract sentence/);
  });

  it("D. IG Card negative lexical seed reduced", () => {
    expect(CARD_COPY_NATURAL_KOREAN_CONTRACT_EN).not.toMatch(/문화적 맥락을 읽어내게 됩니다/);
    expect(CARD_COPY_NATURAL_KOREAN_CONTRACT_EN).not.toMatch(/여행의 리듬이 달라집니다/);
    expect(CARD_COPY_NATURAL_KOREAN_CONTRACT_EN).not.toMatch(/휴양 프레임 밖의 또 다른 베트남/);
    expect(CARD_COPY_NATURAL_KOREAN_CONTRACT_EN).not.toMatch(/휴양 프레임 밖에서 읽는 생활 리듬/);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/concrete fact, contrast, or observation/i);
    expect(INSTAGRAM_CARD_COPY_WRITER_SOUL).toMatch(/no forced philosophical synthesis/i);
  });

  it("E. Blog structure no required perspective expansion", () => {
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(/curiosity \/ concrete context \/ concrete detail \/ reader understanding/);
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).toMatch(/Do NOT require perspective expansion/);
    expect(NAVER_BLOG_STRUCTURE_PLANNER_SOUL).not.toMatch(
      /prefer curiosity \/ cultural context \/ concrete detail \/ perspective expansion/,
    );
  });

  it("F. Blog copy concrete/non-sales close allowed", () => {
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/concrete observation/);
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/perspective synthesis is NOT required/i);
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toMatch(/NATURAL KOREAN SYNTAX/);
  });

  it("G. Band concrete takeaway", () => {
    expect(NAVER_BAND_COPY_WRITER_SOUL).toMatch(/One concrete takeaway or observation/);
    expect(NAVER_BAND_COPY_WRITER_SOUL).not.toMatch(/One perspective-expanding takeaway/);
  });

  it("H. Kakao discovery no forced decision/action", () => {
    const kakao = kakaoChannelWritingContract({ hasApprovedCanonicalAsset: true });
    expect(kakao).toMatch(/ARCHETYPE-AWARE CLOSE/);
    expect(kakao).toMatch(/Discovery\/cultural\/contrast/);
    expect(kakao).toMatch(/Do not force action\/decision synthesis when there is no CTA/);
    expect(CHANNEL_EDITOR_CHANNEL_EXTENSIONS.kakao_channel).toMatch(/archetype-aware/i);
  });

  it("I. Shortform no forced payoff/takeaway sentence", () => {
    expect(SHORTFORM_NARRATION_WRITING_CONTRACT).toMatch(/hook → concrete fact\/context/);
    expect(SHORTFORM_NARRATION_WRITING_CONTRACT).toMatch(/close\/action은 optional/);
    expect(SHORTFORM_NARRATION_WRITING_CONTRACT).toMatch(/payoff는 semantic outcome/);
    const compose = readFileSync(
      join(root, "src/lib/marketing/publishable/shortform/composeShortformNarration.ts"),
      "utf8",
    );
    expect(compose).toMatch(/payoff is semantic, not a forced abstract sentence/);
    expect(compose).not.toMatch(/Structure: hook → payoff → concrete useful information → close\/action\./);
  });

  it("J. marketing promotional framing preserved", () => {
    expect(CROSS_CHANNEL_PROMOTIONAL_FRAMING_ALLOWED).toEqual(
      expect.arrayContaining(["숨은 여행지", "전혀 다른 베트남이 기다립니다"]),
    );
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toMatch(/Marketing energy is allowed/);
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toMatch(/Promotional framing/);
  });

  it("K. no blacklist / deterministic replacement", () => {
    const contractSrc = readFileSync(
      join(root, "src/lib/marketing/agentContracts/crossChannelNaturalKoreanSyntaxContract.ts"),
      "utf8",
    );
    expect(contractSrc).toMatch(/NOT a blacklist/);
    expect(contractSrc).not.toMatch(/replaceAll\(|bannedWords|BLOCKLIST/);
  });

  it("L. evidence safety preserved", () => {
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toMatch(/EVIDENCE SAFETY UNCHANGED/);
    expect(CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN).toMatch(/must NOT strengthen claims/);
  });

  it("M. production prompt composition parity", () => {
    expect(THREADS_COPY_WRITER_SOUL).toContain(buildCrossChannelNaturalKoreanSoulSection("threads"));
    expect(INSTAGRAM_CAPTION_WRITER_SOUL).toContain(
      buildCrossChannelNaturalKoreanSoulSection("instagram_caption"),
    );
    expect(NAVER_BLOG_COPY_WRITER_SOUL).toContain(buildCrossChannelNaturalKoreanSoulSection("naver_blog"));
    expect(NAVER_BAND_COPY_WRITER_SOUL).toContain(buildCrossChannelNaturalKoreanSoulSection("naver_band"));
    expect(kakaoChannelWritingContract({ hasApprovedCanonicalAsset: true })).toMatch(
      /NATURAL KOREAN SYNTAX/,
    );
    expect(SHORTFORM_NARRATION_WRITING_CONTRACT).toMatch(/NATURAL KOREAN SYNTAX/);
  });

  it("N. semantic registry parity where applicable", () => {
    for (const id of [
      "threads-copy-writer",
      "instagram-caption-writer",
      "naver-blog-copy-writer",
      "naver-band-copy-writer",
    ]) {
      const notes = (requireMarketingAgentSemanticContract(id).docs?.notes ?? []).join("\n");
      for (const note of CROSS_CHANNEL_NATURAL_KOREAN_SEMANTIC_NOTES) {
        expect(notes).toContain(note);
      }
    }
    const structure = requireMarketingAgentSemanticContract("naver-blog-structure-planner");
    expect((structure.docs?.notes ?? []).join("\n")).toMatch(/perspective expansion is NOT a required/);
  });

  it("O. Narrative / Canonical / visual surfaces untouched by this PR scope markers", () => {
    // Soft guard: this PR must not rewrite Narrative SOUL forced-payoff (do-not-touch)
    const narrative = readFileSync(
      join(root, "src/lib/marketing/publishable/instagramEditorial/hermesIdentity.ts"),
      "utf8",
    );
    // Caption got Natural Korean; Narrative planner block must still exist unchanged as planner
    expect(narrative).toMatch(/Editorial Narrative Planner/);
    expect(narrative).toMatch(/channel-agnostic Editorial Narrative Planner/);
  });
});
