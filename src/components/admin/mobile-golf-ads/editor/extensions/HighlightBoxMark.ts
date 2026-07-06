import { Mark, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    highlightBox: {
      setHighlightBox: (attrs: { backgroundColor: string; roundBox: boolean }) => ReturnType;
      unsetHighlightBox: () => ReturnType;
    };
  }
}

export const HighlightBoxMark = Mark.create({
  name: "highlightBox",
  addAttributes() {
    return {
      backgroundColor: {
        default: "#f8fafc",
        parseHTML: (element) => element.getAttribute("data-bg-color") || "#f8fafc",
        renderHTML: (attributes) => ({
          "data-bg-color": attributes.backgroundColor,
          style: `background-color: ${attributes.backgroundColor}`,
        }),
      },
      roundBox: {
        default: true,
        parseHTML: (element) => element.getAttribute("data-round-box") === "true",
        renderHTML: (attributes) => ({
          "data-round-box": attributes.roundBox ? "true" : "false",
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-bg-color]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "mg-highlight-box" }), 0];
  },
  addCommands() {
    return {
      setHighlightBox:
        (attrs) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),
      unsetHighlightBox:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
