import "server-only";

export type ProviderVideoFile = {
  width: number | null;
  height: number | null;
  quality?: string | null;
  link: string;
  fileType?: string | null;
};

/**
 * Prefer portrait-friendly, shortform-sized renditions; avoid 4K when possible.
 */
export function selectShortformRendition(files: ProviderVideoFile[]): ProviderVideoFile | null {
  const usable = files.filter((f) => typeof f.link === "string" && f.link.length > 0);
  if (usable.length === 0) return null;

  const scored = usable.map((file) => {
    const width = file.width ?? 0;
    const height = file.height ?? 0;
    const portrait = height >= width ? 1 : 0;
    const heightScore =
      height >= 1920 ? 1 : height >= 1280 ? 0.9 : height >= 720 ? 0.6 : height > 0 ? 0.3 : 0.1;
    const tooBigPenalty = height > 2160 || width > 3840 ? -0.5 : 0;
    const qualityBoost =
      file.quality === "hd" ? 0.1 : file.quality === "sd" ? 0.05 : 0;
    return {
      file,
      score: portrait * 2 + heightScore + qualityBoost + tooBigPenalty,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.file.link.localeCompare(b.file.link);
  });
  return scored[0]!.file;
}
