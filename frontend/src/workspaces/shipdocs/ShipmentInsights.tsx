import { useEffect, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";

import { fetchAuditEvents, type ApiAuditEvent } from "../../lib/api";

// Shared shipment insights (Phase 6F enhancements): the stage timeline and the
// conversation log, used by both Primary and Secondary validation. A shipment
// always shows where it is and everything that has happened to it.

// The canonical lifecycle every shipment moves through.
const STAGES = [
  "Created",
  "Documents uploaded",
  "Validated",
  "Dispatched",
  "In transit",
  "Arrived",
  "Received",
  "Completed",
] as const;

const PRIMARY_STAGE: Record<string, number> = {
  draft: 0,
  validation_pending: 1,
  validated: 2,
  approved: 2,
  dispatched: 3,
  in_transit: 4,
  customs_in_progress: 4,
  country_documents_pending: 4,
  arrived: 5,
  goods_receipt_pending: 5,
  received: 6,
  closed: 7,
};

const SECONDARY_STAGE: Record<string, number> = {
  draft: 0,
  pending_validation: 1,
  validated: 2,
  dispatched: 3,
  delivered: 6,
  closed: 7,
};

export function ShipmentTimeline({ status, flow }: { status: string; flow: "primary" | "secondary" }) {
  const key = status.toLowerCase();
  const rejected = key === "rejected";
  const current = (flow === "secondary" ? SECONDARY_STAGE : PRIMARY_STAGE)[key] ?? 1;
  return (
    <div className="ship-timeline" role="img" aria-label={`Shipment stage: ${STAGES[current]}`}>
      {STAGES.map((stage, index) => {
        const state = rejected ? "pending" : index < current ? "done" : index === current ? "current" : "pending";
        return (
          <div className={`ship-tl-step ${state}`} key={stage}>
            <span className="ship-tl-dot" aria-hidden="true" />
            <span className="ship-tl-label">{stage}</span>
          </div>
        );
      })}
      {rejected ? <span className="ship-tl-rejected">Rejected</span> : null}
    </div>
  );
}

function humanizeAction(action: string): string {
  const map: Record<string, string> = {
    secondary_shipment_uploaded: "Documents uploaded",
    secondary_shipment_validated: "Validated",
    secondary_shipment_rejected: "Rejected",
    post_goods_receipt: "Goods receipt posted",
    post_direct_sale: "Recorded as direct sale",
    assemble_import: "Documents assembled into shipment",
    create: "Created",
    approve: "Approved",
    decide: "Decision recorded",
  };
  if (map[action]) return map[action];
  return action.replace(/[_-]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function timeAgo(iso: string): string {
  return iso.replace("T", " ").slice(0, 16);
}

// The conversation log for one shipment, read from the tamper-evident audit
// trail and filtered to that shipment's entity id.
export function ConversationLog({ shipmentId, refreshKey = 0 }: { shipmentId: string; refreshKey?: number }) {
  const [events, setEvents] = useState<ApiAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAuditEvents(300)
      .then((rows) => {
        if (active) setEvents(rows);
      })
      .catch(() => {
        if (active) setEvents([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [shipmentId, refreshKey]);

  const log = useMemo(
    () =>
      events
        .filter((event) => event.entity_id === shipmentId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [events, shipmentId],
  );

  return (
    <section className="panel cockpit-panel">
      <div className="panel-heading">
        <div className="worklist-title">
          <MessageSquare size={15} aria-hidden="true" />
          <h2>Conversation log</h2>
        </div>
        <span className="cc-panel-meta">{log.length}</span>
      </div>
      {loading ? (
        <p className="empty-state">Loading the shipment's history…</p>
      ) : log.length === 0 ? (
        <p className="empty-state">No recorded activity yet. Uploads, validations, and corrections appear here with who and when.</p>
      ) : (
        <ol className="ship-log">
          {log.map((event) => (
            <li className="ship-log-row" key={event.id}>
              <span className="ship-log-dot" aria-hidden="true" />
              <div className="ship-log-body">
                <strong>{humanizeAction(event.action)}</strong>
                <small>
                  {event.actor ?? "system"} · {timeAgo(event.created_at)}
                  {event.reason ? ` · ${event.reason}` : ""}
                </small>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
