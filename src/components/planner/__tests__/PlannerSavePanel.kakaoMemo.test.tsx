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
  trackPlannerSaveClicked: vi.fn(),
  trackPlannerSaved: vi.fn(),
}));

vi.mock("@/lib/planner/saveClient", () => ({
  fetchPlannerMemberAuthenticated: vi.fn(async () => true),
  postPlannerSessionSave: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/auth/oauthStart", () => ({
  startOAuthLogin: vi.fn(),
}));

describe("PlannerSavePanel kakao memo CTA", () => {
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

  it("shows kakao memo CTA after save and does not auto-navigate", () => {
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
    expect(screen.getByRole("link", { name: "내 여행 플랜 보기" })).toBeTruthy();
    expect(window.location.href).toBe("");
  });

  it("starts action OAuth on CTA click", () => {
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

  it("shows failure copy and retry without unsaving", () => {
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

  it("shows success copy after sent query", () => {
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
  });
});
