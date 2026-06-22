import { useSyncExternalStore } from "react";

import { getInjectRevision, subscribeDemo } from "./demoMode";

// One line that makes a screen "live" during a presentation. The number it
// returns advances on every presenter click (Start at zero / Primary Sales + /
// Secondary Sales +). Put it in a data-loading effect's dependency array and the
// screen re-fetches — so every tab, map and dashboard grows together in real
// time instead of sitting frozen on the data it loaded once.
export function useDemoRevision(): number {
  return useSyncExternalStore(subscribeDemo, getInjectRevision, () => 0);
}
