import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Layers,
  PackagePlus,
  Ship,
  Trash2,
  UploadCloud,
} from "lucide-react";

import {
  assembleImportFromDocuments,
  fetchImportCandidates,
  getExtractionMaster,
  saveSecondaryShipment,
  uploadDocument,
  type ApiAuthenticatedUser,
  type ApiImportFileCandidate,
} from "../../lib/api";
import type { DocumentType } from "../../types/domain";

// Upload Center (Phase 6C). One upload surface for every operational user — no
// "Primary vs Secondary vs Master" decision. Documents are evidence; the
// shipment is the business object. The user assigns a shipment, drops files,
// glances at the business data we read, and submits. Nothing official is created
// and no business data moves until a validator approves it later.
//
// The motion here follows the design-engineering rules: custom ease-out curves,
// scale-on-press feedback, staggered list entrances, transform/opacity only, and
// full prefers-reduced-motion support (handled in CSS).

type Direction = "subsidiary" | "direct";

const DOC_TYPES: { type: DocumentType; label: string }[] = [
  { type: "commercial_invoice", label: "Commercial Invoice" },
  { type: "packing_list", label: "Packing List" },
  { type: "air_waybill", label: "Air Waybill" },
  { type: "bill_of_entry", label: "Customs / B3 / PO" },
  { type: "bill_of_lading", label: "Proof of Delivery" },
];

const TYPE_LABEL = new Map(DOC_TYPES.map((d) => [d.type, d.label]));

// Business fields worth showing the uploader — never OCR internals.
const BUSINESS_FIELDS = new Set([
  "invoice_number",
  "document_number",
  "material_code",
  "item_code",
  "product_description",
  "description",
  "batch_number",
  "batch",
  "quantity",
  "unit_value",
  "value",
  "currency",
  "country",
  "invoice_date",
  "document_date",
  "net_weight",
  "gross_weight",
]);

