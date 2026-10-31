import React, { useState } from "react";
import {
  benchmarkDescription,
  categoryDescription,
  formatPercent,
  headlineTakeaway,
  outcomeDescription,
  outcomeMeta,
  sentimentDescription,
  sentimentTone
} from "../utils/impactFormat";
import ConfidenceCalibration from "./ConfidenceCalibration";
import ImpactStep from "./ImpactStep";
import Tooltip from "./Tooltip";
import useRevealOnScroll from "../hooks/useRevealOnScroll";
import { handleSpotlightMove } from "../utils/spotlight";

// These signals are the exact same Market_Signals rows (and the exact same
// analyst write-up) as the full news history below - they're just ranked
// differently (biggest actual move first, instead of newest first). So a
// highlight deserves the same depth of analysis as its history-list twin,
// not a stripped-down version of it.
function HighlightItem({ item, rank, priceDigits, assetName, confidenceBreakdown }) {
  const outcome = outcomeMeta(item.outcome);
  const [revealRef, isVisible] = useRevealOnScroll();
  const [isExpanded, setIsExpanded] = useState(false);
  // Stock news that broke while the market was closed is measured from the
  // next open, same distinction the full history list below makes.
  const measuredAtOpen = item.measuredFrom !== item.time;
  const stillWaitingOnOpen = measuredAtOpen && item.price1hAfter === null;
  const takeaway = headlineTakeaway(item, assetName);
  // Benchmark-adjusted change - the same number the Outcome pill is actually
  // judged on, so it's shown here too instead of leaving only the raw move
  // (in the steps below) visible.
  const headlineChange = item.change24hPercent ?? item.change1hPercent;

  return (
    <li
      ref={revealRef}
      className={`weekly-highlights__item spotlight reveal${isVisible ? " is-visible" : ""}`}
      onMouseMove={handleSpotlightMove}
      style={{ "--reveal-delay": `${Math.min(rank - 1, 4) * 60}ms` }}
    >
      <div className="spotlight__glow" aria-hidden="true" />
      <div className="weekly-highlights__row">
        <span className="weekly-highlights__rank">{rank}</span>

        <div className="weekly-highlights__body">
          <p className="weekly-highlights__title">
            {item.sourceUrl ? (
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                {item.title}
              </a>
            ) : (
              item.title
            )}
          </p>
          <div className="weekly-highlights__meta">
            <div className="weekly-highlights__meta-row">
              <span className="weekly-highlights__time">{item.displayTime}</span>
              <Tooltip text={categoryDescription(item.category)}>
                <span className="asset-badge asset-badge--subtle">{item.category}</span>
              </Tooltip>
            </div>
            <div className="weekly-highlights__meta-row">
              <Tooltip text={sentimentDescription(item.sentiment)}>
                <span className={`tag tag--${sentimentTone(item.sentiment)}`}>{item.sentiment}</span>
              </Tooltip>
              {headlineChange !== null && headlineChange !== undefined ? (
                <span className="impact-card__headline-change">
                  <strong className={headlineChange >= 0 ? "positive" : "negative"}>
                    {formatPercent(headlineChange)}
                  </strong>
                  {item.benchmarkSymbol ? (
                    <Tooltip text={benchmarkDescription(item.benchmarkSymbol)}>
                      <small className="impact-card__benchmark-tag">vs {item.benchmarkSymbol}</small>
                    </Tooltip>
                  ) : null}
                </span>
              ) : null}
              <Tooltip text={outcomeDescription(item.outcome)}>
                <span className={`outcome-pill outcome-pill--${outcome.tone}`}>{outcome.label}</span>
              </Tooltip>
            </div>
          </div>
          <p className="impact-card__source">
            {item.sourceName} · {item.importance} impact
          </p>
          {item.summary && item.summary !== item.title ? (
            <p className="impact-card__summary">{item.summary}</p>
          ) : null}
        </div>
      </div>

      {stillWaitingOnOpen ? (
        <p className="impact-card__market-note">
          NVDA only trades 9:30am–4pm ET. This broke while the market was closed, so its clock
          starts at the next open ({item.measuredFromDisplay}), not at {item.displayTime.toLowerCase()}{" "}
          — that's why the steps below are still pending.
        </p>
      ) : takeaway ? (
        <p className={`impact-card__takeaway impact-card__takeaway--${outcome.tone}`}>{takeaway}</p>
      ) : null}

      <div className="impact-steps weekly-highlights__steps">
        <ImpactStep
          label={measuredAtOpen ? "At next open" : "At signal"}
          price={item.priceAtSignal}
          digits={priceDigits}
          showDelta={false}
        />
        <span className="impact-steps__arrow" aria-hidden="true">
          →
        </span>
        <ImpactStep
          label="+1h"
          price={item.price1hAfter}
          deltaPercent={item.rawChange1hPercent}
          digits={priceDigits}
          pending={item.price1hAfter === null}
        />
        <span className="impact-steps__arrow" aria-hidden="true">
          →
        </span>
        <ImpactStep
          label="+1 day"
          price={item.price24hAfter}
          deltaPercent={item.rawChange24hPercent}
          digits={priceDigits}
          pending={item.price24hAfter === null}
        />
      </div>

      <button type="button" className="impact-card__toggle" onClick={() => setIsExpanded((value) => !value)}>
        {isExpanded ? "Hide analyst take" : "Show analyst take"}
        <span aria-hidden="true">{isExpanded ? "▲" : "▼"}</span>
      </button>

      {isExpanded ? (
        <div className="impact-card__details">
          <div>
            <span>Analyst take</span>
            <p>{item.analystSummary || "No analyst commentary available."}</p>
          </div>
          <div>
            <span>Why it matters</span>
            <p>{item.marketNarrative || "No additional context available."}</p>
          </div>
          <div className="detail-split">
            <div>
              <span>Short-term view</span>
              <p>{item.shortTermView || "Not available."}</p>
            </div>
            <div>
              <span>Long-term view</span>
              <p>{item.longTermView || "Not available."}</p>
            </div>
          </div>
          {item.benchmarkSymbol ? (
            <p className="impact-card__market-note">
              The raw price move over that window was{" "}
              {formatPercent(item.rawChange24hPercent ?? item.rawChange1hPercent)}, but{" "}
              {item.benchmarkSymbol} moved on its own too. The {formatPercent(headlineChange)} above
              is the raw move minus the benchmark's - this headline's own effect, not the broader
              market's.
            </p>
          ) : null}

          <div className="impact-card__footer">
            <span>AI confidence: {item.confidence}%</span>
            <ConfidenceCalibration confidencePercent={item.confidence} confidenceBreakdown={confidenceBreakdown} />
          </div>
        </div>
      ) : null}
    </li>
  );
}

