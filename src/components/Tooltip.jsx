import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// How far the bubble must stay from the screen edge, in px.
const VIEWPORT_MARGIN = 12;

// Rendered into <body> (not next to the trigger) for the same reason
// CategorySelect's menu is: panels clip overflow for their rounded corners,
// so a tooltip positioned normally would get cut off near a panel's edge.
export default function Tooltip({ text, children, block = false }) {
  const [style, setStyle] = useState(null);
  const triggerRef = useRef(null);
  const bubbleRef = useRef(null);

  // The bubble is centered on the trigger via a CSS transform
  // (translateX(-50%)). That's fine almost everywhere, but a trigger near
  // the left or right edge of the screen (e.g. a tag in the leftmost
  // column of a card) centers the bubble straight off the edge, clipping
  // its text. Once the bubble's real rendered width is known, nudge its
  // anchor point back on-screen before the browser paints, so it never
  // visibly overflows.
  useLayoutEffect(() => {
    if (!style || !bubbleRef.current) {
      return;
    }

    const halfWidth = bubbleRef.current.getBoundingClientRect().width / 2;
    const minLeft = halfWidth + VIEWPORT_MARGIN;
    const maxLeft = window.innerWidth - halfWidth - VIEWPORT_MARGIN;
    const clampedLeft = Math.min(Math.max(style.left, minLeft), maxLeft);

    if (clampedLeft !== style.left) {
      setStyle((current) => (current ? { ...current, left: clampedLeft } : current));
    }
    // Only the position needs to re-run this check, not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style && style.left, style && style.top]);

  if (!text) {
    return children;
  }

  const show = () => {
    const rect = triggerRef.current.getBoundingClientRect();
    setStyle({
      position: "fixed",
      left: rect.left + rect.width / 2,
      top: rect.top - 10
    });
  };

  const hide = () => setStyle(null);

  return (
    <span
      ref={triggerRef}
      className={`tooltip-trigger${block ? " tooltip-trigger--block" : ""}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {style
        ? createPortal(
            <span ref={bubbleRef} className="tooltip-bubble" role="tooltip" style={style}>
              {text}
            </span>,
            document.body
          )
        : null}
    </span>
  );
}
