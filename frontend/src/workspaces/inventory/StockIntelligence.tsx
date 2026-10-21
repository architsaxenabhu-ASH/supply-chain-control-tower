import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Activity, AlertTriangle, ChevronDown, Info } from "lucide-react";

import {
  fetchInventoryIntelligence,
  type ApiClassBucket,
  type ApiInventoryIntelligence,
  type ApiSkuIntelligence,
} from "../../lib/api";
import {
  convertAmount,
  formatDisplay,
  formatUnits,
  getCurrencyRevision,
  subscribeCurrency,
} from "../../lib/currency";
import { getInjectRevision, subscribeDemo } from "../../lib/demoMode";

// Stock Intelligence (healthcare inventory analysis).
// A plain-language read on six questions a medical-device business actually
// asks of its stock: where the money sits (ABC), what is medically important
// (VED), what moves (FSN), how predictable demand is (XYZ), what may expire
// (FEFO), and when to reorder (reorder point + safety stock) — combined into a
// single Priority Score per item. All numbers come from the backend, which
// recomputes them live from current stock, demand and receipts, so this panel
// moves with the data flow (including demo sample-data injection).

const today = new Date().toISOString().slice(0, 10);
const num = formatUnits;

// Backend values arrive in base currency; convert to the chosen display
// currency just like the rest of the inventory page.
const toDisplay = (value: number) => convertAmount(value, { book: "primary", onDate: today });
const money = (value: number) => formatDisplay(toDisplay(value));

const ABC_TONE: Record<string, string> = { A: "tone-accent", B: "tone-info", C: "tone-muted" };
const VED_TONE: Record<string, string> = { Vital: "tone-bad", Essential: "tone-warn", Desirable: "tone-muted" };
const FSN_TONE: Record<string, string> = { Fast: "tone-good", Slow: "tone-info", "Non-moving": "tone-warn" };
const XYZ_TONE: Record<string, string> = { X: "tone-good", Y: "tone-info", Z: "tone-warn" };
const SEV_TONE: Record<string, string> = { high: "tone-bad", medium: "tone-warn", low: "tone-muted" };

