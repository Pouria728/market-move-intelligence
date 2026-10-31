import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// A first-time visitor lands straight on dense cards (Confidence, Confirmed
// by price, vs ETH+QQQ...) with no orientation at all. This is that
// orientation - kept out of the way by default (a small trigger, not a
// forced banner) so it doesn't make the page feel busier for anyone who
// already knows what they're looking at.
export default function AboutPanel() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <button type="button" className="about-trigger" onClick={() => setIsOpen(true)}>
        <span aria-hidden="true">?</span>
        How to read this
      </button>

      {isOpen
        ? createPortal(
            <div className="about-overlay" onClick={() => setIsOpen(false)}>
              <div
                className="about-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="about-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="about-modal__header">
                  <h3 id="about-modal-title">What is Market Move Intelligence?</h3>
                  <button
                    type="button"
                    className="about-modal__close"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className="about-modal__body">
                  <section>
                    <p className="about-modal__label">What this is</p>
                    <p>
                      A companion to TradingView that explains <em>why</em> Bitcoin and NVIDIA are
                      moving - connecting real news, macro context, and AI analysis into one plain
                      read of the day. It's not another price chart.
                    </p>
                  </section>

                  <section>
                    <p className="about-modal__label">What this isn't</p>
                    <p>
                      Not trading advice. There are no buy or sell signals, no price predictions,
                      and nothing on this site should be read as a recommendation.
                    </p>
                  </section>

                  <section>
                    <p className="about-modal__label">How to read it</p>
                    <ul className="bullet-list">
                      <li>
                        <strong>Confidence</strong> is the AI's own stated certainty about a
                        read - not a guaranteed accuracy score.
                      </li>
                      <li>
                        Pills like <strong>Confirmed by price</strong>, <strong>Went against
                        call</strong>, and <strong>Inconclusive move</strong> show whether price
                        actually moved the way the AI expected, checked after the fact.
                      </li>
                      <li>
                        <strong>AI Track Record</strong>, further down each asset's page, shows how
                        often the AI's calls have actually held up over time - not just this one.
                      </li>
                    </ul>
                  </section>

                  <section>
                    <p className="about-modal__label">Why some numbers look unfinished</p>
                    <p>
                      This project tracks its own accuracy in the open, including while it's still
                      building up history. A note like "too few calls to verify" means exactly
                      that - not enough data yet to say, not a hidden good or bad result.
                    </p>
                  </section>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
