/**
 * Remotion entry — server/worker only. Do not import from Next.js app routes/pages.
 */
import React from "react";
import { Composition, registerRoot } from "remotion";
import {
  TravelShortInfoV1,
  TRAVEL_SHORT_INFO_V1_ID,
  TRAVEL_SHORT_INFO_V1_SIZE,
  type TravelShortInfoV1Props,
} from "./TravelShortInfoV1";

const Root: React.FC = () => {
  return (
    <Composition
      id={TRAVEL_SHORT_INFO_V1_ID}
      component={TravelShortInfoV1}
      durationInFrames={90}
      fps={TRAVEL_SHORT_INFO_V1_SIZE.fps}
      width={TRAVEL_SHORT_INFO_V1_SIZE.width}
      height={TRAVEL_SHORT_INFO_V1_SIZE.height}
      defaultProps={
        {
          scenes: [],
          cta: null,
        } satisfies TravelShortInfoV1Props
      }
      calculateMetadata={async ({ props }) => {
        const total = (props.scenes ?? []).reduce((sum, s) => sum + (s.durationFrames || 0), 0);
        return {
          durationInFrames: Math.max(1, total || 90),
        };
      }}
    />
  );
};

registerRoot(Root);
