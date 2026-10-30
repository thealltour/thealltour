import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PlannerWizard } from "@/components/planner/PlannerWizard";
import { startOAuthLogin } from "@/lib/auth/oauthStart";
import { setPlannerGenerationIntent } from "@/lib/planner/generationIntent";

const searchParams = vi.hoisted(() => ({
  get: vi.fn((): string | null => null),
}));
const push = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/planner/anonymousKey", () => ({
  getOrCreatePlannerAnonymousKey: () => "anon-quota-test-key1",
}));

vi.mock("@/lib/auth/oauthStart", () => ({
  startOAuthLogin: vi.fn(),
}));

vi.mock("@/lib/analytics/trackPlannerEvents", () => ({
  trackPlannerLandingView: vi.fn(),
  trackPlannerStarted: vi.fn(),
  trackPlannerGenerationStarted: vi.fn(),
  trackPlannerPlanGenerated: vi.fn(),
  trackPlannerGenerationFailed: vi.fn(),
  trackPlannerGenerationQuotaBlocked: vi.fn(),
  trackPlannerInputCompleted: vi.fn(),
  trackPlannerSummaryEditClicked: vi.fn(),
}));

vi.stubGlobal("fetch", fetchMock);

const SESSION_ID = "550e8400-e29b-41d4-a716-446655440077";

function mockWizardToSummaryThenGenerate(generateResponse: {
  status: number;
  body: unknown;
}) {
  fetchMock.mockImplementation(async (input: RequestInfo, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.endsWith("/api/planner/sessions") && method === "POST") {
      return new Response(
        JSON.stringify({
          session: {
            id: SESSION_ID,
            origin: "서울",
            destination: "오사카",
            sourceProductId: null,
          },
        }),
        { status: 200 },
      );
    }
    if (url.includes("/generate") && method === "POST") {
      return new Response(JSON.stringify(generateResponse.body), {
        status: generateResponse.status,
      });
    }
    if (url.includes("/api/planner/sessions/") && method === "PATCH") {
      return new Response(
        JSON.stringify({ session: { id: SESSION_ID }, finalized: true }),
        { status: 200 },
      );
    }
    return new Response("{}", { status: 500 });
  });
}

async function triggerQaGenerate(generateResponse: { status: number; body: unknown }) {
  mockWizardToSummaryThenGenerate(generateResponse);
  searchParams.get.mockImplementation((...args: unknown[]) =>
    args[0] === "qa" ? "1" : null,
  );
  render(<PlannerWizard qaEnabled />);
  fireEvent.click(screen.getByRole("button", { name: "바로 생성 테스트" }));
}

describe("PlannerWizard quota UX", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    searchParams.get.mockReturnValue(null);
    try {
      window.sessionStorage.clear();
    } catch {
      // ignore
    }
  });

  it("A. Guest lifetime exceeded — dedicated copy + Kakao CTA", async () => {
    await triggerQaGenerate({
      status: 429,
      body: {
        code: "ANONYMOUS_LIFETIME_QUOTA_EXCEEDED",
        message: "비회원은 이 기기에서 AI 여행 플랜을 1회 만들 수 있어요.",
      },
    });

    await waitFor(() => {
      expect(screen.getByText("무료 플랜 1회를 사용했어요.")).toBeInTheDocument();
    });
    expect(screen.getByText(/카카오로 로그인하면 매일/)).toBeInTheDocument();
    expect(screen.queryByText("플랜 생성에 실패했습니다")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "카카오로 계속하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "여행 조건 수정하기" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "카카오로 계속하기" }));
    expect(startOAuthLogin).toHaveBeenCalledWith(
      "kakao",
      expect.objectContaining({
        nextPath: `/planner?resumeSession=${SESSION_ID}`,
      }),
    );
  });

  it("B. Member daily exceeded — dedicated copy, no login CTA", async () => {
    await triggerQaGenerate({
      status: 429,
      body: {
        code: "AI_DAILY_QUOTA_EXCEEDED",
        message: "오늘의 AI 플랜 생성권을 모두 사용했어요.",
        nextAvailableAt: "2026-10-31T15:00:00.000Z",
      },
    });

    await waitFor(() => {
      expect(
        screen.getByText("오늘의 AI 플랜 생성권을 모두 사용했어요."),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/내일 00시/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "카카오로 계속하기" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "내 여행 플랜 보기" })).toHaveAttribute(
      "href",
      "/planner/my",
    );
    expect(screen.getByRole("button", { name: "여행 조건 확인하기" })).toBeInTheDocument();
  });

  it("C. Provider failure keeps retry + edit CTAs", async () => {
    await triggerQaGenerate({
      status: 502,
      body: {
        code: "generation_failed",
        failureCategory: "provider_failed",
        message: "여행 플랜을 만드는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      },
    });

    await waitFor(() => {
      expect(screen.getByText("플랜 생성에 실패했습니다")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "다시 시도하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "여행 조건 수정하기" })).toBeInTheDocument();
    expect(screen.queryByText("무료 플랜 1회를 사용했어요.")).not.toBeInTheDocument();
  });

  it("generation intent helper stores sessionId", () => {
    setPlannerGenerationIntent(SESSION_ID);
    expect(window.sessionStorage.getItem("theall_planner_generation_intent")).toContain(
      SESSION_ID,
    );
  });
});
