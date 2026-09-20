/**
 * Instagram channel constraints for carousel planner (adapter surface).
 * Story/copy generation lives in dedicated workers — this is conventions only.
 */

export type InstagramChannelConstraints = {
  minCards: number;
  maxCards: number;
  preferredCardRange: { min: number; max: number };
  aspectRatio: "4:5";
  hashtagMax: number;
  captionTone: "editorial_informative";
};

export const DEFAULT_INSTAGRAM_CHANNEL_CONSTRAINTS: InstagramChannelConstraints = {
  minCards: 3,
  maxCards: 10,
  preferredCardRange: { min: 4, max: 6 },
  aspectRatio: "4:5",
  hashtagMax: 12,
  captionTone: "editorial_informative",
};
