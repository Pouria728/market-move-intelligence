import React, { useEffect, useMemo, useState } from "react";
import AboutPanel from "./components/AboutPanel";
import AssetCard from "./components/AssetCard";
import AssetDetail from "./components/AssetDetail";
import DataFreshnessBadge from "./components/DataFreshnessBadge";
import useMacroSnapshot from "./hooks/useMacroSnapshot";
import { getAssetDetail, getOverviewAssets } from "./api/dashboardApi";
import { markVisited } from "./utils/lastVisit";

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="15" />
        <path d="M4 18h4l3-8 5 12 4-9 2 5h6" />
      </svg>
    </div>
  );
}

export default function App() {
  const [assets, setAssets] = useState([]);
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [selectedAssetDetail, setSelectedAssetDetail] = useState(null);

  const [overviewLoading, setOverviewLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const [overviewError, setOverviewError] = useState(null);
  const [detailError, setDetailError] = useState(null);

  // Shared by both assets (it's the same broad market for either one), so
  // it's fetched once here instead of once per AssetCard/AssetDetail.
  const { rows: macroRows } = useMacroSnapshot(24);

  const selectedAsset = useMemo(() => {
    if (!selectedAssetId) {
      return null;
    }

    return selectedAssetDetail;
  }, [selectedAssetId, selectedAssetDetail]);

  useEffect(() => {
    let isMounted = true;

    async function loadOverview() {
      try {
        setOverviewLoading(true);
        setOverviewError(null);

        const overviewAssets = await getOverviewAssets();

        if (isMounted) {
          setAssets(overviewAssets);
        }
      } catch (error) {
        console.error("Overview API error:", error);

        if (isMounted) {
          setOverviewError("Could not load dashboard overview data.");
        }
      } finally {
        if (isMounted) {
          setOverviewLoading(false);
        }
      }
    }

    loadOverview();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedAssetId) {
      setSelectedAssetDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    let isMounted = true;

    async function loadAssetDetail() {
      try {
        setDetailLoading(true);
        setDetailError(null);
        setSelectedAssetDetail(null);

        const detail = await getAssetDetail(selectedAssetId);

        if (isMounted) {
          setSelectedAssetDetail(detail);
        }
      } catch (error) {
        console.error("Asset detail API error:", error);

        if (isMounted) {
          setDetailError("Could not load asset detail data.");
        }
      } finally {
        if (isMounted) {
          setDetailLoading(false);
        }
      }
    }

    loadAssetDetail();

    return () => {
      isMounted = false;
    };
  }, [selectedAssetId]);

  function handleBackToOverview() {
    setSelectedAssetId(null);
  }

  function handleOpenAssetDetail(assetId) {
    markVisited(assetId);
    setSelectedAssetId(assetId);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand-block">
          <BrandMark />
          <div>
            <div className="brand-row">
              <h1>Market Move Intelligence</h1>
              <span>AI-powered insights to explain why BTC and NVDA are moving.</span>
            </div>
          </div>
        </div>

        <nav className="main-nav" aria-label="Primary">
          <button
            type="button"
            className={!selectedAsset ? "is-active" : ""}
            onClick={handleBackToOverview}
          >
            Overview
          </button>

          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              className={selectedAssetId === asset.id ? "is-active" : ""}
              onClick={() => handleOpenAssetDetail(asset.id)}
            >
              {asset.symbol}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <AboutPanel />
          <DataFreshnessBadge assets={assets} />
        </div>
      </header>

      <main className="app-main">
        {!selectedAssetId ? (
          <section className="overview-page">
            <div className="page-intro">
              <div>
                <p className="section-eyebrow">Overview</p>
                <h2>Why did it move?</h2>
                <div className="page-intro__meta">
                  <span className="section-badge">Companion to TradingView</span>
                  <span className="section-note">
                    Narrative-first market context for BTC and NVDA.
                  </span>
                </div>
              </div>
              <p>
                A companion intelligence layer for TradingView. It does not replace charting.
                It explains the move by connecting price, news, macro context, and AI analysis.
              </p>
            </div>

            {overviewLoading ? (
              <div className="overview-stack">
                <div className="section-note">Loading market overview...</div>
              </div>
            ) : overviewError ? (
              <div className="overview-stack">
                <div className="section-note">{overviewError}</div>
              </div>
            ) : (
              <div className="overview-stack">
                {assets.map((asset) => (
                  <AssetCard key={asset.id} asset={asset} macroRows={macroRows} onOpen={setSelectedAssetId} />
                ))}
              </div>
            )}
          </section>
        ) : detailLoading ? (
          <section className="overview-page">
            <div className="page-intro">
              <div>
                <p className="section-eyebrow">Asset Detail</p>
                <h2>Loading full analysis...</h2>
              </div>
              <p>Fetching news impact history, track record, and AI analysis.</p>
            </div>
          </section>
        ) : detailError ? (
          <section className="overview-page">
            <div className="page-intro">
              <div>
                <p className="section-eyebrow">Asset Detail</p>
                <h2>Could not load asset detail</h2>
              </div>
              <p>{detailError}</p>
            </div>

            <button type="button" className="section-badge" onClick={handleBackToOverview}>
              Back to overview
            </button>
          </section>
        ) : selectedAsset ? (
          <AssetDetail asset={selectedAsset} macroRows={macroRows} onBack={handleBackToOverview} />
        ) : null}
      </main>
    </div>
  );
}