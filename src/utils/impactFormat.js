export function sentimentTone(sentiment) {
  const tones = {
    Bullish: "bullish",
    Bearish: "bearish",
    Mixed: "risk",
    Neutral: "neutral"
  };

  return tones[sentiment] || "neutral";
}

// The two top-of-card badges that say what kind of instrument this asset
// actually is - this matters beyond labeling, since it changes how/when a
// price can even react to news (see below).
const ASSET_TYPE_DESCRIPTIONS = {
  "Digital Asset":
    "Bitcoin trades as a cryptocurrency on crypto exchanges around the clock - 24 hours a day, every day, including weekends and holidays. There's no market open or close for it, so a price reaction to a headline can start immediately, whenever it breaks.",
  "Equity Signal":
    "NVIDIA trades as a regular stock, only during US stock market hours (9:30am-4pm ET, weekdays). A headline that breaks outside that window - overnight, on a weekend, or on a holiday - has to wait for the next market open before price can actually react to it. That's why some price-reaction numbers on this page are measured from the next open instead of the exact moment the news broke."
};

export function assetTypeDescription(label) {
  return ASSET_TYPE_DESCRIPTIONS[label] || null;
}

// The big "Confidence" meter at the top of a card/hero isn't about any one
// headline - it's the AI's confidence in its latest periodic big-picture
// snapshot (Market Mood), built from all recent news together. That scope
// isn't obvious from a bare "Confidence 78%", so it's spelled out on hover.
export function heroConfidenceDescription(assetName) {
  return `This is the AI's confidence in its most recent overall read of ${assetName}'s situation - a big-picture snapshot it rebuilds periodically from all the recent news together, not the confidence behind any single headline. For how confident it was on one specific headline, check that headline's own card in the news history below (each one shows "AI confidence: X%" for just that call).`;
}

// Hovering the number/bar itself (as opposed to the "Overall confidence"
// label) should answer a different question: not "what is this metric",
// but "where did THIS exact number come from, and why should/shouldn't I
// trust it". The honest answer is that it's the AI's own self-reported
// rating, not a calculated figure - so the best we can add is how numbers
// at this same level have actually scored historically.
export function confidenceNumberDescription(confidencePercent, confidenceBreakdown) {
  const rounded = Math.round(confidencePercent);
  const base = `This exact number (${rounded}%) is the AI's own self-reported certainty when it wrote this read - it isn't calculated from a formula or derived from price data. It's a subjective rating of how clear and consistent the recent signals seemed to the AI at that moment, so there's no deeper "why 60 and not 65" to find - that's simply the number it chose to state.`;

  const calibrated = getCalibratedConfidence(confidencePercent, confidenceBreakdown);
  if (!calibrated || calibrated.accuracyPercent === null) {
    return `${base} There isn't enough historical data yet at this confidence level to say how trustworthy numbers like it have actually been.`;
  }

  if (!calibrated.isReliable) {
    return `${base} So far, only ${calibrated.decisiveCount} decided call${
      calibrated.decisiveCount === 1 ? "" : "s"
    } have landed around this confidence level - too few yet to say whether numbers like this one have actually been trustworthy.`;
  }

  return `${base} What we do know: historically, when it has stated a number around this range, it's actually been right ${Math.round(
    calibrated.accuracyPercent
  )}% of the time (${calibrated.decisiveCount} decided calls) - see "Does the AI's own confidence mean anything?" further down for the full picture.`;
}

export function outcomeMeta(outcome) {
  const meta = {
    Confirmed: { label: "Confirmed by price", tone: "confirmed" },
    "Against Call": { label: "Went against call", tone: "against" },
    Inconclusive: { label: "Inconclusive move", tone: "inconclusive" },
    "Too Early": { label: "Too early to tell", tone: "pending" },
    "No Price Data": { label: "No price data", tone: "pending" }
  };

  return meta[outcome] || meta["Too Early"];
}

