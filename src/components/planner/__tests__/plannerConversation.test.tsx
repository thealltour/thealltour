import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PlannerWizard } from "@/components/planner/PlannerWizard";
import { PlannerConversationShell } from "@/components/planner/conversation/PlannerConversationShell";
import { PlannerChoiceChip } from "@/components/planner/conversation/PlannerChoiceChip";
import { PlannerChoiceCard } from "@/components/planner/conversation/PlannerChoiceCard";
import { User } from "lucide-react";
import {
  formatCompletedStepAnswer,
  formatPlannerTravelersSummary,
  getCompletedConversationSteps,
  getPlannerAcknowledgement,
  PLANNER_ASSISTANT_DESCRIPTIONS,
  PLANNER_ASSISTANT_QUESTIONS,
  PLANNER_BUDGET_QUESTION,
} from "@/lib/planner/conversationCopy";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import { createFutureFixedDateRange } from "@/lib/planner/qaPresets";
import type { PlannerDraftInput } from "@/types/planner";

const searchParams = vi.hoisted(() => ({
  get: vi.fn<(key: string) => string | null>(() => null),
}));
const push = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/planner/anonymousKey", () => ({
  getOrCreatePlannerAnonymousKey: () => "anon-conv-test-key1",
}));

vi.mock("@/lib/analytics/trackPlannerEvents", () => ({
  trackPlannerLandingView: vi.fn(),
  trackPlannerStarted: vi.fn(),
  trackPlannerGenerationStarted: vi.fn(),
  trackPlannerPlanGenerated: vi.fn(),
  trackPlannerGenerationFailed: vi.fn(),
  trackPlannerInputCompleted: vi.fn(),
  trackPlannerSummaryEditClicked: vi.fn(),
}));

vi.stubGlobal("fetch", fetchMock);

function mockSessionFetch(sessionId = "550e8400-e29b-41d4-a716-446655440011") {
  fetchMock.mockImplementation(async (input: RequestInfo, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.endsWith("/api/planner/sessions") && method === "POST") {
      return new Response(
        JSON.stringify({
          session: {
            id: sessionId,
            origin: "서울",
            destination: "오사카",
            sourceProductId: null,
          },
        }),
        { status: 200 },
      );
    }
    if (url.includes("/api/planner/sessions/") && method === "PATCH") {
      return new Response(JSON.stringify({ session: { id: sessionId } }), { status: 200 });
    }
    return new Response("{}", { status: 500 });
  });
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  searchParams.get.mockReturnValue(null);
});

describe("conversationCopy helpers", () => {
  it("does not expose default companion/pace as completed on step 1", () => {
    const draft = createEmptyPlannerDraftInput();
    expect(
      getCompletedConversationSteps({
        step: 1,
        draft,
        editingFromSummary: false,
      }),
    ).toEqual([]);
  });

  it("lists only prior steps after progression", () => {
    const draft = createEmptyPlannerDraftInput("오사카", "서울");
    expect(
      getCompletedConversationSteps({
        step: 3,
        draft,
        editingFromSummary: false,
      }),
    ).toEqual([1, 2]);
  });

  it("formats route and companion answers", () => {
    const draft: PlannerDraftInput = {
      ...createEmptyPlannerDraftInput("오사카", "서울"),
      dates: createFutureFixedDateRange({ startOffsetDays: 30, durationDays: 5 }),
      companionType: "couple",
      travelers: { adults: 2, children: 0 },
      interests: ["food", "sightseeing"],
    };
    expect(formatCompletedStepAnswer(1, draft)).toBe("서울 → 오사카");
    expect(formatCompletedStepAnswer(3, draft)).toBe("연인 · 성인 2명");
    expect(formatCompletedStepAnswer(4, draft)).toContain("맛집");
  });

  it("formats traveler summary with companion first and hides zero children", () => {
    const solo = {
      ...createEmptyPlannerDraftInput("오사카", "서울"),
      companionType: "solo" as const,
      travelers: { adults: 1, children: 0 },
    };
    expect(formatPlannerTravelersSummary(solo)).toBe("혼자 · 성인 1명");

    const kids = {
      ...createEmptyPlannerDraftInput("다낭", "서울"),
      companionType: "with_children" as const,
      travelers: { adults: 2, children: 1 },
    };
    expect(formatPlannerTravelersSummary(kids)).toBe("아이와 · 성인 2명 · 아이 1명");
  });

  it("returns deterministic acknowledgements", () => {
    const draft: PlannerDraftInput = {
      ...createEmptyPlannerDraftInput("오사카", "서울"),
      companionType: "parents",
      interests: ["food"],
      pace: "relaxed",
    };
    expect(getPlannerAcknowledgement({ step: 3, draft })).toMatch(/부모님/);
    expect(getPlannerAcknowledgement({ step: 5, draft })).toMatch(/여유/);
  });

  it("exposes assistant questions and step 4 description", () => {
    for (let s = 1; s <= 7; s++) {
      expect(PLANNER_ASSISTANT_QUESTIONS[s as 1 | 2 | 3 | 4 | 5 | 6 | 7]).toBeTruthy();
    }
    expect(PLANNER_ASSISTANT_QUESTIONS[4]).toBe("이번 여행에서 무엇을 즐기고 싶으세요?");
    expect(PLANNER_ASSISTANT_DESCRIPTIONS[4]).toBe("여러 개 선택하셔도 됩니다.");
    expect(PLANNER_ASSISTANT_QUESTIONS[6]).toBe("일정을 짤 때 꼭 지켜야 할 조건이 있나요?");
    expect(PLANNER_ASSISTANT_DESCRIPTIONS[6]).toBe("해당되는 항목만 선택해 주세요.");
  });
});

