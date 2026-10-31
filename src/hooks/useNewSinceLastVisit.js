import { useMemo, useState } from "react";
import { countNewSince, getLastVisit } from "../utils/lastVisit";

// The stored "last visit" timestamp is only read once per mount - it's
// deliberately frozen for the card's lifetime so the count doesn't reset to 0
// mid-session the instant markVisited() fires from somewhere else.
export default function useNewSinceLastVisit(assetId, recentImpacts) {
  const [lastVisit] = useState(() => getLastVisit(assetId));
  return useMemo(() => countNewSince(lastVisit, recentImpacts), [lastVisit, recentImpacts]);
}