// What each outcome pill actually means - these are the result of comparing
// the real 1h/24h price move against the AI's Bullish/Bearish call, using a
// statistically-sized "meaningful move" bar that's tuned per asset.
const OUTCOME_DESCRIPTIONS = {
  Confirmed:
    "The price actually moved the way the AI's Bullish or Bearish call expected, and by enough to count as a real, meaningful move - not just normal day-to-day noise for this asset.",
  "Against Call":
    "The price moved by a meaningful amount, but in the opposite direction from what the AI's Bullish or Bearish call expected. In plain terms: the call was wrong.",
  Inconclusive:
    "The price did move, but not by enough to confidently call it a real reaction rather than this asset's normal background noise. The bar for 'meaningful' is set statistically for each asset, based on how much it typically moves anyway - so this move was too small to count as either confirmed or wrong.",
  "Too Early":
    "Not enough time has passed yet since this headline for its 1h or 24h price reaction to be measured. Once that window passes, this will update to one of the other outcomes.",
  "No Price Data":
    "There isn't enough real price history around this headline yet to measure what happened afterward - usually because it's a very recent signal or a short gap in the recorded price feed."
};

export function outcomeDescription(outcome) {
  return OUTCOME_DESCRIPTIONS[outcome] || OUTCOME_DESCRIPTIONS["Too Early"];
}

// The AI's own directional read on a headline - shown next to it so you can
// see at a glance which way it thinks the news leans, before checking
// whether that call actually held up (see the Track Record section).
const SENTIMENT_DESCRIPTIONS = {
  Bullish:
    "The AI's read is that this headline points toward the price going up. This is just its own call based on the story - not a guarantee of what price will actually do. Check Track Record on this page to see how often Bullish calls like this one have actually held up.",
  Bearish:
    "The AI's read is that this headline points toward the price going down. This is just its own call based on the story - not a guarantee of what price will actually do. Check Track Record on this page to see how often Bearish calls like this one have actually held up.",
  Mixed:
    "The story pulls in both directions at once - there are genuinely strong signals pointing toward the price going up and genuinely strong signals pointing toward it going down, with neither clearly winning out.",
  Neutral:
    "Nothing in this story meaningfully points toward the price going either up or down - it's informational rather than a directional call."
};

export function sentimentDescription(sentiment) {
  return SENTIMENT_DESCRIPTIONS[sentiment] || null;
}

// Turns one headline's raw ingredients (sentiment call, outcome, and actual
// price reaction) into one plain verdict sentence - the thing a reader
// actually wants to know ("so did this call work out, and by how much"),
// instead of making them read a 3-step price ladder and an outcome pill and
// connect those dots themselves. Mirrors macroTakeaway below: a plain verb
// for the move's size/direction instead of a bare percentage.
export function headlineTakeaway(item, assetName) {
  if (item.outcome === "Too Early") {
    return `Too early to tell - not enough time has passed since this headline for ${assetName}'s price reaction to be measured yet.`;
  }

  if (item.outcome === "No Price Data") {
    return `There isn't enough price history around this headline yet to say what ${assetName} actually did afterward.`;
  }

  const hasDailyRead = item.change24hPercent !== null && item.change24hPercent !== undefined;
  const change = hasDailyRead ? item.change24hPercent : item.change1hPercent;

  if (change === null || change === undefined) {
    return null;
  }

  const windowPhrase = hasDailyRead ? "over the following day" : "in the hour afterward";
  const verb = moveVerb(change);

  // Confirmed/Against Call only ever happen for a Bullish/Bearish call (see
  // backend _judge_move) - Neutral/Mixed sentiment always lands as
  // Inconclusive, since there was no directional call to confirm or miss.
  if (item.outcome === "Inconclusive") {
    if (item.sentiment === "Bullish" || item.sentiment === "Bearish") {
      return `The AI called this ${item.sentiment.toLowerCase()}, but ${assetName} only ended up ${verb} ${windowPhrase} - too small a reaction to count as either a real confirmation or a miss; that's within this asset's normal day-to-day noise.`;
    }
    return `This headline wasn't a directional call to begin with, and ${assetName} ended up ${verb} ${windowPhrase} - nothing here to confirm or contradict.`;
  }

  const direction = item.sentiment === "Bullish" ? "rise" : "fall";

  if (item.outcome === "Confirmed") {
    return `The AI called a ${direction} here, and that's exactly what happened - ${assetName} ended up ${verb} ${windowPhrase}.`;
  }

  return `The AI called a ${direction} here, but it didn't hold up - ${assetName} ended up ${verb} ${windowPhrase} instead.`;
}

