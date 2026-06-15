import { useState } from "react";
import { ArrowRight, CheckCircle2, FileUp, PackagePlus, ScanText, Send, Trash2 } from "lucide-react";

import {
  getExtractionMaster,
  saveSecondaryShipment,
  uploadDocument,
  type ApiAuthenticatedUser,
  type ApiSecondaryDocument,
  type ApiSecondaryShipment,
} from "../../lib/api";
import type { DocumentRecord, DocumentType } from "../../types/domain";
import { DropZone } from "../../components/DropZone";

// Secondary Documents → Upload (Phase 6F). The outbound mirror of Primary
// Upload: subsidiary → customer. Same shipment-first logic — every document
// belongs to a customer shipment, the uploader sees only business data, and
// saving queues the shipment for validation without touching sales, receivables
// or analytics until a validator approves it.

type ShipmentType = "standard" | "consignment" | "direct";

// Business doc kinds → the extraction type used to read them.
const DOC_KINDS: { id: string; label: string; extractAs: DocumentType }[] = [
  { id: "customer_po", label: "Customer PO", extractAs: "bill_of_entry" },
  { id: "invoice", label: "Invoice", extractAs: "commercial_invoice" },
  { id: "packing_list", label: "Packing List", extractAs: "packing_list" },
  { id: "pod", label: "Proof of Delivery (POD)", extractAs: "bill_of_lading" },
  { id: "other", label: "Other Document", extractAs: "bill_of_entry" },
];

const BUSINESS_FIELDS = [
  "item_code", "material_code", "product_description", "description", "batch_number", "batch",
  "quantity", "unit_value", "value", "currency", "country", "customer", "invoice_number",
  "document_number", "po_number", "invoice_date", "document_date",
];

