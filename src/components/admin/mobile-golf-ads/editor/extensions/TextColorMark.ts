import { Mark, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textColor: {
      setTextColor: (color: string) => ReturnType;
      unsetTextColor: () => ReturnType;
    };
  }
}

export const TextColorMark = Mark.create({
  name: "textColor",
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-text-color"),
        renderHTML: (attributes) => {
          if (!attributes.color) return {};
          return { "data-text-color": attributes.color, style: `color: ${attributes.color}` };
        },
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-text-color]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      setTextColor:
        (color) =>
        ({ commands }) =>
          commands.setMark(this.name, { color }),
      unsetTextColor:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