// What this specific headline's benchmark-adjusted percentage actually
// represents - shown on the small "vs SOX" / "vs ETH+QQQ" tag next to a
// headline's measured move.
export function benchmarkDescription(benchmarkSymbol) {
  if (!benchmarkSymbol) {
    return null;
  }

  return `This percentage is the asset's own raw price move with ${benchmarkSymbol}'s move over the same time window subtracted out. The goal is to isolate what this specific headline actually did, separate from a broader move the whole sector or market was already making anyway - so a rally that lifts almost everything isn't mistakenly credited to this one story.`;
}

// What each short context/news tag actually means - the label alone (e.g.
// "Macro", "AI Infra") doesn't say what kind of story triggered it.
const TAG_DESCRIPTIONS = {
  "ETF Flows":
    "Big investment funds are buying or selling bitcoin through ETFs - a way to own bitcoin through a normal stock account instead of a crypto wallet. When a lot of money flows into these funds at once, it usually means serious investors are stepping in, which can push the price up. Big outflows can do the opposite.",
  Institutional:
    "This story involves big companies, investment firms, or professional money managers - not everyday individual traders. This type of buyer tends to matter more for price than regular retail activity, simply because the amounts of money involved are usually much larger.",
  Macro:
    "This isn't about Bitcoin or NVIDIA specifically - it's about the broader economy: interest rates, inflation, or decisions made by the Federal Reserve. These bigger economic forces can move almost every asset at once, even ones that have nothing to do with the actual news story.",
  Derivatives:
    "This is about futures, options, or other bets on where the price is headed - not people actually buying or selling the real asset. These markets often move faster and more sharply than the regular market, because traders can bet with borrowed money.",
  "AI Demand":
    "This is about how much companies want to buy AI chips and hardware. Since this demand is the main thing driving NVIDIA's entire business right now, any story about it tends to matter a lot for the stock price.",
  Guidance:
    "This is the company talking directly about its own results - like how much money it made, or what it expects to happen next quarter. Investors pay close attention to this because it comes straight from the company itself, not a rumor or an outside analyst's guess.",
  "Supply Chain":
    "This is about the physical side of making chips - factories, raw materials, or how much can actually be produced. Even when demand for a product is high, a problem here can limit how much of it reaches customers, which affects the business either way.",
  Regulation:
    "A government is involved here - through a new rule, an export ban, a sanction, or some other legal restriction. These decisions can change what a company or market is even allowed to do, so they tend to have an outsized effect on price.",
  Geopolitics:
    "This is about conflict or tension between countries - wars, trade disputes, or diplomatic standoffs. Markets often react to this kind of news because it creates uncertainty about the future, even when it doesn't directly touch the company or asset itself.",
  Adoption:
    "This is about real use - more individual people, companies, or institutions actually starting to hold or use this asset in practice, not just talking about it. Genuine adoption tends to support the price over the long run, since it reflects real demand rather than speculation.",
  "AI Infra":
    "This is about the physical infrastructure AI actually needs to run - data centers, electricity, and the huge amounts of money being spent building them. Since NVIDIA's chips power most of this infrastructure, spending in this area tends to directly benefit the company.",
  Valuation:
    "This is about whether the current price makes sense given the company or asset's actual performance - not whether the news itself is good or bad. Even very positive news can lead to a price drop if investors feel the price had already gotten ahead of reality.",
  "Market Structure":
    "This is about how the market itself is functioning, rather than the asset's own story - things like trading volume, liquidity, exchange activity, or technical trading behavior. It's used when nothing more specific (like Macro or Regulation) fits what's actually going on.",
  "AI Analysis":
    "No single theme here stood out clearly enough to earn one of the more specific tags above. This just means the written analysis elsewhere on this card is the best way to understand what's going on, rather than a short label."
};

export function tagDescription(label) {
  return TAG_DESCRIPTIONS[label] || null;
}