function humanize(value: string): string {
  const text = value.replace(/[_-]/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type Uploaded = { kindId: string; kindLabel: string; record: DocumentRecord; rows: { label: string; value: string }[] };

export function SecondaryUpload({ currentUser }: { currentUser: ApiAuthenticatedUser }) {
  const [step, setStep] = useState(1);

  // Step 1 — shipment header.
  const [shipmentType, setShipmentType] = useState<ShipmentType>("standard");
  const [customer, setCustomer] = useState("");
  const [country, setCountry] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [destination, setDestination] = useState("");
  const [required, setRequired] = useState("");

  // Step 2 — uploaded documents.
  const [uploads, setUploads] = useState<Uploaded[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState<ApiSecondaryShipment | null>(null);

  async function handleUpload(kind: (typeof DOC_KINDS)[number], file: File | null) {
    if (!file) return;
    setUploading(kind.id);
    setMessage("");
    try {
      const record = await uploadDocument(kind.extractAs, file);
      let rows: { label: string; value: string }[] = [];
      try {
        const master = await getExtractionMaster(record.document_id);
        rows = master.fields
          .filter((f) => BUSINESS_FIELDS.includes(f.field_name.toLowerCase()))
          .map((f) => ({ label: humanize(f.field_name), value: f.corrected_value || f.extracted_value || "—" }));
      } catch {
        /* extraction may still be processing */
      }
      setUploads((current) => [...current, { kindId: kind.id, kindLabel: kind.label, record, rows }]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not upload the document.");
    } finally {
      setUploading(null);
    }
  }

  function removeUpload(documentId: string) {
    setUploads((current) => current.filter((u) => u.record.document_id !== documentId));
  }

  async function handleSaveToQueue() {
    setSaving(true);
    setMessage("");
    try {
      const documents: ApiSecondaryDocument[] = uploads.map((u) => ({
        document_id: u.record.document_id,
        filename: u.record.filename,
        kind: u.kindId,
        rows: u.rows,
      }));
      const shipment = await saveSecondaryShipment({
        customer: customer.trim(),
        country: country.trim(),
        order_number: orderNo.trim(),
        shipment_type: shipmentType,
        documents,
        actor: currentUser.email,
      });
      setSaved(shipment);
      setStep(4);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the shipment to the validation queue.");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setStep(1);
    setShipmentType("standard");
    setCustomer("");
    setCountry("");
    setOrderNo("");
    setDestination("");
    setRequired("");
    setUploads([]);
    setSaved(null);
    setMessage("");
  }

  const shipmentLabel = [country, orderNo].map((p) => p.trim().toUpperCase()).filter(Boolean).join("-") || "New customer shipment";
  const canAdvance1 = Boolean(customer.trim() && country.trim());

  return (
    <div className="ops-stage">
      <section className="cockpit-hero">
        <div className="cockpit-hero-top">
          <div>
            <p className="eyebrow">Secondary Documents · Upload · {customer || "customer"}</p>
            <h2>Building a customer shipment, with its documents attached</h2>
            <p className="dash-story">
              Subsidiary → customer. Every document belongs to a customer shipment. Upload what you have; the system
              reads the business data for you to check. Saving queues the shipment for validation — nothing reaches
              sales, receivables, commitments, or analytics until a validator approves it.
            </p>
          </div>
        </div>
        <ol className="ship-steps">
          {["Customer & order", "Upload documents", "Check data", "Save to queue"].map((label, index) => {
            const n = index + 1;
            return (
              <li key={label} className={`ship-step${step === n ? " active" : ""}${step > n ? " done" : ""}`}>
                <span className="ship-step-no">{step > n ? <CheckCircle2 size={15} aria-hidden="true" /> : n}</span>
                {label}
              </li>
            );
          })}
        </ol>
      </section>

      {message ? <p className="review-message bad" role="alert">{message}</p> : null}

      {step === 1 ? (
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <Send size={16} aria-hidden="true" />
              <h2>Step 1 · Customer &amp; order</h2>
            </div>
          </div>
          <div className="ship-header-grid">
            <label className="field-control">
              <span>Shipment type</span>
              <select value={shipmentType} onChange={(event) => setShipmentType(event.target.value as ShipmentType)}>
                <option value="standard">Standard sale</option>
                <option value="consignment">Consignment</option>
                <option value="direct">Direct (India → customer)</option>
              </select>
            </label>
            <label className="field-control">
              <span>Customer</span>
              <input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Ospedale San Raffaele" />
            </label>
            <label className="field-control">
              <span>Country</span>
              <input value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Italy" />
            </label>
            <label className="field-control">
              <span>Customer PO / order no.</span>
              <input value={orderNo} onChange={(event) => setOrderNo(event.target.value)} placeholder="PO-88421" />
            </label>
            <label className="field-control">
              <span>Destination</span>
              <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Milan" />
            </label>
            <label className="field-control">
              <span>Required delivery</span>
              <input type="date" value={required} onChange={(event) => setRequired(event.target.value)} />
            </label>
            <div className="ship-name-preview">
              <span>Shipment ID</span>
              <strong>{shipmentLabel}</strong>
            </div>
          </div>
          <div className="review-form-actions">
            <button type="button" className="review-decide-save" disabled={!canAdvance1} onClick={() => setStep(2)}>
              Continue <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <FileUp size={16} aria-hidden="true" />
              <h2>Step 2 · Upload the documents for {customer}</h2>
            </div>
          </div>
          <div className="ship-upload-grid">
            {DOC_KINDS.map((kind) => (
              <DropZone
                key={kind.id}
                className="ship-upload-card"
                disabled={uploading !== null}
                ariaLabel={`Upload ${kind.label}`}
                onFile={(file) => void handleUpload(kind, file)}
              >
                <span className="ship-upload-label">{kind.label}</span>
                <span className="ship-upload-hint">{uploading === kind.id ? "Reading…" : "Drag & drop, or click to choose"}</span>
              </DropZone>
            ))}
          </div>
          {uploads.length > 0 ? (
            <ul className="ship-doc-list">
              {uploads.map((u) => (
                <li key={u.record.document_id} className="ship-doc-row">
                  <ScanText size={15} aria-hidden="true" />
                  <span className="ship-doc-name">{u.record.filename}</span>
                  <span className="tag">{u.kindLabel}</span>
                  <button type="button" className="ship-doc-remove" onClick={() => removeUpload(u.record.document_id)} title="Remove">
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No documents yet. Upload at least a customer PO or invoice to continue.</p>
          )}
          <div className="review-form-actions">
            <button type="button" className="secondary-action" onClick={() => setStep(1)}>Back</button>
            <button type="button" className="review-decide-save" disabled={uploads.length === 0} onClick={() => setStep(3)}>
              Continue <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <ScanText size={16} aria-hidden="true" />
              <h2>Step 3 · What the documents say</h2>
            </div>
          </div>
          {uploads.map((u) => (
            <div className="ship-extract-block" key={u.record.document_id}>
              <div className="ship-extract-head">
                <strong>{u.record.filename}</strong>
                <span className="tag">{u.kindLabel}</span>
              </div>
              {u.rows.length === 0 ? (
                <p className="empty-state">Reading this document — the validator will see and confirm the data.</p>
              ) : (
                <div className="ship-extract-grid">
                  {u.rows.map((row, index) => (
                    <div className="ship-extract-cell" key={`${row.label}-${index}`}>
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="review-form-actions">
            <button type="button" className="secondary-action" onClick={() => setStep(2)}>Back</button>
            <button type="button" className="review-decide-save" disabled={saving || uploads.length === 0} onClick={() => void handleSaveToQueue()}>
              {saving ? "Saving…" : "Save to validation queue"}
            </button>
          </div>
          <p className="access-note">
            <small>Saving does not create an official shipment or update sales — it queues the shipment for a validator to approve.</small>
          </p>
        </section>
      ) : null}

      {step === 4 && saved ? (
        <section className="panel cockpit-panel">
          <div className="empty-story">
            <span className="empty-story-mark"><PackagePlus size={22} aria-hidden="true" /></span>
            <strong>{saved.shipment_id} · {saved.customer} is pending validation</strong>
            <span>
              {saved.documents.length} document(s) captured. It now waits in Secondary Documents → Validate. Nothing has
              reached sales, receivables, commitments, or analytics — a validator must approve it first.
            </span>
          </div>
          <div className="review-form-actions">
            <button type="button" className="review-decide-save" onClick={reset}>Upload another shipment</button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
