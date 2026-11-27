import { afterEach, describe, expect, it, vi } from "vitest";
import {
  elementIdFromHashHref,
  scrollToElementId,
  stripLocationHashFromHistory,
} from "@/lib/navigation/inPageAnchor";

describe("elementIdFromHashHref", () => {
  it("해시 href에서 id를 추출한다", () => {
    expect(elementIdFromHashHref("#products-golf-dates")).toBe("products-golf-dates");
    expect(elementIdFromHashHref("  #home-golf-dates  ")).toBe("home-golf-dates");
  });

  it("해시가 아니면 null", () => {
    expect(elementIdFromHashHref("/products")).toBeNull();
    expect(elementIdFromHashHref("#")).toBeNull();
    expect(elementIdFromHashHref(null)).toBeNull();
  });
});

describe("scrollToElementId / stripLocationHashFromHistory", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("존재하는 요소로 스크롤한다", () => {
    const el = document.createElement("div");
    el.id = "products-golf-dates";
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);

    expect(scrollToElementId("#products-golf-dates")).toBe(true);
    expect(el.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
  });

  it("해시가 있을 때만 replaceState로 제거한다", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("location", {
      hash: "#products-golf-dates",
      pathname: "/products",
      search: "?tourType=golf-park",
    });
    vi.stubGlobal("history", { state: { as: "/" }, replaceState });

    stripLocationHashFromHistory();

    expect(replaceState).toHaveBeenCalledWith(
      { as: "/" },
      "",
      "/products?tourType=golf-park",
    );
  });

  it("해시가 없으면 replaceState를 호출하지 않는다", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("location", {
      hash: "",
      pathname: "/products",
      search: "?tourType=golf-park",
    });
    vi.stubGlobal("history", { state: null, replaceState });

    stripLocationHashFromHistory();
    expect(replaceState).not.toHaveBeenCalled();
  });
});
