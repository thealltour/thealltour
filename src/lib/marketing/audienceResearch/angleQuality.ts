import type { AcrbContentAngle } from "@/lib/marketing/audienceResearch/contracts";
import { clamp01 } from "@/lib/marketing/audienceResearch/validate";

const GENERIC_ANGLE_PATTERNS = [
  /알아보기/,
  /장점$/,
  /소개$/,
  /여행에 관심/,
  /특별한 경험/,
  /좋은 추억/,
  /유용한 정보/,
  /크루즈 여행의 매력/,
  /^.{0,8}가이드$/,
  /^시드\s*재평가\s*:/,
  /^seed\s*re-?eval/i,
];

const STRONG_SIGNAL_PATTERNS = [
  /불안|헷갈|막막|실수|리스크|비교|전에|직전|먼저|동선|준비|처음|초보|부모님|가족|연휴|추석|체크|결정|대비|공백|불확실/,
];

export function isGenericAngleText(text: string): boolean {
  const t = text.trim();
  if (t.length < 8) return true;
  return GENERIC_ANGLE_PATTERNS.some((re) => re.test(t));
}

export function isSeedWrapperAngle(text: string): boolean {
  return /^시드\s*재평가\s*:/i.test(text.trim()) || /^seed\s*re-?eval/i.test(text.trim());
}

export function angleHasStrongSignal(
  angle: Pick<AcrbContentAngle, "angle" | "hook" | "audienceTension">,
): boolean {
  const blob = `${angle.angle} ${angle.hook} ${angle.audienceTension}`;
  return STRONG_SIGNAL_PATTERNS.some((re) => re.test(blob));
}

export function isRecommendedAngleComplete(angle: AcrbContentAngle): boolean {
  return Boolean(
    angle.angle.trim() &&
      (angle.hook.trim() || angle.rationale.trim()) &&
      angle.audienceTension.trim() &&
      angle.rationale.trim() &&
      !isSeedWrapperAngle(angle.angle) &&
      !isGenericAngleText(angle.angle),
  );
}

/** Penalize/reject generic & seed-wrapper angles; require audience tension signal. */
export function applyAngleQualityGate(angles: AcrbContentAngle[]): AcrbContentAngle[] {
  return angles
    .map((angle) => {
      let interest = angle.interestScore;
      let novelty = angle.noveltyScore;
      const limitations = [...angle.limitations];

      if (isSeedWrapperAngle(angle.angle) || isSeedWrapperAngle(angle.hook)) {
        interest = 0;
        novelty = 0;
        limitations.push("seed_wrapper_angle_rejected");
      }
      if (isGenericAngleText(angle.angle) || isGenericAngleText(angle.hook)) {
        interest = clamp01(interest * 0.45);
        novelty = clamp01(novelty * 0.4);
        limitations.push("generic_angle_penalized");
      }
      if (!angleHasStrongSignal(angle)) {
        interest = clamp01(interest * 0.7);
        limitations.push("weak_audience_tension_signal");
      }
      if (!angle.audienceTension.trim()) {
        interest = clamp01(interest * 0.6);
        limitations.push("missing_audience_tension");
      }

      return {
        ...angle,
        interestScore: interest,
        noveltyScore: novelty,
        limitations: [...new Set(limitations)],
      };
    })
    .filter((angle) => !isSeedWrapperAngle(angle.angle))
    .filter((angle) => !(isGenericAngleText(angle.angle) && angle.interestScore < 0.25))
    .filter((angle) => angle.interestScore > 0)
    .sort(
      (a, b) =>
        b.interestScore * 0.4 +
        b.noveltyScore * 0.35 +
        b.evidenceStrength * 0.25 -
        (a.interestScore * 0.4 + a.noveltyScore * 0.35 + a.evidenceStrength * 0.25),
    )
    .slice(0, 5);
}

export function pickRecommendedAngle(angles: AcrbContentAngle[]): AcrbContentAngle | null {
  const ranked = applyAngleQualityGate(angles).filter(isRecommendedAngleComplete);
  return ranked[0] ?? null;
}
