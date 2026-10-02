import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MarketingReviewAssetsPanel } from "@/components/admin/marketing-review/MarketingReviewAssetsPanel";

const assets = { status: "present", assetRootConfigured: true, artifacts: [
  { artifactId: "square", relativePath: "cardnews/1x1/card-01.png", mediaType: "image/png", byteSize: 100 },
  { artifactId: "portrait", relativePath: "cardnews/card-01.png", mediaType: "image/png", byteSize: 100 },
  { artifactId: "source", relativePath: "media/shared-visuals/image.png", mediaType: "image/png", byteSize: 100 },
] };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("previews one ratio at a time and keeps source files available in the folded list", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => assets })));
  render(<MarketingReviewAssetsPanel candidateId="candidate" />);
  expect(await screen.findByRole("img", { name: "cardnews/1x1/card-01.png" })).toBeVisible();
  expect(screen.queryByRole("img", { name: "cardnews/card-01.png" })).toBeNull();
  expect(screen.queryByRole("img", { name: "media/shared-visuals/image.png" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "4:5" }));
  expect(screen.getByRole("img", { name: "cardnews/card-01.png" })).toBeVisible();
  expect(screen.queryByRole("img", { name: "cardnews/1x1/card-01.png" })).toBeNull();
  expect(screen.getByText("media/shared-visuals/image.png")).not.toBeVisible();
});

it("keeps the render request contract and refreshes workflow status on completion", async () => {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({ ok: true, json: async () => init?.method === "POST" ? { status: "rendered" } : assets }));
  vi.stubGlobal("fetch", fetchMock);
  const changed = vi.fn();
  render(<MarketingReviewAssetsPanel candidateId="candidate" onStatusChange={changed} />);
  fireEvent.click(await screen.findByRole("button", { name: "카드뉴스 렌더링 시작" }));
  await waitFor(() => expect(changed).toHaveBeenCalledOnce());
  const post = fetchMock.mock.calls.find((call) => call[1]?.method === "POST")!;
  expect(post[0]).toBe("/api/admin/marketing-review/candidate/assets/cardnews/render");
  expect(post[1]?.body).toBe("{}");
});
