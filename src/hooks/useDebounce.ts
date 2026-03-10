import { useEffect, useState } from "react";

/**
 * 값을 delay(ms)만큼 지연해 반환.
 * 타이핑 시 과도한 API 호출 방지용.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
