export {
  NAVER_BAND_COPY_CONTRACT,
  NAVER_BAND_COPY_WRITER_HERMES_PROFILE,
  NAVER_BAND_COPY_PREFERRED_MIN_CHARS,
  NAVER_BAND_COPY_PREFERRED_MAX_CHARS,
  NAVER_BAND_COPY_SPECIALIST_MAX_CHARS,
  type NaverBandCopyArtifact,
  type NaverBandCopyEndingIntent,
  type NaverBandCopyOpeningIntent,
} from "@/lib/marketing/publishable/naverBandCopy/contracts";
export { NAVER_BAND_COPY_RELATIVE_PATH } from "@/lib/marketing/publishable/naverBandCopy/paths";
export { buildNaverBandCopyContentFingerprint } from "@/lib/marketing/publishable/naverBandCopy/fingerprint";
export {
  NAVER_BAND_COPY_WRITER_SOUL,
  NAVER_BAND_COPY_HERMES_PROFILE_SET,
  ensureNaverBandCopyWriterHermesReady,
} from "@/lib/marketing/publishable/naverBandCopy/hermesIdentity";
export {
  NaverBandCopyMaterializeError,
  materializeNaverBandCopy,
  hasForcedNaverBandCta,
  hasNaverBandUnsafeGeneralization,
  looksLikeCanonicalReprint,
} from "@/lib/marketing/publishable/naverBandCopy/materialize";
export {
  persistNaverBandCopy,
  readNaverBandCopyFromPackage,
} from "@/lib/marketing/publishable/naverBandCopy/persist";
export { assemblePublishableNaverBandFromCopy } from "@/lib/marketing/publishable/naverBandCopy/assemblePublishable";
export {
  runNaverBandCopySpecialist,
  assertNaverBandCopyArtifactContractParity,
  resolveNaverBandCopyRepairAttemptBudget,
  type RunNaverBandCopySpecialistResult,
} from "@/lib/marketing/publishable/naverBandCopy/pipeline";
