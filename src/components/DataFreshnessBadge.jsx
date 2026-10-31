import React from "react";

const FRESH_MINUTES = 20;
const STALE_MINUTES = 60;

function describeFreshness(assets) {
  const timestamps = (assets || [])
    .map((asset) => Date.parse(asset.currentPriceTime))
    .filter(Number.isFinite);

  if (timestamps.length === 0) {
    return { status: "unknown", label: "No data yet" };
  }

  const mostRecent = Math.max(...timestamps);
  const minutesAgo = Math.max(0, Math.round((Date.now() - mostRecent) / 60000));
  const ageLabel = minutesAgo < 1 ? "just now" : `${minutesAgo}m ago`;

  if (minutesAgo <= FRESH_MINUTES) {
    return { status: "live", label: `Live · updated ${ageLabel}` };
  }

  if (minutesAgo <= STALE_MINUTES) {
    return { status: "delayed", label: `Delayed · updated ${ageLabel}` };
  }

  return { status: "down", label: `Data stale · updated ${ageLabel}` };
}

export default function DataFreshnessBadge({ assets }) {
  const { status, label } = describeFreshness(assets);

  return (
    <span className={`freshness-badge freshness-badge--${status}`}>
      <i aria-hidden="true" />
      {label}
    </span>
  );
}
