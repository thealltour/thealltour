/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { MarketingReviewInstagramCardnewsHandoffPanel } from "@/components/admin/marketing-review/MarketingReviewInstagramCardnewsHandoffPanel";

function renderPanel(canonicalApproved: boolean) {
  const onImported = vi.fn();
  render(
    <MarketingReviewInstagramCardnewsHandoffPanel
      candidateId="cmc_1"
      canEdit
      canonicalApproved={canonicalApproved}
      busy={false}
      onBusy={() => {}}
      onImported={onImported}
    />,
  );
  return { onImported };
}

describe("MarketingReviewInstagramCardnewsHandoffPanel", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("disables the copy button until the Canonical is approved", () => {
    renderPanel(false);
    const button = screen.getByRole("button", { name: "Instagram 카드뉴스용 JSON 복사" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("copies the handoff text and shows the research warning", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ text: '{"contract":"instagram-cardnews-chatgpt-handoff-v1"}', message: "만들었습니다.", warnings: ["research 미반영"] }),
      ),
    );
    renderPanel(true);
    fireEvent.click(screen.getByRole("button", { name: "Instagram 카드뉴스용 JSON 복사" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('{"contract":"instagram-cardnews-chatgpt-handoff-v1"}'));
    expect(await screen.findByText(/복사 완료 — 만들었습니다\.[\s\S]*research 미반영/)).toBeTruthy();
  });

  it("posts the pasted result to the import route and reloads on success", async () => {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
      Response.json({ importId: "xe_1", message: "Instagram 채널에 적용했습니다.", warnings: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { onImported } = renderPanel(true);

    fireEvent.change(screen.getByPlaceholderText(/instagram-cardnews-chatgpt-result-v1/), {
      target: { value: '{"contract":"instagram-cardnews-chatgpt-result-v1"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Instagram 카드뉴스 결과 가져오기" }));

    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/admin/marketing-review/cmc_1/instagram-cardnews-import");
    expect(JSON.parse(String(init?.body))).toEqual({ raw: '{"contract":"instagram-cardnews-chatgpt-result-v1"}' });
    expect(await screen.findByText(/Instagram 채널에 적용했습니다/)).toBeTruthy();
  });

  it("shows import errors with details and does not reload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { message: "카드 수가 범위를 벗어났습니다.", code: "card_count_out_of_range", details: ["carouselPlan.cards 3장"] },
          { status: 422 },
        ),
      ),
    );
    const { onImported } = renderPanel(true);
    fireEvent.change(screen.getByPlaceholderText(/instagram-cardnews-chatgpt-result-v1/), { target: { value: "{}" } });
    fireEvent.click(screen.getByRole("button", { name: "Instagram 카드뉴스 결과 가져오기" }));
    expect(await screen.findByText(/카드 수가 범위를 벗어났습니다\.[\s\S]*carouselPlan\.cards 3장/)).toBeTruthy();
    expect(onImported).not.toHaveBeenCalled();
  });
});
