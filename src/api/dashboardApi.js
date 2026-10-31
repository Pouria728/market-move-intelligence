const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5146";

const assetVisuals = {
  // Real brand colors (Bitcoin orange, NVIDIA green) rather than
  // approximated theme colors, to match the real logos shown next to them.
  BTC: {
    id: "btc",
    name: "Bitcoin",
    symbol: "BTC",
    accent: "#f7931a",
    accentSoft: "rgba(247, 147, 26, 0.16)",
    accentStrong: "#ffb84d",
    aiAccent: "#8b5cf6"
  },
  NVDA: {
    id: "nvda",
    name: "NVIDIA",
    symbol: "NVDA",
    accent: "#76b900",
    accentSoft: "rgba(118, 185, 0, 0.16)",
    accentStrong: "#a6e22e",
    aiAccent: "#60a5fa"
  }
};

const newsTagRules = [
  { pattern: /etf|inflows?|outflows?/i, label: "ETF Flows", tone: "bullish" },
  { pattern: /institution|corporate treasury|collateral/i, label: "Institutional", tone: "macro" },
  { pattern: /fed|inflation|macro|rates?|pce|cpi|yield|liquidity/i, label: "Macro", tone: "ai" },
  { pattern: /liquidation|derivative|options|funding/i, label: "Derivatives", tone: "neutral" },
  { pattern: /ai demand|gpu|hyperscaler|ai hardware|infrastructure/i, label: "AI Demand", tone: "bullish" },
  { pattern: /guidance|earnings|revenue/i, label: "Guidance", tone: "ai" },
  { pattern: /supply|dram|memory|supplier|capacity/i, label: "Supply Chain", tone: "risk" },
  { pattern: /china|export|regulation|blacklist|geopolitic|tariff/i, label: "Regulation", tone: "risk" }
];

const contextTagRules = [
  { pattern: /fed|inflation|macro|rates?|pce|cpi|liquidity/i, label: "Macro", tone: "macro" },
  { pattern: /geopolitic|china|export|regulation|blacklist|tariff/i, label: "Geopolitics", tone: "risk" },
  { pattern: /institution|adoption|corporate treasury|collateral/i, label: "Adoption", tone: "bullish" },
  { pattern: /ai|infrastructure|power|electricity|capex/i, label: "AI Infra", tone: "ai" },
  { pattern: /valuation|multiple|re-rating/i, label: "Valuation", tone: "neutral" },
  { pattern: /supply|dram|memory|supplier|capacity/i, label: "Supply Chain", tone: "risk" }
];

async function fetchJson(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function unwrapCollection(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.value)) {
    return payload.value;
  }

  return [];
}

function toNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function toNullableNumber(value) {
  // Number(null) is 0 in JS, not NaN - so null/undefined must be checked
  // explicitly first, or a genuinely "not available yet" value silently
  // becomes a fake zero instead of staying null.
  if (value === null || value === undefined) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function toConfidencePercent(value) {
  const numericValue = toNumber(value, 0);

  if (numericValue <= 1) {
    return Math.round(numericValue * 100);
  }

  if (numericValue <= 10) {
    return Math.round(numericValue * 10);
  }

  return Math.max(0, Math.min(100, Math.round(numericValue)));
}

function formatRelativeTime(value) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return "Recent";
  }

  const diffMinutes = Math.round((Date.now() - timestamp) / 60000);

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);

  if (diffDays === 1) {
    return "Yesterday";
  }

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return formatEventDateTime(value);
}

