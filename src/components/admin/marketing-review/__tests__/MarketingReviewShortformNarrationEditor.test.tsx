/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import {
  MarketingReviewShortformNarrationEditor,
  shortformNarrationSaveMessage,
} from "@/components/admin/marketing-review/MarketingReviewShortformNarrationEditor";
import type {
  ShortformNarrationSaveResult,
  ShortformNarrationView,
} from "@/lib/marketing/review/shortformNarrationReview";

function view(overrides: Partial<ShortformNarrationView> = {}): ShortformNarrationView {
  return {
    candidateId: "cmc_ui",
    applicable: true,
    humanEdited: false,
    maxLength: 2000,
    editable: true,
    blockedReason: null,
    render: {
      uiStatus: "ready",
      reason: "job_ready",
      requiredSceneCount: 2,
      pickedSceneCount: 2,
      jobStatus: "READY",
      narrationStale: false,
    },
    segments: [
      { segmentId: "narr-01", sceneId: "scene-001", purpose: "hook", aiText: "AI 첫 문장", text: "AI 첫 문장", edited: false },
      { segmentId: "narr-02", sceneId: "scene-002", purpose: "close", aiText: "AI 끝 문장", text: "AI 끝 문장", edited: false },
    ],
    ...overrides,
  };
}

function saveResult(overrides: Partial<ShortformNarrationSaveResult> = {}): ShortformNarrationSaveResult {
  return {
    ...view(),
    changed: true,
    rerender: { enqueued: true, created: true, skippedReason: null },
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MarketingReviewShortformNarrationEditor", () => {
  it("edits a segment, posts every segment and reports the re-render", async () => {
    const onSaved = vi.fn(async () => {});
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        return {
          ok: true,
          json: async () =>
            saveResult({
              segments: view().segments.map((s, i) => ({
                ...s,
                text: body.segments[i].text.trim(),
                edited: body.segments[i].text.trim() !== s.aiText,
              })),
            }),
        } as Response;
      }
      return { ok: true, json: async () => view() } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MarketingReviewShortformNarrationEditor candidateId="cmc_ui" canEdit fallbackBody="fallback" onSaved={onSaved} />,
    );
    const first = await screen.findByLabelText("내레이션 1");
    expect(screen.getByText(/도입/)).toBeTruthy();
    expect(screen.getByText(/렌더 READY · PICK 2\/2/)).toBeTruthy();
    const save = screen.getByRole("button", { name: "내레이션 저장" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(first, { target: { value: "사람이 고친 문장" } });
    expect(screen.getByText("사람 수정")).toBeTruthy();
    expect(save.disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "AI 원문 보기" }));
    expect(screen.getByText("AI 첫 문장")).toBeTruthy();

    fireEvent.click(save);
    await waitFor(() => expect(screen.getByText("저장했습니다 · 재렌더를 요청했습니다")).toBeTruthy());
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({
      action: "save",
      segments: [
        { segmentId: "narr-01", text: "사람이 고친 문장" },
        { segmentId: "narr-02", text: "AI 끝 문장" },
      ],
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("falls back to the read-only body when the package has no narration", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => view({ applicable: false, segments: [] }) }) as Response),
    );
    render(<MarketingReviewShortformNarrationEditor candidateId="cmc_ui" canEdit fallbackBody="기존 본문" />);
    await waitFor(() => expect(screen.getByText("기존 본문")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "내레이션 저장" })).toBeNull();
  });

  it("disables editing when blocked and warns about stale renders", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: true,
            json: async () =>
              view({
                editable: false,
                blockedReason: "반려되었거나 게시 완료된 리뷰는 편집할 수 없습니다.",
                render: { ...view().render!, uiStatus: "not_render_ready", jobStatus: null, narrationStale: true },
              }),
          }) as Response,
      ),
    );
    render(<MarketingReviewShortformNarrationEditor candidateId="cmc_ui" canEdit fallbackBody="" />);
    const first = (await screen.findByLabelText("내레이션 1")) as HTMLTextAreaElement;
    expect(first.disabled).toBe(true);
    expect(screen.getByText(/반려되었거나/)).toBeTruthy();
    expect(screen.getByText(/이전 내레이션 기준/)).toBeTruthy();
  });
});

describe("shortformNarrationSaveMessage", () => {
  it("explains why no render was requested", () => {
    expect(
      shortformNarrationSaveMessage(
        saveResult({
          rerender: { enqueued: false, created: false, skippedReason: "scene_pick_missing" },
          render: { ...view().render!, pickedSceneCount: 1 },
        }),
      ),
    ).toBe("저장했습니다 · PICK 완료 후 렌더됩니다");
    expect(
      shortformNarrationSaveMessage(
        saveResult({ rerender: { enqueued: false, created: false, skippedReason: "render_key_spent_requires_input_change" } }),
      ),
    ).toMatch(/문구를 조금 바꿔/);
    expect(
      shortformNarrationSaveMessage(saveResult({ rerender: { enqueued: true, created: false, skippedReason: null } })),
    ).toBe("저장했습니다 · 현재 내레이션 기준 렌더가 이미 있습니다");
  });
});
