import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MarketingReviewDetailBody } from "@/components/admin/marketing-review/MarketingReviewDetailBody";
import type { MorningMarketingReviewContext } from "@/lib/marketing/review/morningReview/types";

vi.mock("@/components/admin/AdminHeader", () => ({ default: () => <h1>리뷰</h1> }));
vi.mock("@/components/admin/ai-marketing/MarketingTeamSubnav", () => ({ MarketingTeamSubnav: () => null }));
vi.mock("@/components/admin/marketing-review/MarketingReviewCanonicalAssetPanel", () => ({ MarketingReviewCanonicalAssetPanel: () => <input aria-label="공통 원문 편집" defaultValue="원문" /> }));
vi.mock("@/components/admin/marketing-review/MarketingReviewExternalEditorialPanel", () => ({ MarketingReviewExternalEditorialPanel: ({ mode }: { mode: string }) => <p>{mode === "research" ? "Research 가져오기 영역" : "채널 소스 영역"}</p> }));
vi.mock("@/components/admin/marketing-review/MarketingReviewInstagramCardCopyPanel", () => ({ MarketingReviewInstagramCardCopyPanel: () => <p>카드 문구 영역</p> }));
vi.mock("@/components/admin/marketing-review/MarketingReviewInstagramCardnewsHandoffPanel", () => ({ MarketingReviewInstagramCardnewsHandoffPanel: () => <p>카드뉴스 가져오기 영역</p> }));
vi.mock("@/components/admin/marketing-review/MarketingReviewAstraHandoffPanel", () => ({ MarketingReviewAstraHandoffPanel: () => <p>비주얼 영역</p> }));
vi.mock("@/components/admin/marketing-review/MarketingReviewAssetsPanel", () => ({ MarketingReviewAssetsPanel: () => <p>렌더 영역</p> }));
vi.mock("@/components/admin/marketing-review/MarketingReviewChannelChecklist", () => ({ MarketingReviewChannelChecklist: () => null }));
vi.mock("@/components/admin/marketing-review/MarketingReviewChannelTabs", () => ({ MarketingReviewChannelTabs: () => <p>채널 편집 영역</p> }));
vi.mock("@/components/admin/marketing-review/MarketingReviewShortformSourcesPanel", () => ({ MarketingReviewShortformSourcesPanel: () => <p>숏폼 소스 영역</p> }));

const context = {
  detail: { candidate: { candidateId: "workflow-test", status: "completed" }, review: {}, canEdit: true },
  identity: { businessDateKst: "2026-10-02", candidateId: "workflow-test" },
  canonicalAsset: { present: true, status: "approved", version: 1, approvedVersion: 1 },
  agenda: { title: "테스트", summary: "요약", destinations: [], rationale: [] },
  humanAction: { label: "검토 전" }, governance: {}, operations: { degradations: [] },
  draft: { channel: "threads" }, channelReviews: [], strategySummary: {},
  evidence: { claims: [] }, performance: { absent: true },
} as unknown as MorningMarketingReviewContext;

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("puts editing, research, card copy, visuals, render and channels in the agreed order without losing drafts", async () => {
  render(<MarketingReviewDetailBody initialContext={context} unreadNotificationCount={0} />);
  const tabs = screen.getAllByRole("tab");
  expect(tabs).toHaveLength(6);
  ["공통 원문", "Research 검증", "카드 문구", "공유 비주얼", "카드뉴스 완성", "기타 채널"].forEach((label, index) => expect(tabs[index]).toHaveTextContent(label));
  fireEvent.change(screen.getByRole("textbox", { name: "공통 원문 편집" }), { target: { value: "아직 저장 안 함" } });
  fireEvent.click(tabs[2]!);
  expect(screen.getByText("카드 문구 영역")).toBeVisible();
  expect(screen.getByText("채널 편집 영역")).not.toBeVisible();
  expect(screen.queryByRole("textbox", { name: "공통 원문 편집" })).toBeNull();
  fireEvent.click(tabs[0]!);
  expect(screen.getByRole("textbox", { name: "공통 원문 편집" })).toHaveValue("아직 저장 안 함");
  fireEvent.click(tabs[5]!);
  expect(screen.getByText("채널 편집 영역")).toBeVisible();
  expect(screen.getByText("숏폼 소스 영역")).toBeVisible();
  expect(localStorage.getItem("marketing-review-step:workflow-test")).toBe("6");
  await waitFor(() => expect(screen.getByRole("tab", { selected: true }).textContent).toContain("기타 채널"));
});

it("restores the last selected stage for this candidate", async () => {
  localStorage.setItem("marketing-review-step:workflow-test", "4");
  render(<MarketingReviewDetailBody initialContext={context} unreadNotificationCount={0} />);
  await waitFor(() => expect(screen.getByRole("tab", { selected: true }).textContent).toContain("공유 비주얼"));
  expect(screen.getByText("비주얼 영역")).toBeVisible();
});
