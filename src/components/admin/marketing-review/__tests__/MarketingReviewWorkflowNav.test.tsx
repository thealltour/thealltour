import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveReviewWorkflowStatuses, MarketingReviewWorkflowNav, MarketingReviewWorkflowStage, type ReviewWorkflowStepId } from "@/components/admin/marketing-review/MarketingReviewWorkflowNav";

const snapshot = {
  narration: { gateState: "approved" },
  narrationScenes: { gateState: "approved", uploads: { complete: true } },
  narrationShortform: { ready: true },
  narrationInstagram: { gateState: "approved", rendered: {} },
  cardCopy: { applicable: true, gateState: "approved" },
  astra: { plan: { status: "fresh" }, planStaleFromCardCopyOnly: false, handoff: { status: "ready", uploadStatus: { complete: true }, handoffSourceStale: false, assetsStale: false } },
  sources: { candidates: [{ research: { status: "ready", conflicts: [] }, stale: false }] },
  assets: { artifacts: [{ relativePath: "cardnews/1x1/card-01.png" }] },
};
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("additive narration review workflow", () => {
  it("uses actual approval/readiness and labels PNG existence without claiming freshness", () => {
    expect(deriveReviewWorkflowStatuses(true, snapshot)).toEqual(["승인됨", "결과 있음", "승인됨", "준비 완료", "렌더 준비됨", "결과 있음", "승인됨", "준비 완료", "결과 있음"]);
    const states = deriveReviewWorkflowStatuses(false, snapshot);
    expect(states[0]).toBe("작업 필요");
    expect(states.slice(6)).toEqual(["재검토 필요", "재검토 필요", "재검토 필요"]);
  });
  it("marks stale research and structural visual changes for review", () => {
    expect(deriveReviewWorkflowStatuses(true, { ...snapshot, sources: { candidates: [{ ...snapshot.sources.candidates[0]!, stale: true }] } })[1]).toBe("재검토 필요");
    expect(deriveReviewWorkflowStatuses(true, { ...snapshot, astra: { ...snapshot.astra, plan: { status: "stale" } } })[7]).toBe("재검토 필요");
    expect(deriveReviewWorkflowStatuses(true, { ...snapshot, astra: { ...snapshot.astra, plan: { status: "stale" }, planStaleFromCardCopyOnly: true } })[7]).toBe("준비 완료");
    expect(deriveReviewWorkflowStatuses(true, { ...snapshot, cardCopy: { applicable: true, gateState: "approved_stale" } })[6]).toBe("재검토 필요");
  });
  it("keeps unknown status unknown on failed reads", () => {
    expect(deriveReviewWorkflowStatuses(true, { cardCopy: null, astra: null, sources: null, assets: null }).slice(1)).toEqual(Array(8).fill("확인 불가"));
  });
  it("supports keyboard navigation and only reads existing status APIs", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => ({ ok: !init?.method || init.method === "GET", json: async () => url.endsWith("/astra-handoff") ? snapshot.astra : url.endsWith("/assets") ? snapshot.assets : url.endsWith("/channel-source-selection") ? snapshot.sources : snapshot.cardCopy }));
    vi.stubGlobal("fetch", fetchMock);
    const select = vi.fn();
    render(<MarketingReviewWorkflowNav candidateId="candidate" canonicalApproved refreshKey={0} activeStep={1} onSelect={select} channelStatus="작업 필요" />);
    await waitFor(() => expect(screen.getByRole("tab", { name: /8. 공유 비주얼/ }).textContent).toContain("준비 완료"));
    fireEvent.keyDown(screen.getByRole("tab", { name: /1. 공통 원문/ }), { key: "End" });
    expect(select).toHaveBeenCalledWith(6);
    expect(fetchMock).toHaveBeenCalledTimes(8);
    expect(fetchMock.mock.calls.every((call) => call.length === 2 && (call[1] as RequestInit).method === undefined)).toBe(true);
  });
  it("hides other stages while retaining unsaved inputs", () => {
    function Harness() {
      const [step, setStep] = useState<ReviewWorkflowStepId>(1);
      return <><button onClick={() => setStep(step === 1 ? 3 : 1)}>단계 이동</button>
        <MarketingReviewWorkflowStage step={1} activeStep={step}><input aria-label="편집 원문" defaultValue="원문" /></MarketingReviewWorkflowStage>
        <MarketingReviewWorkflowStage step={3} activeStep={step}><input aria-label="카드 문구" /></MarketingReviewWorkflowStage></>;
    }
    render(<Harness />);
    fireEvent.change(screen.getByRole("textbox", { name: "편집 원문" }), { target: { value: "저장 전 수정" } });
    fireEvent.click(screen.getByText("단계 이동"));
    expect(screen.queryByRole("textbox", { name: "편집 원문" })).toBeNull();
    fireEvent.click(screen.getByText("단계 이동"));
    expect((screen.getByRole("textbox", { name: "편집 원문" }) as HTMLInputElement).value).toBe("저장 전 수정");
  });
});
