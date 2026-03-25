"use client";

import { ProductEditorSections, type ProductEditorSectionsProps } from "./ProductEditorSections";

export type ProductEditorShellProps = ProductEditorSectionsProps;

export function ProductEditorShell(props: ProductEditorShellProps) {
  return (
    <div className="space-y-2">
      <ProductEditorSections {...props} />
    </div>
  );
}
