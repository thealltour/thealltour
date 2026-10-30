import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PlannerSavePanel } from "@/components/planner/PlannerSavePanel";

const replace = vi.fn();
const searchParamsGet = vi.fn((_key?: string) => null as string | null);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/planner/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  useSearchParams: () => ({
    get: searchParamsGet,
    toString: () => "",
  }),
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

vi.mock("@/lib/analytics/trackPlannerEvents", () => ({
  trackPlannerKakaoLoginStarted: vi.fn(),
  trackPlannerKakaoMemoClicked: vi.fn(),
  trackPlannerKakaoMemoOAuthStarted: vi.fn(),
  trackPlannerKakaoCalendarClicked: vi.fn(),
  trackPlannerKakaoCalendarOAuthStarted: vi.fn(),
  trackPlannerSaveClicked: vi.fn(),
  trackPlannerSaved: vi.fn(),
}));

vi.mock("@/lib/planner/saveClient", () => ({
  fetchPlannerMemberAuthenticated: vi.fn(async () => true),
  postPlannerSessionSave: vi.fn(async () => ({
    ok: true,
    claimed: false,
    session: {
      id: "sess",
      status: "saved",
      isSaved: true,
      updatedAt: "2026-10-31T00:00:00.000Z",
    },
  })),
}));

vi.mock("@/lib/auth/oauthStart", () => ({
  startOAuthLogin: vi.fn(),
}));

describe("PlannerSavePanel kakao memo/calendar CTA", () => {
  const sessionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const assign = vi.fn();

  beforeEach(() => {
    replace.mockReset();
    searchParamsGet.mockReturnValue(null);
    assign.mockReset();
    // @ts-expect-error test stub
    delete window.location;
    // @ts-expect-error test stub
    window.location = { href: "" };
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "", assign },
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows memo + calendar CTAs after save without auto-sending", () => {
    render(
      <PlannerSavePanel
        sessionId={sessionId}
        destination="오사카"
        sourceProductId={null}
        isSaved
        onSaved={() => undefined}
        compact
      />,
    );

    expect(screen.getByText(/여행 플랜이 저장됐어요/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "카카오톡으로 받아보기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "톡캘린더에 추가" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "내 여행 플랜 보기" })).toBeTruthy();
    expect(window.location.href).toBe("");
  });

  it("starts memo action OAuth on CTA click", () => {
    render(
      <PlannerSavePanel
        sessionId={sessionId}
        destination="오사카"
        sourceProductId={null}
        isSaved
        onSaved={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "카카오톡으로 받아보기" }));
    expect(window.location.href).toContain(
      `/api/planner/sessions/${sessionId}/kakao-memo/start`,
    );
  });

  it("starts calendar action OAuth on CTA click", () => {
    render(
      <PlannerSavePanel
        sessionId={sessionId}
        destination="오사카"
        sourceProductId={null}
        isSaved
        onSaved={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "톡캘린더에 추가" }));
    expect(window.location.href).toContain(
      `/api/planner/sessions/${sessionId}/kakao-calendar/start`,
    );
  });

  it("shows memo failure copy and retry without unsaving", () => {
    searchParamsGet.mockImplementation((key?: string) =>
      key === "plannerKakaoMemo" ? "failed" : null,
    );

    render(
      <PlannerSavePanel
        sessionId={sessionId}
        destination="오사카"
        sourceProductId={null}
        isSaved
        onSaved={() => undefined}
      />,
    );

    expect(screen.getByText(/카카오톡으로 보내지 못했어요/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 보내기" })).toBeTruthy();
    expect(screen.getByText(/여행 플랜이 저장됐어요/)).toBeTruthy();
  });

  it("shows calendar failure and retry", () => {
    searchParamsGet.mockImplementation((key?: string) =>
      key === "plannerKakaoCalendar" ? "failed" : null,
    );

    render(
      <PlannerSavePanel
        sessionId={sessionId}
        destination="오사카"
        sourceProductId={null}
        isSaved
        onSaved={() => undefined}
      />,
    );

    expect(screen.getByText(/톡캘린더에 일정을 추가하지 못했어요/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 추가" })).toBeTruthy();
  });

  it("shows memo success copy after sent query", () => {
    searchParamsGet.mockImplementation((key?: string) =>
      key === "plannerKakaoMemo" ? "sent" : null,
    );

    render(
      <PlannerSavePanel
        sessionId={sessionId}
        destination="오사카"
        sourceProductId={null}
        isSaved
        onSaved={() => undefined}
      />,
    );

    expect(screen.getByText(/나와의 채팅/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /카카오톡으로/ })).toBeNull();
    expect(screen.getByRole("button", { name: "톡캘린더에 추가" })).toBeTruthy();
  });

  it("shows calendar success copy after added query", () => {
    searchParamsGet.mockImplementation((key?: string) =>
      key === "plannerKakaoCalendar" ? "added" : null,
    );

    render(
      <PlannerSavePanel
        sessionId={sessionId}
        destination="오사카"
        sourceProductId={null}
        isSaved
        onSaved={() => undefined}
      />,
    );

    expect(screen.getByText(/톡캘린더에 여행 일정을 추가했어요/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /톡캘린더/ })).toBeNull();
  });
});
