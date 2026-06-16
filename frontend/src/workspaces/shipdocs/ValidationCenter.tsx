import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ClipboardCheck, Filter, Search, ShieldCheck } from "lucide-react";

import {
  fetchImportCandidates,
  listSecondaryShipments,
  type ApiImportFileCandidate,
  type ApiSecondaryShipment,
} from "../../lib/api";
import { useCountry } from "../../context/CountryContext";

// Validation Center (Phase 6C, item C). One country-filtered queue of everything
// waiting for a validator — inbound (import) and outbound (customer) shipments
// together. Opening a row jumps to the right validation screen. The country
// filter applies everywhere, defaulting to the operating environment.

const PRIMARY_PENDING = new Set(["validation_pending", "pending", "draft"]);

type Lane = "all" | "inbound" | "outbound";

type Row = {
  id: string;
  name: string;
  country: string;
  lane: "inbound" | "outbound";
  documents: number;
  uploadedBy: string;
  date: string;
  status: string;
  view: string;
};

function humanizeStatus(status: string): string {
  return status.replace(/[_-]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function ValidationCenter({ onNavigate }: { onNavigate: (view: string) => void }) {
  const { country: envCountry } = useCountry();
  const [candidates, setCandidates] = useState<ApiImportFileCandidate[]>([]);
  const [secondary, setSecondary] = useState<ApiSecondaryShipment[]>([]);
  const [loading, setLoading] = useState(true);

  const [lane, setLane] = useState<Lane>("all");
  const [countryFilter, setCountryFilter] = useState(envCountry);
  const [search, setSearch] = useState("");

  useEffect(() => setCountryFilter(envCountry), [envCountry]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([fetchImportCandidates(), listSecondaryShipments()]).then(([c, s]) => {
      if (!active) return;
      if (c.status === "fulfilled") setCandidates(c.value);
      if (s.status === "fulfilled") setSecondary(s.value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo<Row[]>(() => {
    const inbound: Row[] = candidates
      .filter((c) => PRIMARY_PENDING.has(c.status.toLowerCase()))
      .map((c) => ({
        id: c.import_file_number,
        name: c.shipment_name ?? c.import_file_number,
        country: c.destination_country,
        lane: "inbound",
        documents: c.commercial_invoice_document_ids.length + c.packing_list_document_ids.length + (c.awb_document_id ? 1 : 0),
        uploadedBy: "—",
        date: c.invoice_date ?? "—",
        status: c.status,
        view: "doc-primary-validate",
      }));
    const outbound: Row[] = secondary
      .filter((s) => s.status === "pending_validation")
      .map((s) => ({
        id: s.shipment_id,
        name: s.customer,
        country: s.country,
        lane: "outbound",
        documents: s.documents.length,
        uploadedBy: s.uploaded_by ?? "—",
        date: (s.uploaded_at ?? "").slice(0, 10) || "—",
        status: s.status,
        view: "doc-secondary-validate",
      }));
    return [...inbound, ...outbound];
  }, [candidates, secondary]);

  const countries = useMemo(() => [...new Set(rows.map((r) => r.country).filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (lane !== "all" && r.lane !== lane) return false;
      if (countryFilter && r.country.toLowerCase() !== countryFilter.toLowerCase()) return false;
      if (term && !`${r.name} ${r.id} ${r.country}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, lane, countryFilter, search]);

  if (loading) {
    return (
      <div className="cc-loading" aria-busy="true">
        <div className="skeleton-row tall" />
        <div className="skeleton-row" />
      </div>
    );
  }

  return (
    <div className="ops-stage">
      <section className="cockpit-hero">
        <div className="cockpit-hero-top">
          <div>
            <p className="eyebrow">Validation Center</p>
            <h2>{filtered.length === 0 ? "Nothing waiting for validation" : `${filtered.length} shipment${filtered.length === 1 ? "" : "s"} waiting`}</h2>
            <p className="dash-story">
              Every shipment that needs a validator, inbound and outbound, in one place. Filter by country, open one,
              check it, approve or send it back. Nothing reaches inventory, sales, or analytics until it's validated.
            </p>
          </div>
        </div>
      </section>

      <div className="vc-controls">
        <div className="uc-seg" role="tablist" aria-label="Direction">
          {(["all", "inbound", "outbound"] as Lane[]).map((l) => (
            <button key={l} type="button" role="tab" aria-selected={lane === l} className={`uc-seg-btn${lane === l ? " active" : ""}`} onClick={() => setLane(l)}>
              {l === "all" ? "All" : l === "inbound" ? "Inbound" : "Outbound"}
            </button>
          ))}
        </div>
        <label className="vc-field">
          <Filter size={14} aria-hidden="true" />
          <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} aria-label="Country">
            <option value="">All countries</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="vc-field vc-search">
          <Search size={14} aria-hidden="true" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search shipment, customer, country" />
        </label>
      </div>

      <section className="panel cockpit-panel">
        <div className="panel-heading">
          <div className="worklist-title"><ClipboardCheck size={16} aria-hidden="true" /><h2>Validation queue</h2></div>
          <span className="cc-panel-meta">{filtered.length}</span>
        </div>
        {filtered.length === 0 ? (
          <p className="empty-state">Nothing pending for this filter. Shipments saved in the Upload Center appear here.</p>
        ) : (
          <div className="vc-table">
            <div className="vc-row vc-head">
              <span>Shipment</span><span>Country</span><span>Direction</span><span>Docs</span><span>Uploaded</span><span>Status</span><span aria-hidden="true" />
            </div>
            {filtered.map((r) => (
              <button key={`${r.lane}-${r.id}`} type="button" className="vc-row vc-item" onClick={() => onNavigate(r.view)}>
                <span className="vc-name">{r.name}<small>{r.id}</small></span>
                <span>{r.country}</span>
                <span className={`vc-lane ${r.lane}`}>{r.lane === "inbound" ? "Inbound" : "Outbound"}</span>
                <span>{r.documents}</span>
                <span className="vc-muted">{r.date}{r.uploadedBy !== "—" ? ` · ${r.uploadedBy}` : ""}</span>
                <span className="dot-pill tone-warn"><span className="seg-dot" aria-hidden="true" />{humanizeStatus(r.status)}</span>
                <ArrowUpRight size={15} aria-hidden="true" className="vc-go" />
              </button>
            ))}
          </div>
        )}
        <p className="access-note"><ShieldCheck size={13} aria-hidden="true" /> <small>Opening a shipment takes you to its validation screen — check the documents and data, then approve or send back.</small></p>
      </section>
    </div>
  );
}
