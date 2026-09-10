vi.mock("server-only", () => ({}));

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiAuth", () => ({
  requireAdminPermission: vi.fn(),
}));

import { requireAdminPermission } from "@/lib/apiAuth";
import { POST as resolvePost } from "@/app/api/admin/marketing-review/[candidateId]/shortform/sources/resolve/route";
import { POST as pickPost } from "@/app/api/admin/marketing-review/[candidateId]/shortform/sources/pick/route";

describe("SV-5 shortform sources API auth", () => {
  beforeEach(() => {
    vi.mocked(requireAdminPermission).mockReset();
  });

  it("denies unauthorized resolve and pick", async () => {
    vi.mocked(requireAdminPermission).mockResolvedValue({
      ok: false,
      res: Response.json({ message: "forbidden" }, { status: 403 }),
    } as never);

    const resolveRes = await resolvePost(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ candidateId: "cmc_x" }),
    });
    expect(resolveRes.status).toBe(403);

    const pickRes = await pickPost(
      new Request("http://localhost/x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: "scene-001", selectionToken: "x.y" }),
      }),
      { params: Promise.resolve({ candidateId: "cmc_x" }) },
    );
    expect(pickRes.status).toBe(403);
  });
});
