"use client";

import { cn } from "@/lib/cn";
import { PageContainer, type PageContainerSize } from "./PageContainer";

export type ContentContainerProps = {
  children: React.ReactNode;
  className?: string;
  /**
   * 폭 프리셋. 기본값 default(1280px).
   * 기존 max-w-6xl(1152px)보다 넓게 조정되어 유저 페이지에 맞춤.
   */
  size?: PageContainerSize;
};

/**
 * 콘텐츠 폭 제한 컨테이너.
 * PageContainer 기반으로, 유저 페이지 전반에 공통 폭·패딩 적용.
 * 하위 호환: size 미지정 시 default(1280px) 사용.
 */
export function ContentContainer({
  children,
  className,
  size = "default",
}: ContentContainerProps) {
  return (
    <PageContainer size={size} className={cn(className)}>
      {children}
    </PageContainer>
  );
}