// What each news-signal "category" badge means - this is the AI's
// classification of the *type* of story (shown on every signal card and in
// Weekly Highlights), a different, more specific list than the context/news
// tags above.
const CATEGORY_DESCRIPTIONS = {
  "Geopolitics / War":
    "This headline is about conflict, military action, or tension between countries. Markets often react to this kind of news purely because of the uncertainty it creates about the future, even when it doesn't directly touch this asset.",
  "Regulation / Political":
    "A government, regulator, or lawmaker is directly involved - a new rule, a ban, a court ruling, or a political decision. These can change what's legally allowed to happen, so they tend to have an outsized effect on price.",
  "Macro / Fed":
    "This is about the broader economy rather than this asset specifically - interest rates, inflation data, or a decision from the Federal Reserve. These forces can move almost every asset at once, even ones with no direct connection to the news.",
  "Earnings / Guidance":
    "This is the company talking about its own financial results, or what it expects to happen next quarter. It carries extra weight because it comes directly from the company itself, not a rumor or an outside analyst's guess.",
  "Corporate Deal":
    "This is about a specific business transaction - an acquisition, a partnership, a major investment, or something similar. Deals like this can directly change a company's future revenue or strategy, which is why the market reacts.",
  "Institutional / ETF":
    "Big investment funds, banks, or professional money managers are the ones acting here - buying, selling, or moving large amounts of capital. This tends to matter more than everyday retail trading simply because of how much money is involved.",
  "Supply Chain":
    "This is about the physical side of producing or delivering something - factories, raw materials, shipping, or production capacity. Even when demand is strong, a problem here can limit how much actually reaches customers.",
  "Technology / Product":
    "This is about an actual product, technology, or technical capability - a new chip, feature, or innovation. It reflects something concrete the company has built, rather than financial or political news about it.",
  "Market Structure": TAG_DESCRIPTIONS["Market Structure"]
};

export function categoryDescription(category) {
  return CATEGORY_DESCRIPTIONS[category] || null;
}

// Turns the raw macro snapshot (S&P/Nasdaq/VIX levels + 24h change) into one
// plain verdict about THIS asset - what it actually MEANS for the asset,
// not the market mechanics behind it. Leads with the asset's own takeaway;
// the broader market is only ever a short, number-free qualifier after it.
// Every number (S&P/Nasdaq/VIX figures) lives only in the hover tooltip,
// never in the visible sentence - a user who cares about the impact
// shouldn't have to read a percentage to get it. Returns null when there
// isn't enough data to say anything.
function magnitudeWord(percent) {
  const abs = Math.abs(percent);
  if (abs < 0.4) return "flat";
  if (abs < 1.5) return "moderate";
  return "big";
}

// A plain verb phrase that matches how sharp a move actually is, instead of
// the same neutral "move" every time regardless of whether it's a 0.2% drift
// or a 5% plunge - this is most of what makes a sentence sound like it's
// actually describing today, not a template.
function moveVerb(percent) {
  const abs = Math.abs(percent);
  const up = percent > 0;

  if (abs < 0.4) return "staying mostly flat";
  if (abs < 1.5) return up ? "edging higher" : "edging lower";
  if (abs < 4) return up ? "climbing" : "dropping";
  return up ? "surging higher" : "plunging lower";
}

// A short, number-free read of "what's the broader market doing right now" -
// used only as a trailing qualifier, never the main point of the sentence.
function marketMoodPhrase(equityAvg, vixRow) {
  if (equityAvg === null) {
    return null;
  }

  let phrase = `the broader market is ${moveVerb(equityAvg)} today`;

  // A double-digit swing in fear/volatility is worth a plain mention even
  // when the absolute level is still "calm" - that swing itself is real
  // information about today, not just background noise to skip.
  const vixChange = vixRow?.changePercent;
  const vixLevel = vixRow?.value;
  if (vixChange !== null && vixChange !== undefined && vixChange >= 20) {
    phrase += ", with investors clearly on edge";
  } else if (vixChange !== null && vixChange !== undefined && vixChange >= 8) {
    phrase += ", with nervousness ticking up a notch";
  } else if (vixChange !== null && vixChange !== undefined && vixChange <= -20) {
    phrase += ", with nerves clearly easing";
  } else if (vixChange !== null && vixChange !== undefined && vixChange <= -8) {
    phrase += ", with nervousness easing a bit";
  } else if (vixLevel !== null && vixLevel !== undefined && vixLevel >= 30) {
    phrase += ", with real fear already in the market";
  }

  return phrase;
}

