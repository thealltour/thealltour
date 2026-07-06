"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { MobileGolfAdBodyDoc } from "@/lib/adminMobileGolfAds/bodyDoc";
import { parseMobileGolfAdBodyDoc } from "@/lib/adminMobileGolfAds/bodyDoc";
import { FontSizeMark } from "@/components/admin/mobile-golf-ads/editor/extensions/FontSizeMark";
import { TextColorMark } from "@/components/admin/mobile-golf-ads/editor/extensions/TextColorMark";
import { HighlightBoxMark } from "@/components/admin/mobile-golf-ads/editor/extensions/HighlightBoxMark";
import { GolfProductRailNode } from "@/components/admin/mobile-golf-ads/editor/extensions/GolfProductRailNode";
import { MobileGolfAdEditorToolbar } from "@/components/admin/mobile-golf-ads/editor/MobileGolfAdEditorToolbar";

export type MobileGolfAdTipTapEditorProps = {
  value: MobileGolfAdBodyDoc;
  onChange: (doc: MobileGolfAdBodyDoc) => void;
};

export function MobileGolfAdTipTapEditor({ value, onChange }: MobileGolfAdTipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      FontSizeMark,
      TextColorMark,
      HighlightBoxMark,
      GolfProductRailNode,
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[280px] px-3 py-3 focus:outline-none text-[var(--text-primary)] [&_.mg-highlight-box]:rounded-lg [&_.mg-highlight-box]:px-1.5 [&_.mg-highlight-box]:py-0.5",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(parseMobileGolfAdBodyDoc(ed.getJSON()));
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    const next = JSON.stringify(value);
    if (current !== next) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  const insertProductRail = () => {
    editor?.chain().focus().insertGolfProductRail().run();
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <MobileGolfAdEditorToolbar editor={editor} onInsertProductRail={insertProductRail} />
      <EditorContent editor={editor} />
    </div>
  );
}
