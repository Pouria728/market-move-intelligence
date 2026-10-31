import React from "react";

// Mirrors MIN_RELIABLE_SAMPLE in impactFormat.js / TrackRecordSummary.jsx -
// below this many decisive calls, a bucket's accuracy is basically a coin
// flip that happened to land somewhere, not evidence yet.
const MIN_RELIABLE_SAMPLE = 8;

// Plain-language stand-ins for the raw bucket labels ("Low (<0.60)" etc.) -
// read as a continuation of "Actually right X% of the time" below each one.
const PLAIN_LABELS = {
  "Low (<0.60)": "When it said: not very sure (under 60%)",
  "Medium (0.60-0.80)": "When it said: fairly sure (60-80%)",
  "High (0.80+)": "When it said: very sure (80%+)"
};

function verdictText(calibrationErrorPercent, totalDecisive) {
  if (totalDecisive < MIN_RELIABLE_SAMPLE) {
    return `Too early to tell - only ${totalDecisive} decided call${
      totalDecisive === 1 ? "" : "s"
    } so far, not enough yet to know if the AI's confidence numbers mean anything.`;
  }

  if (calibrationErrorPercent === null || calibrationErrorPercent === undefined) {
    return null;
  }

  if (calibrationErrorPercent <= 8) {
    return "So far, the AI's stated confidence lines up reasonably well with how often it's actually right.";
  }

  if (calibrationErrorPercent <= 20) {
    return "So far, the AI's stated confidence is noticeably off from how often it's actually right - read the numbers below with that in mind.";
  }

  return "So far, the AI's stated confidence doesn't track how often it's actually right at all - don't put much weight on the confidence number by itself.";
}

// Answers "does the AI's own confidence mean anything?" as plainly as
// possible: one blunt verdict sentence, then one row per confidence level
// the AI has actually used, each showing both what it said and what
// actually happened - a bar for real accuracy with a marker for the
// average stated confidence, so the gap between the two is visible at a
// glance without needing a chart, an axis, or a statistics term.
export default function ConfidenceCheck({ confidenceBreakdown, calibrationErrorPercent }) {
  const rows = (confidenceBreakdown || []).filter((bucket) => bucket.decisiveCount > 0);

  if (rows.length === 0) {
    return null;
  }

  const totalDecisive = rows.reduce((sum, bucket) => sum + bucket.decisiveCount, 0);
  const verdict = verdictText(calibrationErrorPercent, totalDecisive);

  return (
    <div className="confidence-check">
      <p className="track-record__eyebrow">Does the AI's own confidence mean anything?</p>
      <p className="track-record__subline">
        When the AI says it's more sure, is it actually right more often? Here's what's happened so
        far, broken down by how sure it said it was.
      </p>

      {verdict ? <p className="confidence-check__verdict">{verdict}</p> : null}

      <div className="confidence-check__key">
        <span>
          <i className="confidence-check__key-bar" aria-hidden="true" /> how often it was actually right
        </span>
        <span>
          <i className="confidence-check__key-marker" aria-hidden="true" /> what the AI said on average
        </span>
      </div>

      <div className="confidence-check__rows">
        {rows.map((bucket) => {
          const isReliable = bucket.decisiveCount >= MIN_RELIABLE_SAMPLE;

          return (
            <div
              key={bucket.label}
              className={`confidence-row${isReliable ? "" : " confidence-row--thin"}`}
            >
              <div className="confidence-row__top">
                <span className="confidence-row__label">{PLAIN_LABELS[bucket.label] || bucket.label}</span>
                <span className="confidence-row__count">
                  {isReliable
                    ? `${bucket.decisiveCount} calls`
                    : `only ${bucket.decisiveCount} call${bucket.decisiveCount === 1 ? "" : "s"} — too few`}
                </span>
              </div>

              <div className="confidence-row__bar">
                <div
                  className="confidence-row__bar-fill"
                  style={{ width: `${Math.max(bucket.accuracyPercent ?? 0, 4)}%` }}
                />
                {bucket.avgConfidencePercent !== null ? (
                  <div
                    className="confidence-row__marker"
                    style={{ left: `${Math.min(Math.max(bucket.avgConfidencePercent, 1), 99)}%` }}
                  />
                ) : null}
              </div>

              <div className="confidence-row__values">
                <span>
                  AI said ~{bucket.avgConfidencePercent !== null ? Math.round(bucket.avgConfidencePercent) : "—"}%
                  sure
                </span>
                <strong>
                  Actually right {bucket.accuracyPercent !== null ? `${bucket.accuracyPercent.toFixed(0)}%` : "—"}
                  {" "}of the time
                </strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
