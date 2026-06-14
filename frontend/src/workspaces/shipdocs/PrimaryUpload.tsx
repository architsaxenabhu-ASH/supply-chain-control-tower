import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, FileUp, PackagePlus, ScanText, Ship, Trash2 } from "lucide-react";

import {
  assembleImportFromDocuments,
  fetchImportCandidates,
  getExtractionMaster,
  uploadDocument,
  type ApiAuthenticatedUser,
  type ApiImportFileCandidate,
} from "../../lib/api";
import type { DocumentRecord, DocumentType } from "../../types/domain";

// Primary Documents → Upload (Phase 6F). Shipment-first: every document belongs
// to a shipment. The upload user never sees OCR config, templates, confidence,
// or governance — only the shipment, its documents, and the business data read
// from them. Saving puts the shipment in the validation queue: nothing official
// is created, no inventory or metric moves until a validator approves.

type ShipmentType = "subsidiary" | "direct";

// Document kinds the upload user works with (business labels → extraction type).
const DOC_KINDS: { id: DocumentType; label: string }[] = [
  { id: "commercial_invoice", label: "Commercial Invoice" },
  { id: "packing_list", label: "Packing List" },
  { id: "air_waybill", label: "Air Waybill (AWB)" },
  { id: "bill_of_entry", label: "Import Document" },
];

// Business fields worth showing the uploader — never OCR internals.
const BUSINESS_FIELDS = [
  "item_code",
  "material_code",
  "product_description",
  "description",
  "batch_number",
  "batch",
  "quantity",
  "unit_value",
  "value",
  "currency",
  "country",
  "invoice_number",
  "document_number",
  "invoice_date",
  "document_date",
];

