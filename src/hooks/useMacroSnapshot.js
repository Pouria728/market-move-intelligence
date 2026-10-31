import { useEffect, useState } from "react";
import { getMacroSnapshot } from "../api/dashboardApi";

// Unlike usePriceStats, there's no overview payload to fall back to here -
// macro context isn't part of any per-asset endpoint, so every window
// (including the default 24h) needs its own live fetch.
export default function useMacroSnapshot(hours) {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    getMacroSnapshot(hours)
      .then((result) => {
        if (!cancelled) {
          setRows(result);
          setHasError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hours]);

  return { rows, isLoading, hasError };
}
