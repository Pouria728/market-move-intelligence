import React from "react";
import useCountUp from "../hooks/useCountUp";
import ConfidenceCheck from "./ConfidenceCheck";

function formatPercent(value) {
  if (value === null || value === undefined) {
    return "—";
  }

  return `${value.toFixed(1)}%`;
}

export default function TrackRecordSummary({ trackRecord }) {
  // Hooks run every render regardless of the early return below, so the
  // fallback keeps this safe when there's no track record yet.
  const animatedAccuracy = useCountUp(trackRecord?.directionalAccuracyPercent ?? 0, { duration: 1100 });

  if (!trackRecord || trackRecord.totalSignals === 0) {
    return null;
  }

  const {
    totalSignals,
    marketMoves,
    decisiveMoves,
    confirmed,
    againstCall,
    inconclusive,
    tooEarly,
    noPriceData,
    confirmedPercent,
    againstCallPercent,
    inconclusivePercent,
    directionalAccuracyPercent,
    signalDirectionalAccuracyPercent,
    confidenceBreakdown,
    calibrationErrorPercent
  } = trackRecord;

  const confirmedShare = marketMoves ? (confirmed / marketMoves) * 100 : 0;
  const againstShare = marketMoves ? (againstCall / marketMoves) * 100 : 0;
  const inconclusiveShare = marketMoves ? (inconclusive / marketMoves) * 100 : 0;

  return (
    <div className="track-record">
      <div className="track-record__header">
        <div>
          <p className="track-record__eyebrow">AI track record</p>
          <p className="track-record__intro">
            Every time the AI calls a headline Bullish or Bearish, we check what the price actually
            did next. This is how often that call has turned out to be right so far.
          </p>
          <h4>
            {directionalAccuracyPercent !== null
              ? `${formatPercent(animatedAccuracy)} directional accuracy`
              : "Not enough decisive calls yet"}
          </h4>
          {decisiveMoves > 0 ? (
            <p className="track-record__subline">
              Of the {marketMoves} distinct price moves checked (merged down from {totalSignals}{" "}
              signals), only {decisiveMoves} were clear enough to call either way: {confirmed} right,{" "}
              {againstCall} wrong. The other {inconclusive} barely moved - that's the normal,
              expected outcome for most headlines, not a gap in the AI's calls.
            </p>
          ) : null}
        </div>
        <span className="track-record__sample">
          {marketMoves} market moves judged from {totalSignals} signals
          {tooEarly > 0 ? ` · ${tooEarly} too recent to judge` : ""}
          {noPriceData > 0 ? ` · ${noPriceData} without price data` : ""}
        </span>
      </div>

      <div
        className="track-record__bar"
        role="img"
        aria-label={`${confirmed} confirmed, ${againstCall} against call, ${inconclusive} inconclusive`}
      >
        <span
          className="track-record__segment track-record__segment--confirmed"
          style={{ width: `${confirmedShare}%` }}
        />
        <span
          className="track-record__segment track-record__segment--against"
          style={{ width: `${againstShare}%` }}
        />
        <span
          className="track-record__segment track-record__segment--inconclusive"
          style={{ width: `${inconclusiveShare}%` }}
        />
      </div>

      <div className="track-record__legend">
        <span className="track-record__legend-item track-record__legend-item--confirmed">
          Confirmed {confirmed} ({formatPercent(confirmedPercent)})
        </span>
        <span className="track-record__legend-item track-record__legend-item--against">
          Against call {againstCall} ({formatPercent(againstCallPercent)})
        </span>
        <span className="track-record__legend-item track-record__legend-item--inconclusive">
          Inconclusive {inconclusive} ({formatPercent(inconclusivePercent)})
        </span>
      </div>

      <p className="track-record__note">
        Headlines measured over the same price move count once, as the AI's prevailing call on that
        move — otherwise one busy day would outweigh every other. Directional accuracy counts only
        moves big enough to judge.
        {signalDirectionalAccuracyPercent !== null
          ? ` Counting every headline separately would give ${formatPercent(signalDirectionalAccuracyPercent)}.`
          : ""}
      </p>

      <ConfidenceCheck confidenceBreakdown={confidenceBreakdown} calibrationErrorPercent={calibrationErrorPercent} />
    </div>
  );
}
