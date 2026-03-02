import Image from "next/image";
import type { ReactNode } from "react";
import styles from "./NotionBlocksRenderer.module.css";
import { getNotionTokenVars, type NotionThemeMode } from "@/styles/notionTokens";
import { NotionImageGroupCarousel } from "@/components/guides/NotionImageGroupCarousel";
import type { GuideBlock, NotionRichText } from "@/lib/notion";

type Props = {
  blocks: GuideBlock[];
  theme?: NotionThemeMode;
};

const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxNicgaGVpZ2h0PScxMic+PHJlY3Qgd2lkdGg9JzE2JyBoZWlnaHQ9JzEyJyBmaWxsPScjMGIxMjIwJy8+PC9zdmc+";

function renderRichText(richText: NotionRichText[]): ReactNode {
  return richText.map((item, index) => {
    const text = item.plain_text ?? "";
    if (!text) return null;
    let node: ReactNode = text;

    if (item.annotations) {
      const { bold, italic, underline, code } = item.annotations;
      if (code) {
        node = <code className={styles.inlineCode}>{node}</code>;
      }
      if (bold) node = <strong>{node}</strong>;
      if (italic) node = <em>{node}</em>;
      if (underline) node = <span className={styles.underlined}>{node}</span>;
    }

    if (item.href) {
      node = (
        <a href={item.href} className={styles.link} target="_blank" rel="noopener noreferrer">
          {node}
        </a>
      );
    }
    return <span key={`${text}-${index}`}>{node}</span>;
  });
}

function renderBlocks(blocks: GuideBlock[]): ReactNode {
  return blocks.map((block) => {
    if (block.type === "heading") {
      if (block.level === 1) {
        return (
          <h2 key={block.id} id={block.id} className={`${styles.block} ${styles.h1}`}>
            {renderRichText(block.richText)}
          </h2>
        );
      }
      if (block.level === 2) {
        return (
          <h3 key={block.id} id={block.id} className={`${styles.block} ${styles.h2}`}>
            {renderRichText(block.richText)}
          </h3>
        );
      }
      return (
        <h4 key={block.id} id={block.id} className={`${styles.block} ${styles.h3}`}>
          {renderRichText(block.richText)}
        </h4>
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
                <div className={styles.nestedContainer}>{renderBlocks(item.children)}</div>
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
              <div className={styles.nestedContainer}>{renderBlocks(block.children)}</div>
            ) : null}
          </div>
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
          {block.image.caption ? (
            <figcaption className={styles.imageCaption}>{block.image.caption}</figcaption>
          ) : null}
        </figure>
      );
    }

    return <hr key={block.id} className={`${styles.block} ${styles.divider}`} />;
  });
}

export function NotionBlocksRenderer({ blocks, theme = "dark" }: Props) {
  if (!blocks?.length) return null;
  return (
    <article className={styles.root} style={getNotionTokenVars(theme)}>
      <div className={styles.container}>{renderBlocks(blocks)}</div>
    </article>
  );
}

