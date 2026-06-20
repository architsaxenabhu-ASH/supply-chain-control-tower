import { convertAmount, formatDisplay, formatUnits, getCurrencyRevision, subscribeCurrency } from "../../lib/currency";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Boxes, Globe2, PieChart, Warehouse } from "lucide-react";

import {
  fetchCustomerCommitments,
  fetchInventoryBatches,
  fetchShipments,
  fetchWarehouses,
  type ApiCustomerCommitment,
  type ApiInventoryBatch,
  type ApiShipment,
  type ApiWarehouseLocation,
} from "../../lib/api";
import { getInjectRevision, subscribeDemo } from "../../lib/demoMode";
import { useCountry } from "../../context/CountryContext";
import { FilterBar } from "../../components/FilterBar";
import { WorldMap, type MapCity } from "../../components/WorldMap";
import { DonutChart } from "../../components/DonutChart";
import { cityCoords, cityFromLabel } from "../../lib/cityGeo";

// Inventory workspace (Phase 5C): stock and risk, not sales.
// Answers "What do we have?" — available / reserved / allocated units,
// expiry risk, inventory value, and batch drill-down. Filters: date,
// country, vertical, product, expiry band. All options come from live data.

const num = formatUnits;
// Aggregates convert each batch from its own invoice currency first, so
// `money` formats values already expressed in the display currency.
const money = (value: number) => formatDisplay(value);
const todayStamp = () => new Date().toISOString().slice(0, 10);

const EXPIRY_TONES: Record<string, "bad" | "warn" | "info" | "good"> = {
  "0-90 Days": "bad",
  "91-180 Days": "warn",
  "181-365 Days": "info",
  "Above 365 Days": "good",
};
const EXPIRY_ORDER = Object.keys(EXPIRY_TONES);

const OPEN_SHIPMENT_STATUSES = new Set(["submitted", "approved"]);
const CLOSED_COMMITMENT_STATUSES = new Set(["fulfilled", "delivered", "cancelled", "closed"]);

