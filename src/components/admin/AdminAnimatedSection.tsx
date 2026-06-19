"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type AdminAnimatedSectionProps = {
  children: ReactNode;
  sectionKey?: string;
};

export default function AdminAnimatedSection({ children, sectionKey }: AdminAnimatedSectionProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [sectionKey]);

  return (
    <div
      className={`mt-4 transform transition-all duration-[180ms] ease-in-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
      }`}
    >
      {children}
    </div>
  );
}
