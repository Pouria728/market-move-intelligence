import React from "react";
import Tooltip from "./Tooltip";
import { macroTakeaway } from "../utils/impactFormat";

// One synthesized sentence about how THIS asset's move relates to the
// broader market today, not a row of raw indicators the reader has to
// cross-reference themselves - the analysis is the deliverable, the numbers
// behind it are just a tooltip away for anyone who wants the receipts.
export default function MacroTakeaway({ asset, macroRows }) {
  const result = macroTakeaway(asset.name, asset.change24h, macroRows);

  if (!result) {
    return null;
  }

  return (
    <Tooltip text={result.receipts} block>
      <p className="macro-takeaway">{result.sentence}</p>
    </Tooltip>
  );
}
