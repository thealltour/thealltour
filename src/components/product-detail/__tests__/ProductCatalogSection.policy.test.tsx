import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
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

const CATALOG_SOURCE = readFileSync(
  resolve(process.cwd(), "src/components/product-detail/ProductCatalogSection.tsx"),
  "utf8",
);

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

  it("Browse paginated: server total count summary without client region tab filter", () => {
    render(
      <ProductCatalogSection
        products={[prod({ id: "a", category: "일본" }), prod({ id: "b", category: "미국" })]}
        listTotalCount={2}
        initialRegion="일본"
      />,
    );
    expect(screen.getByText(/총 2개 · 지역 일본/)).toBeInTheDocument();
  });

  it("does not render full region or theme taxonomy chip rows in body", () => {
    render(
      <ProductCatalogSection
        products={[prod({ id: "a", category: "일본" }), prod({ id: "b", category: "미국" })]}
        themeChipOptions={["골프", "힐링"]}
        listTotalCount={2}
      />,
    );

    expect(screen.queryByRole("button", { name: "일본" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "미국" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "골프" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "힐링" })).not.toBeInTheDocument();
    expect(CATALOG_SOURCE).not.toMatch(/categoryTabs\.map/);
    expect(CATALOG_SOURCE).not.toMatch(/themeTabs\.map/);
  });

  it("legacy client mode: initialRegion filters products without taxonomy chips", () => {
    render(
      <ProductCatalogSection
        products={[prod({ id: "a", category: "일본" }), prod({ id: "b", category: "미국" })]}
        initialRegion="일본"
      />,
    );
    expect(screen.getByText(/총 1개 · 지역 일본/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "미국" })).not.toBeInTheDocument();
  });

  it("Browse paginated: skip client keyword re-filter when listTotalCount provided", () => {
    render(
      <ProductCatalogSection
        products={[prod({ id: "a", title: "제주 골프" }), prod({ id: "b", title: "오사카" })]}
        listTotalCount={2}
        initialKeyword="제주"
      />,
    );
    expect(screen.getByText(/총 2개/)).toBeInTheDocument();
  });

  it("non-browse: client keyword filter still applies", () => {
    render(
      <ProductCatalogSection
        products={[prod({ id: "a", title: "제주 골프" }), prod({ id: "b", title: "오사카" })]}
        initialKeyword="제주"
      />,
    );
    expect(screen.getByText(/총 1개/)).toBeInTheDocument();
  });

  it("0건 + initialRegion + onResetFilters 시 reset CTA", () => {
    render(
      <ProductCatalogSection
        products={[prod({ title: "only" })]}
        initialKeyword="nomatch"
        initialRegion="일본"
        onResetFilters={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "필터 초기화" })).toBeInTheDocument();
  });

  it("list 레이아웃: productToProductCardProps 에 campaignBadgeMax: 2", () => {
    const spy = vi.spyOn(productCardProps, "productToProductCardProps");
    render(<ProductCatalogSection products={[prod({ id: "x" })]} cardLayout="list" />);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ id: "x" }),
      expect.objectContaining({ campaignBadgeMax: 2 }),
    );
  });

  it("related 레이아웃: layout related + landing_catalog", () => {
    const spy = vi.spyOn(productCardProps, "productToProductCardProps");
    render(<ProductCatalogSection products={[prod({ id: "x" })]} cardLayout="related" />);
    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ layout: "related", analyticsSection: "landing_catalog" }),
    );
  });
});
