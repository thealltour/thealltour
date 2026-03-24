import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProductCatalogSection from "@/components/product-detail/ProductCatalogSection";
import type { Product } from "@/types/product";
import * as productCardProps from "@/lib/productCardProps";

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/products",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/inquiry/ConsultModal", () => ({
  useConsultModal: () => ({ openModal: vi.fn() }),
}));

function prod(o: Partial<Product> = {}): Product {
  return {
    id: o.id ?? "1",
    title: o.title ?? "t",
    description: "",
    image_url: "/x.jpg",
    category: o.category ?? "일본",
    theme: o.theme ?? "골프",
    ...o,
  };
}

describe("ProductCatalogSection policy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("URL-controlled: 내부 지역 탭 필터 없이 baseProducts 그대로", () => {
    render(
      <ProductCatalogSection
        products={[prod({ id: "a", category: "일본" }), prod({ id: "b", category: "미국" })]}
        categories={["일본", "미국"]}
        onCategoryChange={vi.fn()}
        onThemeChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/총 2개/)).toBeInTheDocument();
  });

  it("내부 탭 모드: 지역 칩으로 건수 축소", async () => {
    const user = userEvent.setup();
    render(
      <ProductCatalogSection
        products={[prod({ id: "a", category: "일본" }), prod({ id: "b", category: "미국" })]}
        categories={["일본", "미국"]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "일본" }));
    expect(screen.getByText(/총 1개/)).toBeInTheDocument();
  });

  it("URL-controlled 에서도 catalog keyword 로 한 번 더 필터", () => {
    render(
      <ProductCatalogSection
        products={[prod({ id: "a", title: "제주 골프" }), prod({ id: "b", title: "오사카" })]}
        categories={["일본"]}
        initialKeyword="제주"
        onCategoryChange={vi.fn()}
        onThemeChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/총 1개/)).toBeInTheDocument();
  });

  it("0건 + initialRegion + onResetFilters 시 reset CTA", () => {
    render(
      <ProductCatalogSection
        products={[prod({ title: "only" })]}
        categories={["일본"]}
        initialKeyword="nomatch"
        initialRegion="일본"
        onResetFilters={vi.fn()}
        onCategoryChange={vi.fn()}
        onThemeChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "필터 초기화" })).toBeInTheDocument();
  });

  it("list 레이아웃: productToProductCardProps 에 campaignBadgeMax: 2", () => {
    const spy = vi.spyOn(productCardProps, "productToProductCardProps");
    render(<ProductCatalogSection products={[prod({ id: "x" })]} categories={["일본"]} cardLayout="list" />);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ id: "x" }),
      expect.objectContaining({ campaignBadgeMax: 2 }),
    );
  });

  it("related 레이아웃: layout related + landing_catalog", () => {
    const spy = vi.spyOn(productCardProps, "productToProductCardProps");
    render(<ProductCatalogSection products={[prod({ id: "x" })]} categories={["일본"]} cardLayout="related" />);
    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ layout: "related", analyticsSection: "landing_catalog" }),
    );
  });
});