export function InventoryHub() {
  const { country: envCountry } = useCountry();
  // Re-run conversions whenever the currency engine changes (display currency,
  // book, or a historical rate table arriving for a batch's registration date).
  const rev = useSyncExternalStore(subscribeCurrency, getCurrencyRevision);
  // Re-pull stock when the presenter injects sample data, so freshly received
  // batches surface here just like a real goods-receipt would.
  const injectRev = useSyncExternalStore(subscribeDemo, getInjectRevision, () => 0);
  const [batches, setBatches] = useState<ApiInventoryBatch[]>([]);
  const [warehouses, setWarehouses] = useState<ApiWarehouseLocation[]>([]);
  const [shipments, setShipments] = useState<ApiShipment[]>([]);
  const [commitments, setCommitments] = useState<ApiCustomerCommitment[]>([]);
  const [loading, setLoading] = useState(true);
  // Inventory values at each batch's registration-date rate by default, with an
  // option to revalue everything at today's rate.
  const [valuation, setValuation] = useState<"registered" | "today">("registered");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [countryFilter, setCountryFilter] = useState(envCountry);
  const [vertical, setVertical] = useState("");
  const [expiryBand, setExpiryBand] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => setCountryFilter(envCountry), [envCountry]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      fetchInventoryBatches(),
      fetchWarehouses(),
      fetchShipments(),
      fetchCustomerCommitments(),
    ]).then(([batchResult, warehouseResult, shipmentResult, commitmentResult]) => {
      if (!active) return;
      if (batchResult.status === "fulfilled") setBatches(batchResult.value);
      if (warehouseResult.status === "fulfilled") setWarehouses(warehouseResult.value);
      if (shipmentResult.status === "fulfilled") setShipments(shipmentResult.value);
      if (commitmentResult.status === "fulfilled") setCommitments(commitmentResult.value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [injectRev]);

  const warehouseCountry = useMemo(() => {
    const map = new Map<string, string>();
    for (const warehouse of warehouses) {
      map.set(warehouse.warehouse_name.toLowerCase(), warehouse.country);
      map.set(warehouse.warehouse_code.toLowerCase(), warehouse.country);
    }
    return map;
  }, [warehouses]);

  const countryOf = (location: string) => warehouseCountry.get(location.toLowerCase()) ?? "";

  const countryOptions = useMemo(
    () => [...new Set(warehouses.map((warehouse) => warehouse.country).filter(Boolean))].sort(),
    [warehouses],
  );
  const verticalOptions = useMemo(
    () => [...new Set(batches.map((batch) => batch.product_category).filter(Boolean))].sort(),
    [batches],
  );
  const expiryOptions = useMemo(() => {
    const present = [...new Set(batches.map((batch) => batch.expiry_bucket).filter(Boolean))];
    return present.sort((a, b) => EXPIRY_ORDER.indexOf(a) - EXPIRY_ORDER.indexOf(b));
  }, [batches]);

  const query = search.trim().toLowerCase();

  const matchesExceptCountry = (batch: ApiInventoryBatch) => {
    if (vertical && batch.product_category !== vertical) return false;
    if (expiryBand && batch.expiry_bucket !== expiryBand) return false;
    if (dateFrom && batch.manufacturing_date < dateFrom) return false;
    if (dateTo && batch.manufacturing_date > dateTo) return false;
    if (query && !`${batch.item_code} ${batch.product_description}`.toLowerCase().includes(query)) return false;
    return true;
  };

  const filtered = useMemo(
    () =>
      batches.filter(
        (batch) =>
          matchesExceptCountry(batch) && (!countryFilter || countryOf(batch.warehouse_location) === countryFilter),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [batches, countryFilter, vertical, expiryBand, dateFrom, dateTo, query, warehouseCountry],
  );

  // Convert a batch's value: from its invoice currency, on the primary book,
  // at its registration date (or today, if revaluing). `rev` keeps the closure
  // honest as rate tables load.
  const today = todayStamp();
  const batchValue = (batch: ApiInventoryBatch): number =>
    convertAmount(batch.inventory_value, {
      from: batch.currency,
      book: "primary",
      onDate: valuation === "today" ? today : batch.registered_date,
    });
  void rev;

  const availableUnits = filtered.reduce((sum, batch) => sum + batch.quantity_available, 0);
  const inventoryValue = filtered.reduce((sum, batch) => sum + batchValue(batch), 0);
  const riskBatches = filtered.filter((batch) => batch.days_to_expiry <= 90);
  const riskValue = riskBatches.reduce((sum, batch) => sum + batchValue(batch), 0);

  const reservedUnits = useMemo(
    () =>
      shipments
        .filter((shipment) => OPEN_SHIPMENT_STATUSES.has(shipment.status))
        .filter((shipment) => !countryFilter || shipment.destination_country === countryFilter)
        .reduce(
          (sum, shipment) =>
            sum +
            shipment.lines
              .filter((line) => !query || line.item_code.toLowerCase().includes(query))
              .reduce(
                (acc, line) => acc + (line.quantity_approved > 0 ? line.quantity_approved : line.quantity_requested),
                0,
              ),
          0,
        ),
    [shipments, countryFilter, query],
  );

  const allocatedUnits = useMemo(
    () =>
      commitments
        .filter((commitment) => !CLOSED_COMMITMENT_STATUSES.has(commitment.status.toLowerCase()))
        .filter((commitment) => !countryFilter || commitment.country === countryFilter)
        .filter((commitment) => !query || commitment.material.toLowerCase().includes(query))
        .reduce((sum, commitment) => sum + commitment.allocated_quantity, 0),
    [commitments, countryFilter, query],
  );

  const valueByCountry = useMemo(() => {
    const map: Record<string, number> = {};
    for (const batch of batches) {
      if (!matchesExceptCountry(batch)) continue;
      const country = countryOf(batch.warehouse_location);
      if (!country) continue;
      map[country] = (map[country] ?? 0) + batchValue(batch);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches, vertical, expiryBand, dateFrom, dateTo, query, warehouseCountry, valuation, rev]);

  // Per-country inventory valuation split by vertical, for the map tooltip.
  const valueByCountryVertical = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const batch of batches) {
      if (!matchesExceptCountry(batch)) continue;
      const country = countryOf(batch.warehouse_location);
      if (!country) continue;
      const vert = batch.product_category?.trim() || "Unclassified";
      map[country] = map[country] ?? {};
      map[country][vert] = (map[country][vert] ?? 0) + batchValue(batch);
    }
    const details: Record<string, { label: string; value: number }[]> = {};
    for (const [country, verts] of Object.entries(map)) {
      details[country] = Object.entries(verts)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);
    }
    return details;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches, vertical, expiryBand, dateFrom, dateTo, query, warehouseCountry, valuation, rev]);

  // City-level inventory nodes — warehouses placed by their city, sized by
  // value. Real data: warehouse name → city, country from the warehouse master.
  const cityNodes = useMemo<MapCity[]>(() => {
    const agg = new Map<string, { country: string; city: string; lon: number; lat: number; value: number; volume: number }>();
    for (const batch of batches) {
      if (!matchesExceptCountry(batch)) continue;
      const country = countryOf(batch.warehouse_location);
      const cityName = cityFromLabel(batch.warehouse_location);
      const coords = cityCoords(cityName);
      if (!country || !coords) continue;
      const key = batch.warehouse_location.toLowerCase();
      const node = agg.get(key) ?? { country, city: cityName, lon: coords[0], lat: coords[1], value: 0, volume: 0 };
      node.value += batchValue(batch);
      node.volume += batch.quantity_available;
      agg.set(key, node);
    }
    return [...agg.values()].map((n) => ({
      country: n.country,
      city: n.city,
      lon: n.lon,
      lat: n.lat,
      value: n.value,
      valueLabel: money(n.value),
      volume: `${num(n.volume)} units`,
      status: "In stock",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches, vertical, expiryBand, dateFrom, dateTo, query, warehouseCountry, valuation, rev]);

  const verticalSlices = useMemo(() => {
    const map = new Map<string, number>();
    for (const batch of filtered) {
      const key = batch.product_category || "Unclassified";
      map.set(key, (map.get(key) ?? 0) + batchValue(batch));
    }
    return [...map.entries()].map(([label, value]) => ({ label, value }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, valuation, rev]);

  const warehouseRows = useMemo(() => {
    const map = new Map<string, number>();
    for (const batch of filtered) {
      map.set(batch.warehouse_location, (map.get(batch.warehouse_location) ?? 0) + batchValue(batch));
    }
    const rows = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = rows[0]?.[1] ?? 0;
    return rows.map(([name, value]) => ({
      name,
      value,
      pct: max > 0 ? Math.max(Math.round((value / max) * 100), 4) : 0,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, valuation, rev]);

  const bandCounts = EXPIRY_ORDER.map((label) => ({
    label,
    tone: EXPIRY_TONES[label],
    count: filtered.filter((batch) => batch.expiry_bucket === label).length,
  }));

  const drillRows = useMemo(
    () => [...filtered].sort((a, b) => a.days_to_expiry - b.days_to_expiry).slice(0, 30),
    [filtered],
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
            <p className="eyebrow">Inventory · {countryFilter || "all stations"}</p>
            <h2>
              {batches.length === 0
                ? "No stock on the books yet"
                : `${num(availableUnits)} units on hand · ${money(inventoryValue)}`}
            </h2>
          </div>
          <div className="lens-switch" role="tablist" aria-label="Inventory valuation rate">
            <button
              type="button"
              role="tab"
              aria-selected={valuation === "registered"}
              className={valuation === "registered" ? "lens-chip active" : "lens-chip"}
              onClick={() => setValuation("registered")}
            >
              <span>Registration rate</span>
              <small>rate on the day each batch was received</small>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={valuation === "today"}
              className={valuation === "today" ? "lens-chip active" : "lens-chip"}
              onClick={() => setValuation("today")}
            >
              <span>Today's rate</span>
              <small>revalue all stock at today's rate</small>
            </button>
          </div>
        </div>
        <div className="vitals-row">
          <div className="vital">
            <strong>{num(availableUnits)}</strong>
            <span>Available units</span>
          </div>
          <div className="vital">
            <strong>{num(reservedUnits)}</strong>
            <span>Reserved on open shipments</span>
          </div>
          <div className="vital">
            <strong>{num(allocatedUnits)}</strong>
            <span>Allocated to customer POs</span>
          </div>
          <div className={`vital ${riskBatches.length > 0 ? "tone-bad" : "tone-good"}`}>
            <strong>{riskBatches.length}</strong>
            <span>Batches within 90 days · {money(riskValue)}</span>
          </div>
          <div className="vital">
            <strong>{money(inventoryValue)}</strong>
            <span>Inventory value</span>
          </div>
        </div>
        {filtered.length > 0 ? (
          <>
            <div
              className="seg-bar"
              role="img"
              aria-label={bandCounts.map((band) => `${band.label}: ${band.count}`).join(", ")}
            >
              {bandCounts
                .filter((band) => band.count > 0)
                .map((band) => (
                  <span key={band.label} className={`seg-${band.tone}`} style={{ flexGrow: band.count }} />
                ))}
            </div>
            <ul className="seg-legend">
              {bandCounts.map((band) => (
                <li key={band.label}>
                  <span className={`seg-dot seg-${band.tone}`} aria-hidden="true" /> {band.label}{" "}
                  <strong>{band.count}</strong>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <FilterBar
        dates={{ label: "Mfg", from: dateFrom, to: dateTo, onFrom: setDateFrom, onTo: setDateTo }}
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
            id: "expiry",
            label: "Expiry",
            value: expiryBand,
            options: expiryOptions,
            allLabel: "All bands",
            onChange: setExpiryBand,
          },
        ]}
        search={{ value: search, placeholder: "Search product or material code", onChange: setSearch }}
      />

      <div className="hub-columns">
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <Globe2 size={16} aria-hidden="true" />
              <h2>Stock by country</h2>
            </div>
            <span className="cc-panel-meta">{Object.keys(valueByCountry).length}</span>
          </div>
          <WorldMap
            values={valueByCountry}
            details={valueByCountryVertical}
            cities={cityNodes}
            formatValue={money}
            caption={
              Object.keys(valueByCountry).length === 0
                ? "No stock positioned yet — the map shows zero; it lights up as warehouses are linked to countries"
                : "Inventory value by country — click a country to zoom in and see warehouse cities; hover for detail"
            }
            activeCountry={countryFilter}
            onSelect={(name) => setCountryFilter(name === countryFilter ? "" : name)}
          />
        </section>
        <aside className="hub-rail">
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <PieChart size={16} aria-hidden="true" />
                <h2>Value by vertical</h2>
              </div>
              <span className="cc-panel-meta">{verticalSlices.length}</span>
            </div>
            <DonutChart slices={verticalSlices} centerLabel="Stock value" formatValue={money} />
          </section>
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <Warehouse size={16} aria-hidden="true" />
                <h2>Warehouses</h2>
              </div>
              <span className="cc-panel-meta">{warehouseRows.length}</span>
            </div>
            {warehouseRows.length === 0 ? (
              <p className="empty-state">No warehouse stock in this view.</p>
            ) : (
              <div className="score-stack">
                {warehouseRows.map((row) => (
                  <div className="score-row" key={row.name}>
                    <div className="score-row-head">
                      <span>{row.name}</span>
                      <strong>{money(row.value)}</strong>
                    </div>
                    <div className="score-row-track">
                      <div className="score-row-fill" style={{ width: `${row.pct}%` }} />
                    </div>
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
            <Boxes size={16} aria-hidden="true" />
            <h2>Batch drill-down</h2>
          </div>
          <span className="cc-panel-meta">{filtered.length}</span>
        </div>
        {filtered.length === 0 ? (
          <p className="empty-state">
            No batches match these filters. Stock appears here once goods receipts post inventory.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Description</th>
                <th>Batch</th>
                <th>Warehouse</th>
                <th>Qty</th>
                <th>Value</th>
                <th>Expiry</th>
                <th>Band</th>
              </tr>
            </thead>
            <tbody>
              {drillRows.map((batch) => {
                const tone = EXPIRY_TONES[batch.expiry_bucket] ?? "info";
                return (
                  <tr key={`${batch.item_code}-${batch.batch_number}-${batch.warehouse_location}`}>
                    <td>{batch.item_code}</td>
                    <td>{batch.product_description}</td>
                    <td>{batch.batch_number}</td>
                    <td>{batch.warehouse_location}</td>
                    <td>{num(batch.quantity_available)}</td>
                    <td>{money(batchValue(batch))}</td>
                    <td>{batch.expiry_date}</td>
                    <td>
                      <span className={`dot-pill tone-${tone === "info" ? "info" : tone}`}>
                        <span className="seg-dot" aria-hidden="true" />
                        {batch.expiry_bucket || "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
