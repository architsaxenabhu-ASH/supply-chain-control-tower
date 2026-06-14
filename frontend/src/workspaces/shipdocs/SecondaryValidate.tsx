import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, FileUp, ListChecks, Paperclip, ShieldCheck, XCircle } from "lucide-react";

import {
  approveSecondaryShipment,
  listSecondaryShipments,
  rejectSecondaryShipment,
  uploadDocument,
  type ApiAuthenticatedUser,
  type ApiSecondaryShipment,
} from "../../lib/api";

// Secondary Documents → Validate (Phase 6F). The outbound mirror of Primary
// Validate. Approving turns the bundle into an official secondary shipment,
// available for sales, receivables, commitments, and analytics.

// Required documents for a secondary (customer) shipment.
const REQUIRED = [
  { kind: "customer_po", label: "Customer PO" },
  { kind: "invoice", label: "Invoice" },
] as const;

const DOC_LABELS: Record<string, string> = {
  customer_po: "Customer PO",
  invoice: "Invoice",
  packing_list: "Packing List",
  pod: "Proof of Delivery",
  other: "Other Document",
};

export function SecondaryValidate({ currentUser }: { currentUser: ApiAuthenticatedUser }) {
  const [shipments, setShipments] = useState<ApiSecondaryShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [supporting, setSupporting] = useState<string[]>([]);

  function load() {
    setLoading(true);
    listSecondaryShipments()
      .then((rows) => {
        setShipments(rows);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }
  useEffect(() => {
    load();
  }, []);

  const pending = useMemo(() => shipments.filter((s) => s.status === "pending_validation"), [shipments]);
  const selected = useMemo(() => shipments.find((s) => s.shipment_id === selectedId) ?? null, [shipments, selectedId]);

  const completeness = useMemo(() => {
    if (!selected) return [];
    const kinds = new Set(selected.documents.map((d) => d.kind));
    return REQUIRED.map((req) => ({ label: req.label, present: kinds.has(req.kind) }));
  }, [selected]);
  const allRequiredPresent = completeness.every((c) => c.present);

  const selectedRows = useMemo(() => {
    if (!selected) return [];
    return selected.documents.flatMap((doc) => doc.rows.map((row) => ({ ...row, document: doc.filename })));
  }, [selected]);

  async function handleApprove() {
    if (!selected) return;
    if (!allRequiredPresent) {
      setMessage({ tone: "bad", text: "Mandatory documents are missing — validation cannot complete." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await approveSecondaryShipment(selected.shipment_id, { actor: currentUser.email, note: "Validated from Secondary Documents" });
      setMessage({ tone: "good", text: `${selected.shipment_id} · ${selected.customer} is validated — now an official secondary shipment.` });
      setSelectedId(null);
      load();
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "Could not validate the shipment." });
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    try {
      await rejectSecondaryShipment(selected.shipment_id, { actor: currentUser.email, note: "Rejected at validation" });
      setMessage({ tone: "bad", text: `${selected.shipment_id} rejected. It stays out of business data; the uploader should correct and re-submit.` });
      setSelectedId(null);
      load();
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "Could not reject the shipment." });
    } finally {
      setBusy(false);
    }
  }

  async function handleSupporting(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const record = await uploadDocument("bill_of_entry", file);
      setSupporting((current) => [...current, record.filename]);
      setMessage({ tone: "good", text: `Attached ${record.filename} to the shipment record.` });
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "Could not attach the document." });
    } finally {
      setBusy(false);
    }
  }

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
            <p className="eyebrow">Secondary Documents · Validate</p>
            <h2>{pending.length === 0 ? "No customer shipments waiting for validation" : `${pending.length} customer shipment${pending.length === 1 ? "" : "s"} waiting for your sign-off`}</h2>
            <p className="dash-story">
              Check each customer shipment's documents against its data and the required-document list. Approving turns
              it into an official secondary shipment, available for sales, receivables, commitments, and analytics.
            </p>
          </div>
        </div>
      </section>

      {message ? <p className={`review-message ${message.tone}`} role={message.tone === "bad" ? "alert" : "status"}>{message.text}</p> : null}

      <div className="ship-validate-grid">
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <ListChecks size={16} aria-hidden="true" />
              <h2>Validation queue</h2>
            </div>
            <span className="cc-panel-meta">{pending.length}</span>
          </div>
          {pending.length === 0 ? (
            <p className="empty-state">Nothing pending. Customer shipments saved from Upload appear here.</p>
          ) : (
            <ul className="doc-list">
              {pending.map((s) => (
                <li key={s.shipment_id}>
                  <button type="button" className={`doc-item${selectedId === s.shipment_id ? " selected" : ""}`} onClick={() => { setSelectedId(s.shipment_id); setMessage(null); setSupporting([]); }}>
                    <span className="doc-item-icon"><FileText size={16} aria-hidden="true" /></span>
                    <span className="doc-item-body">
                      <strong>{s.customer}</strong>
                      <small>{s.shipment_id} · {s.country} · {s.documents.length} document(s)</small>
                    </span>
                    <span className="dot-pill tone-warn"><span className="seg-dot" aria-hidden="true" />Pending</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {selected ? (
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <ShieldCheck size={16} aria-hidden="true" />
                <h2>{selected.customer} · {selected.shipment_id}</h2>
              </div>
              <span className="cc-panel-meta">{selected.country}</span>
            </div>

            <div className="ship-completeness">
              {completeness.map((c) => (
                <span key={c.label} className={`dot-pill ${c.present ? "tone-good" : "tone-bad"}`}>
                  {c.present ? <CheckCircle2 size={13} aria-hidden="true" /> : <XCircle size={13} aria-hidden="true" />}
                  {c.label}
                </span>
              ))}
            </div>

            <div className="ship-split">
              <div className="ship-split-pane">
                <h3 className="ship-split-title">Documents</h3>
                <ul className="ship-doc-list">
                  {selected.documents.map((doc) => (
                    <li className="ship-doc-row" key={doc.document_id}>
                      <FileText size={14} aria-hidden="true" />
                      <span className="ship-doc-name">{doc.filename}</span>
                      <span className="tag">{DOC_LABELS[doc.kind] ?? doc.kind}</span>
                    </li>
                  ))}
                  {supporting.map((name) => (
                    <li className="ship-doc-row" key={name}><Paperclip size={14} aria-hidden="true" /><span className="ship-doc-name">{name}</span><span className="tag">supporting</span></li>
                  ))}
                </ul>
                <label className="ship-support-upload">
                  <FileUp size={14} aria-hidden="true" /> Attach supporting document (POD photo, email, certificate)
                  <input type="file" disabled={busy} onChange={(event) => { void handleSupporting(event.target.files?.[0] ?? null); event.target.value = ""; }} />
                </label>
              </div>

              <div className="ship-split-pane">
                <h3 className="ship-split-title">Extracted data</h3>
                {selectedRows.length === 0 ? (
                  <p className="empty-state">No business data captured from these documents.</p>
                ) : (
                  <table>
                    <thead>
                      <tr><th>Field</th><th>Value</th><th>From</th></tr>
                    </thead>
                    <tbody>
                      {selectedRows.slice(0, 24).map((row, index) => (
                        <tr key={`${row.label}-${index}`}>
                          <td>{row.label}</td>
                          <td>{row.value}</td>
                          <td><span className="muted-cell">{row.document}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="review-form-actions ship-validate-actions">
              <button type="button" className="review-decide-save" disabled={busy || !allRequiredPresent} onClick={() => void handleApprove()}>
                <CheckCircle2 size={15} aria-hidden="true" /> Approve → official shipment
              </button>
              <button type="button" className="secondary-action" disabled={busy} onClick={() => void handleReject()}>Reject</button>
            </div>
            {!allRequiredPresent ? (
              <p className="access-note"><small>Validation cannot complete until the mandatory documents above are present.</small></p>
            ) : null}
          </section>
        ) : (
          <aside className="panel cockpit-panel">
            <div className="signal-empty">
              <ShieldCheck size={20} aria-hidden="true" />
              <p>Select a customer shipment to check its documents and data, then approve or reject.</p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
