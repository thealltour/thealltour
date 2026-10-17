import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import {
  PlannerConversationStep4,
  PlannerConversationSummary,
  summarySectionToStep,
} from "@/components/planner/conversation/PlannerConversationSteps";
import { createEmptyPlannerDraftInput } from "@/lib/planner/constants";
import type { PlannerDraftInput } from "@/types/planner";

afterEach(() => cleanup());

const MUST_DO_LABEL = "꼭 가고 싶은 곳 · 체험";

function Step4Harness({
  initial,
  onDraft,
}: {
  initial: PlannerDraftInput;
  onDraft: (draft: PlannerDraftInput) => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <PlannerConversationStep4
      draft={draft}
      patchDraft={(patch) => {
        const next = { ...draft, ...patch };
        onDraft(next);
        setDraft(next);
      }}
    />
  );
}

function mustDoTextbox() {
  return screen.queryByRole("textbox", { name: MUST_DO_LABEL }) as HTMLTextAreaElement | null;
}

function openMustDoInput(): HTMLTextAreaElement {
  const group = screen.getByRole("group", { name: MUST_DO_LABEL });
  fireEvent.click(within(group).getByRole("button", { name: "직접 입력하기" }));
  const textarea = mustDoTextbox();
  if (!textarea) throw new Error("mustDo textarea not rendered");
  return textarea;
}

describe("PR-9AL Step 4 mustDo input (G)", () => {
  it("is collapsed by default and shows the question", () => {
    render(<Step4Harness initial={createEmptyPlannerDraftInput()} onDraft={vi.fn()} />);
    expect(screen.getByText("꼭 가고 싶거나 해보고 싶은 게 있나요?")).toBeInTheDocument();
    expect(mustDoTextbox()).toBeNull();
  });

  it("stores comma/newline separated text as string[] without rewriting the text", () => {
    const onDraft = vi.fn();
    render(<Step4Harness initial={createEmptyPlannerDraftInput()} onDraft={onDraft} />);
    const textarea = openMustDoInput();
    expect(textarea).toHaveAttribute("placeholder", "예: USJ, 오사카성, 온천, 야경 크루즈");
    expect(
      screen.getByText("선택 사항입니다. 장소나 체험을 최대 5개까지 적어 주세요."),
    ).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: "USJ, " } });
    expect(mustDoTextbox()?.value).toBe("USJ, ");
    expect(onDraft.mock.calls.at(-1)?.[0].mustDo).toEqual(["USJ"]);

    fireEvent.change(textarea, { target: { value: "USJ, 오사카성\n온천" } });
    expect(mustDoTextbox()?.value).toBe("USJ, 오사카성\n온천");
    expect(onDraft.mock.calls.at(-1)?.[0].mustDo).toEqual(["USJ", "오사카성", "온천"]);
  });

  it("keeps interests and themeRequest untouched", () => {
    const onDraft = vi.fn();
    const initial: PlannerDraftInput = {
      ...createEmptyPlannerDraftInput(),
      interests: ["food"],
      themeRequest: "여유",
    };
    render(<Step4Harness initial={initial} onDraft={onDraft} />);
    fireEvent.change(openMustDoInput(), { target: { value: "온천" } });
    const last = onDraft.mock.calls.at(-1)?.[0] as PlannerDraftInput;
    expect(last.mustDo).toEqual(["온천"]);
    expect(last.interests).toEqual(["food"]);
    expect(last.themeRequest).toBe("여유");
    expect(last.additionalRequest).toBe("");
  });

  it("restores saved mustDo one per line (opened)", () => {
    render(
      <Step4Harness
        initial={{ ...createEmptyPlannerDraftInput(), mustDo: ["USJ", "오사카성"] }}
        onDraft={vi.fn()}
      />,
    );
    expect(mustDoTextbox()?.value).toBe("USJ\n오사카성");
  });
});

describe("PR-9AL Summary mustDo row (H)", () => {
  it("shows mustDo and edits via Step 4", () => {
    const onEditSection = vi.fn();
    render(
      <PlannerConversationSummary
        draft={{ ...createEmptyPlannerDraftInput("오사카"), mustDo: ["USJ", "오사카성", "온천"] }}
        onEditSection={onEditSection}
      />,
    );
    expect(screen.getByText(MUST_DO_LABEL)).toBeInTheDocument();
    expect(screen.getByText("USJ · 오사카성 · 온천")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `${MUST_DO_LABEL} 수정` }));
    expect(onEditSection).toHaveBeenCalledWith("themes");
    expect(summarySectionToStep("themes")).toBe(4);
  });

  it("hides the row when mustDo is empty", () => {
    render(
      <PlannerConversationSummary
        draft={createEmptyPlannerDraftInput("오사카")}
        onEditSection={vi.fn()}
      />,
    );
    expect(screen.queryByText(MUST_DO_LABEL)).not.toBeInTheDocument();
  });
});