function humanize(value: string): string {
  const text = value.replace(/[_-]/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// System classification from the filename — the user can correct it per file,
// but should rarely need to.
function detectType(filename: string): DocumentType {
  const f = filename.toLowerCase();
  if (/(packing|pack[\s_-]?list|\bpl\b)/.test(f)) return "packing_list";
  if (/(awb|waybill|air[\s_-]?way)/.test(f)) return "air_waybill";
  if (/(\bb3\b|customs|bill[\s_-]?of[\s_-]?entry)/.test(f)) return "bill_of_entry";
  if (/(pod|proof[\s_-]?of[\s_-]?delivery|delivery[\s_-]?note)/.test(f)) return "bill_of_lading";
  if (/(\bpo\b|purchase[\s_-]?order)/.test(f)) return "bill_of_entry";
  if (/(invoice|\binv\b|\bci\b|commercial)/.test(f)) return "commercial_invoice";
  return "commercial_invoice";
}

type Row = { label: string; value: string };
type Upload = {
  id: string;
  filename: string;
  documentId: string | null;
  type: DocumentType;
  rows: Row[];
  status: "reading" | "ready" | "error";
};

let rowSeq = 0;

export function UploadCenter({ currentUser }: { currentUser: ApiAuthenticatedUser }) {
  const [direction, setDirection] = useState<Direction>("subsidiary");
  const [shipMode, setShipMode] = useState<"new" | "existing">("new");
  const [candidates, setCandidates] = useState<ApiImportFileCandidate[]>([]);
  const [existingId, setExistingId] = useState("");

  // Shipment header.
  const [country, setCountry] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [eta, setEta] = useState("");
  const [vertical, setVertical] = useState("");
  const [shipmentNo, setShipmentNo] = useState("");
  const [customer, setCustomer] = useState("");
  const [orderNo, setOrderNo] = useState("");

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchImportCandidates().then(setCandidates).catch(() => setCandidates([]));
  }, []);

  const shipmentName = useMemo(() => {
    if (shipMode === "existing") {
      const found = candidates.find((c) => c.import_file_number === existingId);
      return found?.shipment_name ?? existingId ?? "shipment";
    }
    if (direction === "direct") {
      return [customer, orderNo].filter(Boolean).join(" · ") || "New customer shipment";
    }
    return [country, vertical, shipmentNo].map((p) => p.trim().toUpperCase()).filter(Boolean).join("-") || "New shipment";
  }, [shipMode, existingId, candidates, direction, customer, orderNo, country, vertical, shipmentNo]);

  async function ingest(file: File) {
    const id = `u${++rowSeq}`;
    const type = detectType(file.name);
    setUploads((current) => [...current, { id, filename: file.name, documentId: null, type, rows: [], status: "reading" }]);
    try {
      const record = await uploadDocument(type, file);
      let rows: Row[] = [];
      try {
        const master = await getExtractionMaster(record.document_id);
        rows = master.fields
          .filter((field) => BUSINESS_FIELDS.has(field.field_name.toLowerCase()))
          .map((field) => ({ label: humanize(field.field_name), value: field.corrected_value || field.extracted_value || "—" }));
      } catch {
        /* extraction still processing — the validator will see it */
      }
      setUploads((current) =>
        current.map((u) => (u.id === id ? { ...u, documentId: record.document_id, rows, status: "ready" } : u)),
      );
    } catch {
      setUploads((current) => current.map((u) => (u.id === id ? { ...u, status: "error" } : u)));
    }
  }

  async function handleFiles(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list);
    setBusy(true);
    setMessage(null);
    try {
      for (const file of files) await ingest(file);
    } finally {
      setBusy(false);
    }
  }

  function setType(id: string, type: DocumentType) {
    setUploads((current) => current.map((u) => (u.id === id ? { ...u, type } : u)));
  }
  function removeUpload(id: string) {
    setUploads((current) => current.filter((u) => u.id !== id));
  }

  const ready = uploads.filter((u) => u.status === "ready");
  const headerComplete =
    shipMode === "existing"
      ? Boolean(existingId)
      : direction === "direct"
        ? Boolean(customer.trim() && country.trim())
        : Boolean(country.trim() && shipmentNo.trim());
  const canSubmit = ready.length > 0 && headerComplete && !saving;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    setMessage(null);
    try {
      if (direction === "direct") {
        const documents = ready.map((u) => ({
          document_id: u.documentId as string,
          filename: u.filename,
          kind: TYPE_LABEL.get(u.type) ?? u.type,
          rows: u.rows,
        }));
        const saved = await saveSecondaryShipment({
          customer: customer.trim(),
          country: country.trim(),
          order_number: orderNo.trim() || shipmentName,
          shipment_type: "standard",
          documents,
          actor: currentUser.email,
        });
        setSavedName(`${saved.customer} · ${saved.shipment_id}`);
      } else {
        const ci = ready.filter((u) => u.type === "commercial_invoice").map((u) => u.documentId as string);
        const pl = ready.filter((u) => u.type === "packing_list").map((u) => u.documentId as string);
        const awb = ready.find((u) => u.type === "air_waybill")?.documentId ?? null;
        const candidate = await assembleImportFromDocuments({
          commercial_invoice_document_ids: ci,
          packing_list_document_ids: pl,
          awb_document_id: awb,
          shipment_country: shipMode === "new" ? country.trim() || null : null,
          shipment_vertical: shipMode === "new" ? vertical.trim() || null : null,
          shipment_number: shipMode === "new" ? shipmentNo.trim() || null : null,
        });
        setSavedName(candidate.shipment_name ?? candidate.import_file_number);
      }
    } catch (error) {
      setMessage({ tone: "bad", text: error instanceof Error ? error.message : "Could not save to the validation queue." });
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setUploads([]);
    setSavedName(null);
    setMessage(null);
    setCountry("");
    setOrigin("");
    setDestination("");
    setEta("");
    setVertical("");
    setShipmentNo("");
    setCustomer("");
    setOrderNo("");
    setExistingId("");
    fetchImportCandidates().then(setCandidates).catch(() => undefined);
  }

  if (savedName) {
    return (
      <div className="ops-stage">
        <section className="panel cockpit-panel uc-done">
          <span className="uc-done-mark"><PackagePlus size={26} aria-hidden="true" /></span>
          <h2>{savedName} is waiting for validation</h2>
          <p>
            {ready.length} document{ready.length === 1 ? "" : "s"} attached. Nothing has touched inventory, sales,
            planning, or analytics — a validator must approve it first. Stock only moves later, on goods receipt.
          </p>
          <button type="button" className="uc-primary" onClick={reset}>
            Upload another shipment
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="ops-stage uc">
      <section className="cockpit-hero">
        <div className="cockpit-hero-top">
          <div>
            <p className="eyebrow">Upload Center</p>
            <h2>Drop your documents — we'll file them under the right shipment</h2>
            <p className="dash-story">
              One place for every document. Assign a shipment, drop the files, and check the business data we read.
              Saving puts the shipment in the validation queue — nothing official is created until it's approved.
            </p>
          </div>
        </div>
      </section>

      {message ? <p className={`review-message ${message.tone}`} role="alert">{message.text}</p> : null}

      {/* Direction — a business attribute of the shipment, not "which screen" */}
      <div className="uc-seg" role="tablist" aria-label="Shipment direction">
        <button type="button" role="tab" aria-selected={direction === "subsidiary"} className={`uc-seg-btn${direction === "subsidiary" ? " active" : ""}`} onClick={() => setDirection("subsidiary")}>
          <Ship size={15} aria-hidden="true" /> Inbound · into our stock
        </button>
        <button type="button" role="tab" aria-selected={direction === "direct"} className={`uc-seg-btn${direction === "direct" ? " active" : ""}`} onClick={() => { setDirection("direct"); setShipMode("new"); }}>
          <ArrowRight size={15} aria-hidden="true" /> Outbound · to a customer
        </button>
      </div>

      <div className="uc-grid">
        {/* LEFT — shipment + dropzone */}
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title"><Layers size={16} aria-hidden="true" /><h2>1 · Which shipment?</h2></div>
            <span className="uc-name-chip">{shipmentName}</span>
          </div>

          {direction === "subsidiary" ? (
            <div className="uc-seg uc-seg-sm" role="tablist" aria-label="Shipment source">
              <button type="button" role="tab" aria-selected={shipMode === "new"} className={`uc-seg-btn${shipMode === "new" ? " active" : ""}`} onClick={() => setShipMode("new")}>New shipment</button>
              <button type="button" role="tab" aria-selected={shipMode === "existing"} className={`uc-seg-btn${shipMode === "existing" ? " active" : ""}`} onClick={() => setShipMode("existing")}>Add to existing</button>
            </div>
          ) : null}

          {shipMode === "existing" && direction === "subsidiary" ? (
            <label className="field-control">
              <span>Existing shipment</span>
              <select value={existingId} onChange={(e) => setExistingId(e.target.value)}>
                <option value="">Select a shipment…</option>
                {candidates.map((c) => (
                  <option key={c.import_file_number} value={c.import_file_number}>
                    {c.shipment_name ?? c.import_file_number} · {c.destination_country}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="uc-header-grid">
              {direction === "direct" ? (
                <>
                  <label className="field-control"><span>Customer</span><input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Apollo Hospital" /></label>
                  <label className="field-control"><span>Order number</span><input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="PO-2026-0142" /></label>
                </>
              ) : (
                <>
                  <label className="field-control"><span>Vertical</span><input value={vertical} onChange={(e) => setVertical(e.target.value)} placeholder="Cardio" /></label>
                  <label className="field-control"><span>Shipment no.</span><input value={shipmentNo} onChange={(e) => setShipmentNo(e.target.value)} placeholder="0361" /></label>
                </>
              )}
              <label className="field-control"><span>Country</span><input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Italy" /></label>
              <label className="field-control"><span>Origin</span><input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="India" /></label>
              <label className="field-control"><span>Destination</span><input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Milan" /></label>
              <label className="field-control"><span>ETA</span><input type="date" value={eta} onChange={(e) => setEta(e.target.value)} /></label>
            </div>
          )}

          <div className="panel-heading" style={{ marginTop: 18 }}>
            <div className="worklist-title"><UploadCloud size={16} aria-hidden="true" /><h2>2 · Drop the documents</h2></div>
          </div>
          <div
            className={`uc-drop${over ? " is-over" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); void handleFiles(e.dataTransfer.files); }}
          >
            <UploadCloud size={30} aria-hidden="true" className="uc-drop-icon" />
            <strong>Drag &amp; drop files here</strong>
            <span>or click to browse — PDF, Excel, CSV, Word, images. Multiple at once.</span>
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }}
            />
          </div>
        </section>

        {/* RIGHT — what we read */}
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title"><FileText size={16} aria-hidden="true" /><h2>3 · What the documents say</h2></div>
            <span className="cc-panel-meta">{uploads.length}</span>
          </div>

          {uploads.length === 0 ? (
            <div className="uc-empty">
              <FileText size={22} aria-hidden="true" />
              <p>Files you drop appear here with the business data we read — invoice numbers, products, batches, quantities, values. No technical detail.</p>
            </div>
          ) : (
            <ul className="uc-files">
              {uploads.map((u, index) => (
                <li key={u.id} className={`uc-file uc-file-${u.status}`} style={{ animationDelay: `${Math.min(index, 14) * 45}ms` }}>
                  <div className="uc-file-top">
                    <span className="uc-file-icon">
                      {u.status === "reading" ? <span className="uc-spin" aria-hidden="true" /> : u.status === "error" ? <Trash2 size={15} aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}
                    </span>
                    <span className="uc-file-name">{u.filename}</span>
                    <select className="uc-file-type" value={u.type} onChange={(e) => setType(u.id, e.target.value as DocumentType)} aria-label="Document type">
                      {DOC_TYPES.map((d) => <option key={d.type} value={d.type}>{d.label}</option>)}
                    </select>
                    <button type="button" className="uc-file-remove" onClick={() => removeUpload(u.id)} title="Remove"><Trash2 size={14} aria-hidden="true" /></button>
                  </div>
                  {u.status === "reading" ? (
                    <p className="uc-file-hint">Reading the document…</p>
                  ) : u.rows.length > 0 ? (
                    <div className="uc-file-rows">
                      {u.rows.slice(0, 8).map((row, i) => (
                        <div className="uc-file-cell" key={`${row.label}-${i}`}><span>{row.label}</span><strong>{row.value}</strong></div>
                      ))}
                    </div>
                  ) : (
                    <p className="uc-file-hint">No business data read yet — the validator will see and confirm it.</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="uc-actions">
            <button type="button" className="uc-primary" disabled={!canSubmit} onClick={() => void handleSubmit()}>
              {saving ? "Saving…" : "Save to validation queue"} <ArrowRight size={15} aria-hidden="true" />
            </button>
            {!headerComplete ? <small className="uc-need">Add the shipment details first.</small> : ready.length === 0 ? <small className="uc-need">Drop at least one document.</small> : null}
          </div>
          <p className="access-note"><small>Saving creates nothing official — it queues the shipment for a validator. Inventory only moves later, on goods receipt.</small></p>
        </section>
      </div>
    </div>
  );
}
