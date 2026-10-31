import React from "react";
import NewsImpactHistory from "./NewsImpactHistory";
import AssetIcon from "./AssetIcon";
import useCountUp from "../hooks/useCountUp";
import usePriceStats, { PRICE_RANGE_OPTIONS } from "../hooks/usePriceStats";
import { handleSpotlightMove } from "../utils/spotlight";
import ConfidenceCalibration from "./ConfidenceCalibration";
import MacroTakeaway from "./MacroTakeaway";
import RangeToggle from "./RangeToggle";
import Tooltip from "./Tooltip";
import {
  confidenceNumberDescription,
  getCalibratedConfidence,
  heroConfidenceDescription,
  tagDescription
} from "../utils/impactFormat";

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

function formatDelta(value) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export default function AssetDetail({ asset, macroRows, onBack }) {
  const priceDigits = asset.symbol === "BTC" ? 0 : 2;
  const animatedPrice = useCountUp(asset.currentPrice);
  const animatedConfidence = useCountUp(asset.confidence);
  const confidenceCalibrated = getCalibratedConfidence(asset.confidence, asset.moodTrackRecord?.confidenceBreakdown);
  const confidenceIsUnverified = !confidenceCalibrated || !confidenceCalibrated.isReliable;
  const { hours: rangeHours, setHours: setRangeHours, stats: rangeStats } = usePriceStats(asset.symbol, {
    avgPrice: asset.avgPrice,
    maxPrice: asset.maxPrice,
    minPrice: asset.minPrice
  });
  const rangeLabel = rangeLabelFor(rangeHours);

  return (
    <section
      className={`detail-page detail-page--${asset.id}`}
      style={{
        "--asset-accent": asset.accent,
        "--asset-accent-soft": asset.accentSoft,
        "--asset-accent-strong": asset.accentStrong,
        "--asset-ai-accent": asset.aiAccent
      }}
    >
      <div className="detail-toolbar">
        <button className="back-button" type="button" onClick={onBack}>
          ← Back to Overview
        </button>
      </div>

      <div className="detail-hero spotlight" onMouseMove={handleSpotlightMove}>
        <div className="spotlight__glow" aria-hidden="true" />
        <div className="detail-hero__identity">
          <AssetIcon symbol={asset.symbol} size={48} />
          <div>
            <div className="asset-card__name-line">
              <h2>{asset.name}</h2>
              <span>{asset.symbol}</span>
            </div>
            <div className="asset-card__price-line">
              <strong>{formatCurrency(animatedPrice, priceDigits)}</strong>
              <p className={`asset-change ${asset.change24h >= 0 ? "positive" : "negative"}`}>
                {asset.change24h >= 0 ? "▲" : "▼"} {formatDelta(asset.change24h)} <span>(24h)</span>
              </p>
            </div>
          </div>
        </div>

        <div className="detail-hero__spark">
          <div className="detail-badge">
            <span>Market Mood / Phase</span>
            <strong>{asset.marketMood}</strong>
          </div>
          <div className="detail-confidence">
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
        </div>

        <div className="detail-hero__stats">
          <div className="detail-hero__stats-toggle">
            <RangeToggle hours={rangeHours} onChange={setRangeHours} />
          </div>
          <div className="detail-stat">
            <span>Avg Price ({rangeLabel})</span>
            <strong>{formatCurrency(rangeStats.avgPrice, priceDigits)}</strong>
          </div>
          <div className="detail-stat">
            <span>Max Price ({rangeLabel})</span>
            <strong className="positive">{formatCurrency(rangeStats.maxPrice, priceDigits)}</strong>
          </div>
          <div className="detail-stat">
            <span>Min Price ({rangeLabel})</span>
            <strong className="negative">{formatCurrency(rangeStats.minPrice, priceDigits)}</strong>
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-grid__left">
          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="panel__eyebrow">News impact history</p>
                <h3>What each headline actually did to price</h3>
              </div>
            </div>

            <NewsImpactHistory
              impactList={asset.newsImpact}
              trackRecord={asset.trackRecord}
              weeklyHighlights={asset.weeklyHighlights}
              priceDigits={priceDigits}
              assetName={asset.name}
            />
          </section>
        </div>

        <div className="detail-grid__right">
          <section className="panel detail-section">
            <p className="detail-section__index">1. Current situation</p>
            <p>{asset.currentSituation}</p>
          </section>

          <section className="panel detail-section">
            <p className="detail-section__index">2. Why it is moving</p>
            <ul className="bullet-list">
              {asset.whyMovingPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </section>

          <section className="panel detail-section">
            <p className="detail-section__index">3. Real-world / global context</p>
            <div className="tag-row">
              {asset.contextTags.map((tag) => (
                <Tooltip key={tag.label} text={tagDescription(tag.label)}>
                  <span className={`tag tag--${tag.tone}`}>{tag.label}</span>
                </Tooltip>
              ))}
            </div>
            <p>{asset.realWorldContext}</p>
            <MacroTakeaway asset={asset} macroRows={macroRows} />
          </section>

          <section className="panel detail-section">
            <p className="detail-section__index">4. Risks and opportunities</p>
            <div className="detail-split">
              <div>
                <span>Risks</span>
                <ul className="bullet-list bullet-list--compact">
                  {asset.risks.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span>Opportunities</span>
                <ul className="bullet-list bullet-list--compact">
                  {asset.opportunities.map((opportunity) => (
                    <li key={opportunity}>{opportunity}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="panel detail-section">
            <p className="detail-section__index">5. Outlook / future scenarios</p>
            <div className="scenario-grid">
              <article>
                <span>Base case</span>
                <p>{asset.outlook.base}</p>
              </article>
              <article>
                <span>Bull case</span>
                <p>{asset.outlook.bull}</p>
              </article>
              <article>
                <span>Bear case</span>
                <p>{asset.outlook.bear}</p>
              </article>
            </div>
          </section>

          <section className="panel detail-section">
            <p className="detail-section__index">6. What to watch next</p>
            <ul className="watch-list">
              {asset.watchNext.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <footer className="detail-ai-footer">
        <span>AI Insight</span>
        <p>{asset.aiInsight}</p>
      </footer>
    </section>
  );
}
