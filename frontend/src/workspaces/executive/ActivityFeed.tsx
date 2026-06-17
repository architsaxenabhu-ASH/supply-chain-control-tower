import { useState } from "react";
import { Activity } from "lucide-react";

import { CATEGORY_LABEL, type LiveCategory, type LiveEvent } from "../../lib/liveTicker";

// The right-hand live activity feed (Phase 7A). The latest real events, grouped
// and filterable by stream. Auto-refreshes whenever the parent reloads (the
// `events` prop changes). Read-only — an executive observes, never edits here.

type FilterId = "all" | LiveCategory;

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "primary", label: "Primary" },
  { id: "inventory", label: "Inventory" },
  { id: "secondary", label: "Secondary" },
  { id: "finance", label: "Finance" },
];

export function ActivityFeed({ events, defaultFilter = "all" }: { events: LiveEvent[]; defaultFilter?: FilterId }) {
  const [filter, setFilter] = useState<FilterId>(defaultFilter);
  const shown = filter === "all" ? events : events.filter((event) => event.category === filter);

  return (
    <aside className="exec-feed" aria-label="Live activity feed">
      <header className="exec-feed-head">
        <h3>
          <Activity size={15} aria-hidden="true" /> Live activity
        </h3>
        <div className="exec-feed-filters" role="tablist" aria-label="Filter activity">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={filter === option.id}
              className={filter === option.id ? "active" : ""}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>
      <ol className="exec-feed-list">
        {shown.length === 0 ? (
          <li className="exec-feed-empty">No activity in this stream yet — it fills in as the business moves.</li>
        ) : (
          shown.map((event) => (
            <li className="exec-feed-item" key={event.id}>
              <span className={`exec-feed-rail cat-${event.category}`} aria-hidden="true" />
              <div className="exec-feed-body">
                <div className="exec-feed-meta">
                  <span className="exec-feed-time">{event.time}</span>
                  <span className={`exec-feed-cat cat-${event.category}`}>{CATEGORY_LABEL[event.category]}</span>
                </div>
                <p className="exec-feed-text">{event.text}</p>
                {event.actor ? <span className="exec-feed-actor">{event.actor}</span> : null}
              </div>
            </li>
          ))
        )}
      </ol>
    </aside>
  );
}
