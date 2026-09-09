import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlannerWizard } from "@/components/planner/PlannerWizard";

const searchParams = vi.hoisted(() => ({
  get: vi.fn((key: string) => (key === "qa" ? "1" : null)),
}));
const push = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/planner/anonymousKey", () => ({
  getOrCreatePlannerAnonymousKey: () => "anon-qa-test-key12",
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

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  searchParams.get.mockImplementation((key: string) => (key === "qa" ? "1" : null));
});

describe("PlannerWizard QA panel visibility", () => {
  it("hides panel when qaEnabled=false", () => {
    render(<PlannerWizard qaEnabled={false} />);
    expect(screen.queryByTestId("planner-qa-panel")).not.toBeInTheDocument();
  });

  it("hides panel when enabled but qa query missing", () => {
    searchParams.get.mockReturnValue(null);
    render(<PlannerWizard qaEnabled />);
    expect(screen.queryByTestId("planner-qa-panel")).not.toBeInTheDocument();
  });

  it("shows panel when enabled and qa=1", () => {
    render(<PlannerWizard qaEnabled />);
    expect(screen.getByTestId("planner-qa-panel")).toBeInTheDocument();
  });
});

describe("PlannerWizard QA session + step 7 ready", () => {
  it("creates session, patches draft, and lands on step 7", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/api/planner/sessions") && method === "POST") {
        return new Response(
          JSON.stringify({
            session: {
              id: "550e8400-e29b-41d4-a716-446655440099",
              origin: "서울",
              destination: "오사카",
              sourceProductId: null,
              input: {
                origin: { text: "서울" },
                destination: { text: "오사카" },
              },
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/planner/sessions/") && method === "PATCH") {
        return new Response(
          JSON.stringify({
            session: { id: "550e8400-e29b-41d4-a716-446655440099" },
            finalized: false,
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ message: "unexpected" }), { status: 500 });
    });

    render(<PlannerWizard qaEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "완성 직전으로" }));

    await waitFor(() => {
      expect(screen.getByText("입력하신 조건을 확인해주세요")).toBeInTheDocument();
    });

    const methods = fetchMock.mock.calls.map((c) => (c[1] as RequestInit | undefined)?.method);
    expect(methods).toContain("POST");
    expect(methods.filter((m) => m === "PATCH").length).toBeGreaterThanOrEqual(1);
  });
});

describe("PlannerWizard QA generate order", () => {
  it("POST create → PATCH → finalize PATCH → POST generate → navigate", async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    fetchMock.mockImplementation(async (input: RequestInfo, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });

      if (url.endsWith("/api/planner/sessions") && method === "POST") {
        return new Response(
          JSON.stringify({
            session: {
              id: "550e8400-e29b-41d4-a716-446655440088",
              origin: "서울",
              destination: "오사카",
              sourceProductId: null,
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/generate") && method === "POST") {
        return new Response(
          JSON.stringify({
            session: {
              id: "550e8400-e29b-41d4-a716-446655440088",
              plan: { days: [{ items: [] }] },
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("/api/planner/sessions/") && method === "PATCH") {
        return new Response(
          JSON.stringify({
            session: { id: "550e8400-e29b-41d4-a716-446655440088" },
            finalized: Boolean(body?.finalize),
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 500 });
    });

    render(<PlannerWizard qaEnabled />);
    fireEvent.click(screen.getByRole("button", { name: "바로 생성 테스트" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/planner/550e8400-e29b-41d4-a716-446655440088");
    });

    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.url).toContain("/api/planner/sessions");
    expect(calls.some((c) => c.method === "PATCH" && c.body && (c.body as { finalize?: boolean }).finalize === true)).toBe(
      true,
    );
    expect(calls.some((c) => c.url.includes("/generate") && c.method === "POST")).toBe(true);
  });
});
