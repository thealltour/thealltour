/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { MarketingReviewAstraHandoffPanel } from "@/components/admin/marketing-review/MarketingReviewAstraHandoffPanel";

const COPY_TEXT = "EXACT_PERSISTED_COPY_TEXT_FOR_ASTRA\nline2";

function readyView(overrides: Record<string, unknown> = {}) {
  const handoffOverrides =
    overrides.handoff && typeof overrides.handoff === "object"
      ? (overrides.handoff as Record<string, unknown>)
      : {};
  const { handoff: _h, ...rest } = overrides;
  return {
    candidateId: "cmc_astra",
    packagePresent: true,
    message: null,
    plan: {
      status: "fresh",
      statusLabel: "최신",
      present: true,
      strategySummary: "shared cover + detail",
      planningMode: "llm",
      visualCount: 2,
      generatedVisualNeededCount: 2,
      fingerprint: "plan_fp",
      visuals: [
        {
          visualId: "social_visual_01",
          role: "cover_context",
          visualMode: "editorial_photo",
          generatedVisualNeeded: true,
          visualIntent: "cover",
          usageLabels: ["Instagram card-01", "Threads image 1"],
        },
      ],
    },
    handoff: {
      status: "ready",
      candidateId: "cmc_astra",
      packagePresent: true,
      handoff: {
        contentTitleKo: "테스트 제목",
        generationMode: "manual_human_in_the_loop",
        providerIntent: "astra",
        visualCount: 2,
        copyText: COPY_TEXT,
        editorialArchetype: "discovery",
      },
      handoffFingerprint: "fp",
      handoffStale: false,
      assetsStale: false,
      uploadStatus: {
        required: 2,
        uploaded: 1,
        complete: false,
        missingVisualIds: ["social_visual_03"],
        stale: false,
      },
      slots: [
        {
          visualId: "social_visual_01",
          role: "cover_context",
          visualIntent: "cover",
          visualMode: "editorial_photo",
          aspectRatio: "1:1",
          expectedFilename: "social_visual_01.png",
          usageLabels: ["Instagram card-01", "Threads image 1"],
          compositionGuidance: "c",
          textSafeArea: "t",
          evidenceGuidance: [],
          uploaded: {
            visualId: "social_visual_01",
            expectedFilename: "social_visual_01.png",
            storedFilename: "social_visual_01.png",
            storedPath: "media/shared-visuals/social_visual_01.png",
            mimeType: "image/png",
            byteSize: 100,
            uploadedAt: "2026-09-18T12:00:00.000Z",
            status: "uploaded",
          },
        },
        {
          visualId: "social_visual_03",
          role: "architecture_detail",
          visualIntent: "detail",
          visualMode: "object_or_detail",
          aspectRatio: "4:5",
          expectedFilename: "social_visual_03.png",
          usageLabels: ["Instagram card-03"],
          compositionGuidance: "c",
          textSafeArea: "t",
          evidenceGuidance: [],
          uploaded: null,
        },
      ],
      message: null,
      ...handoffOverrides,
    },
    canGenerateHandoff: true,
    handoffBlockReason: null,
    ...rest,
  };
}

describe("MarketingReviewAstraHandoffPanel", () => {
  it("shows plan + handoff sections, progress, upload/replace, and preview", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/astra-handoff") && !url.includes("upload") && !url.includes("generate")) {
        return {
          ok: true,
          json: async () => readyView(),
        };
      }
      return { ok: false, json: async () => ({ message: "unexpected" }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MarketingReviewAstraHandoffPanel candidateId="cmc_astra" />);

    await waitFor(() => {
      expect(screen.getByText("Shared Visual Plan")).toBeTruthy();
      expect(screen.getByText("Astra Handoff")).toBeTruthy();
    });

    expect(screen.getByRole("button", { name: /Shared Visual Plan 재생성/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Astra Handoff 재생성/ })).toBeTruthy();
    expect(screen.getByText(/1 \/ 2/)).toBeTruthy();
    expect(screen.getByText("✓ 업로드됨")).toBeTruthy();
    expect(screen.getByText("미업로드")).toBeTruthy();
    expect(screen.getByRole("button", { name: "교체" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "이미지 업로드" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "HDD 다시 보내기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "카드뉴스 렌더링 시작" })).toBeTruthy();
    expect(screen.getByAltText("social_visual_01")).toBeTruthy();
    expect(
      screen.getByText((_, el) => el?.tagName === "PRE" && el.textContent === COPY_TEXT),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Astra 요청문 복사/ })).toBeTruthy();

    vi.unstubAllGlobals();
  });

  it("HDD 다시 보내기 posts assets/export and shows note", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/assets/export") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            wrote: true,
            reused: false,
            relativePackagePath: "2026/09/18/cmc_astra",
            note: "context/copy를 최신 후보 상태로 덮어썼습니다. 공유 비주얼(media/shared-visuals)은 유지됩니다.",
          }),
        };
      }
      if (url.includes("/astra-handoff") && !url.includes("upload") && !url.includes("generate")) {
        return { ok: true, json: async () => readyView() };
      }
      return { ok: false, json: async () => ({ message: "unexpected" }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MarketingReviewAstraHandoffPanel candidateId="cmc_astra" />);
    await waitFor(() => screen.getByRole("button", { name: "HDD 다시 보내기" }));
    fireEvent.click(screen.getByRole("button", { name: "HDD 다시 보내기" }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/assets/export"))).toBe(true);
      expect(screen.getByText(/공유 비주얼\(media\/shared-visuals\)은 유지/)).toBeTruthy();
    });

    vi.unstubAllGlobals();
  });

  it("disables upload when handoff is stale and shows warning", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () =>
        readyView({
          handoff: {
            handoffStale: true,
            uploadStatus: {
              required: 2,
              uploaded: 1,
              complete: false,
              missingVisualIds: ["social_visual_03"],
              stale: true,
            },
          },
        }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<MarketingReviewAstraHandoffPanel candidateId="cmc_astra" />);

    await waitFor(() => {
      expect(
        screen.getByText(/최신 Visual Plan과 일치하지 않습니다/),
      ).toBeTruthy();
    });

    const uploadBtn = screen.getByRole("button", { name: "이미지 업로드" });
    const replaceBtn = screen.getByRole("button", { name: "교체" });
    expect(uploadBtn).toHaveProperty("disabled", true);
    expect(replaceBtn).toHaveProperty("disabled", true);

    vi.unstubAllGlobals();
  });

  it("copy button uses exact persisted copyText", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => readyView(),
      })),
    );

    render(<MarketingReviewAstraHandoffPanel candidateId="cmc_astra" />);
    await waitFor(() => screen.getByRole("button", { name: /Astra 요청문 복사/ }));

    fireEvent.click(screen.getByRole("button", { name: /Astra 요청문 복사/ }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(COPY_TEXT);
    });

    vi.unstubAllGlobals();
  });
});
