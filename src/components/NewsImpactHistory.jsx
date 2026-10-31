import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import TrackRecordSummary from "./TrackRecordSummary";
import WeeklyHighlights from "./WeeklyHighlights";
import ImpactStep, { formatCurrency } from "./ImpactStep";
import useRevealOnScroll from "../hooks/useRevealOnScroll";
import { handleSpotlightMove } from "../utils/spotlight";
import ConfidenceCalibration from "./ConfidenceCalibration";
import Tooltip from "./Tooltip";

const OUTCOME_FILTERS = ["All", "Confirmed", "Against Call", "Inconclusive", "Too Early", "No Price Data"];
const SENTIMENT_FILTERS = ["All", "Bullish", "Bearish", "Mixed", "Neutral"];
const PAGE_SIZE = 6;
const CATEGORY_OPTIONS = [
  "Geopolitics / War",
  "Regulation / Political",
  "Macro / Fed",
  "Earnings / Guidance",
  "Corporate Deal",
  "Institutional / ETF",
  "Supply Chain",
  "Technology / Product",
  "Market Structure"
];

// A native <select>'s open popup is drawn by the OS, not by our CSS - no
// way to make it match the dark premium theme. This owns every pixel.
function CategorySelect({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const containerRef = useRef(null);
  const menuRef = useRef(null);

  const openMenu = () => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const rect = node.getBoundingClientRect();
    // --asset-accent is set on an ancestor via inline style, so it only
    // reaches descendants in the real DOM tree. Once the menu is portaled
    // to <body> it's no longer a DOM descendant of that ancestor, so the
    // variable has to be re-declared here from its resolved value.
    const accent = getComputedStyle(node).getPropertyValue("--asset-accent").trim();

    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
      "--asset-accent": accent || "#7c5cff"
    });
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function isOutside(event) {
      const inTrigger = containerRef.current && containerRef.current.contains(event.target);
      const inMenu = menuRef.current && menuRef.current.contains(event.target);
      return !inTrigger && !inMenu;
    }

    function handlePointerDown(event) {
      if (isOutside(event)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    // The menu's position is computed once, on open - closing when the
    // page scrolls avoids it drifting away from its trigger. But "scroll"
    // is captured top-down regardless of bubbling, so scrolling the menu's
    // own option list (it has its own overflow-y: auto) fires this too;
    // that has to be ignored or the menu closes the instant you scroll it.
    function handleScroll(event) {
      const insideMenu = menuRef.current && menuRef.current.contains(event.target);
      if (insideMenu) {
        return;
      }
      setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  const options = ["All", ...CATEGORY_OPTIONS];
  const displayLabel = value === "All" ? "All categories" : value;

  return (
    <div className="category-select" ref={containerRef}>
      <button
        type="button"
        className={`category-select__trigger${isOpen ? " is-open" : ""}`}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{displayLabel}</span>
        <span className="category-select__chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {isOpen && menuStyle
        ? createPortal(
            <ul ref={menuRef} className="category-select__menu" role="listbox" style={menuStyle}>
              {options.map((option) => (
                <li
                  key={option}
                  role="option"
                  aria-selected={value === option}
                  className={`category-select__option${value === option ? " is-selected" : ""}`}
                  onClick={() => {
                    onChange(option);
                    setIsOpen(false);
                  }}
                >
                  {option === "All" ? "All categories" : option}
                </li>
              ))}
            </ul>,
            document.body
          )
        : null}
    </div>
  );
}

function ImpactCard({ item, priceDigits, isExpanded, onToggle, staggerIndex = 0, confidenceBreakdown, assetName }) {
  const outcome = outcomeMeta(item.outcome);
  // Best-available read at a glance, so you don't have to scan the whole
  // steps row just to see whether this call worked out.
  const headlineChange = item.change24hPercent ?? item.change1hPercent;
  const takeaway = headlineTakeaway(item, assetName);
  // Stock news that broke while the market was closed is measured from the
  // next open, the first moment the price could react.
  const measuredAtOpen = item.measuredFrom !== item.time;
  // While that headline is still waiting on its own clock to start, "3h ago"
  // up top and "Pending" below look contradictory unless this is spelled out.
  const stillWaitingOnOpen = measuredAtOpen && item.price1hAfter === null;
  const [revealRef, isVisible] = useRevealOnScroll();
  // Cards closer to the top of a freshly-revealed batch arrive a beat before
  // the ones below - a cascade instead of everything popping in together.
  const revealDelay = Math.min(staggerIndex, 5) * 70;

  return (
    <article
      ref={revealRef}
      className={`impact-card spotlight reveal${isVisible ? " is-visible" : ""}`}
      onMouseMove={handleSpotlightMove}
      style={{ "--reveal-delay": `${revealDelay}ms` }}
    >
      <div className="spotlight__glow" aria-hidden="true" />
      <div className="impact-card__header">
        <div className="impact-card__meta">
          <span className="impact-card__time" title={item.fullTime}>
            {item.displayTime}
          </span>
          <Tooltip text={categoryDescription(item.category)}>
            <span className="asset-badge asset-badge--subtle">{item.category}</span>
          </Tooltip>
          <Tooltip text={sentimentDescription(item.sentiment)}>
            <span className={`tag tag--${sentimentTone(item.sentiment)}`}>{item.sentiment}</span>
          </Tooltip>
        </div>
        <div className="impact-card__headline-stat">
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

      <h4 className="impact-card__title">
        {item.sourceUrl ? (
          <a href={item.sourceUrl} target="_blank" rel="noreferrer">
            {item.title}
          </a>
        ) : (
          item.title
        )}
      </h4>
      <p className="impact-card__source">
        {item.sourceName} · {item.importance} impact
      </p>

      {item.summary && item.summary !== item.title ? (
        <p className="impact-card__summary">{item.summary}</p>
      ) : null}

      {stillWaitingOnOpen ? (
        <p className="impact-card__market-note">
          NVDA only trades 9:30am–4pm ET. This broke while the market was closed, so its clock
          starts at the next open ({item.measuredFromDisplay}), not at {item.displayTime.toLowerCase()}{" "}
          — that's why the steps below are still pending.
        </p>
      ) : takeaway ? (
        <p className={`impact-card__takeaway impact-card__takeaway--${outcome.tone}`}>{takeaway}</p>
      ) : null}

      <div className="impact-steps">
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
          // The raw move, so this matches the actual price shown right next
          // to it. The sector-adjusted number (used for the Outcome pill)
          // lives in the headline badge above, clearly tagged "vs SOX".
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

      <button type="button" className="impact-card__toggle" onClick={onToggle}>
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
    </article>
  );
}

export default function NewsImpactHistory({ impactList, trackRecord, weeklyHighlights, priceDigits = 2, assetName }) {
  const [expandedId, setExpandedId] = useState(null);
  const [outcomeFilter, setOutcomeFilter] = useState("All");
  const [sentimentFilter, setSentimentFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  // Rendering every signal at once made this the longest thing on the page,
  // especially on mobile - reveal it a page at a time instead.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filteredList = useMemo(() => {
    return (impactList || []).filter((item) => {
      const matchesOutcome = outcomeFilter === "All" || item.outcome === outcomeFilter;
      const matchesSentiment = sentimentFilter === "All" || item.sentiment === sentimentFilter;
      const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
      return matchesOutcome && matchesSentiment && matchesCategory;
    });
  }, [impactList, outcomeFilter, sentimentFilter, categoryFilter]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [outcomeFilter, sentimentFilter, categoryFilter]);

  const visibleList = filteredList.slice(0, visibleCount);
  const remainingCount = filteredList.length - visibleList.length;

  if (!impactList || impactList.length === 0) {
    return <div className="section-note">No news impact history available for this asset yet.</div>;
  }

  return (
    <div className="impact-panel">
      <WeeklyHighlights
        items={weeklyHighlights}
        priceDigits={priceDigits}
        assetName={assetName}
        confidenceBreakdown={trackRecord?.confidenceBreakdown}
      />

      <TrackRecordSummary trackRecord={trackRecord} />

      <div className="impact-filters">
        <p className="impact-filters__scope">
          Newest first · filtering the {impactList.length} most recent signals · track record above
          covers full history
        </p>
        <div className="impact-filters__row">
          {OUTCOME_FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              className={`filter-chip ${outcomeFilter === option ? "is-active" : ""}`}
              onClick={() => setOutcomeFilter(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="impact-filters__row">
          {SENTIMENT_FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              className={`filter-chip ${sentimentFilter === option ? "is-active" : ""}`}
              onClick={() => setSentimentFilter(option)}
            >
              {option}
            </button>
          ))}
          <CategorySelect value={categoryFilter} onChange={setCategoryFilter} />
        </div>
      </div>

      {filteredList.length === 0 ? (
        <div className="section-note">
          None of the {impactList.length} most recent signals match these filters — try Track Record
          above for the full-history picture.
        </div>
      ) : (
        <>
          <div className="impact-feed">
            {visibleList.map((item, index) => (
              <ImpactCard
                key={item.id}
                item={item}
                priceDigits={priceDigits}
                isExpanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                staggerIndex={index}
                confidenceBreakdown={trackRecord?.confidenceBreakdown}
                assetName={assetName}
              />
            ))}
          </div>

          {remainingCount > 0 ? (
            <button
              type="button"
              className="load-more-button"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            >
              Show {Math.min(remainingCount, PAGE_SIZE)} more
              <span aria-hidden="true">↓</span>
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
