import { describe, expect, it } from "vitest";
import {
  activateLazyLoadedImagesOnElement,
  isJunkImageUrl,
  minifyHtmlForAi,
  pickBestSrcFromSrcset,
  resolveImageUrlFromAttrs,
  sanitizeHtmlClone,
  stripHtmlToText,
  truncatePageContent,
} from "@/lib/admin/externalImport/htmlContextExtract";

describe("htmlContextExtract", () => {
  it("resolves lazy data-src to absolute url", () => {
    const url = resolveImageUrlFromAttrs(
      {
        dataSrc: "/images/spot.jpg",
        src: "data:image/gif;base64,placeholder",
      },
      "https://www.hanatour.com/pkg/1",
    );
    expect(url).toBe("https://www.hanatour.com/images/spot.jpg");
  });

  it("picks largest width from srcset", () => {
    const url = pickBestSrcFromSrcset(
      "/small.jpg 400w, /large.jpg 1200w",
      "https://cdn.example.com/",
    );
    expect(url).toBe("https://cdn.example.com/large.jpg");
  });

  it("filters junk image urls", () => {
    expect(isJunkImageUrl("https://cdn.example.com/logo.png")).toBe(true);
    expect(isJunkImageUrl("https://cdn.example.com/spot.jpg")).toBe(false);
  });

  it("activates lazy src on img elements", () => {
    document.body.innerHTML =
      '<div id="root"><img data-src="https://cdn.example.com/real.jpg" src="data:x"></div>';
    const root = document.getElementById("root")!;
    activateLazyLoadedImagesOnElement(root, "https://example.com");
    const img = root.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("https://cdn.example.com/real.jpg");
  });

  it("removes trash tags and preserves content html", () => {
    document.body.innerHTML =
      '<div id="root"><script>alert(1)</script><p>1일차</p><img data-src="/a.jpg"><style>.x{}</style></div>';
    const root = document.getElementById("root")!;
    const clone = root.cloneNode(true) as Element;
    const html = sanitizeHtmlClone(clone, "https://example.com");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<style");
    expect(html).toContain("1일차");
    expect(html).toContain('src="https://example.com/a.jpg"');
  });

  it("truncates long content", () => {
    const out = truncatePageContent("a".repeat(200), 50);
    expect(out).toContain("…(truncated)");
    expect(out.length).toBeLessThan(200);
  });

  it("minifies html by stripping classes and keeping img src", () => {
    const raw =
      '<div class="foo" style="color:red"><p data-x="1">1일차</p><img class="bar" src="https://cdn.example.com/a.jpg" alt="산"></div>';
    const out = minifyHtmlForAi(raw);
    expect(out).not.toContain("class=");
    expect(out).toContain('src="https://cdn.example.com/a.jpg"');
    expect(out).toContain("1일차");
  });

  it("strips html to plain text", () => {
    expect(stripHtmlToText("<p>상품명</p><div>가격</div>")).toBe("상품명 가격");
  });
});
