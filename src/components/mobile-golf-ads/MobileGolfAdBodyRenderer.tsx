"use client";

import type { ReactNode } from "react";
import { HomeProductCardRail } from "@/components/products/HomeProductCardRail";
import type {
  MobileGolfAdBodyBlockNode,
  MobileGolfAdBodyDoc,
  MobileGolfAdBodyTextNode,
  MobileGolfAdGolfProductRailNode,
} from "@/lib/adminMobileGolfAds/bodyDoc";
import { isBoldMarked, resolveMobileGolfAdTextMarkStyle } from "@/lib/adminMobileGolfAds/markStyles";
import { resolveRailProducts } from "@/lib/adminMobileGolfAds/resolveRailProducts";
import type { Product } from "@/types/product";

export type MobileGolfAdBodyRendererProps = {
  bodyDoc: MobileGolfAdBodyDoc;
  productsById?: Map<string, Product>;
  homeGolfProducts?: Product[];
  className?: string;
};

function renderTextNode(node: MobileGolfAdBodyTextNode, key: number): ReactNode {
  const { style, className } = resolveMobileGolfAdTextMarkStyle(node.marks);
  if (!node.text) return null;
  return (
    <span key={key} className={className || undefined} style={Object.keys(style).length ? style : undefined}>
      {node.text}
    </span>
  );
}

function renderParagraph(block: Extract<MobileGolfAdBodyBlockNode, { type: "paragraph" }>, index: number) {
  const content = block.content ?? [];
  if (content.length === 0) {
    return <div key={index} className="h-3" aria-hidden />;
  }

  const hasBold = content.some((t) => isBoldMarked(t.marks));
  const borderClass = index > 0 && !hasBold ? "border-t border-slate-100 pt-5 mt-5" : "";

  return (
    <p
      key={index}
      className={`whitespace-pre-wrap break-words leading-relaxed text-slate-900 ${borderClass}`}
    >
      {content.map((node, i) => renderTextNode(node, i))}
    </p>
  );
}

function renderGolfProductRail(
  block: MobileGolfAdGolfProductRailNode,
  index: number,
  productsById: Map<string, Product>,
  homeGolfProducts: Product[],
) {
  const products = resolveRailProducts(
    block.attrs.source,
    block.attrs.productIds,
    productsById,
    homeGolfProducts,
  );
  if (products.length === 0) return null;

  return (
    <section key={index} aria-label={block.attrs.title} className="py-5">
      {(block.attrs.eyebrow || block.attrs.title) && (
        <div className="mb-3 px-1">
          {block.attrs.eyebrow ? (
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">
              {block.attrs.eyebrow}
            </p>
          ) : null}
          {block.attrs.title ? (
            <h2 className="mt-0.5 text-base font-bold text-slate-900">{block.attrs.title}</h2>
          ) : null}
          {block.attrs.description ? (
            <p className="mt-1 text-sm text-slate-600">{block.attrs.description}</p>
          ) : null}
        </div>
      )}
      <HomeProductCardRail
        products={products}
        analyticsSection="mobile_golf_ad"
        listAriaLabel={block.attrs.title || "추천 골프투어"}
        className="-mx-1"
      />
    </section>
  );
}

export function MobileGolfAdBodyRenderer({
  bodyDoc,
  productsById,
  homeGolfProducts = [],
  className,
}: MobileGolfAdBodyRendererProps) {
  const productMap = productsById ?? new Map<string, Product>();

  return (
    <div className={`w-full px-4 py-5 ${className ?? ""}`}>
      {bodyDoc.content.map((block, index) => {
        if (block.type === "paragraph") return renderParagraph(block, index);
        if (block.type === "golfProductRail") {
          return renderGolfProductRail(block, index, productMap, homeGolfProducts);
        }
        return null;
      })}
    </div>
  );
}