function ClassCard({ title, hint, buckets, tones }: {
  title: string;
  hint: string;
  buckets: ApiClassBucket[];
  tones: Record<string, string>;
}) {
  return (
    <div className="si-class-card">
      <div className="si-class-head">
        <strong>{title}</strong>
        <span>{hint}</span>
      </div>
      <ul className="si-class-list">
        {buckets.map((bucket) => (
          <li key={bucket.key}>
            <span className={`si-dot ${tones[bucket.key] ?? "tone-muted"}`} aria-hidden="true" />
            <span className="si-class-label">{bucket.label}</span>
            <strong>{bucket.count}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Badges({ sku }: { sku: ApiSkuIntelligence }) {
  return (
    <div className="si-badges">
      <span className={`si-badge ${ABC_TONE[sku.abc_class]}`} title="ABC — value">{sku.abc_class}</span>
      <span className={`si-badge ${VED_TONE[sku.criticality]}`} title={`Medical importance — ${sku.criticality_basis}`}>
        {sku.criticality[0]}
      </span>
      <span className={`si-badge ${FSN_TONE[sku.fsn_class]}`} title={`Movement — ${sku.fsn_class}`}>
        {sku.fsn_class === "Non-moving" ? "N" : sku.fsn_class[0]}
      </span>
      <span className={`si-badge ${XYZ_TONE[sku.xyz_class]}`} title="Demand predictability">{sku.xyz_class}</span>
    </div>
  );
}

export function StockIntelligence() {
  // Re-render on display-currency change; re-fetch on sample-data injection.
  const rev = useSyncExternalStore(subscribeCurrency, getCurrencyRevision);
  const injectRev = useSyncExternalStore(subscribeDemo, getInjectRevision, () => 0);
  void rev;

  const [data, setData] = useState<ApiInventoryIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMethod, setShowMethod] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchInventoryIntelligence()
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [injectRev]);

  const topSkus = useMemo(() => (data ? data.skus.slice(0, 12) : []), [data]);

  if (loading && !data) {
    return (
      <section className="panel cockpit-panel">
        <div className="panel-heading">
          <div className="worklist-title">
            <Activity size={16} aria-hidden="true" />
            <h2>Stock intelligence</h2>
          </div>
        </div>
        <div className="cc-loading" aria-busy="true">
          <div className="skeleton-row tall" />
          <div className="skeleton-row" />
        </div>
      </section>
    );
  }

  if (!data || data.skus.length === 0) {
    return (
      <section className="panel cockpit-panel">
        <div className="panel-heading">
          <div className="worklist-title">
            <Activity size={16} aria-hidden="true" />
            <h2>Stock intelligence</h2>
          </div>
        </div>
        <p className="empty-state">
          Analysis appears here once stock is on the books. It updates automatically as goods are received and shipped.
        </p>
      </section>
    );
  }

  const m = data.owner_metrics;
  const liveCount = data.methods.filter((method) => method.status === "live").length;

  const ownerCards: { label: string; value: string; hint: string; tone?: string }[] = [
    { label: "Inventory value", value: money(m.inventory_value), hint: "Total money tied up in stock" },
    {
      label: "Critical stockout risk",
      value: String(m.critical_stockout_count),
      hint: m.critical_stockout_count > 0 ? `Vital/Essential below reorder · ${money(m.critical_stockout_value)}` : "No critical item below reorder",
      tone: m.critical_stockout_count > 0 ? "tone-bad" : "tone-good",
    },
    {
      label: "Expiry risk value",
      value: money(m.expiry_risk_value),
      hint: "Stock likely to expire before it is used",
      tone: m.expiry_risk_value > 0 ? "tone-warn" : "tone-good",
    },
    {
      label: "Dead stock value",
      value: money(m.dead_stock_value),
      hint: "Value of non-moving stock",
      tone: m.dead_stock_value > 0 ? "tone-warn" : "tone-good",
    },
    {
      label: "Fill rate",
      value: m.fill_rate === null ? "—" : `${Math.round(m.fill_rate * 100)}%`,
      hint: "Demand met without a stockout",
    },
    {
      label: "Inventory turnover",
      value: m.inventory_turnover === null ? "—" : `${m.inventory_turnover}×`,
      hint: "How many times stock cycles a year",
    },
    {
      label: "Days of inventory",
      value: m.days_of_inventory === null ? "—" : num(m.days_of_inventory),
      hint: "How long current stock would last",
    },
    {
      label: "Supplier delay risk",
      value: String(m.supplier_delay_risk_count),
      hint: "Items with a supply concern",
      tone: m.supplier_delay_risk_count > 0 ? "tone-warn" : "tone-good",
    },
  ];

  return (
    <section className="panel cockpit-panel si-panel">
      <div className="panel-heading">
        <div className="worklist-title">
          <Activity size={16} aria-hidden="true" />
          <h2>Stock intelligence</h2>
        </div>
        <button
          type="button"
          className={`si-how${showMethod ? " is-open" : ""}`}
          aria-expanded={showMethod}
          onClick={() => setShowMethod((open) => !open)}
        >
          <Info size={14} aria-hidden="true" />
          How this is calculated
          <ChevronDown size={14} aria-hidden="true" className="si-how-chev" />
        </button>
      </div>
      <p className="si-sub">
        Beyond “stock minus sales” — money (ABC), medical importance (VED), movement (FSN), demand
        predictability (XYZ), expiry (FEFO) and reorder safety, in one place. Updates live as stock moves.
      </p>

      {showMethod ? (
        <div className="si-method">
          <div className="si-assumptions">
            {Object.entries(data.assumptions).map(([key, value]) => (
              <div key={key} className="si-assume">
                <span>{key.replace(/_/g, " ")}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="si-method-table" role="table" aria-label="Methods used">
            {data.methods.map((method) => (
              <div className="si-method-row" role="row" key={method.key}>
                <span className={`si-method-status ${method.status === "live" ? "is-live" : "is-pending"}`}>
                  {method.status === "live" ? "Live" : "Next"}
                </span>
                <div className="si-method-main">
                  <strong>{method.plain_title}</strong>
                  <span className="si-method-name">{method.name}</span>
                  <span className="si-method-tell">{method.what_it_tells_you}</span>
                  {method.note ? <span className="si-method-note">{method.note}</span> : null}
                </div>
              </div>
            ))}
          </div>
          <p className="si-foot">
            {data.currency_note} {liveCount} of {data.methods.length} methods are live now; the rest activate as more data is captured.
          </p>
        </div>
      ) : null}

      <div className="si-metric-grid">
        {ownerCards.map((card) => (
          <div className={`si-metric ${card.tone ?? ""}`} key={card.label}>
            <strong>{card.value}</strong>
            <span className="si-metric-label">{card.label}</span>
            <span className="si-metric-hint">{card.hint}</span>
          </div>
        ))}
      </div>

      <div className="si-class-grid">
        <ClassCard title="Where the money sits" hint="ABC" buckets={data.abc_breakdown} tones={ABC_TONE} />
        <ClassCard title="Medical importance" hint="VED" buckets={data.ved_breakdown} tones={VED_TONE} />
        <ClassCard title="How fast it moves" hint="FSN" buckets={data.fsn_breakdown} tones={FSN_TONE} />
        <ClassCard title="Demand predictability" hint="XYZ" buckets={data.xyz_breakdown} tones={XYZ_TONE} />
      </div>

      {data.alerts.length > 0 ? (
        <div className="si-alerts">
          <div className="si-alerts-head">
            <AlertTriangle size={15} aria-hidden="true" />
            <strong>Action list</strong>
            <span>{data.alerts.length} item{data.alerts.length === 1 ? "" : "s"} need attention</span>
          </div>
          <ul>
            {data.alerts.slice(0, 8).map((alert, index) => (
              <li key={`${alert.kind}-${alert.item_code}-${alert.batch_number ?? index}`} className="si-alert">
                <span className={`si-dot ${SEV_TONE[alert.severity]}`} aria-hidden="true" />
                <div className="si-alert-body">
                  <strong>{alert.title}</strong>
                  <span>{alert.detail}</span>
                </div>
                <span className="si-alert-action">{alert.action}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="si-table-wrap">
        <table className="si-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Class</th>
              <th>On hand</th>
              <th>Reorder pt</th>
              <th>Expiry risk</th>
              <th>Priority</th>
              <th>Recommended action</th>
            </tr>
          </thead>
          <tbody>
            {topSkus.map((sku) => (
              <tr key={sku.item_code} className={sku.below_reorder ? "si-row-flag" : ""}>
                <td>
                  <div className="si-item">
                    <strong>{sku.item_code}</strong>
                    <span>{sku.product_description}</span>
                  </div>
                </td>
                <td><Badges sku={sku} /></td>
                <td>{num(sku.on_hand_qty)}</td>
                <td>{sku.avg_monthly_demand > 0 ? num(sku.reorder_point) : "—"}</td>
                <td>{sku.expiry_risk_qty > 0 ? `${num(sku.expiry_risk_qty)} · ${money(sku.expiry_risk_value)}` : "—"}</td>
                <td>
                  <div className="si-priority">
                    <span className="si-score">{sku.priority_score}</span>
                    <span className="si-band">{sku.review_cadence}</span>
                  </div>
                </td>
                <td className="si-action">{sku.recommended_action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.skus.length > topSkus.length ? (
        <p className="si-foot">Showing top {topSkus.length} of {data.skus.length} items by priority.</p>
      ) : null}
    </section>
  );
}
