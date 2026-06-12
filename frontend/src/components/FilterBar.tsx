import { Search } from "lucide-react";

// Shared filter strip for the workspace overview pages (Phase 5C).
// Options are always derived from live data — never hardcoded lists.

export type FilterSelect = {
  id: string;
  label: string;
  value: string; // "" = all
  options: string[];
  allLabel: string;
  onChange: (value: string) => void;
};

export function FilterBar({
  dates,
  selects,
  search,
}: {
  dates?: {
    label: string;
    from: string;
    to: string;
    onFrom: (value: string) => void;
    onTo: (value: string) => void;
  };
  selects: FilterSelect[];
  search?: { value: string; placeholder: string; onChange: (value: string) => void };
}) {
  return (
    <section className="filter-bar" aria-label="Filters">
      {dates ? (
        <>
          <label className="filter-control">
            <span>{dates.label} from</span>
            <input type="date" value={dates.from} onChange={(event) => dates.onFrom(event.target.value)} />
          </label>
          <label className="filter-control">
            <span>To</span>
            <input type="date" value={dates.to} onChange={(event) => dates.onTo(event.target.value)} />
          </label>
        </>
      ) : null}
      {selects.map((select) => (
        <label className="filter-control" key={select.id}>
          <span>{select.label}</span>
          <select value={select.value} onChange={(event) => select.onChange(event.target.value)}>
            <option value="">{select.allLabel}</option>
            {select.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      ))}
      {search ? (
        <div className="search-box filter-search">
          <Search size={16} aria-hidden="true" />
          <input
            placeholder={search.placeholder}
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
          />
        </div>
      ) : null}
    </section>
  );
}
