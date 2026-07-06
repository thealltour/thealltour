import { Mark, mergeAttributes } from "@tiptap/core";
import type { MobileGolfAdFontSize } from "@/lib/adminMobileGolfAds/types";

export type FontSizeOptions = {
  sizes: MobileGolfAdFontSize[];
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: MobileGolfAdFontSize) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSizeMark = Mark.create<FontSizeOptions>({
  name: "fontSize",
  addOptions() {
    return { sizes: ["sm", "md", "lg"] };
  },
  addAttributes() {
    return {
      size: {
        default: "md",
        parseHTML: (element) => element.getAttribute("data-font-size") || "md",
        renderHTML: (attributes) => ({
          "data-font-size": attributes.size,
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-font-size]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      setFontSize:
        (size) =>
        ({ commands }) =>
          commands.setMark(this.name, { size }),
      unsetFontSize:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