describe("choice selection feedback", () => {
  it("renders chip icon, selected check, and aria-pressed", () => {
    const { rerender } = render(
      <PlannerChoiceChip selected={false} icon={User}>
        혼자
      </PlannerChoiceChip>,
    );
    const chip = screen.getByRole("button", { name: "혼자" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(chip.querySelector("svg")).toBeTruthy();
    expect(within(chip).queryByText("혼자")).toBeInTheDocument();

    rerender(
      <PlannerChoiceChip selected icon={User}>
        혼자
      </PlannerChoiceChip>,
    );
    expect(screen.getByRole("button", { name: "혼자" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "혼자" }).querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);
  });

  it("applies category tone on unselected chip icon container", () => {
    render(
      <PlannerChoiceChip selected={false} icon={User} iconTone="blue">
        혼자
      </PlannerChoiceChip>,
    );
    const chip = screen.getByRole("button", { name: "혼자" });
    const container = chip.querySelector("span.inline-flex.h-6");
    expect(container?.className).toMatch(/bg-blue-50/);
    expect(container?.className).toMatch(/text-blue-600/);
    expect(chip.className).not.toMatch(/bg-blue-50/);
  });

  it("overrides category tone with primary when chip is selected", () => {
    render(
      <PlannerChoiceChip selected icon={User} iconTone="emerald">
        자연
      </PlannerChoiceChip>,
    );
    const chip = screen.getByRole("button", { name: "자연" });
    expect(chip.className).toMatch(/border-\[var\(--primary\)\]/);
    expect(chip.className).toMatch(/bg-\[var\(--primary-soft\)\]/);
    const container = chip.querySelector("span.inline-flex.h-6");
    expect(container?.className).toMatch(/bg-\[var\(--primary-soft\)\]/);
    expect(container?.className).toMatch(/text-\[var\(--primary\)\]/);
    expect(container?.className).not.toMatch(/bg-emerald-50/);
    expect(chip.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);
  });

  it("renders card icon, selected check, and aria-checked", () => {
    const { rerender } = render(
      <PlannerChoiceCard
        title="여유롭게"
        description="휴식 충분히"
        selected={false}
        icon={User}
      />,
    );
    const card = screen.getByRole("radio", { name: /여유롭게/ });
    expect(card).toHaveAttribute("aria-checked", "false");

    rerender(
      <PlannerChoiceCard title="여유롭게" description="휴식 충분히" selected icon={User} />,
    );
    expect(screen.getByRole("radio", { name: /여유롭게/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /여유롭게/ }).querySelectorAll("svg").length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("applies category tone on unselected card icon container and primary when selected", () => {
    const { rerender } = render(
      <PlannerChoiceCard
        title="균형 있게"
        description="관광과 휴식"
        selected={false}
        icon={User}
        iconTone="blue"
      />,
    );
    const card = screen.getByRole("radio", { name: /균형 있게/ });
    const container = card.querySelector("span.inline-flex.h-8");
    expect(container?.className).toMatch(/bg-blue-50/);
    expect(container?.className).toMatch(/text-blue-600/);
    expect(card.className).not.toMatch(/bg-blue-50/);

    rerender(
      <PlannerChoiceCard
        title="균형 있게"
        description="관광과 휴식"
        selected
        icon={User}
        iconTone="blue"
      />,
    );
    const selected = screen.getByRole("radio", { name: /균형 있게/ });
    expect(selected.className).toMatch(/border-\[var\(--primary\)\]/);
    const selectedContainer = selected.querySelector("span.inline-flex.h-8");
    expect(selectedContainer?.className).toMatch(/bg-\[var\(--primary-soft\)\]/);
    expect(selectedContainer?.className).toMatch(/text-\[var\(--primary\)\]/);
    expect(selectedContainer?.className).not.toMatch(/bg-blue-50/);
  });
});

describe("PlannerConversationShell hierarchy", () => {
  it("renders current before history in the DOM", () => {
    const draft = createEmptyPlannerDraftInput("오사카", "서울");
    render(
      <PlannerConversationShell
        step={2}
        draft={draft}
        editingFromSummary={false}
        onEditCompletedStep={vi.fn()}
      >
        <p>현재 질문</p>
      </PlannerConversationShell>,
    );

    const current = screen.getByTestId("planner-conversation-current");
    const historySummary = screen.getByText(/지금까지 선택한 조건/);
    expect(current.compareDocumentPosition(historySummary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("현재 질문")).toBeInTheDocument();
  });

  it("applies header-aware scroll-margin on the current step container", () => {
    const draft = createEmptyPlannerDraftInput("오사카", "서울");
    render(
      <PlannerConversationShell
        step={1}
        draft={draft}
        editingFromSummary={false}
        onEditCompletedStep={vi.fn()}
      >
        <p>step1</p>
      </PlannerConversationShell>,
    );
    expect(screen.getByTestId("planner-conversation-current").className).toContain(
      "scroll-mt-[calc(var(--mobile-header-top-height)+0.75rem)]",
    );
  });

  it("hides history on step 1 and collapses by default when completed", () => {
    const empty = createEmptyPlannerDraftInput();
    const { rerender } = render(
      <PlannerConversationShell
        step={1}
        draft={empty}
        editingFromSummary={false}
        onEditCompletedStep={vi.fn()}
      >
        <p>step1</p>
      </PlannerConversationShell>,
    );
    expect(screen.queryByText(/지금까지 선택한 조건/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("지금까지 알려주신 여행 조건")).not.toBeInTheDocument();

    const draft = createEmptyPlannerDraftInput("오사카", "서울");
    const onEdit = vi.fn();
    rerender(
      <PlannerConversationShell
        step={2}
        draft={draft}
        editingFromSummary={false}
        onEditCompletedStep={onEdit}
      >
        <p>step2</p>
      </PlannerConversationShell>,
    );

    expect(screen.getByText("지금까지 선택한 조건 1개")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "보기" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("서울 → 오사카")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("지금까지 알려주신 여행 조건")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "보기" }));
    expect(screen.getByRole("button", { name: "접기" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("서울 → 오사카")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    expect(onEdit).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: "접기" }));
    expect(screen.queryByText("서울 → 오사카")).not.toBeInTheDocument();
  });

  it("hides conversation history on step 7 to avoid duplicate summary", () => {
    const draft = createEmptyPlannerDraftInput("오사카", "서울");
    render(
      <PlannerConversationShell
        step={7}
        draft={draft}
        editingFromSummary={false}
        onEditCompletedStep={vi.fn()}
      >
        <p>summary</p>
      </PlannerConversationShell>,
    );
    expect(screen.queryByText(/지금까지 선택한 조건/)).not.toBeInTheDocument();
  });
});

describe("PlannerConversationShell step scroll restoration", () => {
  const scrollIntoView = vi.fn();
  let matchMediaMock: ReturnType<typeof vi.fn>;

  function setReducedMotion(matches: boolean) {
    matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.stubGlobal("matchMedia", matchMediaMock);
  }

  beforeEach(() => {
    scrollIntoView.mockReset();
    Element.prototype.scrollIntoView = scrollIntoView;
    setReducedMotion(false);
  });

  function renderShell(step: 1 | 2 | 3 | 5 | 6 | 7, editingFromSummary = false) {
    const draft = createEmptyPlannerDraftInput("오사카", "서울");
    return render(
      <PlannerConversationShell
        step={step}
        draft={draft}
        editingFromSummary={editingFromSummary}
        onEditCompletedStep={vi.fn()}
      >
        <p>{`step-${step}`}</p>
      </PlannerConversationShell>,
    );
  }

  it("does not scroll on initial Step1 mount", () => {
    renderShell(1);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("scrolls to start when Step 1 → 2", () => {
    const { rerender } = renderShell(1);
    const draft = createEmptyPlannerDraftInput("오사카", "서울");
    rerender(
      <PlannerConversationShell
        step={2}
        draft={draft}
        editingFromSummary={false}
        onEditCompletedStep={vi.fn()}
      >
        <p>step-2</p>
      </PlannerConversationShell>,
    );
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "smooth",
    });
  });

  it("scrolls when Step 5 → 6", () => {
    const { rerender } = renderShell(5);
    expect(scrollIntoView).not.toHaveBeenCalled();
    const draft = createEmptyPlannerDraftInput("오사카", "서울");
    rerender(
      <PlannerConversationShell
        step={6}
        draft={draft}
        editingFromSummary={false}
        onEditCompletedStep={vi.fn()}
      >
        <p>step-6</p>
      </PlannerConversationShell>,
    );
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "smooth",
    });
  });

  it("scrolls on Back (Step 3 → 2)", () => {
    const { rerender } = renderShell(3);
    const draft = createEmptyPlannerDraftInput("오사카", "서울");
    rerender(
      <PlannerConversationShell
        step={2}
        draft={draft}
        editingFromSummary={false}
        onEditCompletedStep={vi.fn()}
      >
        <p>step-2</p>
      </PlannerConversationShell>,
    );
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "smooth",
    });
  });

  it("scrolls on summary edit Step7 → Step3", () => {
    const { rerender } = renderShell(7);
    const draft = createEmptyPlannerDraftInput("오사카", "서울");
    rerender(
      <PlannerConversationShell
        step={3}
        draft={draft}
        editingFromSummary={true}
        onEditCompletedStep={vi.fn()}
      >
        <p>step-3</p>
      </PlannerConversationShell>,
    );
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "smooth",
    });
  });

  it("scrolls on 수정 완료 Step3 → Step7", () => {
    const draft = createEmptyPlannerDraftInput("오사카", "서울");
    const { rerender } = render(
      <PlannerConversationShell
        step={3}
        draft={draft}
        editingFromSummary={true}
        onEditCompletedStep={vi.fn()}
      >
        <p>step-3</p>
      </PlannerConversationShell>,
    );
    expect(scrollIntoView).not.toHaveBeenCalled();
    rerender(
      <PlannerConversationShell
        step={7}
        draft={draft}
        editingFromSummary={false}
        onEditCompletedStep={vi.fn()}
      >
        <p>step-7</p>
      </PlannerConversationShell>,
    );
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "smooth",
    });
  });

  it("uses behavior auto when prefers-reduced-motion", () => {
    setReducedMotion(true);
    const { rerender } = renderShell(1);
    const draft = createEmptyPlannerDraftInput("오사카", "서울");
    rerender(
      <PlannerConversationShell
        step={2}
        draft={draft}
        editingFromSummary={false}
        onEditCompletedStep={vi.fn()}
      >
        <p>step-2</p>
      </PlannerConversationShell>,
    );
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "auto",
    });
  });
});

