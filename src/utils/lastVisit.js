const STORAGE_PREFIX = "lastVisit_";

// A missing value means "never opened this asset's full analysis before" -
// callers treat that as "nothing new to flag" rather than "everything is new".
export function getLastVisit(assetId) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + assetId);
    const parsed = raw ? Number(raw) : null;
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function markVisited(assetId) {
  try {
    localStorage.setItem(STORAGE_PREFIX + assetId, String(Date.now()));
  } catch {
    // Private browsing / blocked storage - the badge just won't persist.
  }
}

export function countNewSince(lastVisit, items) {
  if (lastVisit === null || !items) {
    return 0;
  }

  return items.filter((item) => {
    const eventTime = Date.parse(item.time);
    return Number.isFinite(eventTime) && eventTime > lastVisit;
  }).length;
}
