import React from "react";
import { PRICE_RANGE_OPTIONS } from "../hooks/usePriceStats";

export default function RangeToggle({ hours, onChange }) {
  return (
    <div className="range-toggle" role="group" aria-label="Price context window">
      {PRICE_RANGE_OPTIONS.map((option) => (
        <button
          key={option.hours}
          type="button"
          className={`range-toggle__option${hours === option.hours ? " is-active" : ""}`}
          onClick={() => onChange(option.hours)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
