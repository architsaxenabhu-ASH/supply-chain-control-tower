import { formatMoney, formatUnits } from "../../lib/currency";
import { useEffect, useMemo, useState } from "react";
import { Gauge, Globe2, Send, ShieldAlert } from "lucide-react";

import {
  fetchCommitmentDashboard,
  fetchCommitmentRisks,
  fetchCustomerCommitments,
  fetchProducts,
  type ApiCommitmentDashboard,
  type ApiCommitmentRisk,
  type ApiCustomerCommitment,
  type ApiProduct,
} from "../../lib/api";
import { useCountry } from "../../context/CountryContext";
import { FilterBar } from "../../components/FilterBar";
import { WorldMap } from "../../components/WorldMap";

// Secondary Sales workspace (Phase 5C): subsidiary → customer.
// Answers "What are we delivering to customers?" — customer POs,
// fulfillment, backorders, OTIF, and delayed deliveries. This page is
// customer commitment management, not stock management.

const num = formatUnits;

const CLOSED_STATUSES = new Set(["fulfilled", "delivered", "cancelled", "closed"]);

function humanize(value: string): string {
  const text = value.replace(/[_-]/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function riskPill(level: string): string {
  const key = level.toLowerCase();
  if (key === "critical" || key === "high") return "risk-critical";
  if (key === "medium") return "risk-medium";
  return "risk-low";
}

function isOpenCommitment(commitment: ApiCustomerCommitment): boolean {
  return !CLOSED_STATUSES.has(commitment.status.toLowerCase());
}

function isDelayed(commitment: ApiCustomerCommitment, today: string): boolean {
  return (
    isOpenCommitment(commitment) &&
    commitment.required_delivery_date < today &&
    commitment.delivered_quantity < commitment.ordered_quantity
  );
}

function commitmentTone(
  commitment: ApiCustomerCommitment,
  today: string,
): { tone: "good" | "warn" | "bad" | "info"; label: string } {
  if (isDelayed(commitment, today)) return { tone: "bad", label: "Delayed" };
  if (commitment.backorder_quantity > 0) return { tone: "warn", label: "Backordered" };
  if (!isOpenCommitment(commitment)) return { tone: "good", label: humanize(commitment.status) };
  return { tone: "info", label: humanize(commitment.status) };
}

export function SecondarySales() {
  const { country: envCountry } = useCountry();
  const [commitments, setCommitments] = useState<ApiCustomerCommitment[]>([]);
  const [dashboard, setDashboard] = useState<ApiCommitmentDashboard | null>(null);
  const [risks, setRisks] = useState<ApiCommitmentRisk[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
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
    Promise.allSettled([
      fetchCustomerCommitments(),
      fetchCommitmentDashboard(),
      fetchCommitmentRisks(),
      fetchProducts(),
    ]).then(([commitmentResult, dashboardResult, riskResult, productResult]) => {
      if (!active) return;
      if (commitmentResult.status === "fulfilled") setCommitments(commitmentResult.value);
      if (dashboardResult.status === "fulfilled") setDashboard(dashboardResult.value);
      if (riskResult.status === "fulfilled") setRisks(riskResult.value);
      if (productResult.status === "fulfilled") setProducts(productResult.value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const query = search.trim().toLowerCase();

  const verticalOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) {
      map.set(product.item_code.toLowerCase(), product.product_category || "Unclassified");
    }
    return (material: string) => map.get(material.toLowerCase()) ?? "Unclassified";
  }, [products]);

  const countryOptions = useMemo(
    () => [...new Set(commitments.map((commitment) => commitment.country).filter(Boolean))].sort(),
    [commitments],
  );
  const verticalOptions = useMemo(
    () => [...new Set(commitments.map((commitment) => verticalOf(commitment.material)))].sort(),
    [commitments, verticalOf],
  );
  const statusOptions = useMemo(
    () => [...new Set(commitments.map((commitment) => commitment.status).filter(Boolean))].sort(),
    [commitments],
  );

  const matchesExceptCountry = (commitment: ApiCustomerCommitment) => {
    if (vertical && verticalOf(commitment.material) !== vertical) return false;
    if (status && commitment.status !== status) return false;
    if (dateFrom && commitment.required_delivery_date < dateFrom) return false;
    if (dateTo && commitment.required_delivery_date > dateTo) return false;
    if (query) {
      const haystack =
        `${commitment.po_number} ${commitment.customer} ${commitment.distributor} ${commitment.material}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  };

  const filtered = useMemo(
    () =>
      commitments.filter(
        (commitment) => matchesExceptCountry(commitment) && (!countryFilter || commitment.country === countryFilter),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commitments, countryFilter, vertical, status, dateFrom, dateTo, query, verticalOf],
  );

  const openOrders = filtered.filter(isOpenCommitment);
  const delayed = filtered.filter((commitment) => isDelayed(commitment, today));
  const backordered = filtered.filter((commitment) => commitment.backorder_quantity > 0);
  const fulfilled = filtered.filter((commitment) => !isOpenCommitment(commitment));
  const backorderUnits = filtered.reduce((sum, commitment) => sum + commitment.backorder_quantity, 0);
  const orderedUnits = filtered.reduce((sum, commitment) => sum + commitment.ordered_quantity, 0);
  const deliveredUnits = filtered.reduce((sum, commitment) => sum + commitment.delivered_quantity, 0);
  const fillRate = orderedUnits > 0 ? Math.round((deliveredUnits / orderedUnits) * 100) : null;

  const inMotion = openOrders.filter(
    (commitment) => !isDelayed(commitment, today) && commitment.backorder_quantity === 0,
  );

  const posByCountry = useMemo(() => {
    const map: Record<string, number> = {};
    for (const commitment of commitments) {
      if (!matchesExceptCountry(commitment)) continue;
      if (!commitment.country) continue;
      map[commitment.country] = (map[commitment.country] ?? 0) + 1;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commitments, vertical, status, dateFrom, dateTo, query, verticalOf]);

  const urgent = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => a.required_delivery_date.localeCompare(b.required_delivery_date))
        .slice(0, 8),
    [filtered],
  );

  const serviceTone = (value: number | null) => {
    if (value === null) return "";
    if (value >= 95) return " tone-good";
    if (value >= 85) return " tone-warn";
    return " tone-bad";
  };

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
            <p className="eyebrow">Secondary Sales · {countryFilter || "all markets"} → customers</p>
            <h2>
              {filtered.length === 0
                ? "No customer commitments in this view"
                : delayed.length > 0
                  ? `${delayed.length} customer deliver${delayed.length === 1 ? "y is" : "ies are"} running late`
                  : `${openOrders.length} open order${openOrders.length === 1 ? "" : "s"} on track`}
            </h2>
          </div>
        </div>
        <div className="vitals-row">
          <div className="vital">
            <strong>{filtered.length}</strong>
            <span>Customer POs</span>
          </div>
          <div className="vital">
            <strong>{openOrders.length}</strong>
            <span>Open orders</span>
          </div>
          <div className={`vital ${backorderUnits > 0 ? "tone-warn" : ""}`}>
            <strong>{num(backorderUnits)}</strong>
            <span>Backorder units</span>
          </div>
          <div className={`vital ${delayed.length > 0 ? "tone-bad" : "tone-good"}`}>
            <strong>{delayed.length}</strong>
            <span>Delayed deliveries</span>
          </div>
          <div className={`vital${serviceTone(fillRate)}`}>
            <strong>{fillRate === null ? "—" : `${fillRate}%`}</strong>
            <span>Fill rate (filtered)</span>
          </div>
        </div>
        {filtered.length > 0 ? (
          <>
            <div
              className="seg-bar"
              role="img"
              aria-label={`${inMotion.length} on track, ${backordered.length} backordered, ${fulfilled.length} fulfilled, ${delayed.length} delayed`}
            >
              {inMotion.length > 0 ? <span className="seg-info" style={{ flexGrow: inMotion.length }} /> : null}
              {backordered.length > 0 ? <span className="seg-warn" style={{ flexGrow: backordered.length }} /> : null}
              {fulfilled.length > 0 ? <span className="seg-good" style={{ flexGrow: fulfilled.length }} /> : null}
              {delayed.length > 0 ? <span className="seg-bad" style={{ flexGrow: delayed.length }} /> : null}
            </div>
            <ul className="seg-legend">
              <li>
                <span className="seg-dot seg-info" aria-hidden="true" /> On track <strong>{inMotion.length}</strong>
              </li>
              <li>
                <span className="seg-dot seg-warn" aria-hidden="true" /> Backordered{" "}
                <strong>{backordered.length}</strong>
              </li>
              <li>
                <span className="seg-dot seg-good" aria-hidden="true" /> Fulfilled <strong>{fulfilled.length}</strong>
              </li>
              <li>
                <span className="seg-dot seg-bad" aria-hidden="true" /> Delayed <strong>{delayed.length}</strong>
              </li>
            </ul>
          </>
        ) : null}
      </section>

      <FilterBar
        dates={{ label: "Delivery", from: dateFrom, to: dateTo, onFrom: setDateFrom, onTo: setDateTo }}
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
            label: "Order status",
            value: status,
            options: statusOptions,
            allLabel: "All statuses",
            onChange: setStatus,
          },
        ]}
        search={{ value: search, placeholder: "Search PO, customer, distributor, material", onChange: setSearch }}
      />

      <div className="hub-columns">
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <Globe2 size={16} aria-hidden="true" />
              <h2>Customer POs by country</h2>
            </div>
            <span className="cc-panel-meta">{Object.keys(posByCountry).length}</span>
          </div>
          {Object.keys(posByCountry).length === 0 ? (
            <p className="empty-state">
              The map lights up as customer POs are recorded with a country. Commitments are captured from customer
              orders.
            </p>
          ) : (
            <WorldMap
              values={posByCountry}
              formatValue={(value) => `${num(value)} PO${value === 1 ? "" : "s"}`}
              caption="Customer POs by country — click a lit country to focus"
              activeCountry={countryFilter}
              onSelect={(name) => setCountryFilter(name === countryFilter ? "" : name)}
            />
          )}
        </section>
        <aside className="hub-rail">
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <Gauge size={16} aria-hidden="true" />
                <h2>Service levels</h2>
              </div>
            </div>
            <div className="score-stack">
              <div className="score-row">
                <div className="score-row-head">
                  <span>OTIF — on time, in full (all time)</span>
                  <strong>{dashboard?.otif_pct == null ? "—" : `${Math.round(dashboard.otif_pct)}%`}</strong>
                </div>
                <div className="score-row-track">
                  <div
                    className={`score-row-fill${
                      dashboard?.otif_pct == null
                        ? ""
                        : dashboard.otif_pct >= 95
                          ? " tone-good"
                          : dashboard.otif_pct >= 85
                            ? " tone-warn"
                            : " tone-bad"
                    }`}
                    style={{ width: `${Math.min(Math.max(dashboard?.otif_pct ?? 0, 0), 100)}%` }}
                  />
                </div>
              </div>
              <div className="score-row">
                <div className="score-row-head">
                  <span>Average fill rate (all time)</span>
                  <strong>
                    {dashboard?.average_fill_rate_pct == null ? "—" : `${Math.round(dashboard.average_fill_rate_pct)}%`}
                  </strong>
                </div>
                <div className="score-row-track">
                  <div
                    className={`score-row-fill${
                      dashboard?.average_fill_rate_pct == null
                        ? ""
                        : dashboard.average_fill_rate_pct >= 95
                          ? " tone-good"
                          : dashboard.average_fill_rate_pct >= 85
                            ? " tone-warn"
                            : " tone-bad"
                    }`}
                    style={{ width: `${Math.min(Math.max(dashboard?.average_fill_rate_pct ?? 0, 0), 100)}%` }}
                  />
                </div>
              </div>
            </div>
            {dashboard ? (
              <p className="access-note">
                <small>
                  {num(dashboard.open_commitments)} open · {num(dashboard.backordered_commitments)} backordered ·
                  backorder value {num(dashboard.total_backorder_value)}
                </small>
              </p>
            ) : null}
          </section>
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <ShieldAlert size={15} aria-hidden="true" />
                <h2>Commitment risk</h2>
              </div>
              <span className="cc-panel-meta">{risks.length}</span>
            </div>
            {risks.length === 0 ? (
              <p className="empty-state">No commitments are flagged. Risk appears when fulfillment falls behind.</p>
            ) : (
              <div className="worklist-body">
                {risks.slice(0, 6).map((risk) => (
                  <div className="worklist-row" key={risk.commitment_id}>
                    <div>
                      <strong>
                        {risk.po_number} · {risk.customer}
                      </strong>
                      <small>
                        {risk.material} · fill rate {Math.round(risk.fill_rate_pct)}%
                      </small>
                    </div>
                    <span className={`risk-pill ${riskPill(risk.risk_level)}`}>{humanize(risk.risk_level)}</span>
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
            <Send size={16} aria-hidden="true" />
            <h2>Most urgent customer orders</h2>
          </div>
          <span className="cc-panel-meta">{filtered.length}</span>
        </div>
        {urgent.length === 0 ? (
          <p className="empty-state">
            Customer POs appear here once commitments are recorded. This list always sorts by the nearest required
            delivery date.
          </p>
        ) : (
          <ul className="num-rows">
            {urgent.map((commitment, index) => {
              const { tone, label } = commitmentTone(commitment, today);
              return (
                <li className="num-row" key={commitment.commitment_id}>
                  <span className="num-row-index">{index + 1}</span>
                  <div className="num-row-main">
                    <strong>
                      {commitment.po_number} · {commitment.customer}
                    </strong>
                    <small>
                      {commitment.material} · due {commitment.required_delivery_date} · ordered{" "}
                      {num(commitment.ordered_quantity)} · delivered {num(commitment.delivered_quantity)}
                      {commitment.backorder_quantity > 0 ? ` · backorder ${num(commitment.backorder_quantity)}` : ""}
                    </small>
                  </div>
                  <span className={`dot-pill tone-${tone}`}>
                    <span className="seg-dot" aria-hidden="true" />
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
