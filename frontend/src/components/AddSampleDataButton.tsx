import { useState, useSyncExternalStore } from "react";
import { CirclePlus } from "lucide-react";

import { getInjectedCount, injectSampleData, subscribeDemo } from "../lib/demoMode";

// Presenter-only control (Phase 7C). One click generates a fresh set of sample
// activity and pushes it into the live system, so new records visibly stream
// into the Overview feed during a walkthrough. Visibility is gated by the caller
// (only the demo presenter's login renders it).

export function AddSampleDataButton() {
  const count = useSyncExternalStore(subscribeDemo, getInjectedCount, () => 0);
  const [flash, setFlash] = useState(false);

  function handleClick() {
    injectSampleData();
    setFlash(true);
    window.setTimeout(() => setFlash(false), 1100);
  }

  return (
    <button
      type="button"
      className={`demo-inject${flash ? " is-flash" : ""}`}
      onClick={handleClick}
      title="Generate a fresh set of sample activity and add it to the live system"
    >
      <CirclePlus size={15} aria-hidden="true" />
      <span>{flash ? "Added ✓" : "Add Sample Data"}</span>
      {count > 0 ? <span className="demo-inject-count">{count}</span> : null}
    </button>
  );
}
