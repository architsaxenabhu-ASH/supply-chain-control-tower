import { useSyncExternalStore } from "react";
import { ArrowDownToLine, ArrowUpFromLine, RotateCcw } from "lucide-react";

import {
  getPrimaryClicks,
  getSecondaryClicks,
  injectPrimary,
  injectSecondary,
  isPresentation,
  resetDemo,
  subscribeDemo,
} from "../lib/demoMode";

// Presenter-only controls (Phase 7E). Three buttons drive a live walkthrough that
// every connected device sees at once:
//   • Start at zero  — resets the whole business to zero on every device.
//   • Primary Sales + — goods come IN (inbound + inventory rise).
//   • Secondary Sales + — goods sold OUT (revenue rises; inventory + active
//     shipments fall). Inventory is always Primary − Secondary.
// Visibility is gated by the caller (only the demo presenter's login renders it).

export function DemoControls() {
  const presenting = useSyncExternalStore(subscribeDemo, isPresentation, () => false);
  const primary = useSyncExternalStore(subscribeDemo, getPrimaryClicks, () => 0);
  const secondary = useSyncExternalStore(subscribeDemo, getSecondaryClicks, () => 0);

  return (
    <div className="demo-controls" role="group" aria-label="Demo presentation controls">
      <button
        type="button"
        className="demo-ctl demo-ctl-reset"
        onClick={resetDemo}
        title="Reset the business to zero on every device, then build the demo live"
      >
        <RotateCcw size={14} aria-hidden="true" />
        <span>Start at zero</span>
      </button>

      <button
        type="button"
        className="demo-ctl demo-ctl-primary"
        onClick={injectPrimary}
        title="Primary Sales: goods coming into the business (inbound + inventory rise)"
        aria-label="Add a Primary Sales pulse"
      >
        <ArrowDownToLine size={14} aria-hidden="true" />
        <span>Primary Sales</span>
        <span className="demo-ctl-sign">+</span>
        {presenting && primary > 0 ? <span className="demo-ctl-count">{primary}</span> : null}
      </button>

      <button
        type="button"
        className="demo-ctl demo-ctl-secondary"
        onClick={injectSecondary}
        title="Secondary Sales: goods sold out to customers (revenue up; inventory + active shipments down)"
        aria-label="Add a Secondary Sales pulse"
      >
        <ArrowUpFromLine size={14} aria-hidden="true" />
        <span>Secondary Sales</span>
        <span className="demo-ctl-sign">+</span>
        {presenting && secondary > 0 ? <span className="demo-ctl-count">{secondary}</span> : null}
      </button>
    </div>
  );
}
