import { useEffect, useState } from "react";
import { getPriceStats } from "../api/dashboardApi";

export const PRICE_RANGE_OPTIONS = [
  { hours: 24, label: "24H" },
  { hours: 24 * 7, label: "7D" },
  { hours: 24 * 30, label: "30D" }
];

// The asset payload we already have IS the 24h window (it comes straight
// from the SQL view), so there's nothing to fetch for that choice - only
// 7D/30D need a live request against /price-stats.
export default function usePriceStats(symbol, fallbackStats) {
  const [hours, setHours] = useState(24);
  const [fetchedStats, setFetchedStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (hours === 24) {
      setFetchedStats(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getPriceStats(symbol, hours)
      .then((result) => {
        if (!cancelled) {
          setFetchedStats(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchedStats(null);
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
  }, [symbol, hours]);

  return {
    hours,
    setHours,
    // While a 7D/30D fetch is in flight (or failed), keep showing the last
    // good numbers instead of flashing zeroes.
    stats: hours === 24 ? fallbackStats : fetchedStats || fallbackStats,
    isLoading
  };
}
