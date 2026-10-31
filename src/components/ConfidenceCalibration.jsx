import React from "react";
import { getCalibratedConfidence } from "../utils/impactFormat";

// The AI's confidence is self-reported, not derived from price data - and
// Track Record shows it isn't reliably predictive (sometimes the opposite).
// This sits next to any displayed confidence number and says what calls at
// that same level have actually scored, so the raw number isn't trusted
// more than it's earned. Only valid where confidencePercent comes from the
// same per-signal population confidenceBreakdown was built from - not next
// to the hero's Mood_Confidence, which is a different measurement.
export default function ConfidenceCalibration({ confidencePercent, confidenceBreakdown, className = "" }) {
  const calibrated = getCalibratedConfidence(confidencePercent, confidenceBreakdown);

  if (!calibrated) {
    return null;
  }

  if (!calibrated.isReliable) {
    return (
      <p className={`confidence-calibration confidence-calibration--thin ${className}`.trim()}>
        Still building a track record at this confidence level
      </p>
    );
  }

  const gap = confidencePercent - calibrated.accuracyPercent;
  const isMisleading = gap >= 15;
  const warnClass = isMisleading ? " confidence-calibration--warn" : "";

  return (
    <p className={`confidence-calibration${warnClass} ${className}`.trim()}>
      Historically right <strong>{Math.round(calibrated.accuracyPercent)}%</strong> ({calibrated.decisiveCount} calls)
    </p>
  );
}
