/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { MarketingReviewExternalEditorialPanel } from "@/components/admin/marketing-review/MarketingReviewExternalEditorialPanel";

const CHANNEL_VIEW = {
  channel: "threads",
  selectedSource: "hermes_auto",
  effectiveSource: "hermes_auto",
  humanDraftActive: false,
  selectionInSync: true,
};

function readiness() {
  return Object.fromEntries(
    ["threads", "shortform", "naver_blog", "naver_band", "kakao_channel", "instagram"].map((c) => [
      c,
      { present: false, materializable: false, issues: ["channel_missing"] },
    ]),
  );
}

function candidate(importId: string, stale: boolean) {
  return {
    importId,
    importedAt: "2026-09-29T02:00:00.000Z",
    importedBy: "ysh",
    canonicalVersion: stale ? 1 : 2,
    warnings: [],
    channelReadiness: readiness(),
    stale,
    research: {
      status: "blocked",
      findings: [
        {
          findingId: "F1",
          claim: "2023 빕 구르망 선정",
          supportLevel: "verified",
          usableForEditorial: true,
          freshness: "2023",
          sources: [
            {
              title: "Phở Bò Ấu Triệu",
              publisher: "MICHELIN Guide",
              date: "2023-06-06",
              url: "https://guide.michelin.com/x",
              sourceTier: "official",
            },
          ],
        },
      ],
      unresolved: [],
      conflicts: [
        { index: 0, canonicalField: "keyTakeawaysKo", canonicalText: "업소 확인 불가", findingIds: ["F1"], explanation: "확인됨", action: "remove_item" },
        { index: 1, canonicalField: "forbiddenClaimsKo", canonicalText: "미쉐린 선정 단정", findingIds: ["F1"], explanation: "", action: "remove_forbidden" },
        { index: 2, canonicalField: "forbiddenClaimsKo", canonicalText: "메뉴·위치 확정", findingIds: ["F1"], explanation: "", action: "remove_forbidden" },
        { index: 3, canonicalField: "bodyKo", canonicalText: "본문 문장", findingIds: ["F1"], explanation: "", action: "manual" },
      ],
    },
  };
}

type FetchCall = { url: string; init?: RequestInit };

