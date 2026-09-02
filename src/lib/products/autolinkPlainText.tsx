import { Fragment, useMemo } from "react";
import { cn } from "@/lib/cn";

const HTTP_URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/g;

export type AutolinkSegment = { kind: "text" | "url"; value: string };

function trimTrailingUrlPunctuation(url: string): string {
  return url.replace(/[.,;:!?)]+$/g, "");
}

export function isSafeHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** Split plain text into text/url segments — http(s) only, no HTML parser. */
export function splitAutolinkSegments(text: string): AutolinkSegment[] {
  if (!text) return [{ kind: "text", value: "" }];

  const segments: AutolinkSegment[] = [];
  let lastIndex = 0;
  const matches = text.matchAll(HTTP_URL_PATTERN);

  for (const match of matches) {
    const rawUrl = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ kind: "text", value: text.slice(lastIndex, index) });
    }
    const url = trimTrailingUrlPunctuation(rawUrl);
    if (isSafeHttpUrl(url)) {
      segments.push({ kind: "url", value: url });
    } else {
      segments.push({ kind: "text", value: rawUrl });
    }
    lastIndex = index + rawUrl.length;
  }

  if (lastIndex < text.length) {
    segments.push({ kind: "text", value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ kind: "text", value: text }];
}

const LINK_CLASS =
  "text-[var(--primary)] underline underline-offset-2 [overflow-wrap:anywhere] break-words";

export function AutolinkPlainText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const segments = useMemo(() => splitAutolinkSegments(text), [text]);

  return (
    <span className={cn("min-w-0 break-words [overflow-wrap:anywhere]", className)}>
      {segments.map((segment, index) =>
        segment.kind === "url" ? (
          <a
            key={`url-${index}`}
            href={segment.value}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            {segment.value}
          </a>
        ) : (
          <Fragment key={`text-${index}`}>{segment.value}</Fragment>
        ),
      )}
    </span>
  );
}
