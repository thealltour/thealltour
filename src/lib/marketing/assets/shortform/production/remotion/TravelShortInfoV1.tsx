/**
 * TravelShortInfoV1 — single Remotion template for shortform vertical (9:16).
 * Worker/server-only composition entry. Not imported from Next.js client pages.
 */

import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export type TravelShortInfoScene = {
  sceneId: string;
  durationFrames: number;
  mediaKind: "video" | "image" | "photo_motion";
  mediaSrc: string;
  subtitle?: string | null;
};

export type TravelShortInfoV1Props = {
  scenes: TravelShortInfoScene[];
  cta?: string | null;
};

const WIDTH = 1080;
const HEIGHT = 1920;

function resolveCompositionMediaSrc(src: string): string {
  if (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("data:") ||
    src.startsWith("blob:")
  ) {
    return src;
  }
  // publicDir-relative path staged by ProductionShortformRemotionRenderer
  return staticFile(src);
}


function PhotoMotionLayer({ src }: { src: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.08], {
    extrapolateRight: "clamp",
  });
  const shift = interpolate(frame, [0, durationInFrames], [0, -24], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0f14", overflow: "hidden" }}>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translateY(${shift}px)`,
        }}
      />
    </AbsoluteFill>
  );
}

function VideoLayer({ src }: { src: string }) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0f14", overflow: "hidden" }}>
      <OffthreadVideo
        src={src}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        muted
      />
    </AbsoluteFill>
  );
}

function SubtitleOverlay({ text }: { text: string }) {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 180,
        paddingLeft: 64,
        paddingRight: 64,
      }}
    >
      <div
        style={{
          color: "white",
          fontSize: 42,
          fontFamily: "system-ui, sans-serif",
          fontWeight: 650,
          textAlign: "center",
          lineHeight: 1.25,
          textShadow: "0 2px 8px rgba(0,0,0,0.65)",
          maxWidth: 900,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

export const TravelShortInfoV1: React.FC<TravelShortInfoV1Props> = ({ scenes, cta }) => {
  let from = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", width: WIDTH, height: HEIGHT }}>
      {scenes.map((scene) => {
        const start = from;
        from += scene.durationFrames;
        return (
          <Sequence key={scene.sceneId} from={start} durationInFrames={scene.durationFrames}>
            {scene.mediaKind === "photo_motion" || scene.mediaKind === "image" ? (
              <PhotoMotionLayer src={resolveCompositionMediaSrc(scene.mediaSrc)} />
            ) : (
              <VideoLayer src={resolveCompositionMediaSrc(scene.mediaSrc)} />
            )}
            {scene.subtitle ? <SubtitleOverlay text={scene.subtitle} /> : null}
          </Sequence>
        );
      })}
      {cta ? (
        <Sequence from={Math.max(0, from - 45)} durationInFrames={45}>
          <SubtitleOverlay text={cta} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};

export const TRAVEL_SHORT_INFO_V1_ID = "TravelShortInfoV1" as const;
export const TRAVEL_SHORT_INFO_V1_SIZE = { width: WIDTH, height: HEIGHT, fps: 30 } as const;
