import { useEffect, useState } from "react";

export function useIsDesktop(minWidthPx = 768) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${minWidthPx}px)`);
    const onChange = () => setIsDesktop(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [minWidthPx]);

  return isDesktop;
}
