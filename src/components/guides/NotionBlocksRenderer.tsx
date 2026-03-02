import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import styles from "./NotionBlocksRenderer.module.css";
import { getNotionTokenVars, type NotionThemeMode } from "@/styles/notionTokens";
import { NotionImageGroupCarousel } from "@/components/guides/NotionImageGroupCarousel";
import type { GuideBlock, NotionRichText } from "@/lib/notion";

type Props = {
  blocks: GuideBlock[];
  theme?: NotionThemeMode;
};

type RenderContext = {
  hasPrimaryH1: boolean;
};

const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxNicgaGVpZ2h0PScxMic+PHJlY3Qgd2lkdGg9JzE2JyBoZWlnaHQ9JzEyJyBmaWxsPScjMGIxMjIwJy8+PC9zdmc+";

function getColorClasses(color?: string): string[] {
  if (!color || color === "default") return [];
  const classes: string[] = [];

  switch (color) {
    case "blue":
      classes.push(styles.rtFgBlue);
      break;
    case "orange":
      classes.push(styles.rtFgOrange);
      break;
    case "pink":
      classes.push(styles.rtFgPink);
      break;
    case "red":
      classes.push(styles.rtFgRed);
      break;
    case "gray":
      classes.push(styles.rtFgGray);
      break;
    case "blue_background":
      classes.push(styles.rtBgBlue);
      break;
    case "orange_background":
      classes.push(styles.rtBgOrange);
      break;
    case "pink_background":
      classes.push(styles.rtBgPink);
      break;
    case "red_background":
      classes.push(styles.rtBgRed);
      break;
    case "gray_background":
      classes.push(styles.rtBgGray);
      break;
    default:
      break;
  }

  return classes;
}

function renderRichText(richText: NotionRichText[]): ReactNode {
  return richText.map((item, index) => {
    const text = item.plain_text ?? "";
    if (!text) return null;

    const annotation = item.annotations ?? {};
    const spanClasses = [
      styles.richTextSegment,
      annotation.bold ? styles.rtBold : "",
      annotation.italic ? styles.rtItalic : "",
      annotation.underline ? styles.underlined : "",
      annotation.strikethrough ? styles.rtStrike : "",
      annotation.code ? styles.inlineCode : "",
      ...getColorClasses(annotation.color),
    ]
      .filter(Boolean)
      .join(" ");

    const segment = (
      <span key={`${text}-${index}`} className={spanClasses}>
        {text}
      </span>
    );

    if (item.href) {
      return (
        <a
          key={`${item.href}-${index}`}
          href={item.href}
          className={styles.link}
          target="_blank"
          rel="noopener noreferrer"
        >
          {segment}
        </a>
      );
    }

    return segment;
  });
}

function renderBlock(block: GuideBlock, ctx: RenderContext): ReactNode {
  if (block.type === "heading") {
    if (block.level === 1) {
      if (!ctx.hasPrimaryH1) {
        ctx.hasPrimaryH1 = true;
        return (
          <h1 key={block.id} id={block.id} className={`${styles.block} ${styles.h1}`}>
            {renderRichText(block.richText)}
          </h1>
        );
      }
      return (
        <h2 key={block.id} id={block.id} className={`${styles.block} ${styles.h2}`}>
          {renderRichText(block.richText)}
        </h2>
      );
    }

    if (block.level === 2) {
      return (
        <h2 key={block.id} id={block.id} className={`${styles.block} ${styles.h2}`}>
          {renderRichText(block.richText)}
        </h2>
      );
    }

    return (
      <h3 key={block.id} id={block.id} className={`${styles.block} ${styles.h3}`}>
        {renderRichText(block.richText)}
      </h3>
    );
  }

  if (block.type === "paragraph") {
    return (
      <p key={block.id} className={`${styles.block} ${styles.paragraph}`}>
        {renderRichText(block.richText)}
      </p>
    );
  }

  if (block.type === "list") {
    const ListTag = block.ordered ? "ol" : "ul";
    return (
      <ListTag key={block.id} className={`${styles.block} ${styles.list}`}>
        {block.items.map((item) => (
          <li key={item.id} className={styles.listItem}>
            {renderRichText(item.richText)}
            {item.children.length > 0 ? (
              <div className={styles.nestedContainer}>{renderBlocks(item.children, ctx)}</div>
            ) : null}
          </li>
        ))}
      </ListTag>
    );
  }

  if (block.type === "quote") {
    return (
      <blockquote key={block.id} className={`${styles.block} ${styles.quote}`}>
        {renderRichText(block.richText)}
      </blockquote>
    );
  }

  if (block.type === "callout") {
    return (
      <div key={block.id} className={`${styles.block} ${styles.callout}`}>
        <div className={styles.calloutIcon}>{block.icon || "💡"}</div>
        <div className={styles.calloutBody}>
          <p className={styles.paragraph}>{renderRichText(block.richText)}</p>
          {block.children.length > 0 ? (
            <div className={styles.nestedContainer}>{renderBlocks(block.children, ctx)}</div>
          ) : null}
        </div>
      </div>
    );
  }

  if (block.type === "columns") {
    return (
      <section
        key={block.id}
        className={`${styles.block} ${styles.columns}`}
        style={{ "--columns-count": String(block.columns.length || 1) } as CSSProperties}
        aria-label="컬럼 콘텐츠"
      >
        {block.columns.map((column) => (
          <div key={column.id} className={styles.column}>
            {renderBlocks(column.blocks, ctx)}
          </div>
        ))}
      </section>
    );
  }

  if (block.type === "table") {
    return (
      <div key={block.id} className={`${styles.block} ${styles.tableWrap}`}>
        <table className={styles.table}>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={row.id}>
                {row.cells.map((cell, colIndex) => {
                  const isHeaderCell = (block.hasColumnHeader && rowIndex === 0) || (block.hasRowHeader && colIndex === 0);
                  const CellTag = isHeaderCell ? "th" : "td";
                  return (
                    <CellTag key={`${row.id}-${colIndex}`} className={isHeaderCell ? styles.tableHeaderCell : styles.tableCell}>
                      {renderRichText(cell)}
                    </CellTag>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === "image_group") {
    return <NotionImageGroupCarousel key={block.groupId} group={block} />;
  }

  if (block.type === "image") {
    return (
      <figure key={block.id} className={`${styles.block} ${styles.imageFigure}`}>
        <Image
          unoptimized
          src={block.image.src}
          alt={block.image.alt}
          width={block.image.width ?? 1400}
          height={block.image.height ?? 1000}
          sizes="(max-width: 768px) 100vw, 760px"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className={styles.image}
        />
        {block.image.caption ? <figcaption className={styles.imageCaption}>{block.image.caption}</figcaption> : null}
      </figure>
    );
  }

  if (block.type === "divider") {
    return <hr key={block.id} className={`${styles.block} ${styles.divider}`} />;
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn("[NotionBlocksRenderer] unsupported GuideBlock", block);
  }
  return null;
}

function renderBlocks(blocks: GuideBlock[], ctx: RenderContext): ReactNode {
  return blocks.map((block) => renderBlock(block, ctx));
}

export function NotionBlocksRenderer({ blocks, theme = "dark" }: Props) {
  if (!blocks?.length) return null;
  const ctx: RenderContext = { hasPrimaryH1: false };
  return (
    <article className={styles.root} style={getNotionTokenVars(theme)}>
      <div className={styles.container}>{renderBlocks(blocks, ctx)}</div>
    </article>
  );
}

