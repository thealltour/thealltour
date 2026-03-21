import type { ComponentProps, ReactElement } from "react";
import { ICONS, type IconName } from "@/icons";

export type IconProps = {
  name: IconName;
  /** 픽셀 (width/height). 기본 20 */
  size?: number;
  className?: string;
  /** decorative=false 일 때 스크린리더용 이름 (권장) */
  title?: string;
  /**
   * true: 장식용, aria-hidden
   * false: role="img", title/aria-label 제공
   */
  decorative?: boolean;
};

type SvgIconComponent = (props: ComponentProps<(typeof ICONS)[IconName]>) => ReactElement | null;

/**
 * 브랜드 아이콘 시스템 진입점. 레지스트리 키로 SVG를 렌더합니다.
 */
export function Icon({ name, size = 20, className, title, decorative = true }: IconProps) {
  const Cmp = ICONS[name] as SvgIconComponent;

  if (decorative) {
    return <Cmp size={size} className={className} aria-hidden />;
  }

  const ariaLabel = title ?? String(name);

  return (
    <Cmp size={size} className={className} role="img" aria-label={ariaLabel}>
      {title ? <title>{title}</title> : null}
    </Cmp>
  );
}
