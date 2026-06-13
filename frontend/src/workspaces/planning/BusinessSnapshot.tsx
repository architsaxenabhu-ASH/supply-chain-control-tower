import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Banknote, Boxes, CalendarClock, HandCoins, History, Send } from "lucide-react";

import {
  fetchCustomerCommitments,
  fetchDispatches,
  fetchGoodsReceipts,
  fetchPayables,
  fetchReceivables,
  fetchShipments,
  type ApiCustomerCommitment,
  type ApiDispatch,
  type ApiGoodsReceipt,
  type ApiPayable,
  type ApiReceivable,
  type ApiShipment,
} from "../../lib/api";
import { convertAmount, formatDisplay, formatUnits, getCurrencyRevision, subscribeCurrency } from "../../lib/currency";

// Historical Time Machine — Business Snapshot (Phase 6, P1). Pick a date and see
// the whole business as it stood that day, reconstructed from transaction
// records (goods receipts, dispatches, invoices, payments) — no forecasting,
// no models. Money converts at the rate locked for the snapshot date, so a past
// snapshot reads in period-accurate value.

const num = formatUnits;
const todayStamp = () => new Date().toISOString().slice(0, 10);

function lineKey(itemCode: string, batch: string): string {
  return `${itemCode.toLowerCase()}|${batch.toLowerCase()}`;
}

