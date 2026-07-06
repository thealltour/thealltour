import type { Editor } from "@tiptap/react";
import type { MobileGolfAdFontSize } from "@/lib/adminMobileGolfAds/types";
import { MOBILE_GOLF_AD_FONT_SIZE_OPTIONS } from "@/lib/adminMobileGolfAds/stylePresets";

export type MobileGolfAdEditorToolbarProps = {
  editor: Editor | null;
  onInsertProductRail: () => void;
};

export function MobileGolfAdEditorToolbar({
  editor,
  onInsertProductRail,
}: MobileGolfAdEditorToolbarProps) {
  if (!editor) return null;

  const applyFontSize = (size: MobileGolfAdFontSize) => {
    editor.chain().focus().setFontSize(size).run();
  };

  const applyTextColor = (color: string) => {
    editor.chain().focus().setTextColor(color).run();
  };

  const applyHighlight = (backgroundColor: string, roundBox: boolean) => {
    editor.chain().focus().setHighlightBox({ backgroundColor, roundBox }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-muted)]/50 px-3 py-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`rounded-md border px-2 py-1 text-xs font-bold ${
            editor.isActive("bold")
              ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
              : "border-[var(--border)]"
          }`}
        >
          B
        </button>
        {MOBILE_GOLF_AD_FONT_SIZE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => applyFontSize(opt.value)}
            className="rounded-md border border-[var(--border)] px-2 py-1 text-xs"
          >
            {opt.label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-1 text-xs">
        <span className="text-[var(--text-muted)]">강조색</span>
        <input
          type="color"
          defaultValue="#0f172a"
          onChange={(e) => applyTextColor(e.target.value)}
          className="h-7 w-8 cursor-pointer rounded border border-[var(--border)]"
        />
      </label>

      <label className="flex items-center gap-1 text-xs">
        <span className="text-[var(--text-muted)]">배경</span>
        <input
          type="color"
          defaultValue="#f8fafc"
          onChange={(e) => applyHighlight(e.target.value, true)}
          className="h-7 w-8 cursor-pointer rounded border border-[var(--border)]"
        />
      </label>

      <button
        type="button"
        onClick={() => applyHighlight("#f8fafc", true)}
        className="rounded-md border border-[var(--border)] px-2 py-1 text-xs"
      >
        라운드박스
      </button>

      <button
        type="button"
        onClick={onInsertProductRail}
        className="ml-auto rounded-md border border-[var(--primary)] px-2.5 py-1 text-xs font-semibold text-[var(--primary)]"
      >
        골프 상품 진열대 삽입
      </button>
    </div>
  );
}
