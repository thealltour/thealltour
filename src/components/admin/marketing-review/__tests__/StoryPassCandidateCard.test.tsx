/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { StoryPassCandidateCard } from "@/components/admin/marketing-review/StoryPassCandidateCard";
import {
  formatStoryEditorialArchetypeLabel,
  parseArchetypeFromAgendaFitNotes,
} from "@/components/admin/marketing-review/storyEditorialArchetypeLabel";

describe("formatStoryEditorialArchetypeLabel", () => {
  it("maps known archetypes to Korean labels without altering raw input storage", () => {
    expect(formatStoryEditorialArchetypeLabel("contrast")).toBe("대비형");
    expect(formatStoryEditorialArchetypeLabel("hidden_detail")).toBe("숨은 디테일");
    expect(formatStoryEditorialArchetypeLabel("expectation_vs_reality")).toBe("기대 vs 실제");
    expect(formatStoryEditorialArchetypeLabel("alternative")).toBe("대안형");
    expect(formatStoryEditorialArchetypeLabel("cultural_curiosity")).toBe("문화 호기심");
    expect(formatStoryEditorialArchetypeLabel("discovery")).toBe("발견형");
    expect(formatStoryEditorialArchetypeLabel("experience_fit")).toBe("취향 적합");
    expect(formatStoryEditorialArchetypeLabel("who_is_it_for")).toBe("누구에게 맞나");
    expect(formatStoryEditorialArchetypeLabel("practical")).toBe("실용형");
  });

  it("falls back to raw archetype when unmapped", () => {
    expect(formatStoryEditorialArchetypeLabel("custom_archetype_x")).toBe("custom_archetype_x");
  });

  it("returns null for empty values", () => {
    expect(formatStoryEditorialArchetypeLabel(null)).toBeNull();
    expect(formatStoryEditorialArchetypeLabel("")).toBeNull();
    expect(formatStoryEditorialArchetypeLabel("   ")).toBeNull();
  });
});

describe("parseArchetypeFromAgendaFitNotes", () => {
  it("extracts archetype fragment from agendaFitNotes", () => {
    expect(
      parseArchetypeFromAgendaFitNotes(
        "title:콘다오 | archetype:who_is_it_for | source:external_editorial_director",
      ),
    ).toBe("who_is_it_for");
  });
});

describe("StoryPassCandidateCard", () => {
  const base = {
    pointId: "sp_ext_1",
    sourceLabel: "ChatGPT 수동 Editorial Director",
    editorialArchetype: "who_is_it_for" as string | null,
    headline: "콘다오는 누구에게 맞을까?",
    audienceTension: "프라이빗 휴양 vs 접근성",
    readerPayoff: "본인 스타일 적합 여부를 가른다",
    genericRisk: "과대 단정 금지",
    whyInteresting: "럭셔리 이미지와 실접근성 괴리",
    mechanisms: ["curiosity_gap"],
    researchQuestions: ["페리 스케줄은?"],
    researchRejected: false,
  };

  it("shows archetype badge, recommended badge on #1, and unchanged body labels", () => {
    render(<StoryPassCandidateCard {...base} index={0} onSelectStory={vi.fn()} />);

    const card = screen.getByTestId("story-pass-candidate-card");
    expect(card.getAttribute("data-candidate-index")).toBe("1");
    expect(card.getAttribute("data-recommended")).toBe("true");
    expect(card.textContent).toContain("후보 #");
    expect(card.textContent).toContain("1");
    expect(screen.getByText("ChatGPT 수동 Editorial Director")).toBeTruthy();
    expect(screen.getByText("추천 Story")).toBeTruthy();
    expect(screen.getByTestId("story-archetype-badge").textContent).toContain("누구에게 맞나");
    expect(screen.getByText("콘다오는 누구에게 맞을까?")).toBeTruthy();
    expect(screen.getByText("긴장")).toBeTruthy();
    expect(screen.getByText(/프라이빗 휴양 vs 접근성/)).toBeTruthy();
    expect(screen.getByText("얻는 것")).toBeTruthy();
    expect(screen.getByText(/본인 스타일 적합 여부를 가른다/)).toBeTruthy();
    expect(screen.getByText("주의")).toBeTruthy();
    expect(screen.getByRole("button", { name: "이 Story로 제작" })).toBeTruthy();
  });

  it("does not show 추천 Story on non-first candidates, still shows archetype badge", () => {
    render(
      <StoryPassCandidateCard
        {...base}
        index={1}
        editorialArchetype="hidden_detail"
        headline="숨은 디테일 후보"
      />,
    );

    const card = screen.getByTestId("story-pass-candidate-card");
    expect(card.getAttribute("data-candidate-index")).toBe("2");
    expect(card.getAttribute("data-recommended")).toBe("false");
    expect(screen.queryByText("추천 Story")).toBeNull();
    expect(screen.getByTestId("story-archetype-badge").textContent).toContain("숨은 디테일");
  });

  it("falls back to raw archetype text and keeps select callback", () => {
    const onSelectStory = vi.fn();
    render(
      <StoryPassCandidateCard
        {...base}
        index={2}
        editorialArchetype="totally_unknown_arch"
        onSelectStory={onSelectStory}
      />,
    );

    expect(screen.getByTestId("story-archetype-badge").textContent).toContain(
      "totally_unknown_arch",
    );
    fireEvent.click(screen.getByRole("button", { name: "이 Story로 제작" }));
    expect(onSelectStory).toHaveBeenCalledWith("sp_ext_1");
  });

  it("shows placeholder badge when archetype is missing", () => {
    render(<StoryPassCandidateCard {...base} index={3} editorialArchetype={null} />);
    expect(screen.getByTestId("story-archetype-badge").textContent).toContain("아키타입 미지정");
  });
});
