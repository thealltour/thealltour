import { describe, expect, it } from "vitest";

import { marketingAssetErrorResponse } from "@/lib/marketing/assets/assetApiErrors";
import { CardNewsRenderOverflowError } from "@/lib/marketing/assets/errors";

describe("marketingAssetErrorResponse", () => {
  it("maps cardnews overflow to 422 with the offending card and field", async () => {
    const res = marketingAssetErrorResponse(
      new CardNewsRenderOverflowError({
        cardId: "C1",
        field: "body",
        message: "CardNews body on C1 overflows the canvas at the minimum readable size (26px)",
      }),
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ code: "cardnews_render_overflow", cardId: "C1", field: "body" });
    expect(String(body.message)).toContain("C1");
  });

  it("keeps unknown errors as 500", async () => {
    const res = marketingAssetErrorResponse(new Error("boom"));
    expect(res.status).toBe(500);
  });
});
