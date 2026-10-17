import { useEffect, useRef } from "react";

// Runs `callback` immediately and then every `ms` milliseconds while enabled.
// `resetKey` restarts the timer when it changes (e.g. when the data mode switches).
export function useInterval(callback: () => void, ms: number, enabled = true, resetKey?: unknown) {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (!enabled) return;
    saved.current();
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
  }, [ms, enabled, resetKey]);
}
