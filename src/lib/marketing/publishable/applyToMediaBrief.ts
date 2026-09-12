/**
 * Apply publishable Threads + shortform narration onto a MediaBrief.
 */

import type { MediaBrief, ShortformNarrationSegment } from "@/lib/marketing/assets/contracts";
import { parseMediaBrief } from "@/lib/marketing/assets/parse";
import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";

export function applyPublishableContentToMediaBrief(
  mediaBrief: MediaBrief,
  bundle: PublishableContentBundle,
): MediaBrief {
  const narrationSegments: ShortformNarrationSegment[] = (
    bundle.shortform.narrationSegments ?? []
  ).map((seg) => ({
    segmentId: seg.segmentId,
    narrationText: seg.narrationText,
    subtitleText: seg.subtitleText,
    purpose: seg.purpose,
    visualIntent: seg.visualIntent,
    evidenceRefs: seg.evidenceRefs.slice(0, 8),
  }));

  return parseMediaBrief({
    ...mediaBrief,
    formats: {
      ...mediaBrief.formats,
      text: {
        enabled: Boolean(bundle.threads.title || bundle.threads.body),
        title: bundle.threads.title,
        body: bundle.threads.body,
      },
      shortform: {
        ...mediaBrief.formats.shortform,
        enabled:
          mediaBrief.formats.shortform.enabled || narrationSegments.length > 0,
        narrationSegments:
          narrationSegments.length > 0
            ? narrationSegments
            : mediaBrief.formats.shortform.narrationSegments,
      },
    },
  });
}

export function buildThreadsPostText(bundle: PublishableContentBundle): string {
  const title = bundle.threads.title?.trim() ?? "";
  const body = bundle.threads.body.trim();
  if (title && body) return `${title}\n\n${body}\n`;
  return `${title || body}\n`;
}
