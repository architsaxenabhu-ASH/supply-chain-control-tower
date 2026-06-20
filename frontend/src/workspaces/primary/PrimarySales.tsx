import { convertAmount, formatDisplay, formatIn, formatUnits, getCurrencyRevision, subscribeCurrency } from "../../lib/currency";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AlertTriangle, FileCheck2, Globe2, MoveRight, PlaneLanding } from "lucide-react";

import {
  fetchImportCandidates,
  listDocuments,
  type ApiImportFileCandidate,
} from "../../lib/api";
import type { DocumentRecord } from "../../types/domain";
import { getInjectRevision, subscribeDemo } from "../../lib/demoMode";
import { useCountry } from "../../context/CountryContext";
import { FilterBar } from "../../components/FilterBar";
import { WorldMap } from "../../components/WorldMap";

// Primary Sales workspace (Phase 5C): Meril India → subsidiary.
// Answers "What are we receiving from Meril India?" — import shipments,
// their documents (CI / PL / AWB), open and overdue arrivals, and the
// movement from origin to destination country.

const num = formatUnits;

const RECEIVED_STATUSES = new Set(["received", "closed"]);
const AWAITING_STATUSES = new Set(["arrived", "goods_receipt_pending"]);
const CANCELLED_STATUSES = new Set(["cancelled", "rejected"]);

