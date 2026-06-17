import { RadioTower } from "lucide-react";

import { prefersReducedMotion } from "../../motion/motion";
import type { LiveEvent } from "../../lib/liveTicker";

// Bloomberg-style operational ticker (Phase 7A). A single continuous band of
// real events scrolling past — the executive can leave it open all day. It is
// not notifications; it is the live pulse of the business. Pauses on hover, and
// goes static (no motion) for anyone who prefers reduced motion.

export function LiveTicker({ events }: { events: LiveEvent[] }) {
  const reduced = prefersReducedMotion();

  if (events.length === 0) {
    return (
      <div className="exec-ticker exec-ticker-empty" role="log" aria-label="Live operational ticker">
        <span className="exec-ticker-tag">
          <RadioTower size={13} aria-hidden="true" /> LIVE
        </span>
        <span className="exec-ticker-quiet">Operational stream is quiet — events appear here the moment they happen.</span>
      </div>
    );
  }

  // Duplicate the run so the marquee can loop seamlessly; static users see one pass.
  const items = reduced ? events.slice(0, 10) : [...events, ...events];
  const duration = Math.max(36, events.length * 4);

  return (
    <div className="exec-ticker" role="log" aria-label="Live operational ticker">
      <span className="exec-ticker-tag">
        <RadioTower size={13} aria-hidden="true" /> LIVE
      </span>
      <div className="exec-ticker-track-wrap">
        <div
          className={`exec-ticker-track${reduced ? " is-static" : ""}`}
          style={reduced ? undefined : { animationDuration: `${duration}s` }}
        >
          {items.map((event, index) => (
            <span className="exec-ticker-item" key={`${event.id}-${index}`}>
              <span className="exec-ticker-time">{event.time}</span>
              <span className={`exec-dot cat-${event.category}`} aria-hidden="true" />
              <span className="exec-ticker-text">{event.text}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