describe("PlannerWizard conversation UX", () => {
  it("shows step 1 assistant question, choices, and Next CTA without history", () => {
    render(<PlannerWizard />);
    expect(screen.getByText(PLANNER_ASSISTANT_QUESTIONS[1])).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "서울" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "오사카" })).toBeInTheDocument();
    expect(screen.queryByText(/지금까지 선택한 조건/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음" })).toBeInTheDocument();
  });

  it("creates session, advances to step 2, and keeps history collapsed", async () => {
    mockSessionFetch();

    render(<PlannerWizard />);
    fireEvent.click(screen.getByRole("button", { name: "서울" }));
    fireEvent.click(screen.getByRole("button", { name: "오사카" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() => {
      expect(screen.getByText(PLANNER_ASSISTANT_QUESTIONS[2])).toBeInTheDocument();
    });
    expect(screen.getByText("지금까지 선택한 조건 1개")).toBeInTheDocument();
    expect(screen.queryByText("서울 → 오사카")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "날짜를 정했어요" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "보기" }));
    expect(screen.getByText("서울 → 오사카")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "수정" })).toBeInTheDocument();
  });

  it("shows companion icons and selected check on step 3 via QA jump", async () => {
    searchParams.get.mockImplementation((key: string) => (key === "qa" ? "1" : null));
    mockSessionFetch("550e8400-e29b-41d4-a716-446655440013");

    render(<PlannerWizard qaEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "3" }));

    await waitFor(() => {
      expect(screen.getByText(PLANNER_ASSISTANT_QUESTIONS[3])).toBeInTheDocument();
    });

    const family = screen.getByRole("button", { name: "가족" });
    expect(family.querySelector("svg")).toBeTruthy();
    expect(family.querySelector("span.inline-flex.h-6")?.className).toMatch(/bg-amber-50/);

    fireEvent.click(family);
    const couple = screen.getByRole("button", { name: "연인" });
    expect(couple.querySelector("span.inline-flex.h-6")?.className).toMatch(/bg-rose-50/);
    fireEvent.click(couple);
    expect(couple).toHaveAttribute("aria-pressed", "true");
    expect(couple.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);
    expect(couple.querySelector("span.inline-flex.h-6")?.className).toMatch(
      /bg-\[var\(--primary-soft\)\]/,
    );
  });

  it("shows step 4 title, interest icons, and theme chips via QA jump", async () => {
    searchParams.get.mockImplementation((key: string) => (key === "qa" ? "1" : null));
    mockSessionFetch("550e8400-e29b-41d4-a716-446655440014");

    render(<PlannerWizard qaEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "4" }));

    await waitFor(() => {
      expect(screen.getByText(PLANNER_ASSISTANT_QUESTIONS[4])).toBeInTheDocument();
    });
    expect(screen.getByText(PLANNER_ASSISTANT_DESCRIPTIONS[4]!)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "자연" })).toBeEnabled();
    });
    const nature = screen.getByRole("button", { name: "자연" });
    expect(nature.querySelector("svg")).toBeTruthy();
    expect(nature.querySelector("span.inline-flex.h-6")?.className).toMatch(/bg-emerald-50/);
    fireEvent.click(nature);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "자연" })).toHaveAttribute("aria-pressed", "true");
    });
    expect(screen.getByRole("button", { name: "자연" }).querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);

    const shopping = screen.getByRole("button", { name: "쇼핑" });
    expect(shopping.querySelector("span.inline-flex.h-6")?.className).toMatch(/bg-violet-50/);

    const food = screen.getByRole("button", { name: "맛집" });
    expect(food).toHaveAttribute("aria-pressed", "true");
    expect(food.querySelector("span.inline-flex.h-6")?.className).toMatch(
      /bg-\[var\(--primary-soft\)\]/,
    );

    const mood = screen.getByRole("button", { name: "현지 분위기" });
    expect(mood.querySelector("svg")).toBeTruthy();
    expect(mood.querySelector("span.inline-flex.h-6")?.className).toMatch(/bg-teal-50/);

    const romantic = screen.getByRole("button", { name: "감성적인 곳" });
    expect(romantic.querySelector("span.inline-flex.h-6")?.className).toMatch(/bg-rose-50/);
  });

  it("shows step 5 pace and budget ChoiceCards with custom amount flow", async () => {
    searchParams.get.mockImplementation((key: string) => (key === "qa" ? "1" : null));
    mockSessionFetch("550e8400-e29b-41d4-a716-446655440015");

    render(<PlannerWizard qaEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "5" }));

    await waitFor(() => {
      expect(screen.getByText(PLANNER_ASSISTANT_QUESTIONS[5])).toBeInTheDocument();
    });
    expect(screen.getByText(PLANNER_BUDGET_QUESTION)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /알차게/ })).toBeEnabled();
    });
    const pace = screen.getByRole("radio", { name: /알차게/ });
    expect(pace).toBeInTheDocument();
    expect(pace).toHaveTextContent("하루 시간을 적극 활용해 더 많은 경험");
    expect(pace.querySelector("span.inline-flex.h-8")?.className).toMatch(/bg-violet-50/);
    fireEvent.click(pace);
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /알차게/ })).toHaveAttribute("aria-checked", "true");
    });
    expect(pace.querySelector("span.inline-flex.h-8")?.className).toMatch(
      /bg-\[var\(--primary-soft\)\]/,
    );

    const balanced = screen.getByRole("radio", { name: /균형 있게/ });
    expect(balanced).toHaveTextContent("관광·식사·휴식을 적당히 배분");
    expect(balanced.querySelector("span.inline-flex.h-8")?.className).toMatch(/bg-blue-50/);

    const budget = screen.getByRole("radio", { name: /가성비 있게/ });
    expect(budget).toBeInTheDocument();
    expect(budget).toHaveTextContent("숙소·식사·이동에서 합리적인 선택 위주");
    fireEvent.click(budget);
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /가성비 있게/ })).toHaveAttribute("aria-checked", "true");
    });

    fireEvent.click(screen.getByRole("radio", { name: /금액을 정했어요/ }));
    expect(screen.getByLabelText("예산 (원)")).toBeInTheDocument();
    expect(screen.getByLabelText("예산 슬라이더")).toBeInTheDocument();
  });

  it("shows step 6 quick request icons and denser textarea copy", async () => {
    searchParams.get.mockImplementation((key: string) => (key === "qa" ? "1" : null));
    mockSessionFetch("550e8400-e29b-41d4-a716-446655440016");

    render(<PlannerWizard qaEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "6" }));

    await waitFor(() => {
      expect(screen.getByText(PLANNER_ASSISTANT_QUESTIONS[6])).toBeInTheDocument();
    });
    expect(screen.getByText(PLANNER_ASSISTANT_DESCRIPTIONS[6]!)).toBeInTheDocument();

    const expectedLabels = [
      "많이 걷지 않기",
      "이동시간 줄이기",
      "아침 일정 여유롭게",
      "밤늦은 일정 피하기",
      "자유시간 확보",
      "장소 이동 적게",
    ];
    for (const label of expectedLabels) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    for (const removed of [
      "아이와 편하게",
      "부모님과 편하게",
      "쇼핑시간 넉넉히",
      "맛집 위주",
      "휴식시간 충분히",
    ]) {
      expect(screen.queryByRole("button", { name: removed })).not.toBeInTheDocument();
    }

    const walking = screen.getByRole("button", { name: "많이 걷지 않기" });
    expect(walking.querySelector("svg")).toBeTruthy();
    expect(walking.querySelector("span.inline-flex.h-6")?.className).toMatch(/bg-slate-100/);
    fireEvent.click(walking);
    expect(walking).toHaveAttribute("aria-pressed", "true");

    const transfer = screen.getByRole("button", { name: "이동시간 줄이기" });
    expect(transfer.querySelector("span.inline-flex.h-6")?.className).toMatch(/bg-blue-50/);

    expect(screen.queryByText("직접 적어도 좋아요")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("자유 요청사항")).not.toBeInTheDocument();
    const textarea = screen.getByLabelText("다른 요청이 있다면 적어주세요");
    expect(textarea).toHaveAttribute("maxLength", "1000");
    expect(textarea.getAttribute("placeholder") ?? "").toContain(
      "아침 일정은 늦게 시작하고 싶어요",
    );
  });

  it("preserves legacy additionalRequest text without selecting new chips", async () => {
    searchParams.get.mockImplementation((key: string) => (key === "qa" ? "1" : null));
    mockSessionFetch("550e8400-e29b-41d4-a716-446655440031");

    render(<PlannerWizard qaEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "6" }));

    await waitFor(() => {
      expect(screen.getByText(PLANNER_ASSISTANT_QUESTIONS[6])).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText("다른 요청이 있다면 적어주세요");
    fireEvent.change(textarea, {
      target: { value: "맛집 위주로 일정을 잡아주세요." },
    });
    expect(textarea).toHaveValue("맛집 위주로 일정을 잡아주세요.");
    expect(screen.getByRole("button", { name: "많이 걷지 않기" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "이동시간 줄이기" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("appends new constraint insertText without duplicating on second click", async () => {
    searchParams.get.mockImplementation((key: string) => (key === "qa" ? "1" : null));
    mockSessionFetch("550e8400-e29b-41d4-a716-446655440032");

    render(<PlannerWizard qaEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "6" }));

    await waitFor(() => {
      expect(screen.getByText(PLANNER_ASSISTANT_QUESTIONS[6])).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText("다른 요청이 있다면 적어주세요") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "" } });

    const night = screen.getByRole("button", { name: "밤늦은 일정 피하기" });
    fireEvent.click(night);
    fireEvent.click(night);
    expect(textarea.value).toBe("밤늦게까지 이어지는 일정은 피해주세요.");
    expect(textarea.value.match(/밤늦게까지/g)?.length).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "자유시간 확보" }));
    expect(textarea.value).toContain("일정 중 자유시간을 충분히 확보해주세요.");
  });

  it("does not show collapsed history summary alongside step 7 summary", async () => {
    searchParams.get.mockImplementation((key: string) => (key === "qa" ? "1" : null));
    mockSessionFetch("550e8400-e29b-41d4-a716-446655440017");

    render(<PlannerWizard qaEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "7" }));

    await waitFor(() => {
      expect(screen.getByText(PLANNER_ASSISTANT_QUESTIONS[7])).toBeInTheDocument();
    });
    expect(screen.queryByText(/지금까지 선택한 조건/)).not.toBeInTheDocument();
    expect(screen.getByText("출발 · 도착")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "출발 · 도착 수정" })).toBeInTheDocument();
    expect(screen.getByText("여행 기간")).toBeInTheDocument();
    expect(screen.getByText("동행")).toBeInTheDocument();
    expect(screen.getByText("여행 테마")).toBeInTheDocument();
    expect(screen.getByText("속도 · 예산")).toBeInTheDocument();
    expect(screen.getByText("추가 요청")).toBeInTheDocument();
  });

  it("opens companion step from summary edit and returns after 수정 완료", async () => {
    searchParams.get.mockImplementation((key: string) => (key === "qa" ? "1" : null));
    mockSessionFetch("550e8400-e29b-41d4-a716-446655440018");

    render(<PlannerWizard qaEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "완성 직전으로" }));

    await waitFor(() => {
      expect(screen.getByText(PLANNER_ASSISTANT_QUESTIONS[7])).toBeInTheDocument();
    });

    const editCompanions = await screen.findByRole("button", { name: "동행 수정" });
    fireEvent.click(editCompanions);
    await waitFor(() => {
      expect(screen.getByText(PLANNER_ASSISTANT_QUESTIONS[3])).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "수정 완료" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "수정 완료" }));
    await waitFor(() => {
      expect(screen.getByText(PLANNER_ASSISTANT_QUESTIONS[7])).toBeInTheDocument();
    });
    expect(screen.getByText("동행")).toBeInTheDocument();
  });

  it("toggles destination chip selected state", () => {
    render(<PlannerWizard />);
    const osaka = screen.getByRole("button", { name: "오사카" });
    fireEvent.click(osaka);
    expect(osaka).toHaveAttribute("aria-pressed", "true");
  });

  it.each(["오사카", "다낭"] as const)(
    "clears preset destination %s when switching to custom other destination",
    (preset) => {
      render(<PlannerWizard />);
      fireEvent.click(screen.getByRole("button", { name: preset }));
      fireEvent.click(screen.getByRole("button", { name: "다른 여행지" }));

      const destinationInput = screen.getByLabelText("목적지") as HTMLInputElement;
      expect(destinationInput).toBeInTheDocument();
      expect(destinationInput.value).toBe("");
    },
  );

  it("selects preset after typing a custom destination", () => {
    render(<PlannerWizard />);
    fireEvent.click(screen.getByRole("button", { name: "다른 여행지" }));
    const destinationInput = screen.getByLabelText("목적지") as HTMLInputElement;
    fireEvent.change(destinationInput, { target: { value: "파리" } });
    expect(destinationInput.value).toBe("파리");

    const osaka = screen.getByRole("button", { name: "오사카" });
    fireEvent.click(osaka);
    expect(osaka).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "다른 여행지" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it.each(["서울", "부산"] as const)(
    "clears preset origin %s when switching to custom other origin",
    (preset) => {
      render(<PlannerWizard />);
      fireEvent.click(screen.getByRole("button", { name: preset }));
      fireEvent.click(screen.getByRole("button", { name: "다른 출발지" }));

      const originInput = screen.getByRole("textbox", { name: /출발지/ }) as HTMLInputElement;
      expect(originInput).toBeInTheDocument();
      expect(originInput.value).toBe("");
    },
  );

  it("selects preset origin after typing a custom origin", () => {
    render(<PlannerWizard />);
    fireEvent.click(screen.getByRole("button", { name: "다른 출발지" }));
    const originInput = screen.getByRole("textbox", { name: /출발지/ }) as HTMLInputElement;
    fireEvent.change(originInput, { target: { value: "뉴욕" } });
    expect(originInput.value).toBe("뉴욕");

    const seoul = screen.getByRole("button", { name: "서울" });
    fireEvent.click(seoul);
    expect(seoul).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "다른 출발지" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("preserves custom origin text when other-origin is clicked again", () => {
    render(<PlannerWizard />);
    fireEvent.click(screen.getByRole("button", { name: "다른 출발지" }));
    const originInput = screen.getByRole("textbox", { name: /출발지/ }) as HTMLInputElement;
    fireEvent.change(originInput, { target: { value: "뉴욕" } });

    fireEvent.click(screen.getByRole("button", { name: "다른 출발지" }));
    expect((screen.getByRole("textbox", { name: /출발지/ }) as HTMLInputElement).value).toBe(
      "뉴욕",
    );
  });

  it("resets travelers to companion defaults and applies counter constraints", async () => {
    searchParams.get.mockImplementation((key: string) => (key === "qa" ? "1" : null));
    mockSessionFetch("550e8400-e29b-41d4-a716-446655440020");

    render(<PlannerWizard qaEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "3" }));

    await waitFor(() => {
      expect(screen.getByText(PLANNER_ASSISTANT_QUESTIONS[3])).toBeInTheDocument();
    });

    const adultValue = () =>
      screen.getByLabelText("성인 늘리기").previousElementSibling?.textContent;
    const childValue = () =>
      screen.getByLabelText("아이 늘리기").previousElementSibling?.textContent;

    fireEvent.click(screen.getByRole("button", { name: "혼자" }));
    expect(adultValue()).toBe("1");
    expect(childValue()).toBe("0");
    expect(screen.getByLabelText("성인 늘리기")).toBeDisabled();
    expect(screen.getByLabelText("성인 줄이기")).toBeDisabled();
    expect(screen.getByLabelText("아이 늘리기")).toBeDisabled();
    expect(screen.getByLabelText("아이 줄이기")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "연인" }));
    expect(adultValue()).toBe("2");
    expect(childValue()).toBe("0");
    expect(screen.getByLabelText("성인 늘리기")).toBeDisabled();
    expect(screen.getByLabelText("아이 늘리기")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "친구" }));
    expect(adultValue()).toBe("2");
    expect(childValue()).toBe("0");
    expect(screen.getByLabelText("성인 줄이기")).toBeDisabled();
    expect(screen.getByLabelText("성인 늘리기")).not.toBeDisabled();
    fireEvent.click(screen.getByLabelText("성인 늘리기"));
    expect(adultValue()).toBe("3");
    expect(screen.getByLabelText("아이 늘리기")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "가족" }));
    expect(adultValue()).toBe("2");
    expect(childValue()).toBe("0");
    fireEvent.click(screen.getByLabelText("성인 늘리기"));
    fireEvent.click(screen.getByLabelText("아이 늘리기"));
    fireEvent.click(screen.getByLabelText("아이 늘리기"));
    expect(adultValue()).toBe("3");
    expect(childValue()).toBe("2");

    fireEvent.click(screen.getByRole("button", { name: "혼자" }));
    expect(adultValue()).toBe("1");
    expect(childValue()).toBe("0");

    fireEvent.click(screen.getByRole("button", { name: "부모님" }));
    expect(adultValue()).toBe("2");
    expect(childValue()).toBe("0");
    fireEvent.click(screen.getByLabelText("성인 늘리기"));
    expect(adultValue()).toBe("3");
    expect(screen.getByLabelText("성인 줄이기")).not.toBeDisabled();
    expect(screen.getByLabelText("아이 늘리기")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "아이와" }));
    expect(adultValue()).toBe("2");
    expect(childValue()).toBe("1");
    fireEvent.click(screen.getByLabelText("아이 늘리기"));
    expect(childValue()).toBe("2");
    expect(screen.getByLabelText("아이 줄이기")).not.toBeDisabled();
    fireEvent.click(screen.getByLabelText("아이 줄이기"));
    expect(childValue()).toBe("1");
    expect(screen.getByLabelText("아이 줄이기")).toBeDisabled();
  });

  it("keeps adjusted traveler counts when the same companion chip is re-clicked", async () => {
    searchParams.get.mockImplementation((key: string) => (key === "qa" ? "1" : null));
    mockSessionFetch("550e8400-e29b-41d4-a716-446655440021");

    render(<PlannerWizard qaEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "3" }));

    await waitFor(() => {
      expect(screen.getByText(PLANNER_ASSISTANT_QUESTIONS[3])).toBeInTheDocument();
    });

    const adultValue = () =>
      screen.getByLabelText("성인 늘리기").previousElementSibling?.textContent;

    fireEvent.click(screen.getByRole("button", { name: "친구" }));
    fireEvent.click(screen.getByLabelText("성인 늘리기"));
    fireEvent.click(screen.getByLabelText("성인 늘리기"));
    expect(adultValue()).toBe("4");

    fireEvent.click(screen.getByRole("button", { name: "친구" }));
    expect(adultValue()).toBe("4");

    fireEvent.click(screen.getByRole("button", { name: "아이와" }));
    expect(adultValue()).toBe("2");
    expect(screen.getByLabelText("아이 늘리기").previousElementSibling?.textContent).toBe("1");
  });

  it("shows LandingInfo on initial landing and hides it after conversation starts", async () => {
    mockSessionFetch();
    render(<PlannerWizard />);

    expect(screen.getByLabelText("자유여행 플래너 안내")).toBeInTheDocument();
    expect(screen.getByText("자유여행 플래너로 할 수 있는 것")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "서울" }));
    fireEvent.click(screen.getByRole("button", { name: "오사카" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() => {
      expect(screen.getByText(PLANNER_ASSISTANT_QUESTIONS[2])).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("자유여행 플래너 안내")).not.toBeInTheDocument();
    expect(screen.getByTestId("planner-wizard-footer")).toBeInTheDocument();
  });

  it("uses fixed footer with safe-area padding and reserved body clearance while active", async () => {
    mockSessionFetch();
    render(<PlannerWizard />);
    fireEvent.click(screen.getByRole("button", { name: "서울" }));
    fireEvent.click(screen.getByRole("button", { name: "오사카" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));

    await waitFor(() => {
      expect(screen.getByTestId("planner-wizard-footer")).toBeInTheDocument();
    });

    const footer = screen.getByTestId("planner-wizard-footer");
    expect(footer.className).toContain("fixed");
    expect(footer.className).toContain("sm:static");
    expect(footer.className).toContain("safe-area-inset-bottom");
    expect(footer.closest("[class*='pb-28']")).toBeTruthy();
  });

  it("renders Step7 finalize CTA with stable accessible name and nowrap mobile copy", async () => {
    searchParams.get.mockImplementation((key: string) => (key === "qa" ? "1" : null));
    mockSessionFetch("550e8400-e29b-41d4-a716-446655440030");

    render(<PlannerWizard qaEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "7" }));

    await waitFor(() => {
      expect(screen.getByText(PLANNER_ASSISTANT_QUESTIONS[7])).toBeInTheDocument();
    });

    const finalize = screen.getByRole("button", { name: "이 조건으로 여행 만들기" });
    expect(finalize).toBeInTheDocument();
    expect(finalize.querySelector("svg")).toBeTruthy();
    expect(finalize.querySelector(".whitespace-nowrap")).toBeTruthy();
    expect(finalize.querySelector(".sm\\:hidden")).toHaveTextContent("여행 만들기");
    expect(finalize.querySelector(".hidden.sm\\:inline")).toHaveTextContent(
      "이 조건으로 여행 만들기",
    );
    expect(screen.getByRole("button", { name: "이전 질문" })).toBeInTheDocument();
  });
});