export function BusinessSnapshot() {
  const rev = useSyncExternalStore(subscribeCurrency, getCurrencyRevision);
  const [receipts, setReceipts] = useState<ApiGoodsReceipt[]>([]);
  const [dispatches, setDispatches] = useState<ApiDispatch[]>([]);
  const [shipments, setShipments] = useState<ApiShipment[]>([]);
  const [receivables, setReceivables] = useState<ApiReceivable[]>([]);
  const [payables, setPayables] = useState<ApiPayable[]>([]);
  const [commitments, setCommitments] = useState<ApiCustomerCommitment[]>([]);
  const [loading, setLoading] = useState(true);

  const [snapshot, setSnapshot] = useState(todayStamp());

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      fetchGoodsReceipts(),
      fetchDispatches(),
      fetchShipments(),
      fetchReceivables(),
      fetchPayables(),
      fetchCustomerCommitments(),
    ]).then(([gr, dp, sh, rc, pa, cm]) => {
      if (!active) return;
      if (gr.status === "fulfilled") setReceipts(gr.value);
      if (dp.status === "fulfilled") setDispatches(dp.value);
      if (sh.status === "fulfilled") setShipments(sh.value);
      if (rc.status === "fulfilled") setReceivables(rc.value);
      if (pa.status === "fulfilled") setPayables(pa.value);
      if (cm.status === "fulfilled") setCommitments(cm.value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const shipmentById = useMemo(() => {
    const map = new Map<string, ApiShipment>();
    for (const shipment of shipments) map.set(shipment.shipment_id, shipment);
    return map;
  }, [shipments]);

  // Unit value per item+batch, learned from goods receipts — used to value the
  // quantities that were dispatched out by the snapshot date.
  const unitValueByLine = useMemo(() => {
    const map = new Map<string, number>();
    for (const receipt of receipts)
      for (const line of receipt.lines) map.set(lineKey(line.item_code, line.batch_number), line.unit_value);
    return map;
  }, [receipts]);

  // Reconstruct the position as of the snapshot date.
  const position = useMemo(() => {
    let receivedUnits = 0;
    let receivedValue = 0;
    for (const receipt of receipts) {
      if (receipt.receipt_date > snapshot) continue;
      for (const line of receipt.lines) {
        receivedUnits += line.quantity_received;
        receivedValue += line.quantity_received * line.unit_value;
      }
    }
    let dispatchedUnits = 0;
    let dispatchedValue = 0;
    for (const dispatch of dispatches) {
      if (dispatch.dispatch_date > snapshot) continue;
      const shipment = shipmentById.get(dispatch.shipment_id);
      if (!shipment) continue;
      for (const line of shipment.lines) {
        const qty = line.quantity_approved > 0 ? line.quantity_approved : line.quantity_requested;
        dispatchedUnits += qty;
        dispatchedValue += qty * (unitValueByLine.get(lineKey(line.item_code, line.batch_number)) ?? 0);
      }
    }
    const inventoryUnits = Math.max(receivedUnits - dispatchedUnits, 0);
    const inventoryValueBase = Math.max(receivedValue - dispatchedValue, 0);

    // Receivables / payables outstanding as of the date = invoiced by then,
    // minus payments collected/made by then.
    const outstandingAsOf = (invoiceDate: string, value: number, payments: { amount: number; paid_date: string }[]) => {
      if (invoiceDate > snapshot) return 0;
      const paid = payments.filter((p) => p.paid_date && p.paid_date <= snapshot).reduce((sum, p) => sum + p.amount, 0);
      return Math.max(value - paid, 0);
    };

    const receivablesBase = receivables.reduce(
      (sum, r) => sum + outstandingAsOf(r.invoice_date, r.invoice_value, r.payment_history),
      0,
    );
    const payablesBase = payables.reduce(
      (sum, p) => sum + outstandingAsOf(p.invoice_date, p.invoice_value, p.payment_history),
      0,
    );

    // Open commitments as of the date — best-effort from required dates.
    const openCommitments = commitments.filter(
      (c) => c.required_delivery_date >= snapshot && c.ordered_quantity > 0,
    );
    const openOrderUnits = openCommitments.reduce((sum, c) => sum + c.ordered_quantity, 0);

    return {
      inventoryUnits,
      inventoryValue: convertAmount(inventoryValueBase, { book: "primary", onDate: snapshot }),
      receivables: convertAmount(receivablesBase, { book: "secondary", onDate: snapshot }),
      payables: convertAmount(payablesBase, { book: "primary", onDate: snapshot }),
      openCommitments: openCommitments.length,
      openOrderUnits,
      receiptCount: receipts.filter((r) => r.receipt_date <= snapshot).length,
      dispatchCount: dispatches.filter((d) => d.dispatch_date <= snapshot).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipts, dispatches, shipmentById, unitValueByLine, receivables, payables, commitments, snapshot, rev]);

  const money = (value: number) => formatDisplay(value, { compact: true });
  const isToday = snapshot === todayStamp();

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
            <p className="eyebrow">Historical Time Machine · Business Snapshot</p>
            <h2>The business as it stood on {snapshot}{isToday ? " (today)" : ""}</h2>
            <p className="dash-story">
              Reconstructed from the transaction record — goods receipts and dispatches for stock, invoices and
              payments for money. Values convert at the exchange rate locked for {snapshot}, so a past day reads in
              the money of its time.
            </p>
          </div>
          <label className="filter-control">
            <span>Snapshot date</span>
            <input
              type="date"
              max={todayStamp()}
              value={snapshot}
              onChange={(event) => setSnapshot(event.target.value || todayStamp())}
            />
          </label>
        </div>
        <div className="vitals-row">
          <div className="vital">
            <strong>{money(position.inventoryValue)}</strong>
            <span>Inventory value</span>
          </div>
          <div className="vital">
            <strong>{num(position.inventoryUnits)}</strong>
            <span>Inventory units on hand</span>
          </div>
          <div className="vital">
            <strong>{money(position.receivables)}</strong>
            <span>Receivables outstanding</span>
          </div>
          <div className="vital">
            <strong>{money(position.payables)}</strong>
            <span>Payables outstanding</span>
          </div>
          <div className="vital">
            <strong>{money(position.receivables - position.payables)}</strong>
            <span>Net position</span>
          </div>
        </div>
      </section>

      <div className="hub-columns">
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <Boxes size={16} aria-hidden="true" />
              <h2>How the stock position was reached</h2>
            </div>
          </div>
          <div className="score-stack">
            <div className="score-row-head">
              <span>Goods receipts posted by {snapshot}</span>
              <strong>{num(position.receiptCount)}</strong>
            </div>
            <div className="score-row-head">
              <span>Dispatches out by {snapshot}</span>
              <strong>{num(position.dispatchCount)}</strong>
            </div>
            <div className="score-row-head">
              <span>Net stock on hand</span>
              <strong>{num(position.inventoryUnits)} units</strong>
            </div>
            <div className="score-row-head">
              <span>Open customer orders that day</span>
              <strong>
                {num(position.openCommitments)} · {num(position.openOrderUnits)} units
              </strong>
            </div>
          </div>
        </section>
        <aside className="hub-rail">
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <CalendarClock size={16} aria-hidden="true" />
                <h2>Jump to a key date</h2>
              </div>
            </div>
            <div className="launchpad-row">
              {[
                { label: "Today", date: todayStamp() },
                { label: "Month start", date: `${todayStamp().slice(0, 7)}-01` },
                { label: "Year start", date: `${todayStamp().slice(0, 4)}-01-01` },
              ].map((shortcut) => (
                <button
                  type="button"
                  key={shortcut.label}
                  className={`launch-action${snapshot === shortcut.date ? " selected" : ""}`}
                  onClick={() => setSnapshot(shortcut.date)}
                >
                  <span className="launch-action-icon">
                    <History size={16} aria-hidden="true" />
                  </span>
                  <span className="launch-action-body">
                    <strong>{shortcut.label}</strong>
                    <small>{shortcut.date}</small>
                  </span>
                </button>
              ))}
            </div>
            <p className="access-note">
              <small>
                <Banknote size={12} aria-hidden="true" /> Receivables and <HandCoins size={12} aria-hidden="true" />{" "}
                payables reconstruct exactly from invoice and payment dates; <Send size={12} aria-hidden="true" /> open
                orders are a best-effort from required-delivery dates.
              </small>
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
