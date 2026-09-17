import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PlannerWizard } from "@/components/planner/PlannerWizard";
import { PlannerConversationShell } from "@/components/planner/conversation/PlannerConversationShell";
import { PlannerChoiceChip } from "@/components/planner/conversation/PlannerChoiceChip";
import { PlannerChoiceCard } from "@/components/planner/conversation/PlannerChoiceCard";
import { User } from "lucide-react";
import {
  formatCompletedStepAnswer,
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
  get: vi.fn(() => null as string | null),
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
    expect(formatCompletedStepAnswer(3, draft)).toContain("연인");
    expect(formatCompletedStepAnswer(4, draft)).toContain("맛집");
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
    expect(PLANNER_ASSISTANT_QUESTIONS[6]).toBe("꼭 반영했으면 하는 조건이 있나요?");
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

    const couple = screen.getByRole("button", { name: "연인" });
    expect(couple.querySelector("svg")).toBeTruthy();
    fireEvent.click(couple);
    expect(couple).toHaveAttribute("aria-pressed", "true");
    expect(couple.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);
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

    const nature = screen.getByRole("button", { name: "자연" });
    expect(nature.querySelector("svg")).toBeTruthy();
    fireEvent.click(nature);
    expect(nature).toHaveAttribute("aria-pressed", "true");
    expect(nature.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);

    const mood = screen.getByRole("button", { name: "현지 분위기" });
    expect(mood.querySelector("svg")).toBeTruthy();
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

    const pace = screen.getByRole("radio", { name: /여유롭게.*하루 2~3곳/ });
    expect(pace).toBeInTheDocument();
    fireEvent.click(pace);
    expect(pace).toHaveAttribute("aria-checked", "true");

    const budget = screen.getByRole("radio", { name: /가성비 있게/ });
    expect(budget).toBeInTheDocument();
    fireEvent.click(budget);
    expect(budget).toHaveAttribute("aria-checked", "true");

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

    const walking = screen.getByRole("button", { name: "많이 걷지 않기" });
    expect(walking.querySelector("svg")).toBeTruthy();
    fireEvent.click(walking);
    expect(walking).toHaveAttribute("aria-pressed", "true");

    expect(screen.queryByText("직접 적어도 좋아요")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("자유 요청사항")).not.toBeInTheDocument();
    const textarea = screen.getByLabelText("다른 요청이 있다면 적어주세요");
    expect(textarea).toHaveAttribute("maxLength", "1000");
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
    expect(screen.getByText("출발·도착")).toBeInTheDocument();
  });

  it("toggles destination chip selected state", () => {
    render(<PlannerWizard />);
    const osaka = screen.getByRole("button", { name: "오사카" });
    fireEvent.click(osaka);
    expect(osaka).toHaveAttribute("aria-pressed", "true");
  });
});