export function macroTakeaway(assetName, assetChange24h, macroRows) {
  if (assetChange24h === null || assetChange24h === undefined || !macroRows || macroRows.length === 0) {
    return null;
  }

  const bySymbol = Object.fromEntries(macroRows.map((row) => [row.symbol, row]));
  const sp500 = bySymbol.SP500;
  const nasdaq = bySymbol.NASDAQ;
  const vix = bySymbol.VIX;

  const equityChanges = [sp500?.changePercent, nasdaq?.changePercent].filter(
    (value) => value !== null && value !== undefined
  );
  const equityAvg = equityChanges.length > 0 ? equityChanges.reduce((a, b) => a + b, 0) / equityChanges.length : null;

  if (equityAvg === null) {
    return null;
  }

  // The actual point: not what the market did, but whether THIS asset's own
  // move is explained by that, bigger than it, or going against it entirely.
  // Each branch avoids numbers and avoids repeating "market" - the trailing
  // mood phrase names the broader market, so the verdict doesn't have to.
  const marketMag = magnitudeWord(equityAvg);
  const assetVerb = moveVerb(assetChange24h);
  let verdict;

  if (marketMag === "flat") {
    verdict =
      assetVerb === "staying mostly flat"
        ? `Nothing unusual stands out for ${assetName} today - it's ${assetVerb}, same as everything else`
        : `${assetName} is ${assetVerb} today on its own - the rest of the market is barely moving, so this looks entirely its own story`;
  } else if (Math.sign(assetChange24h) !== Math.sign(equityAvg)) {
    verdict = `${assetName} is ${assetVerb} today, moving against the broader market's own direction - whatever's driving it looks disconnected from today's wider mood`;
  } else if (Math.abs(assetChange24h) > Math.abs(equityAvg) * 1.8) {
    verdict = `${assetName} is ${assetVerb} today, well beyond what the broader market itself is doing - this looks mostly like its own story, not just the wider mood carrying it along`;
  } else if (Math.abs(assetChange24h) < Math.abs(equityAvg) * 0.5) {
    verdict = `${assetName} is only ${assetVerb} today despite that - it's resisting the broader trend rather than following it`;
  } else {
    verdict = `${assetName} is ${assetVerb} today - a good part of this looks like it's just riding the wider mood, not a story unique to ${assetName}`;
  }

  const moodPhrase = marketMoodPhrase(equityAvg, vix);
  const sentence = moodPhrase ? `${verdict}, while ${moodPhrase}.` : `${verdict}.`;

  const receipts = [
    sp500 ? `S&P 500 ${formatPercent(sp500.changePercent)}` : null,
    nasdaq ? `Nasdaq ${formatPercent(nasdaq.changePercent)}` : null,
    vix && vix.value !== null ? `VIX ${vix.value.toFixed(1)} (${formatPercent(vix.changePercent)})` : null
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    sentence,
    receipts: receipts ? `Based on the last 24h: ${receipts}.` : null
  };
}

export function formatPercent(value) {
  if (value === null || value === undefined) {
    return "—";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

// Mirrors CONFIDENCE_BUCKETS in backend/app/impact.py - Low/Medium/High in
// that fixed order, so trackRecord.confidenceBreakdown[0/1/2] line up here.
const MIN_RELIABLE_SAMPLE = 8;

function confidenceBucketIndex(confidencePercent) {
  if (confidencePercent === null || confidencePercent === undefined) {
    return null;
  }

  if (confidencePercent < 60) {
    return 0;
  }

  if (confidencePercent < 80) {
    return 1;
  }

  return 2;
}

// The AI's self-reported confidence is just how sure the model sounds about
// its own call - it isn't derived from price data, and our own Track Record
// shows it's not reliably predictive. This looks up what calls at the same
// confidence level have actually scored, so that number can sit next to it.
export function getCalibratedConfidence(confidencePercent, confidenceBreakdown) {
  const bucketIndex = confidenceBucketIndex(confidencePercent);
  if (bucketIndex === null || !confidenceBreakdown || !confidenceBreakdown[bucketIndex]) {
    return null;
  }

  const bucket = confidenceBreakdown[bucketIndex];

  return {
    label: bucket.label,
    accuracyPercent: bucket.accuracyPercent,
    decisiveCount: bucket.decisiveCount,
    isReliable: bucket.decisiveCount >= MIN_RELIABLE_SAMPLE
  };
}