function formatEventDateTime(value) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return "Recent";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function splitTextToPoints(text, maxItems = 4) {
  if (!text) {
    return [];
  }

  return String(text)
    .replace(/\s+/g, " ")
    .split(/(?:\.\s+|;\s+|\|\s+|,\s+(?=[A-Z0-9]))/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function splitWatchItems(text, maxItems = 4) {
  if (!text) {
    return [];
  }

  return String(text)
    .replace(/\s+/g, " ")
    .split(/(?:,\s+|;\s+|\.\s+)/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

// Every tag shown should mean something specific. Padding the row out to a
// fixed count with generic filler (or restating the mood headline as a tag)
// just adds clutter, so the fallback is only used when nothing real matched.
function buildTagList(textBlocks, rules, fallbackTag) {
  const sourceText = textBlocks.filter(Boolean).join(" ");
  const tags = [];
  const seenLabels = new Set();

  rules.forEach((rule) => {
    if (tags.length >= 4) {
      return;
    }

    if (!seenLabels.has(rule.label) && rule.pattern.test(sourceText)) {
      tags.push({ label: rule.label, tone: rule.tone });
      seenLabels.add(rule.label);
    }
  });

  if (tags.length === 0 && fallbackTag) {
    tags.push(fallbackTag);
  }

  return tags;
}

function buildDefaultVisuals(symbol, name) {
  return {
    id: String(symbol || name || "asset").toLowerCase(),
    name: name || symbol || "Asset",
    symbol: symbol || "ASSET",
    accent: "#94a3b8",
    accentSoft: "rgba(148, 163, 184, 0.16)",
    accentStrong: "#cbd5e1",
    aiAccent: "#60a5fa"
  };
}

function buildBaseAsset(payload, symbolOverride) {
  const symbol = String(symbolOverride || payload.Asset_Symbol || "").toUpperCase();
  const visuals = assetVisuals[symbol] || buildDefaultVisuals(symbol, payload.Asset_Name);
  const whyMovingPoints = splitTextToPoints(payload.Why_Is_It_Moving);
  const risks = splitTextToPoints(payload.Biggest_Risk);
  const opportunities = splitTextToPoints(payload.Biggest_Opportunity);
  const watchNext = splitWatchItems(payload.What_To_Watch_Next);

  return {
    ...visuals,
    currentPrice: toNumber(payload.Current_Price),
    currentPriceTime: payload.Current_Price_Time || null,
    change24h: toNumber(payload.Change_24h_Percent),
    avgPrice: toNumber(payload.Avg_Price_24h),
    maxPrice: toNumber(payload.Max_Price_24h),
    minPrice: toNumber(payload.Min_Price_24h),
    marketMood: payload.Market_Mood || "Unknown",
    confidence: toConfidencePercent(payload.Mood_Confidence),
    currentSituation: payload.What_Is_Happening_Now || "No current market summary available.",
    whyMoving: payload.Why_Is_It_Moving || "No movement explanation available.",
    realWorldContext: payload.Long_Term_View || "No macro context available yet.",
    aiInsight: payload.AI_Insight || "AI insight is not available yet.",
    // Avg/High/Low already have their own visual (the range slider below the
    // price), so the only genuinely new fact worth a stat tile here is how
    // many live price ticks that range is built from.
    summaryMetrics: [
      {
        label: "24H Records",
        value: String(payload.Price_Records_24h || 0),
        delta: "Live"
      }
    ],
    keyNewsTags: buildTagList(
      [payload.Why_Is_It_Moving, payload.Short_Term_View, payload.Biggest_Opportunity],
      newsTagRules,
      { label: "AI Analysis", tone: "ai" }
    ),
    contextTags: buildTagList(
      [payload.Long_Term_View, payload.Biggest_Risk, payload.What_To_Watch_Next],
      contextTagRules,
      { label: "Market Structure", tone: "macro" }
    ),
    whyMovingPoints:
      whyMovingPoints.length > 0
        ? whyMovingPoints
        : splitTextToPoints(payload.Short_Term_View).slice(0, 4),
    risks: risks.length > 0 ? risks : splitTextToPoints(payload.Long_Term_View).slice(0, 3),
    opportunities:
      opportunities.length > 0
        ? opportunities
        : splitTextToPoints(payload.Short_Term_View).slice(0, 3),
    outlook: {
      base: payload.Short_Term_View || payload.What_Is_Happening_Now || "Base case is not available.",
      bull: payload.Biggest_Opportunity || payload.AI_Insight || "Bull case is not available.",
      bear: payload.Biggest_Risk || payload.Long_Term_View || "Bear case is not available."
    },
    watchNext:
      watchNext.length > 0
        ? watchNext
        : splitTextToPoints(payload.What_To_Watch_Next).slice(0, 4)
  };
}

function mapOverviewAsset(row) {
  return buildBaseAsset(row, row.Asset_Symbol);
}

function mapDetailAsset(detailPayload) {
  const baseAsset = buildBaseAsset(detailPayload, detailPayload.Asset_Symbol);

  return {
    ...baseAsset,
    summaryMetrics: [
      {
        label: "Total Signals",
        value: String(detailPayload.Total_Signals || 0),
        delta: "All"
      },
      {
        label: "High Impact",
        value: String(detailPayload.High_Importance_Signals || 0),
        delta: "Signals"
      },
      {
        label: "Bullish",
        value: String(detailPayload.Bullish_Signals || 0),
        delta: "Signals"
      },
      {
        label: "Bearish",
        value: String(detailPayload.Bearish_Signals || 0),
        delta: "Signals"
      }
    ]
  };
}

function mapNewsImpact(rows) {
  return unwrapCollection(rows).map((row) => ({
    id: `impact-${row.Signal_ID}`,
    title: row.Article_Title || "Untitled article",
    sourceName: row.Source_Name || "Unknown source",
    sourceUrl: row.Source_URL || "",
    time: row.Event_Time,
    measuredFrom: row.Measured_From || row.Event_Time,
    displayTime: formatRelativeTime(row.Event_Time),
    fullTime: formatEventDateTime(row.Event_Time),
    measuredFromDisplay: formatEventDateTime(row.Measured_From || row.Event_Time),
    category: row.Category || "Market Structure",
    sentiment: row.Sentiment || "Neutral",
    importance: row.Importance || "Medium",
    confidence: toConfidencePercent(row.Confidence),
    summary: row.Summary || "",
    analystSummary: row.Analyst_Summary || "",
    marketNarrative: row.Market_Narrative || "",
    shortTermView: row.Short_Term_View || "",
    longTermView: row.Long_Term_View || "",
    priceAtSignal: toNullableNumber(row.Price_At_Signal),
    price1hAfter: toNullableNumber(row.Price_1h_After),
    price24hAfter: toNullableNumber(row.Price_24h_After),
    change1hPercent: toNullableNumber(row.Change_1h_Percent),
    change24hPercent: toNullableNumber(row.Change_24h_Percent),
    rawChange1hPercent: toNullableNumber(row.Raw_Change_1h_Percent),
    rawChange24hPercent: toNullableNumber(row.Raw_Change_24h_Percent),
    benchmarkSymbol: row.Benchmark_Symbol || null,
    outcome: row.Outcome || "Too Early"
  }));
}

function pickLatestImportantImpact(rows) {
  const mapped = mapNewsImpact(rows);

  if (mapped.length === 0) {
    return null;
  }

  // Prefer a headline whose real-world impact is already known; only fall
  // back to a "too early to tell" one if literally nothing else qualifies.
  const resolved = mapped.filter((item) => item.outcome !== "Too Early" && item.outcome !== "No Price Data");
  const pool = resolved.length > 0 ? resolved : mapped;

  return pool.find((item) => item.importance === "High") || pool[0];
}

export async function getOverviewAssets() {
  const overviewRows = unwrapCollection(await fetchJson("/api/dashboard/overview"));

  const assets = await Promise.all(
    overviewRows.map(async (row) => {
      const symbol = String(row.Asset_Symbol || "").toUpperCase();
      const [newsImpactRows, moodTrackRecordPayload] = await Promise.all([
        fetchJson(`/api/assets/${symbol}/news-impact?limit=5`),
        fetchJson(`/api/assets/${symbol}/mood-track-record`)
      ]);

      return {
        ...mapOverviewAsset(row),
        latestImpact: pickLatestImportantImpact(newsImpactRows),
        // The last 5 signals regardless of importance - used to detect
        // "new since your last visit", which cares about anything arriving,
        // not just the headline important enough to feature on the card.
        recentImpacts: mapNewsImpact(newsImpactRows),
        moodTrackRecord: mapTrackRecord(moodTrackRecordPayload)
      };
    })
  );

  return assets;
}

function mapTrackRecord(payload) {
  if (!payload) {
    return null;
  }

  return {
    totalSignals: toNumber(payload.Total_Signals, 0),
    marketMoves: toNumber(payload.Market_Moves, 0),
    decisiveMoves: toNumber(payload.Decisive_Moves, 0),
    confirmed: toNumber(payload.Confirmed, 0),
    againstCall: toNumber(payload.Against_Call, 0),
    inconclusive: toNumber(payload.Inconclusive, 0),
    tooEarly: toNumber(payload.Too_Early, 0),
    noPriceData: toNumber(payload.No_Price_Data, 0),
    confirmedPercent: toNullableNumber(payload.Confirmed_Percent),
    againstCallPercent: toNullableNumber(payload.Against_Call_Percent),
    inconclusivePercent: toNullableNumber(payload.Inconclusive_Percent),
    directionalAccuracyPercent: toNullableNumber(payload.Directional_Accuracy_Percent),
    signalDirectionalAccuracyPercent: toNullableNumber(payload.Signal_Directional_Accuracy_Percent),
    confidenceBreakdown: (payload.Confidence_Breakdown || []).map((bucket) => ({
      label: bucket.Label,
      signalCount: toNumber(bucket.Signal_Count, 0),
      decisiveCount: toNumber(bucket.Decisive_Count, 0),
      accuracyPercent: toNullableNumber(bucket.Accuracy_Percent),
      avgConfidencePercent: toNullableNumber(bucket.Avg_Confidence_Percent)
    })),
    calibrationErrorPercent: toNullableNumber(payload.Calibration_Error_Percent)
  };
}

export async function getPriceStats(symbol, hours) {
  const upperSymbol = String(symbol).toUpperCase();
  const payload = await fetchJson(`/api/assets/${upperSymbol}/price-stats?hours=${hours}`);

  return {
    avgPrice: toNumber(payload.Avg_Price),
    maxPrice: toNumber(payload.Max_Price),
    minPrice: toNumber(payload.Min_Price),
    recordCount: toNumber(payload.Price_Records)
  };
}

export async function getMacroSnapshot(hours) {
  const rows = unwrapCollection(await fetchJson(`/api/macro/latest?hours=${hours}`));

  return rows.map((row) => ({
    symbol: row.Symbol,
    label: row.Label,
    value: toNullableNumber(row.Value),
    recordTime: row.Record_Time,
    change: toNullableNumber(row.Change),
    changePercent: toNullableNumber(row.Change_Percent),
    baselineRecordTime: row.Baseline_Record_Time || null
  }));
}

export async function getAssetDetail(symbol) {
  const upperSymbol = String(symbol).toUpperCase();

  const [detailPayload, newsImpactRows, trackRecordPayload, weeklyHighlightRows, moodTrackRecordPayload] =
    await Promise.all([
      fetchJson(`/api/assets/${upperSymbol}/detail`),
      fetchJson(`/api/assets/${upperSymbol}/news-impact?limit=30`),
      fetchJson(`/api/assets/${upperSymbol}/track-record`),
      fetchJson(`/api/assets/${upperSymbol}/weekly-highlights`),
      fetchJson(`/api/assets/${upperSymbol}/mood-track-record`)
    ]);

  return {
    ...mapDetailAsset(detailPayload),
    newsImpact: mapNewsImpact(newsImpactRows),
    trackRecord: mapTrackRecord(trackRecordPayload),
    weeklyHighlights: mapNewsImpact(weeklyHighlightRows),
    moodTrackRecord: mapTrackRecord(moodTrackRecordPayload)
  };
}