export default function WeeklyHighlights({ items, priceDigits = 2, assetName, confidenceBreakdown }) {
  if (!items || items.length === 0) {
    return null;
  }

  // The intro below claims these headlines "actually mattered" - true only
  // when at least one of them was decisive. On a quiet week where every
  // ranked item is still Inconclusive/pending, that claim would overstate
  // what the data actually shows, so the intro says so plainly instead.
  const hasDecisiveMove = items.some((item) => item.outcome === "Confirmed" || item.outcome === "Against Call");

  return (
    <div className="weekly-highlights">
      <div className="weekly-highlights__header">
        <p className="panel__eyebrow">This week's biggest movers</p>
        <h4>Headlines that actually moved price</h4>
        <p className="weekly-highlights__intro">
          {hasDecisiveMove
            ? "Ranked by the real move after benchmark adjustment, 1h and 24h after each headline - not how loud it sounded, how much it actually mattered."
            : "It's been a quiet week - even the biggest relative moves below were still too small to call decisively. Ranked by size anyway, for context."}
        </p>
      </div>

      <ol className="weekly-highlights__list">
        {items.map((item, index) => (
          <HighlightItem
            key={item.id}
            item={item}
            rank={index + 1}
            priceDigits={priceDigits}
            assetName={assetName}
            confidenceBreakdown={confidenceBreakdown}
          />
        ))}
      </ol>
    </div>
  );
}