function humanize(value: string): string {
  const text = value.replace(/[_-]/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function statusTone(status: string): "good" | "warn" | "bad" | "info" {
  const key = status.toLowerCase();
  if (RECEIVED_STATUSES.has(key)) return "good";
  if (AWAITING_STATUSES.has(key)) return "warn";
  if (CANCELLED_STATUSES.has(key)) return "bad";
  return "info";
}

function dateOf(candidate: ApiImportFileCandidate): string {
  return candidate.invoice_date ?? candidate.flight_date ?? "";
}

function isOpen(candidate: ApiImportFileCandidate): boolean {
  const key = candidate.status.toLowerCase();
  return !RECEIVED_STATUSES.has(key) && !CANCELLED_STATUSES.has(key);
}

function isOverdue(candidate: ApiImportFileCandidate, today: string): boolean {
  return isOpen(candidate) && Boolean(candidate.flight_date) && (candidate.flight_date as string) < today;
}

export function PrimarySales() {
  const { country: envCountry } = useCountry();
  const rev = useSyncExternalStore(subscribeCurrency, getCurrencyRevision);
  const injectRev = useSyncExternalStore(subscribeDemo, getInjectRevision, () => 0);
  const [candidates, setCandidates] = useState<ApiImportFileCandidate[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [countryFilter, setCountryFilter] = useState(envCountry);
  const [vertical, setVertical] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => setCountryFilter(envCountry), [envCountry]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([fetchImportCandidates(), listDocuments()]).then(([candidateResult, documentResult]) => {
      if (!active) return;
      if (candidateResult.status === "fulfilled") setCandidates(candidateResult.value);
      if (documentResult.status === "fulfilled") setDocuments(documentResult.value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [injectRev]);

  const today = new Date().toISOString().slice(0, 10);
  const query = search.trim().toLowerCase();

  const countryOptions = useMemo(
    () => [...new Set(candidates.map((candidate) => candidate.destination_country).filter(Boolean))].sort(),
    [candidates],
  );
  const verticalOptions = useMemo(
    () =>
      [...new Set(candidates.map((candidate) => candidate.shipment_vertical ?? "").filter(Boolean))].sort(),
    [candidates],
  );
  const statusOptions = useMemo(
    () => [...new Set(candidates.map((candidate) => candidate.status).filter(Boolean))].sort(),
    [candidates],
  );

  const matchesExceptCountry = (candidate: ApiImportFileCandidate) => {
    if (vertical && (candidate.shipment_vertical ?? "") !== vertical) return false;
    if (status && candidate.status !== status) return false;
    const when = dateOf(candidate);
    if (dateFrom && (!when || when < dateFrom)) return false;
    if (dateTo && (!when || when > dateTo)) return false;
    if (query) {
      const haystack = [
        candidate.shipment_name,
        candidate.import_file_number,
        candidate.supplier_name,
        candidate.awb_number,
        candidate.invoice_number,
        ...candidate.invoice_numbers,
        ...candidate.lines.map((line) => `${line.item_code} ${line.product_description}`),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  };

  const filtered = useMemo(
    () =>
      candidates.filter(
        (candidate) =>
          matchesExceptCountry(candidate) && (!countryFilter || candidate.destination_country === countryFilter),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidates, countryFilter, vertical, status, dateFrom, dateTo, query],
  );

  const received = filtered.filter((candidate) => RECEIVED_STATUSES.has(candidate.status.toLowerCase()));
  const awaiting = filtered.filter((candidate) => AWAITING_STATUSES.has(candidate.status.toLowerCase()));
  const overdue = filtered.filter((candidate) => isOverdue(candidate, today));
  const inMotion = filtered.filter(
    (candidate) =>
      isOpen(candidate) &&
      !AWAITING_STATUSES.has(candidate.status.toLowerCase()) &&
      !isOverdue(candidate, today),
  );

  const ciDocs = filtered.reduce((sum, candidate) => sum + candidate.commercial_invoice_document_ids.length, 0);
  const plDocs = filtered.reduce((sum, candidate) => sum + candidate.packing_list_document_ids.length, 0);
  const awbDocs = filtered.filter((candidate) => candidate.awb_document_id).length;

  const shipmentsByCountry = useMemo(() => {
    const map: Record<string, number> = {};
    for (const candidate of candidates) {
      if (!matchesExceptCountry(candidate)) continue;
      const country = candidate.destination_country;
      if (!country) continue;
      map[country] = (map[country] ?? 0) + 1;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, vertical, status, dateFrom, dateTo, query]);

  // Per-country shipment breakdown by vertical, for the map hover tooltip.
  const shipmentsByCountryVertical = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const candidate of candidates) {
      if (!matchesExceptCountry(candidate)) continue;
      const country = candidate.destination_country;
      if (!country) continue;
      const vert = candidate.shipment_vertical?.trim() || "Unspecified";
      map[country] = map[country] ?? {};
      map[country][vert] = (map[country][vert] ?? 0) + 1;
    }
    const details: Record<string, { label: string; value: number }[]> = {};
    for (const [country, verts] of Object.entries(map)) {
      details[country] = Object.entries(verts)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);
    }
    return details;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, vertical, status, dateFrom, dateTo, query]);

  const latest = useMemo(
    () => [...filtered].sort((a, b) => (dateOf(b) || "").localeCompare(dateOf(a) || "")).slice(0, 8),
    [filtered],
  );

  const libraryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const document of documents) {
      counts[document.document_type] = (counts[document.document_type] ?? 0) + 1;
    }
    return counts;
  }, [documents]);

  // Invoice value grouped by the currency captured from each uploaded
  // invoice — Meril India bills subsidiaries in different currencies.
  const valueByCurrency = useMemo(() => {
    const map = new Map<string, number>();
    for (const candidate of filtered) {
      for (const line of candidate.lines) {
        const value = (line.unit_value ?? 0) * line.quantity;
        if (value <= 0) continue;
        const code = line.currency ? line.currency.toUpperCase() : "UNSPECIFIED";
        map.set(code, (map.get(code) ?? 0) + value);
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  // Total converts each invoice line at the primary-book rate locked for that
  // shipment's invoice date.
  const convertedInvoiceTotal = useMemo(
    () => {
      let sum = 0;
      for (const candidate of filtered) {
        for (const line of candidate.lines) {
          const value = (line.unit_value ?? 0) * line.quantity;
          if (value <= 0) continue;
          sum += convertAmount(value, {
            from: line.currency,
            book: "primary",
            onDate: candidate.invoice_date,
          });
        }
      }
      return sum;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, rev],
  );

  if (loading) {
    return (
      <div className="cc-loading" aria-busy="true">
        <div className="skeleton-row tall" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </div>
    );
  }

  return (
    <div className="ops-stage">
      <section className="cockpit-hero">
        <div className="cockpit-hero-top">
          <div>
            <p className="eyebrow">Primary Sales · Origin → {countryFilter || "all subsidiaries"}</p>
            <h2>
              {filtered.length === 0
                ? "No import shipments in this view"
                : overdue.length > 0
                  ? `${overdue.length} arrival${overdue.length === 1 ? "" : "s"} overdue out of ${filtered.length} shipments`
                  : `${filtered.length - received.length} of ${filtered.length} shipments still moving`}
            </h2>
          </div>
        </div>
        <div className="vitals-row">
          <div className="vital">
            <strong>{filtered.length}</strong>
            <span>Import shipments</span>
          </div>
          <div className="vital">
            <strong>{inMotion.length}</strong>
            <span>In motion</span>
          </div>
          <div className={`vital ${awaiting.length > 0 ? "tone-warn" : ""}`}>
            <strong>{awaiting.length}</strong>
            <span>Awaiting receipt</span>
          </div>
          <div className={`vital ${overdue.length > 0 ? "tone-bad" : "tone-good"}`}>
            <strong>{overdue.length}</strong>
            <span>Overdue arrivals</span>
          </div>
          <div className="vital tone-good">
            <strong>{received.length}</strong>
            <span>Received</span>
          </div>
        </div>
        {filtered.length > 0 ? (
          <>
            <div
              className="seg-bar"
              role="img"
              aria-label={`${inMotion.length} in motion, ${awaiting.length} awaiting receipt, ${received.length} received, ${overdue.length} overdue`}
            >
              {inMotion.length > 0 ? <span className="seg-info" style={{ flexGrow: inMotion.length }} /> : null}
              {awaiting.length > 0 ? <span className="seg-warn" style={{ flexGrow: awaiting.length }} /> : null}
              {received.length > 0 ? <span className="seg-good" style={{ flexGrow: received.length }} /> : null}
              {overdue.length > 0 ? <span className="seg-bad" style={{ flexGrow: overdue.length }} /> : null}
            </div>
            <ul className="seg-legend">
              <li>
                <span className="seg-dot seg-info" aria-hidden="true" /> In motion <strong>{inMotion.length}</strong>
              </li>
              <li>
                <span className="seg-dot seg-warn" aria-hidden="true" /> Awaiting receipt{" "}
                <strong>{awaiting.length}</strong>
              </li>
              <li>
                <span className="seg-dot seg-good" aria-hidden="true" /> Received <strong>{received.length}</strong>
              </li>
              <li>
                <span className="seg-dot seg-bad" aria-hidden="true" /> Overdue <strong>{overdue.length}</strong>
              </li>
            </ul>
          </>
        ) : null}
      </section>

      <FilterBar
        dates={{ label: "Invoice", from: dateFrom, to: dateTo, onFrom: setDateFrom, onTo: setDateTo }}
        selects={[
          {
            id: "country",
            label: "Country",
            value: countryFilter,
            options: countryOptions,
            allLabel: "All countries",
            onChange: setCountryFilter,
          },
          {
            id: "vertical",
            label: "Vertical",
            value: vertical,
            options: verticalOptions,
            allLabel: "All verticals",
            onChange: setVertical,
          },
          {
            id: "status",
            label: "Shipment status",
            value: status,
            options: statusOptions,
            allLabel: "All statuses",
            onChange: setStatus,
          },
        ]}
        search={{ value: search, placeholder: "Search shipment, supplier, AWB, invoice, product", onChange: setSearch }}
      />

      <div className="hub-columns">
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <Globe2 size={16} aria-hidden="true" />
              <h2>Imports by destination</h2>
            </div>
            <span className="cc-panel-meta">{Object.keys(shipmentsByCountry).length}</span>
          </div>
          <WorldMap
            values={shipmentsByCountry}
            details={shipmentsByCountryVertical}
            formatValue={(value) => `${num(value)} shipment${value === 1 ? "" : "s"}`}
            caption={
              Object.keys(shipmentsByCountry).length === 0
                ? "No import movement yet — the map shows zero; it lights up as shipments are assembled with a destination country"
                : "Import shipments by destination — hover for the vertical split, click to focus"
            }
            activeCountry={countryFilter}
            onSelect={(name) => setCountryFilter(name === countryFilter ? "" : name)}
          />
        </section>
        <aside className="hub-rail">
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <FileCheck2 size={16} aria-hidden="true" />
                <h2>Document coverage</h2>
              </div>
            </div>
            <div className="vitals-row">
              <div className="vital">
                <strong>{ciDocs}</strong>
                <span>Commercial invoices</span>
              </div>
              <div className="vital">
                <strong>{plDocs}</strong>
                <span>Packing lists</span>
              </div>
              <div className="vital">
                <strong>{awbDocs}</strong>
                <span>AWB linked</span>
              </div>
            </div>
            {valueByCurrency.length > 0 ? (
              <div className="score-stack">
                {valueByCurrency.map(([code, value]) => (
                  <div className="score-row-head" key={code}>
                    <span>{code === "UNSPECIFIED" ? "No currency on invoice" : `${code} invoices`}</span>
                    <strong>{code === "UNSPECIFIED" ? num(value) : formatIn(code, value)}</strong>
                  </div>
                ))}
                <div className="score-row-head">
                  <span>Total at locked rate</span>
                  <strong>{formatDisplay(convertedInvoiceTotal)}</strong>
                </div>
              </div>
            ) : null}
            <p className="access-note">
              <small>
                Library holds {documents.length} uploaded document{documents.length === 1 ? "" : "s"}
                {Object.keys(libraryCounts).length > 0
                  ? ` (${Object.entries(libraryCounts)
                      .map(([type, count]) => `${count} ${humanize(type)}`)
                      .join(", ")})`
                  : ""}
                .
              </small>
            </p>
          </section>
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <AlertTriangle size={15} aria-hidden="true" />
                <h2>Overdue arrivals</h2>
              </div>
              <span className="cc-panel-meta">{overdue.length}</span>
            </div>
            {overdue.length === 0 ? (
              <p className="empty-state">Nothing overdue. Shipments appear here when the flight date passes without a goods receipt.</p>
            ) : (
              <div className="worklist-body">
                {overdue.slice(0, 6).map((candidate) => (
                  <div className="worklist-row" key={candidate.import_file_number}>
                    <div>
                      <strong>{candidate.shipment_name ?? candidate.import_file_number}</strong>
                      <small>
                        Flew {candidate.flight_date} · {humanize(candidate.status)}
                      </small>
                    </div>
                    <span className="risk-pill risk-high">Overdue</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>

      <section className="panel cockpit-panel">
        <div className="panel-heading">
          <div className="worklist-title">
            <PlaneLanding size={16} aria-hidden="true" />
            <h2>Latest import shipments</h2>
          </div>
          <span className="cc-panel-meta">{filtered.length}</span>
        </div>
        {latest.length === 0 ? (
          <p className="empty-state">
            Import shipments appear here once documents are assembled in Import Validation. Upload a commercial
            invoice, packing list, or AWB to begin.
          </p>
        ) : (
          <ul className="num-rows">
            {latest.map((candidate, index) => (
              <li className="num-row" key={candidate.import_file_number}>
                <span className="num-row-index">{index + 1}</span>
                <div className="num-row-main">
                  <strong>{candidate.shipment_name ?? candidate.import_file_number}</strong>
                  <small className="num-row-route">
                    {candidate.origin_country ?? "Origin pending"}
                    <MoveRight size={13} aria-hidden="true" />
                    {candidate.destination_country}
                    {candidate.supplier_name ? <> · {candidate.supplier_name}</> : null}
                    {candidate.awb_number ? <> · AWB {candidate.awb_number}</> : null}
                  </small>
                </div>
                <span className={`dot-pill tone-${statusTone(candidate.status)}`}>
                  <span className="seg-dot" aria-hidden="true" />
                  {humanize(candidate.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
