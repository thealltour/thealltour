"use client";

import type { ReactNode } from "react";

/**
 * 상품 등록/편집 뷰 컨테이너.
 * 현재는 상위(AdminProductManager)에서 렌더한 폼/미리보기 UI를 children으로 받아 감싸기만 합니다.
 * 추후 폼 JSX와 상태/핸들러를 컨텍스트·props로 이전하면 이 컴포넌트가 전부 담당하도록 확장할 수 있습니다.
 */
export type AdminProductEditorViewProps = {
  children: ReactNode;
};

export default function AdminProductEditorView({ children }: AdminProductEditorViewProps) {
  return <>{children}</>;
}
