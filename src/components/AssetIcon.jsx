import React from "react";
import { SiBitcoin, SiNvidia } from "react-icons/si";

// Real brand marks instead of a plain letter/glyph badge.
const BRAND_ICONS = {
  BTC: SiBitcoin,
  NVDA: SiNvidia
};

export default function AssetIcon({ symbol, size = 44, className = "" }) {
  const Icon = BRAND_ICONS[String(symbol || "").toUpperCase()];

  return (
    <div className={`asset-icon ${className}`}>
      {Icon ? (
        <Icon size={size} aria-hidden="true" focusable="false" />
      ) : (
        <span className="asset-icon__fallback">{String(symbol || "?").slice(0, 1)}</span>
      )}
    </div>
  );
}
