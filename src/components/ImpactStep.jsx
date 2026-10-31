import React from "react";
import { formatPercent } from "../utils/impactFormat";

export function formatCurrency(value, digits = 2) {
  if (value === null || value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

export default function ImpactStep({ label, price, deltaPercent, digits, pending, showDelta = true }) {
  return (
    <div className="impact-step">
      <span>{label}</span>
      <strong>{pending ? "Pending" : formatCurrency(price, digits)}</strong>
      {showDelta ? (
        deltaPercent !== null && deltaPercent !== undefined ? (
          <small className={deltaPercent >= 0 ? "positive" : "negative"}>{formatPercent(deltaPercent)}</small>
        ) : (
          <small>—</small>
        )
      ) : null}
    </div>
  );
}
