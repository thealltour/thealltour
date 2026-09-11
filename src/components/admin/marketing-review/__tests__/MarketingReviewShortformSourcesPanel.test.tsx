/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { MarketingReviewShortformSourcesPanel } from "@/components/admin/marketing-review/MarketingReviewShortformSourcesPanel";

describe("MarketingReviewShortformSourcesPanel", () => {
  it("renders scenes, factual badge, provider status, and pick button", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/resolve") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            candidateId: "cmc_ui",
            businessDateKst: "2026-09-11",
            catalogAvailable: true,
            scenes: [
              {
                sceneId: "scene-001",
                order: 1,
                purpose: "intro",
                narrationPreview: "hook",
                visualSubject: "Ba Na Hills",
                factualVisualRequired: true,
                mediaPreference: "video",
                status: "review_required",
                reason: "probable",
                existingPick: null,
                providerAttempts: [
                  { providerId: "internal", status: "empty", candidateCount: 0, label: "결과 없음" },
                  { providerId: "pexels", status: "disabled", candidateCount: 0, label: "연결 안 됨" },
                  { providerId: "pixabay", status: "success", candidateCount: 1, label: "검색 완료" },
                ],
                recommended: {
                  candidateKey: "pixabay:video:1",
                  selectionToken: "token.sig",
                  origin: "pixabay",
                  provider: "pixabay",
                  providerAssetId: "1",
                  mediaType: "video",
                  sourcePageUrl: "https://pixabay.com/videos/id-1/",
                  previewUrl: null,
                  creatorName: "Creator",
                  rightsKind: "provider_license",
                  licenseName: "Pixabay Content License",
                  score: 0.7,
                  factualMatch: "probable",
                  factualMatchLabel: "실제 장소일 가능성 — 확인 필요",
                  autoPickEligible: false,
                  reviewRequired: true,
                  photoMotion: false,
                  generatedPlan: false,
                  pickBlockedReason: null,
                },
                candidates: [
                  {
                    candidateKey: "pixabay:video:1",
                    selectionToken: "token.sig",
                    origin: "pixabay",
                    provider: "pixabay",
                    providerAssetId: "1",
                    mediaType: "video",
                    sourcePageUrl: "https://pixabay.com/videos/id-1/",
                    previewUrl: null,
                    creatorName: "Creator",
                    rightsKind: "provider_license",
                    licenseName: "Pixabay Content License",
                    score: 0.7,
                    factualMatch: "probable",
                    factualMatchLabel: "실제 장소일 가능성 — 확인 필요",
                    autoPickEligible: false,
                    reviewRequired: true,
                    photoMotion: false,
                    generatedPlan: false,
                    pickBlockedReason: null,
                  },
                  {
                    candidateKey: "photo:1",
                    selectionToken: "token2.sig",
                    origin: "photo_motion",
                    provider: "pixabay",
                    providerAssetId: "2",
                    mediaType: "image",
                    sourcePageUrl: null,
                    previewUrl: null,
                    creatorName: null,
                    rightsKind: "provider_license",
                    licenseName: null,
                    score: 0.5,
                    factualMatch: "generic",
                    factualMatchLabel: "분위기용/일반 영상",
                    autoPickEligible: false,
                    reviewRequired: true,
                    photoMotion: true,
                    generatedPlan: false,
                    pickBlockedReason: null,
                  },
                ],
              },
            ],
          }),
        } as Response;
      }
      return { ok: false, json: async () => ({ message: "unexpected" }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MarketingReviewShortformSourcesPanel candidateId="cmc_ui" />);

    // CG-2: panel auto-loads durable/live resolution on mount (no manual create/resolve required).
    await waitFor(() => {
      expect(screen.getByText(/Scene 1 \/ 1/)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "다시 검색" })).toBeTruthy();
    expect(screen.getByText("실제 장소 확인 필요")).toBeTruthy();
    expect(screen.getByText(/pexels · 연결 안 됨/)).toBeTruthy();
    expect(screen.getByText("추천 소스")).toBeTruthy();
    expect(screen.getByRole("button", { name: "이 장면에 사용" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /다른 후보 1개 보기/ }));
    expect(screen.getByText("사진 모션 사용 가능")).toBeTruthy();

    // Resolve must not auto-pick
    expect(fetchMock.mock.calls.every((c) => !String(c[0]).includes("/pick"))).toBe(true);
    expect(
      fetchMock.mock.calls.some(
        (c) => String(c[0]).includes("/resolve") && String((c[1] as RequestInit)?.body ?? "").includes('"forceRefresh":false'),
      ),
    ).toBe(true);
  });
});
