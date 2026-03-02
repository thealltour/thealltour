"use client";

import React from "react";
import Image from "next/image";

type NotionBlock = any;

type Props = {
  blocks: NotionBlock[];
};

function renderRichText(richText: any[]): React.ReactNode {
  return richText.map((item, index) => {
    const text = item.plain_text ?? "";
    if (!text) return null;
    let node: React.ReactNode = text;

    if (item.annotations) {
      const { bold, italic, underline, code } = item.annotations;
      if (code) {
        node = <code className="rounded bg-slate-900/5 px-1 py-0.5 text-xs font-mono">{node}</code>;
      }
      if (bold) {
        node = <strong>{node}</strong>;
      }
      if (italic) {
        node = <em>{node}</em>;
      }
      if (underline) {
        node = <span className="underline underline-offset-2">{node}</span>;
      }
    }

    if (item.href) {
      node = (
        <a
          href={item.href}
          className="text-[#1E3A8A] underline underline-offset-2"
          target="_blank"
          rel="noopener noreferrer"
        >
          {node}
        </a>
      );
    }

    return <React.Fragment key={index}>{node}</React.Fragment>;
  });
}

export function NotionBlocksRenderer({ blocks }: Props) {
  if (!blocks?.length) return null;

  return (
    <article className="guide-content max-w-none text-content-primary">
      {blocks.map((block: NotionBlock) => {
        const { id, type } = block;
        if (!type) return null;

        switch (type) {
          case "heading_1":
            return (
              <h1 key={id} className="mt-10 section-title type-h2 text-content-primary">
                {renderRichText(block.heading_1?.rich_text ?? [])}
              </h1>
            );
          case "heading_2":
            return (
              <h2 key={id} className="mt-8 section-title type-h3 text-content-primary">
                {renderRichText(block.heading_2?.rich_text ?? [])}
              </h2>
            );
          case "heading_3":
            return (
              <h3 key={id} className="mt-6 font-card-title text-lg font-semibold text-content-primary">
                {renderRichText(block.heading_3?.rich_text ?? [])}
              </h3>
            );
          case "paragraph":
            return (
              <p key={id} className="mt-3 type-body leading-relaxed text-content-secondary">
                {renderRichText(block.paragraph?.rich_text ?? [])}
              </p>
            );
          case "bulleted_list_item":
            return (
              <ul key={id} className="my-2 list-disc pl-6">
                <li>{renderRichText(block.bulleted_list_item?.rich_text ?? [])}</li>
              </ul>
            );
          case "numbered_list_item":
            return (
              <ol key={id} className="my-2 list-decimal pl-6">
                <li>{renderRichText(block.numbered_list_item?.rich_text ?? [])}</li>
              </ol>
            );
          case "quote":
            return (
              <blockquote
                key={id}
                className="my-4 border-l-4 border-slate-300 bg-slate-50/80 px-4 py-2 text-sm text-slate-700"
              >
                {renderRichText(block.quote?.rich_text ?? [])}
              </blockquote>
            );
          case "divider":
            return <hr key={id} className="my-6 border-slate-200" />;
          case "callout":
            return (
              <div
                key={id}
                className="my-4 flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
              >
                <div className="mt-1 text-lg">{block.callout?.icon?.emoji ?? "💡"}</div>
                <div>{renderRichText(block.callout?.rich_text ?? [])}</div>
              </div>
            );
          case "toggle":
            return (
              <details key={id} className="my-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <summary className="cursor-pointer font-medium text-slate-800">
                  {renderRichText(block.toggle?.rich_text ?? [])}
                </summary>
              </details>
            );
          case "image": {
            const image = block.image;
            const source =
              image?.type === "external" ? image.external?.url : image?.file?.url;
            const caption = (image?.caption ?? [])
              .map((c: any) => c.plain_text)
              .join("");
            if (!source) return null;
            return (
              <figure key={id} className="my-6">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-100">
                  <Image
                    src={source}
                    alt={caption || "Guide image"}
                    fill
                    sizes="(max-width: 768px) 100vw, 768px"
                    className="object-cover"
                  />
                </div>
                {caption ? (
                  <figcaption className="mt-2 text-center text-xs text-slate-500">
                    {caption}
                  </figcaption>
                ) : null}
              </figure>
            );
          }
          default:
            return null;
        }
      })}
    </article>
  );
}