function humanize(value: string): string {
  const text = value.replace(/[_-]/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type Uploaded = { kind: DocumentType; record: DocumentRecord };

export function PrimaryUpload({ currentUser }: { currentUser: ApiAuthenticatedUser }) {
  const [step, setStep] = useState(1);
  const [candidates, setCandidates] = useState<ApiImportFileCandidate[]>([]);

  // Step 1 — shipment header.
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [existingId, setExistingId] = useState("");
  const [shipmentType, setShipmentType] = useState<ShipmentType>("subsidiary");
  const [country, setCountry] = useState("");
  const [vertical, setVertical] = useState("");
  const [shipmentNo, setShipmentNo] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [eta, setEta] = useState("");

  // Step 2 — uploaded documents.
  const [uploads, setUploads] = useState<Uploaded[]>([]);
  const [uploading, setUploading] = useState<DocumentType | null>(null);

  // Step 3 — extracted business data (per document).
  const [extracted, setExtracted] = useState<Record<string, { label: string; value: string }[]>>({});

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [savedShipment, setSavedShipment] = useState<ApiImportFileCandidate | null>(null);

  useEffect(() => {
    fetchImportCandidates()
      .then(setCandidates)
      .catch(() => setCandidates([]));
  }, []);

  const shipmentName = useMemo(() => {
    if (mode === "existing") {
      const found = candidates.find((c) => c.import_file_number === existingId);
      return found?.shipment_name ?? existingId;
    }
    const parts = [country, vertical, shipmentNo].map((p) => p.trim().toUpperCase()).filter(Boolean);
    return parts.join("-") || "New shipment";
  }, [mode, existingId, candidates, country, vertical, shipmentNo]);

  async function handleUpload(kind: DocumentType, file: File | null) {
    if (!file) return;
    setUploading(kind);
    setMessage("");
    try {
      const record = await uploadDocument(kind, file);
      setUploads((current) => [...current, { kind, record }]);
      // Pull the business fields straight away so step 3 is ready.
      try {
        const master = await getExtractionMaster(record.document_id);
        const rows = master.fields
          .filter((f) => BUSINESS_FIELDS.includes(f.field_name.toLowerCase()))
          .map((f) => ({ label: humanize(f.field_name), value: f.corrected_value || f.extracted_value || "—" }));
        setExtracted((current) => ({ ...current, [record.document_id]: rows }));
      } catch {
        /* extraction may still be processing; the validator will see it */
      }
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
      const ci = uploads.filter((u) => u.kind === "commercial_invoice").map((u) => u.record.document_id);
      const pl = uploads.filter((u) => u.kind === "packing_list").map((u) => u.record.document_id);
      const awb = uploads.find((u) => u.kind === "air_waybill")?.record.document_id ?? null;
      const candidate = await assembleImportFromDocuments({
        commercial_invoice_document_ids: ci,
        packing_list_document_ids: pl,
        awb_document_id: awb,
        shipment_country: mode === "new" ? country.trim() || null : null,
        shipment_vertical: mode === "new" ? vertical.trim() || null : null,
        shipment_number: mode === "new" ? shipmentNo.trim() || null : null,
      });
      setSavedShipment(candidate);
      setStep(4);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the shipment to the validation queue.");
    } finally {
      setSaving(false);
    }
  }

  function resetWizard() {
    setStep(1);
    setMode("new");
    setExistingId("");
    setShipmentType("subsidiary");
    setCountry("");
    setVertical("");
    setShipmentNo("");
    setOrigin("");
    setDestination("");
    setEta("");
    setUploads([]);
    setExtracted({});
    setSavedShipment(null);
    setMessage("");
    fetchImportCandidates().then(setCandidates).catch(() => undefined);
  }

  const canAdvanceStep1 = mode === "existing" ? Boolean(existingId) : Boolean(country.trim() && shipmentNo.trim());
  const canSave = uploads.length > 0 && !saving;

  return (
    <div className="ops-stage">
      <section className="cockpit-hero">
        <div className="cockpit-hero-top">
          <div>
            <p className="eyebrow">Primary Documents · Upload · {shipmentName}</p>
            <h2>Building a shipment, with its documents attached</h2>
            <p className="dash-story">
              Every document belongs to a shipment. Upload what you have; the system reads the business data for you to
              check. When you save, the shipment waits in the validation queue — nothing posts to inventory or reports
              until a validator approves it.
            </p>
          </div>
        </div>
        {/* Step rail */}
        <ol className="ship-steps">
          {["Select shipment", "Upload documents", "Check data", "Save to queue"].map((label, index) => {
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

      {/* STEP 1 — Shipment header */}
      {step === 1 ? (
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <Ship size={16} aria-hidden="true" />
              <h2>Step 1 · Which shipment?</h2>
            </div>
          </div>
          <div className="lens-switch" role="tablist" aria-label="Shipment source" style={{ marginBottom: 14 }}>
            <button type="button" role="tab" aria-selected={mode === "new"} className={mode === "new" ? "lens-chip active" : "lens-chip"} onClick={() => setMode("new")}>
              <span>Create new shipment</span>
            </button>
            <button type="button" role="tab" aria-selected={mode === "existing"} className={mode === "existing" ? "lens-chip active" : "lens-chip"} onClick={() => setMode("existing")}>
              <span>Add to existing shipment</span>
            </button>
          </div>

          {mode === "existing" ? (
            <label className="field-control">
              <span>Existing shipment</span>
              <select value={existingId} onChange={(event) => setExistingId(event.target.value)}>
                <option value="">Select a shipment…</option>
                {candidates.map((c) => (
                  <option key={c.import_file_number} value={c.import_file_number}>
                    {c.shipment_name ?? c.import_file_number} · {c.destination_country}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="ship-header-grid">
              <label className="field-control">
                <span>Shipment type</span>
                <select value={shipmentType} onChange={(event) => setShipmentType(event.target.value as ShipmentType)}>
                  <option value="subsidiary">Subsidiary shipment (into our stock)</option>
                  <option value="direct">Direct shipment (India → customer)</option>
                </select>
              </label>
              <label className="field-control">
                <span>Country</span>
                <input value={country} onChange={(event) => setCountry(event.target.value)} placeholder="Italy" />
              </label>
              <label className="field-control">
                <span>Vertical</span>
                <input value={vertical} onChange={(event) => setVertical(event.target.value)} placeholder="Cardio" />
              </label>
              <label className="field-control">
                <span>Shipment number</span>
                <input value={shipmentNo} onChange={(event) => setShipmentNo(event.target.value)} placeholder="0361" />
              </label>
              <label className="field-control">
                <span>Origin</span>
                <input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="India" />
              </label>
              <label className="field-control">
                <span>Destination</span>
                <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Milan" />
              </label>
              <label className="field-control">
                <span>ETA</span>
                <input type="date" value={eta} onChange={(event) => setEta(event.target.value)} />
              </label>
              <div className="ship-name-preview">
                <span>Shipment ID</span>
                <strong>{shipmentName}</strong>
              </div>
            </div>
          )}
          <div className="review-form-actions">
            <button type="button" className="review-decide-save" disabled={!canAdvanceStep1} onClick={() => setStep(2)}>
              Continue <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : null}

      {/* STEP 2 — Upload documents */}
      {step === 2 ? (
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <FileUp size={16} aria-hidden="true" />
              <h2>Step 2 · Upload the documents for {shipmentName}</h2>
            </div>
          </div>
          <div className="ship-upload-grid">
            {DOC_KINDS.map((kind) => (
              <label className="ship-upload-card" key={kind.id}>
                <span className="ship-upload-label">{kind.label}</span>
                <input
                  type="file"
                  onChange={(event) => {
                    void handleUpload(kind.id, event.target.files?.[0] ?? null);
                    event.target.value = "";
                  }}
                  disabled={uploading !== null}
                />
                <span className="ship-upload-hint">{uploading === kind.id ? "Reading…" : "Choose file"}</span>
              </label>
            ))}
          </div>
          {uploads.length > 0 ? (
            <ul className="ship-doc-list">
              {uploads.map((u) => (
                <li key={u.record.document_id} className="ship-doc-row">
                  <ScanText size={15} aria-hidden="true" />
                  <span className="ship-doc-name">{u.record.filename}</span>
                  <span className="tag">{humanize(u.kind)}</span>
                  <button type="button" className="ship-doc-remove" onClick={() => removeUpload(u.record.document_id)} title="Remove">
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">No documents yet. Upload at least a commercial invoice to continue.</p>
          )}
          <div className="review-form-actions">
            <button type="button" className="secondary-action" onClick={() => setStep(1)}>Back</button>
            <button type="button" className="review-decide-save" disabled={uploads.length === 0} onClick={() => setStep(3)}>
              Continue <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : null}

      {/* STEP 3 — Extracted business data */}
      {step === 3 ? (
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <ScanText size={16} aria-hidden="true" />
              <h2>Step 3 · What the documents say</h2>
            </div>
          </div>
          {uploads.map((u) => {
            const rows = extracted[u.record.document_id] ?? [];
            return (
              <div className="ship-extract-block" key={u.record.document_id}>
                <div className="ship-extract-head">
                  <strong>{u.record.filename}</strong>
                  <span className="tag">{humanize(u.kind)}</span>
                </div>
                {rows.length === 0 ? (
                  <p className="empty-state">Reading this document — the validator will see and confirm the data.</p>
                ) : (
                  <div className="ship-extract-grid">
                    {rows.map((row, index) => (
                      <div className="ship-extract-cell" key={`${row.label}-${index}`}>
                        <span>{row.label}</span>
                        <strong>{row.value}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div className="review-form-actions">
            <button type="button" className="secondary-action" onClick={() => setStep(2)}>Back</button>
            <button type="button" className="review-decide-save" disabled={!canSave} onClick={() => void handleSaveToQueue()}>
              {saving ? "Saving…" : "Save to validation queue"}
            </button>
          </div>
          <p className="access-note">
            <small>Saving does not create an official shipment or touch inventory — it queues the shipment for a validator to approve.</small>
          </p>
        </section>
      ) : null}

      {/* STEP 4 — Saved */}
      {step === 4 && savedShipment ? (
        <section className="panel cockpit-panel">
          <div className="empty-story">
            <span className="empty-story-mark"><PackagePlus size={22} aria-hidden="true" /></span>
            <strong>{savedShipment.shipment_name ?? savedShipment.import_file_number} is pending validation</strong>
            <span>
              {savedShipment.lines.length} line item(s) captured from {uploads.length} document(s). It now waits in
              Primary Documents → Validate. Nothing has posted to inventory, reports, or analytics — a validator must
              approve it first, and stock only moves on goods receipt.
            </span>
          </div>
          <div className="review-form-actions">
            <button type="button" className="review-decide-save" onClick={resetWizard}>Upload another shipment</button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
