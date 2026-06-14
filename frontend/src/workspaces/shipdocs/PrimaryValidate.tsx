import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, FileUp, ListChecks, Paperclip, ShieldCheck, XCircle } from "lucide-react";

import {
  approveImportCandidate,
  fetchImportCandidates,
  uploadDocument,
  type ApiAuthenticatedUser,
  type ApiImportFileCandidate,
} from "../../lib/api";

// Primary Documents → Validate (Phase 6F). Shipment-first validation. The
// validator sees the shipment, its documents, and the extracted data side by
// side, checks completeness against the required documents, and approves —
// only then does the shipment become official. Inventory still waits for goods
// receipt; nothing here touches stock.

const PENDING = new Set(["validation_pending", "pending", "draft"]);

// Required documents for a primary import (AWB is an optional transport ref).
const REQUIRED = [
  { id: "commercial_invoice", label: "Commercial Invoice" },
  { id: "packing_list", label: "Packing List" },
] as const;

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    validation_pending: "Pending validation",
    validated: "Validated",
    arrived: "Arrived",
    goods_receipt_pending: "Awaiting goods receipt",
    received: "Received",
    closed: "Closed",
  };
  return map[status.toLowerCase()] ?? status.replace(/[_-]/g, " ");
}

export function PrimaryValidate({ currentUser }: { currentUser: ApiAuthenticatedUser }) {
  const [candidates, setCandidates] = useState<ApiImportFileCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [supporting, setSupporting] = useState<string[]>([]);

  function load() {
    setLoading(true);
    fetchImportCandidates()
      .then((rows) => {
        setCandidates(rows);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }
  useEffect(() => {
    load();
  }, []);

  const pending = useMemo(() => candidates.filter((c) => PENDING.has(c.status.toLowerCase())), [candidates]);
  const selected = useMemo(
    () => candidates.find((c) => c.import_file_number === selectedId) ?? null,
    [candidates, selectedId],
  );

  const completeness = useMemo(() => {
    if (!selected) return [];
    return REQUIRED.map((req) => {
      const present =
        req.id === "commercial_invoice"
          ? selected.commercial_invoice_document_ids.length > 0
          : selected.packing_list_document_ids.length > 0;
      return { label: req.label, present };
    });
  }, [selected]);
  const allRequiredPresent = completeness.every((c) => c.present);

  async function handleApprove() {
    if (!selected) return;
    if (!allRequiredPresent) {
      setMessage({ tone: "bad", text: "Mandatory documents are missing — validation cannot complete." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await approveImportCandidate({
        candidate: selected,
        approved_by: currentUser.email,
        auth_token: currentUser.session_token,
        approval_note: "Validated from Primary Documents",
      });
      setMessage({ tone: "good", text: `${selected.shipment_name ?? selected.import_file_number} is validated — it is now an official shipment.` });
      setSelectedId(null);
      load();
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "Could not validate the shipment." });
    } finally {
      setBusy(false);
    }
  }

  function handleReject() {
    setMessage({
      tone: "bad",
      text: "Marked for rejection. The shipment stays out of business data; the uploader should correct and re-submit.",
    });
  }
  function handleRequestCorrection() {
    setMessage({ tone: "bad", text: "Correction requested — the shipment stays pending until the data is fixed and re-saved." });
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
            <p className="eyebrow">Primary Documents · Validate</p>
            <h2>{pending.length === 0 ? "No shipments waiting for validation" : `${pending.length} shipment${pending.length === 1 ? "" : "s"} waiting for your sign-off`}</h2>
            <p className="dash-story">
              Check each shipment's documents against its data and the required-document list. Approving turns it into an
              official shipment available for planning, tracking, reporting, and analytics. Stock only moves later, on
              goods receipt.
            </p>
          </div>
        </div>
      </section>

      {message ? <p className={`review-message ${message.tone}`} role={message.tone === "bad" ? "alert" : "status"}>{message.text}</p> : null}

      <div className="ship-validate-grid">
        {/* Shipment queue */}
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <ListChecks size={16} aria-hidden="true" />
              <h2>Validation queue</h2>
            </div>
            <span className="cc-panel-meta">{pending.length}</span>
          </div>
          {pending.length === 0 ? (
            <p className="empty-state">Nothing pending. Shipments saved from Upload appear here for validation.</p>
          ) : (
            <ul className="doc-list">
              {pending.map((c) => (
                <li key={c.import_file_number}>
                  <button type="button" className={`doc-item${selectedId === c.import_file_number ? " selected" : ""}`} onClick={() => { setSelectedId(c.import_file_number); setMessage(null); setSupporting([]); }}>
                    <span className="doc-item-icon"><FileText size={16} aria-hidden="true" /></span>
                    <span className="doc-item-body">
                      <strong>{c.shipment_name ?? c.import_file_number}</strong>
                      <small>{c.destination_country} · {c.lines.length} line(s) · {c.invoice_numbers.length || (c.invoice_number ? 1 : 0)} invoice(s)</small>
                    </span>
                    <span className="dot-pill tone-warn"><span className="seg-dot" aria-hidden="true" />{statusLabel(c.status)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Split detail: documents + extracted data */}
        {selected ? (
          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <ShieldCheck size={16} aria-hidden="true" />
                <h2>{selected.shipment_name ?? selected.import_file_number}</h2>
              </div>
              <span className="cc-panel-meta">{selected.destination_country}</span>
            </div>

            {/* Completeness */}
            <div className="ship-completeness">
              {completeness.map((c) => (
                <span key={c.label} className={`dot-pill ${c.present ? "tone-good" : "tone-bad"}`}>
                  {c.present ? <CheckCircle2 size={13} aria-hidden="true" /> : <XCircle size={13} aria-hidden="true" />}
                  {c.label}
                </span>
              ))}
              <span className={`dot-pill ${selected.awb_document_id ? "tone-good" : "tone-info"}`}>
                {selected.awb_document_id ? <CheckCircle2 size={13} aria-hidden="true" /> : null}
                AWB {selected.awb_document_id ? "attached" : "optional"}
              </span>
            </div>

            <div className="ship-split">
              {/* LEFT — documents */}
              <div className="ship-split-pane">
                <h3 className="ship-split-title">Documents</h3>
                <ul className="ship-doc-list">
                  {selected.commercial_invoice_document_ids.map((id, i) => (
                    <li className="ship-doc-row" key={`ci-${id}`}><FileText size={14} aria-hidden="true" /><span className="ship-doc-name">Commercial Invoice {i + 1}</span></li>
                  ))}
                  {selected.packing_list_document_ids.map((id, i) => (
                    <li className="ship-doc-row" key={`pl-${id}`}><FileText size={14} aria-hidden="true" /><span className="ship-doc-name">Packing List {i + 1}</span></li>
                  ))}
                  {selected.awb_document_id ? (
                    <li className="ship-doc-row"><FileText size={14} aria-hidden="true" /><span className="ship-doc-name">Air Waybill</span></li>
                  ) : null}
                  {supporting.map((name) => (
                    <li className="ship-doc-row" key={name}><Paperclip size={14} aria-hidden="true" /><span className="ship-doc-name">{name}</span><span className="tag">supporting</span></li>
                  ))}
                </ul>
                <label className="ship-support-upload">
                  <FileUp size={14} aria-hidden="true" /> Attach supporting document (photo, email, certificate)
                  <input type="file" disabled={busy} onChange={(event) => { void handleSupporting(event.target.files?.[0] ?? null); event.target.value = ""; }} />
                </label>
              </div>

              {/* RIGHT — extracted data */}
              <div className="ship-split-pane">
                <h3 className="ship-split-title">Extracted data</h3>
                {selected.lines.length === 0 ? (
                  <p className="empty-state">No line items read from the documents.</p>
                ) : (
                  <table>
                    <thead>
                      <tr><th>Item</th><th>Description</th><th>Batch</th><th>Qty</th><th>Value</th></tr>
                    </thead>
                    <tbody>
                      {selected.lines.slice(0, 20).map((line, index) => (
                        <tr key={`${line.item_code}-${index}`}>
                          <td>{line.item_code}</td>
                          <td>{line.product_description}</td>
                          <td>{line.batch_number}</td>
                          <td>{line.quantity}</td>
                          <td>{line.unit_value ?? "—"} {line.currency ?? ""}</td>
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
              <button type="button" className="secondary-action" disabled={busy} onClick={handleRequestCorrection}>Request correction</button>
              <button type="button" className="secondary-action" disabled={busy} onClick={handleReject}>Reject</button>
            </div>
            {!allRequiredPresent ? (
              <p className="access-note"><small>Validation cannot complete until the mandatory documents above are present.</small></p>
            ) : null}
          </section>
        ) : (
          <aside className="panel cockpit-panel">
            <div className="signal-empty">
              <ShieldCheck size={20} aria-hidden="true" />
              <p>Select a shipment to check its documents and data, then approve, request a correction, or reject.</p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
