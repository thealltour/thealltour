import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiAuth", () => ({ requireAdminPermission: vi.fn() }));
vi.mock("@/lib/marketing/assets/cardnews/renderCandidateInstagramCardnews", () => ({ renderCandidateInstagramCardnews: vi.fn() }));

import { POST } from "@/app/api/admin/marketing-review/[candidateId]/assets/cardnews/render/route";
import { requireAdminPermission } from "@/lib/apiAuth";
import { renderCandidateInstagramCardnews } from "@/lib/marketing/assets/cardnews/renderCandidateInstagramCardnews";
import { CardNewsRenderOverflowError } from "@/lib/marketing/assets/errors";
import { resolveCardNewsGeometry } from "@/lib/marketing/assets/cardnews/brand";
import { buildResolvedCardRenderSpec } from "@/lib/marketing/assets/cardnews/presentation/resolveRenderSpec";

const candidateId = "cmc_render_contract";
const context = () => ({ params: Promise.resolve({ candidateId }) });
const request = (body = {}) => new Request("http://localhost/api/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const outcome = () => ({
  ok: true as const, businessDateKst: "2026-10-02", packageRoot: "/test/package",
  result: {
    status: "rendered" as const, candidateId, packageRoot: "/test/package", aspectRatios: ["4:5", "1:1"] as ("4:5" | "1:1")[],
    cardCount: 5, renders: [],
  },
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireAdminPermission).mockResolvedValue({ ok: true } as never);
});

describe("Instagram render POST contract", () => {
  it("accepts the UI's empty object and succeeds after fitting more than six body lines", async () => {
    vi.mocked(renderCandidateInstagramCardnews).mockImplementation(async () => {
      const spec = buildResolvedCardRenderSpec({
        card: { cardId: "card-3", role: "information", headline: "여행 이야기", body: "첫 번째 줄\n두 번째 줄\n세 번째 줄\n네 번째 줄\n\n여섯 번째 줄\n마지막 줄", visualIntent: "", evidenceRefs: [] },
        index: 3, total: 5, geometry: resolveCardNewsGeometry("1:1"),
        presentation: { cardId: "card-3", template: "photo_overlay_editorial", textPlacement: "overlay-bottom", textDensity: "standard" },
        citation: null, visualDataUri: "data:image/png;base64,placeholder", wordmarkDataUri: null,
      });
      expect(spec.body.lines).toHaveLength(7);
      return outcome();
    });
    const response = await POST(request(), context());
    expect(response.status).toBe(200);
    expect(renderCandidateInstagramCardnews).toHaveBeenCalledWith({ candidateId, dryRun: false, graphicOnly: false });
    expect(await response.json()).toMatchObject({ status: "rendered", wrote: true, candidateId, cardCount: 5, aspectRatios: ["4:5", "1:1"], paths: [] });
  });

  it("forwards dry-run without claiming writes", async () => {
    vi.mocked(renderCandidateInstagramCardnews).mockResolvedValue(outcome());
    const response = await POST(request({ dryRun: true, graphicOnly: true }), context());
    expect(renderCandidateInstagramCardnews).toHaveBeenCalledWith({ candidateId, dryRun: true, graphicOnly: true });
    expect(await response.json()).toMatchObject({ dryRun: true, wrote: false });
  });

  it("preserves the approval gate and actionable skip note", async () => {
    const result = outcome();
    vi.mocked(renderCandidateInstagramCardnews).mockResolvedValue({ ...result, result: { ...result.result, status: "skipped", skipReason: "card_copy_review_required", cardCopyReviewState: "pending", cardCount: 0, aspectRatios: [] } });
    const response = await POST(request(), context());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "skipped", wrote: false, skipReason: "card_copy_review_required", cardCopyReviewState: "pending", note: expect.stringContaining("승인") });
  });

  it.each(["headline", "body", "kicker", "microcopy"] as const)("returns typed 422 with meaningful %s field feedback for true overflow", async (field) => {
    vi.mocked(renderCandidateInstagramCardnews).mockRejectedValue(new CardNewsRenderOverflowError({ cardId: "card-3", field, message: "full stack does not fit" }));
    const response = await POST(request(), context());
    expect(response.status).toBe(422);
    const labels = { headline: "헤드라인", body: "본문", kicker: "키커", microcopy: "마이크로카피" };
    expect(await response.json()).toMatchObject({ code: "cardnews_render_overflow", cardId: "card-3", field, message: expect.stringContaining(labels[field]), detail: "full stack does not fit" });
  });

  it("keeps missing candidates at 404", async () => {
    vi.mocked(renderCandidateInstagramCardnews).mockResolvedValue({ ok: false, reason: "candidate_not_found" });
    expect((await POST(request(), context())).status).toBe(404);
  });

  it("checks admin permission before rendering", async () => {
    vi.mocked(requireAdminPermission).mockResolvedValue({ ok: false, res: Response.json({ message: "forbidden" }, { status: 403 }) } as never);
    expect((await POST(request(), context())).status).toBe(403);
    expect(renderCandidateInstagramCardnews).not.toHaveBeenCalled();
  });
});
