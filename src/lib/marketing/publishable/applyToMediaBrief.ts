/**
 * Apply publishable Threads + shortform narration onto a MediaBrief.
 * Blog/Band/Kakao remain package-level copy artifacts (not MediaBrief formats)
 * to avoid bloating media-brief-v1.
 */

import type { MediaBrief, ShortformNarrationSegment } from "@/lib/marketing/assets/contracts";
import { parseMediaBrief } from "@/lib/marketing/assets/parse";
import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import { channelCountsAsPublishableSuccess } from "@/lib/marketing/publishable/publishableSuccess";

export function applyPublishableContentToMediaBrief(
  mediaBrief: MediaBrief,
  bundle: PublishableContentBundle,
): MediaBrief {
  const shortformOk = channelCountsAsPublishableSuccess(bundle.shortform);
  const threadsBody = bundle.threads.body?.trim() ? bundle.threads.body : mediaBrief.formats.text.body;
  const threadsTitle = bundle.threads.title ?? mediaBrief.formats.text.title;

  const narrationSegments: ShortformNarrationSegment[] = shortformOk
    ? (bundle.shortform.narrationSegments ?? []).map((seg) => ({
        segmentId: seg.segmentId,
        narrationText: seg.narrationText,
        subtitleText: seg.subtitleText,
        purpose: seg.purpose,
        visualIntent: seg.visualIntent,
        evidenceRefs: seg.evidenceRefs.slice(0, 8),
      }))
    : [];

  return parseMediaBrief({
    ...mediaBrief,
    formats: {
      ...mediaBrief.formats,
      text: {
        enabled: Boolean(threadsTitle || threadsBody),
        title: threadsTitle,
        body: threadsBody,
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
