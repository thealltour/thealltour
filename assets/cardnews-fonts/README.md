# Cardnews fallback fonts

Pretendard remains the primary font. These fonts are bundled for offline rendering;
the renderer's isolated fontconfig does not depend on fonts installed on the host.

- Noto Sans CJK JP Regular/Bold: notofonts/noto-cjk commit
  `f8d157532fbfaeda587e826d4cd5b21a49186f7c`, `Sans/OTF/Japanese/`.
- Noto Color Emoji COLRv1: googlefonts/noto-emoji v2.051, commit
  `8998f5dd683424a73e2314a8c1f1e359c19e8742`, `fonts/Noto-COLRv1.ttf`.
  The scalable COLRv1 font avoids the fixed bitmap strike size of NotoColorEmoji.ttf.

Both are redistributed under SIL OFL 1.1; licenses are included alongside the fonts.
Upstream: https://github.com/notofonts/noto-cjk and https://github.com/googlefonts/noto-emoji.

`fonts.ts` registers all files and includes their contents in its cache identity.
`colorEmoji.ts` uses Sharp's RGBA/Pango text path for lines containing emoji, then
embeds the PNG in the SVG. This preserves color that librsvg's text path loses.
The saved editorial copy and handoff/result JSON contracts are unchanged.
