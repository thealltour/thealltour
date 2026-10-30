import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlannerEditPanel } from "@/components/planner/PlannerEditPanel";

vi.mock("@/lib/planner/anonymousKey", () => ({
  getOrCreatePlannerAnonymousKey: () => "anon-key-12345678",
}));

vi.mock("@/lib/analytics/trackPlannerEvents", () => ({
  trackPlannerEditStarted: vi.fn(),
  trackPlannerEditSucceeded: vi.fn(),
  trackPlannerEditFailed: vi.fn(),
}));

vi.mock("@/components/planner/PlannerGenerationView", () => ({
  PlannerGenerationView: () => <div data-testid="generation-view" />,
}));

describe("PlannerEditPanel AI Edit quota UX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AI_EDIT_QUOTA_EXCEEDED shows copy + Manual Edit CTA", async () => {
    const onRequestManualEdit = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            code: "AI_EDIT_QUOTA_EXCEEDED",
            message: "오늘의 AI 수정 횟수를 모두 사용했어요.",
            limit: 3,
            nextAvailableAt: "2026-10-31T15:00:00.000Z",
          }),
          { status: 429 },
        ),
      ),
    );

    render(
      <PlannerEditPanel
        sessionId="11111111-1111-4111-8111-111111111111"
        destination="오사카"
        sourceProductId={null}
        status="generated"
        onPlanUpdated={vi.fn()}
        onRequestManualEdit={onRequestManualEdit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "AI로 일정 수정하기" }));
    fireEvent.change(screen.getByPlaceholderText(/2일차/), {
      target: { value: "여유롭게 바꿔줘" },
    });
    fireEvent.click(screen.getByRole("button", { name: "일정 수정하기" }));

    await waitFor(() => {
      expect(screen.getByTestId("planner-ai-edit-quota-exceeded")).toHaveTextContent(
        /오늘의 AI 수정 횟수를 모두 사용했어요/,
      );
    });
    expect(screen.getByText(/직접 수정은 계속 사용할 수 있습니다/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "직접 수정하기" }));
    expect(onRequestManualEdit).toHaveBeenCalledTimes(1);
  });

  it("AI_EDIT_ALREADY_IN_PROGRESS shows in-progress copy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            code: "AI_EDIT_ALREADY_IN_PROGRESS",
            message: "AI가 이미 이 플랜을 수정하고 있어요.",
          }),
          { status: 409 },
        ),
      ),
    );

    render(
      <PlannerEditPanel
        sessionId="11111111-1111-4111-8111-111111111111"
        destination="오사카"
        sourceProductId={null}
        status="saved"
        onPlanUpdated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "AI로 일정 수정하기" }));
    fireEvent.change(screen.getByPlaceholderText(/2일차/), {
      target: { value: "맛집 더 추가" },
    });
    fireEvent.click(screen.getByRole("button", { name: "일정 수정하기" }));

    await waitFor(() => {
      expect(screen.getByTestId("planner-ai-edit-in-progress")).toHaveTextContent(
        /AI가 이미 이 플랜을 수정하고 있어요/,
      );
    });
  });

  it("generic 500 keeps existing error UX", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ message: "서버 오류", code: "edit_failed" }), {
          status: 502,
        }),
      ),
    );

    render(
      <PlannerEditPanel
        sessionId="11111111-1111-4111-8111-111111111111"
        destination="오사카"
        sourceProductId={null}
        status="generated"
        onPlanUpdated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "AI로 일정 수정하기" }));
    fireEvent.change(screen.getByPlaceholderText(/2일차/), {
      target: { value: "여유롭게" },
    });
    fireEvent.click(screen.getByRole("button", { name: "일정 수정하기" }));

    await waitFor(() => {
      expect(screen.getByTestId("planner-ai-edit-error")).toHaveTextContent("서버 오류");
    });
    expect(screen.queryByRole("button", { name: "직접 수정하기" })).not.toBeInTheDocument();
  });
});
