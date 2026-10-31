import React from "react";
import {
  assetTypeDescription,
  confidenceNumberDescription,
  formatPercent,
  getCalibratedConfidence,
  headlineTakeaway,
  heroConfidenceDescription,
  outcomeDescription,
  outcomeMeta,
  sentimentDescription,
  sentimentTone,
  tagDescription
} from "../utils/impactFormat";
import AssetIcon from "./AssetIcon";
import ConfidenceCalibration from "./ConfidenceCalibration";
import MacroTakeaway from "./MacroTakeaway";
import RangeToggle from "./RangeToggle";
import Tooltip from "./Tooltip";
import useCountUp from "../hooks/useCountUp";
import useNewSinceLastVisit from "../hooks/useNewSinceLastVisit";
import usePriceStats, { PRICE_RANGE_OPTIONS } from "../hooks/usePriceStats";
import useRevealOnScroll from "../hooks/useRevealOnScroll";
import { markVisited } from "../utils/lastVisit";
import { handleSpotlightMove } from "../utils/spotlight";

function rangeLabelFor(hours) {
  return PRICE_RANGE_OPTIONS.find((option) => option.hours === hours)?.label || "24H";
}

function formatCurrency(value, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

function computeRangePercent(current, min, max) {
  const range = max - min;

  if (!Number.isFinite(range) || range <= 0) {
    return 50;
  }

  return Math.min(100, Math.max(0, ((current - min) / range) * 100));
}

export default function AssetCard({ asset, macroRows, onOpen }) {
  // Nobody reads cents on an $80,000 asset - only show them where they're
  // actually meaningful (NVDA).
  const priceDigits = asset.symbol === "BTC" ? 0 : 2;
  const latestImpact = asset.latestImpact;
  const latestOutcome = latestImpact ? outcomeMeta(latestImpact.outcome) : null;
  const latestImpactTakeaway = latestImpact ? headlineTakeaway(latestImpact, asset.name) : null;
  const [revealRef, isVisible] = useRevealOnScroll();
  const animatedPrice = useCountUp(asset.currentPrice);
  const animatedConfidence = useCountUp(asset.confidence);
  const newSinceLastVisit = useNewSinceLastVisit(asset.id, asset.recentImpacts);
  // Whether enough decided calls exist at this confidence level to trust the
  // number - an unverified confidence gets a visibly muted bar instead of
  // the full-color fill, so the bar itself doesn't look more certain than
  // the caption underneath it actually is.
  const confidenceCalibrated = getCalibratedConfidence(asset.confidence, asset.moodTrackRecord?.confidenceBreakdown);
  const confidenceIsUnverified = !confidenceCalibrated || !confidenceCalibrated.isReliable;
  const { hours: rangeHours, setHours: setRangeHours, stats: rangeStats } = usePriceStats(asset.symbol, {
    avgPrice: asset.avgPrice,
    maxPrice: asset.maxPrice,
    minPrice: asset.minPrice,
    recordCount: Number(asset.summaryMetrics[0]?.value) || 0
  });
  const rangeLabel = rangeLabelFor(rangeHours);
  const rangePercent = computeRangePercent(asset.currentPrice, rangeStats.minPrice, rangeStats.maxPrice);

  function handleOpen() {
    // Opening the full analysis is the "I read this" signal - same moment
    // Telegram clears a chat's unread badge when you open the conversation.
    markVisited(asset.id);
    onOpen(asset.id);
  }

  return (
    <article
      ref={revealRef}
      className={`asset-card spotlight reveal asset-card--${asset.id}${isVisible ? " is-visible" : ""}`}
      onMouseMove={handleSpotlightMove}
      style={{
        "--asset-accent": asset.accent,
        "--asset-accent-soft": asset.accentSoft,
        "--asset-accent-strong": asset.accentStrong,
        "--asset-ai-accent": asset.aiAccent
      }}
    >
      <div className="spotlight__glow" aria-hidden="true" />
      <div className="asset-card__main">
        <section className="asset-card__identity">
          <div className="asset-card__meta">
            <Tooltip text={assetTypeDescription(asset.id === "btc" ? "Digital Asset" : "Equity Signal")}>
              <span className="asset-badge">{asset.id === "btc" ? "Digital Asset" : "Equity Signal"}</span>
            </Tooltip>
            <span className="asset-badge asset-badge--subtle">{rangeLabel} context</span>
            {rangeStats.recordCount ? (
              <span className="asset-badge asset-badge--subtle">
                {rangeStats.recordCount} ticks · {rangeLabel.toLowerCase()} records
              </span>
            ) : null}
          </div>

          <div className="asset-card__title-row">
            <AssetIcon symbol={asset.symbol} />
            <div>
              <div className="asset-card__name-line">
                <h2>{asset.name}</h2>
                <span>{asset.symbol}</span>
              </div>
              <div className="asset-card__price-line">
                <strong>{formatCurrency(animatedPrice, priceDigits)}</strong>
                <p className={`asset-change ${asset.change24h >= 0 ? "positive" : "negative"}`}>
                  {asset.change24h >= 0 ? "▲" : "▼"} {Math.abs(asset.change24h).toFixed(2)}%{" "}
                  <span>(24h)</span>
                </p>
              </div>
            </div>
          </div>

          <div className="latest-impact-card">
            <div className="latest-impact-card__header">
              <span className="latest-impact-card__label">Latest important headline</span>
              <div className="latest-impact-card__header-right">
                {newSinceLastVisit > 0 ? (
                  <Tooltip text="Headlines that came in since the last time you opened this asset's full analysis.">
                    <span className="new-badge">
                      <i aria-hidden="true" />
                      {newSinceLastVisit} new
                    </span>
                  </Tooltip>
                ) : null}
                {latestImpact ? (
                  <span className="impact-card__time">{latestImpact.displayTime}</span>
                ) : null}
              </div>
            </div>

            {latestImpact ? (
              <>
                <p className="latest-impact-card__title">{latestImpact.title}</p>
                {latestImpactTakeaway ? (
                  <p className={`impact-card__takeaway impact-card__takeaway--${latestOutcome.tone}`}>
                    {latestImpactTakeaway}
                  </p>
                ) : null}
                <div className="latest-impact-card__footer">
                  <Tooltip text={sentimentDescription(latestImpact.sentiment)}>
                    <span className={`tag tag--${sentimentTone(latestImpact.sentiment)}`}>
                      {latestImpact.sentiment}
                    </span>
                  </Tooltip>
                  <Tooltip text={outcomeDescription(latestImpact.outcome)}>
                    <span className={`outcome-pill outcome-pill--${latestOutcome.tone}`}>
                      {latestOutcome.label}
                    </span>
                  </Tooltip>
                  {latestImpact.change24hPercent !== null ? (
                    <span className={latestImpact.change24hPercent >= 0 ? "positive" : "negative"}>
                      {formatPercent(latestImpact.change24hPercent)} (24h)
                    </span>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="section-note">No news signals recorded for this asset yet.</p>
            )}
          </div>

          <div className="range-card">
            <div className="range-card__header">
              <span>Price context</span>
              <RangeToggle hours={rangeHours} onChange={setRangeHours} />
            </div>
            <div className="range-card__metrics">
              <div>
                <span>Avg Price</span>
                <strong>{formatCurrency(rangeStats.avgPrice, priceDigits)}</strong>
              </div>
              <div>
                <span>Max Price</span>
                <strong className="positive">{formatCurrency(rangeStats.maxPrice, priceDigits)}</strong>
              </div>
              <div>
                <span>Min Price</span>
                <strong className="negative">{formatCurrency(rangeStats.minPrice, priceDigits)}</strong>
              </div>
            </div>

            <div className="range-card__track">
              <div className="range-card__labels">
                <span>{formatCurrency(rangeStats.minPrice, priceDigits)}</span>
                <span>{formatCurrency(rangeStats.maxPrice, priceDigits)}</span>
              </div>
              <div className="range-track">
                <div className="range-track__fill" style={{ left: 0, width: `${rangePercent}%` }} />
                <div className="range-track__marker" style={{ left: `${rangePercent}%` }} />
              </div>
            </div>
          </div>
        </section>

        <section className="asset-card__column">
          <header>
            <p>What is happening now?</p>
          </header>
          <p>{asset.currentSituation}</p>
          <div className="confidence-meter">
            <div
              className={`confidence-meter__label${confidenceIsUnverified ? " confidence-meter__label--unverified" : ""}`}
            >
              <Tooltip text={heroConfidenceDescription(asset.name)}>
                <span>Overall confidence</span>
              </Tooltip>
              <Tooltip
                text={confidenceNumberDescription(asset.confidence, asset.moodTrackRecord?.confidenceBreakdown)}
              >
                <strong>{Math.round(animatedConfidence)}%</strong>
              </Tooltip>
            </div>
            <Tooltip
              text={confidenceNumberDescription(asset.confidence, asset.moodTrackRecord?.confidenceBreakdown)}
              block
            >
              <div className="confidence-meter__track">
                <div
                  className={`confidence-meter__fill${confidenceIsUnverified ? " confidence-meter__fill--unverified" : ""}`}
                  style={{ width: `${Math.max(0, Math.min(100, animatedConfidence))}%` }}
                />
              </div>
            </Tooltip>
            <ConfidenceCalibration
              confidencePercent={asset.confidence}
              confidenceBreakdown={asset.moodTrackRecord?.confidenceBreakdown}
            />
          </div>
        </section>

        <section className="asset-card__column">
          <header>
            <p>Why is it moving?</p>
          </header>
          <p>{asset.whyMoving}</p>
          <div className="tag-row">
            {asset.keyNewsTags.map((tag) => (
              <Tooltip key={tag.label} text={tagDescription(tag.label)}>
                <span className={`tag tag--${tag.tone}`}>{tag.label}</span>
              </Tooltip>
            ))}
          </div>
        </section>

        <section className="asset-card__column">
          <header>
            <p>Real-world context</p>
          </header>
          <p>{asset.realWorldContext}</p>
          <div className="tag-row">
            {asset.contextTags.map((tag) => (
              <Tooltip key={tag.label} text={tagDescription(tag.label)}>
                <span className={`tag tag--${tag.tone}`}>{tag.label}</span>
              </Tooltip>
            ))}
          </div>
          <MacroTakeaway asset={asset} macroRows={macroRows} />
        </section>

        <aside className="asset-card__stats">
          <div className="mood-block">
            <span>Market mood / phase</span>
            <strong>{asset.marketMood}</strong>
          </div>

          <button className="ghost-button" type="button" onClick={handleOpen}>
            Open full analysis
            <span aria-hidden="true">→</span>
          </button>
        </aside>
      </div>

      <footer className="ai-footer">
        <span>AI Insight</span>
        <p>{asset.aiInsight}</p>
      </footer>
    </article>
  );
}
