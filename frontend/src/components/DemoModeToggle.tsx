import { useSyncExternalStore } from "react";
import { Sparkles } from "lucide-react";

import { isDemoActive, subscribeDemo, toggleDemo } from "../lib/demoMode";

// Presenter-only control (Phase 7C). Renders a single, discreet pill that starts
// or stops the continuous demo flow. Visibility is gated by the caller (only the
// demo presenter's login sees it); this component just reflects and toggles the
// shared demo state. Clear two-state affordance, accessible label, ≥44px hit area.

export function DemoModeToggle() {
  const active = useSyncExternalStore(subscribeDemo, isDemoActive, () => false);
  return (
    <button
      type="button"
      className={`demo-toggle${active ? " is-on" : ""}`}
      onClick={toggleDemo}
      aria-pressed={active}
      title={
        active
          ? "Demo flow is running — live sample activity. Click to stop. (Today only.)"
          : "Start demo flow — stream live sample activity for the walkthrough. (Today only.)"
      }
    >
      {active ? (
        <span className="demo-toggle-dot" aria-hidden="true" />
      ) : (
        <Sparkles size={15} aria-hidden="true" />
      )}
      <span>{active ? "Demo · Live" : "Demo Mode"}</span>
    </button>
  );
}