function mockFetch(candidates: unknown[], postResponse: unknown = { ok: true, asset: { version: 3 } }) {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (!init?.method) {
      return Response.json({
        channels: [CHANNEL_VIEW],
        candidates,
        canonical: { version: 2, status: "approved", approved: true },
      });
    }
    return Response.json(postResponse);
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

function renderPanel() {
  const onReload = vi.fn();
  render(
    <MarketingReviewExternalEditorialPanel
      candidateId="cmc_1"
      canEdit
      busy={false}
      onBusy={() => {}}
      onMessage={() => {}}
      onReload={onReload}
    />,
  );
  return { onReload };
}

describe("MarketingReviewExternalEditorialPanel research conflicts", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows one blocked notice instead of per-channel errors, with findings and conflict checkboxes", async () => {
    mockFetch([candidate("xe_1790664679428_09c87ca6b0", false)]);
    renderPanel();

    expect(await screen.findByText(/연구를 보류했습니다\(blocked\)/)).toBeTruthy();
    expect(screen.queryByText(/External 선택 불가/)).toBeNull();
    expect(screen.getByRole("link", { name: "MICHELIN Guide" }).getAttribute("href")).toBe(
      "https://guide.michelin.com/x",
    );

    const boxes = [0, 1, 2, 3].map((i) => screen.getByLabelText(`충돌 ${i + 1}`) as HTMLInputElement);
    await waitFor(() =>
      expect(boxes.slice(0, 3).map((b) => [b.checked, b.disabled])).toEqual([
        [true, false],
        [true, false],
        [true, false],
      ]),
    );
    expect(boxes[3].checked).toBe(false);
    expect(boxes[3].disabled).toBe(true);
    expect(screen.getByText(/본문 필드는 공통 원문 편집에서 직접 수정하세요/)).toBeTruthy();
  });

  it("posts only the checked conflicts and reloads", async () => {
    const calls = mockFetch([candidate("xe_1790664679428_09c87ca6b0", false)]);
    const { onReload } = renderPanel();

    fireEvent.click(await screen.findByLabelText("충돌 3"));
    fireEvent.click(screen.getByRole("button", { name: "승인본 v3 초안 만들기" }));

    await waitFor(() => expect(onReload).toHaveBeenCalled());
    const postCall = calls.find((c) => c.init?.method === "POST");
    expect(postCall?.url).toBe("/api/admin/marketing-review/cmc_1/canonical-asset");
    expect(JSON.parse(String(postCall?.init?.body))).toEqual({
      action: "apply_research_conflicts",
      importId: "xe_1790664679428_09c87ca6b0",
      conflictIndexes: [0, 1],
    });
    expect(await screen.findByText(/Instagram 카드뉴스 JSON을 복사해 ChatGPT에 요청하세요/)).toBeTruthy();
  });

  it("keeps research conflicts from the newest research import when an Instagram cardnews import is newer", async () => {
    const instagramReadiness = {
      ...readiness(),
      instagram: { present: true, materializable: true, issues: [] },
    };
    const calls = mockFetch([
      {
        importId: "xe_1790664679999_igcardnews",
        importedAt: "2026-09-29T03:00:00.000Z",
        importedBy: "ysh",
        resultContract: "instagram-cardnews-chatgpt-result-v1",
        canonicalVersion: 2,
        warnings: [],
        channelReadiness: instagramReadiness,
        stale: false,
        research: null,
      },
      candidate("xe_1790664679428_09c87ca6b0", false),
    ]);
    renderPanel();

    expect(await screen.findByText(/Instagram 카드뉴스 · xe_1790664679999_igcardnews/)).toBeTruthy();
    expect(screen.getByLabelText("충돌 1")).toBeTruthy();
    expect(screen.queryByText(/External 선택 불가/)).toBeNull();

    const draftButton = screen.getByRole("button", { name: "승인본 v3 초안 만들기" }) as HTMLButtonElement;
    await waitFor(() => expect(draftButton.disabled).toBe(false));
    fireEvent.click(draftButton);
    await waitFor(() => expect(calls.some((c) => c.init?.method === "POST")).toBe(true));
    const postCall = calls.find((c) => c.init?.method === "POST");
    expect(JSON.parse(String(postCall?.init?.body)).importId).toBe("xe_1790664679428_09c87ca6b0");
  });

  it("reloads channel review after an import that applied channels and lists the warnings", async () => {
    const calls = mockFetch([], {
      importId: "xe_2",
      message: "외부 편집 결과를 가져와 Threads 채널에 바로 적용했습니다. 채널별 검토에서 확인하세요.",
      warnings: ["research.status가 blocked이지만 채널 결과를 그대로 가져옵니다."],
      appliedChannels: ["threads"],
      failedChannels: [],
    });
    const { onReload } = renderPanel();

    fireEvent.change(await screen.findByPlaceholderText(/editorial-research-bundle-chatgpt-result-v1/), {
      target: { value: '{"contract":"x"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Research 결과 가져오기" }));

    await waitFor(() => expect(onReload).toHaveBeenCalled());
    expect(calls.find((c) => c.init?.method === "POST")?.url).toBe(
      "/api/admin/marketing-review/cmc_1/research-editorial-import",
    );
    expect(await screen.findByText(/Threads 채널에 바로 적용했습니다[\s\S]*경고 1건/)).toBeTruthy();
  });

  it("labels stale candidates and disables the draft button", async () => {
    mockFetch([candidate("xe_1790664679428_0000000000", true)]);
    renderPanel();

    expect(await screen.findByText(/\(이전 승인본 기준\)/)).toBeTruthy();
    const button = screen.getByRole("button", { name: "승인본 v3 초안 만들기" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect((screen.getByLabelText("충돌 2") as HTMLInputElement).disabled).toBe(true);
  });
});
