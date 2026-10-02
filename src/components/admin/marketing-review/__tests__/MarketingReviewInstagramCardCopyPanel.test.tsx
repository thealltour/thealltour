import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MarketingReviewInstagramCardCopyPanel } from "@/components/admin/marketing-review/MarketingReviewInstagramCardCopyPanel";

const view = {
  applicable: true, gateState: "approved", staleHumanEdits: false,
  coverTitleMaxLength: 60, limits: { kicker: 60, headline: 120, body: 600, microcopy: 160 },
  review: { instagramCoverTitleKo: null, cards: ["첫 번째", "두 번째"].map((headline, index) => ({
    cardId: `card-${index + 1}`, role: "story", evidenceRefs: [], humanDraft: null,
    aiDraft: { kicker: "맥락", headline, body: "본문", microcopy: "보충" },
  })) },
};
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("opens only the working card and keeps another card's unsaved copy", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => view })));
  const dirty = vi.fn();
  render(<MarketingReviewInstagramCardCopyPanel candidateId="candidate" canEdit onDirtyChange={dirty} />);
  const headline = await screen.findByRole("textbox", { name: "1번 카드 헤드라인" });
  fireEvent.change(headline, { target: { value: "저장 전 제목" } });
  await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(true));
  fireEvent.click(screen.getByText(/2\. 두 번째/));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "1번 카드 헤드라인" })).not.toBeVisible());
  expect(screen.getByRole("textbox", { name: "2번 카드 헤드라인" })).toBeVisible();
  fireEvent.click(screen.getByText(/1\. 저장 전 제목/));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "1번 카드 헤드라인" })).toHaveValue("저장 전 제목"));
});

it("keeps the existing save contract and refreshes workflow status after success", async () => {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({ ok: true, json: async () => {
    if (init?.method === "POST") return { ...view, gateState: "pending" };
    return view;
  } }));
  vi.stubGlobal("fetch", fetchMock);
  const changed = vi.fn();
  render(<MarketingReviewInstagramCardCopyPanel candidateId="candidate" canEdit onStatusChange={changed} />);
  fireEvent.change(await screen.findByRole("textbox", { name: "1번 카드 헤드라인" }), { target: { value: "새 제목" } });
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() => expect(changed).toHaveBeenCalledOnce());
  const post = fetchMock.mock.calls.find((call) => call[1]?.method === "POST")!;
  const body = JSON.parse(post[1]!.body as string);
  expect(body.action).toBe("save");
  expect(body.cards[0]).toEqual({ cardId: "card-1", kicker: "맥락", headline: "새 제목", body: "본문", microcopy: "보충" });
});
