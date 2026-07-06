import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { GolfProductRailNodeView } from "@/components/admin/mobile-golf-ads/editor/GolfProductRailNodeView";
import {
  DEFAULT_GOLF_RAIL_DESCRIPTION,
  DEFAULT_GOLF_RAIL_EYEBROW,
  DEFAULT_GOLF_RAIL_TITLE,
  type GolfProductRailAttrs,
} from "@/lib/adminMobileGolfAds/bodyDoc";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    golfProductRail: {
      insertGolfProductRail: (attrs?: Partial<GolfProductRailAttrs>) => ReturnType;
    };
  }
}

export const GolfProductRailNode = Node.create({
  name: "golfProductRail",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      source: { default: "home_default" },
      productIds: { default: [] },
      eyebrow: { default: DEFAULT_GOLF_RAIL_EYEBROW },
      title: { default: DEFAULT_GOLF_RAIL_TITLE },
      description: { default: DEFAULT_GOLF_RAIL_DESCRIPTION },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="golf-product-rail"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "golf-product-rail" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(GolfProductRailNodeView);
  },

  addCommands() {
    return {
      insertGolfProductRail:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              source: attrs?.source ?? "home_default",
              productIds: attrs?.productIds ?? [],
              eyebrow: attrs?.eyebrow ?? DEFAULT_GOLF_RAIL_EYEBROW,
              title: attrs?.title ?? DEFAULT_GOLF_RAIL_TITLE,
              description: attrs?.description ?? DEFAULT_GOLF_RAIL_DESCRIPTION,
            },
          }),
    };
  },
});
