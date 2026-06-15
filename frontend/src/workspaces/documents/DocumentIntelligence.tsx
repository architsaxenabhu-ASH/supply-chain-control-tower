import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  CheckCircle2,
  FileText,
  FileUp,
  Globe2,
  Languages,
  LayoutTemplate,
  ScanText,
  ShieldCheck,
} from "lucide-react";

import {
  fetchImportCandidates,
  fetchValidationQueue,
  getExtractionMaster,
  listDocuments,
  listTranslationMemory,
  saveTranslation,
  type ApiAuthenticatedUser,
  type ApiImportFileCandidate,
  type ApiTranslationEntry,
  type ApiValidationQueueResponse,
} from "../../lib/api";
import type {
  DocumentExtractionMaster,
  DocumentRecord,
  ExtractedField,
  MasterCandidate,
} from "../../types/domain";
import type { DashboardNav } from "../dashboards/Dashboards";

// Document Intelligence Center (Phase 6). The document → transaction pipeline as
// a first-class intelligence surface:
//
//   Upload → Detect Country → Document Type → Template → Translation Memory →
//   Extract → Human Validation → Transaction
//
// OCR autofills every field, but it never creates a transaction. A human must
// validate and approve before anything posts — the gate is mandatory and
// always visible. Reuses the existing extraction + validation engines.

const STAGES: { label: string; icon: ComponentType<{ size?: number; "aria-hidden"?: boolean | "true" | "false" }>; gate?: boolean }[] = [
  { label: "Upload", icon: FileUp },
  { label: "Detect country", icon: Globe2 },
  { label: "Document type", icon: FileText },
  { label: "Template", icon: LayoutTemplate },
  { label: "Translation memory", icon: Languages },
  { label: "Extract (autofill)", icon: ScanText },
  { label: "Human validation", icon: ShieldCheck, gate: true },
  { label: "Transaction", icon: CheckCircle2 },
];

function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const text = value.replace(/[_-]/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function confidencePct(score: number | null | undefined): number | null {
  if (score === null || score === undefined) return null;
  return score <= 1 ? Math.round(score * 100) : Math.round(score);
}

function confidenceTone(pct: number | null): string {
  if (pct === null) return "";
  if (pct >= 85) return "tone-good";
  if (pct >= 60) return "tone-warn";
  return "tone-bad";
}

function detectCountry(candidates: MasterCandidate[]): string | null {
  const country = candidates.find((c) => c.candidate_type === "country");
  return country ? country.candidate_name : null;
}

export function DocumentIntelligence({ onNavigate, currentUser }: DashboardNav & { currentUser: ApiAuthenticatedUser }) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [queue, setQueue] = useState<ApiValidationQueueResponse | null>(null);
  const [candidates, setCandidates] = useState<ApiImportFileCandidate[]>([]);
  const [memory, setMemory] = useState<ApiTranslationEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [master, setMaster] = useState<DocumentExtractionMaster | null>(null);
  const [masterLoading, setMasterLoading] = useState(false);

  // Translation capture form.
  const [tSource, setTSource] = useState("");
  const [tLang, setTLang] = useState("it");
  const [tTarget, setTTarget] = useState("");
  const [tSaving, setTSaving] = useState(false);
  const [tMessage, setTMessage] = useState("");

  function loadAll() {
    setLoading(true);
    Promise.allSettled([fetchDocs(), fetchValidationQueue(), fetchImportCandidates(), listTranslationMemory()]).then(
      ([d, q, c, m]) => {
        if (d.status === "fulfilled") setDocuments(d.value);
        if (q.status === "fulfilled") setQueue(q.value);
        if (c.status === "fulfilled") setCandidates(c.value);
        if (m.status === "fulfilled") setMemory(m.value);
        setLoading(false);
      },
    );
  }
  function fetchDocs() {
    return listDocuments();
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMaster(null);
      return;
    }
    let active = true;
    setMasterLoading(true);
    getExtractionMaster(selectedId)
      .then((value) => {
        if (active) setMaster(value);
      })
      .catch(() => {
        if (active) setMaster(null);
      })
      .finally(() => {
        if (active) setMasterLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const totalFields = documents.reduce((sum, d) => sum + d.extracted_field_count, 0);
  const awaitingValidation = (queue?.pending_review_count ?? 0) + (queue?.missing_required_count ?? 0);
  const readyBundles = candidates.filter((c) => !["received", "closed", "cancelled"].includes(c.status.toLowerCase())).length;

  const fieldsToValidate = useMemo<ExtractedField[]>(() => {
    if (!master) return [];
    return [...master.fields].sort((a, b) => (confidencePct(a.confidence_score) ?? 0) - (confidencePct(b.confidence_score) ?? 0));
  }, [master]);

  async function handleSaveTranslation() {
    if (!tSource.trim() || !tTarget.trim()) {
      setTMessage("Enter both the original phrase and its English translation.");
      return;
    }
    setTSaving(true);
    setTMessage("");
    try {
      await saveTranslation({
        source_text: tSource.trim(),
        source_language: tLang.trim() || "it",
        target_text: tTarget.trim(),
        actor: currentUser.email,
      });
      setTSource("");
      setTTarget("");
      setTMessage("Saved. This translation is now reused automatically wherever the phrase appears.");
      setMemory(await listTranslationMemory());
    } catch (error) {
      setTMessage(error instanceof Error ? error.message : "Could not save the translation.");
    } finally {
      setTSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="cc-loading" aria-busy="true">
        <div className="skeleton-row tall" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </div>
    );
  }

  const selectedCountry = master ? detectCountry(master.master_candidates) : null;

  return (
    <div className="ops-stage">
      <section className="cockpit-hero">
        <div className="cockpit-hero-top">
          <div>
            <p className="eyebrow">Document Intelligence · upload to transaction</p>
            <h2>{documents.length === 0 ? "No documents in the pipeline yet" : `${documents.length} document${documents.length === 1 ? "" : "s"} read, ${awaitingValidation} field${awaitingValidation === 1 ? "" : "s"} awaiting your sign-off`}</h2>
            <p className="dash-story">
              OCR reads each document and <strong>autofills every field it can</strong> — country, document type,
              line items, values. It never creates a transaction on its own. A human must validate and approve at the
              gate before anything posts to inventory or finance.
            </p>
          </div>
        </div>
        <div className="vitals-row">
          <div className="vital">
            <strong>{documents.length}</strong>
            <span>Documents read</span>
          </div>
          <div className="vital">
            <strong>{totalFields}</strong>
            <span>Fields autofilled</span>
          </div>
          <div className={`vital ${awaitingValidation > 0 ? "tone-warn" : "tone-good"}`}>
            <strong>{awaitingValidation}</strong>
            <span>Awaiting human validation</span>
          </div>
          <div className="vital">
            <strong>{readyBundles}</strong>
            <span>Shipment bundles open</span>
          </div>
          <div className="vital">
            <strong>{memory.length}</strong>
            <span>Translations remembered</span>
          </div>
        </div>
      </section>

      {/* The pipeline, with the mandatory human gate highlighted. */}
      <section className="panel cockpit-panel">
        <div className="doc-pipeline">
          {STAGES.map((stage, index) => (
            <div className={`doc-stage${stage.gate ? " is-gate" : ""}`} key={stage.label}>
              <span className="doc-stage-icon">
                <stage.icon size={16} aria-hidden="true" />
              </span>
              <span className="doc-stage-label">{stage.label}</span>
              {index < STAGES.length - 1 ? <span className="doc-stage-arrow" aria-hidden="true">→</span> : null}
            </div>
          ))}
        </div>
        <p className="access-note">
          <ShieldCheck size={13} aria-hidden="true" /> The human-validation gate is mandatory. OCR can fill the form,
          but only a person with the right permission can turn it into a transaction.
        </p>
      </section>

      <div className="hub-columns">
        <section className="panel cockpit-panel">
          <div className="panel-heading">
            <div className="worklist-title">
              <ScanText size={16} aria-hidden="true" />
              <h2>Documents</h2>
            </div>
            <button type="button" className="secondary-action" onClick={() => onNavigate("doc-primary-upload")}>
              <FileUp size={15} aria-hidden="true" /> Upload
            </button>
          </div>
          {documents.length === 0 ? (
            <div className="empty-story">
              <span className="empty-story-mark">
                <FileUp size={22} aria-hidden="true" />
              </span>
              <strong>Upload a document to begin</strong>
              <span>
                Drop a commercial invoice, packing list, or AWB on the Upload screen. The system detects its country
                and type, applies the matching template and translation memory, and autofills the fields for you to
                check.
              </span>
            </div>
          ) : (
            <ul className="doc-list">
              {documents.map((document) => {
                const isSelected = document.document_id === selectedId;
                const ready = document.missing_required_count === 0;
                return (
                  <li key={document.document_id}>
                    <button
                      type="button"
                      className={`doc-item${isSelected ? " selected" : ""}`}
                      onClick={() => setSelectedId(isSelected ? null : document.document_id)}
                      aria-expanded={isSelected}
                    >
                      <span className="doc-item-icon">
                        <FileText size={16} aria-hidden="true" />
                      </span>
                      <span className="doc-item-body">
                        <strong>{document.filename}</strong>
                        <small>
                          {humanize(document.document_type)} · {document.extracted_field_count} fields autofilled ·{" "}
                          {document.created_at?.slice(0, 10)}
                        </small>
                      </span>
                      <span className={`dot-pill ${ready ? "tone-good" : "tone-warn"}`}>
                        <span className="seg-dot" aria-hidden="true" />
                        {ready ? "Ready to validate" : `${document.missing_required_count} missing`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="hub-rail">
          {selectedId ? (
            <section className="panel cockpit-panel">
              <div className="panel-heading">
                <div className="worklist-title">
                  <LayoutTemplate size={15} aria-hidden="true" />
                  <h2>Extraction · autofilled</h2>
                </div>
              </div>
              {masterLoading ? (
                <p className="empty-state">Reading the document…</p>
              ) : master ? (
                <>
                  <dl className="doc-detect">
                    <div>
                      <dt>Detected country</dt>
                      <dd>{selectedCountry ?? "Not detected — set on validation"}</dd>
                    </div>
                    <div>
                      <dt>Document type</dt>
                      <dd>{humanize(master.document.document_type)}</dd>
                    </div>
                    <div>
                      <dt>Template applied</dt>
                      <dd>
                        {selectedCountry ? `${selectedCountry} · ${humanize(master.document.document_type)}` : humanize(master.document.document_type)}
                      </dd>
                    </div>
                  </dl>
                  <div className="doc-fields">
                    {fieldsToValidate.slice(0, 12).map((field) => {
                      const pct = confidencePct(field.confidence_score);
                      return (
                        <div className="doc-field" key={field.field_name}>
                          <div className="doc-field-head">
                            <span>{humanize(field.field_name)}</span>
                            {pct !== null ? <strong className={confidenceTone(pct)}>{pct}%</strong> : null}
                          </div>
                          <span className="doc-field-value">{field.corrected_value || field.extracted_value || "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="review-form-actions">
                    <button type="button" className="review-decide-save" onClick={() => onNavigate("import-validation")}>
                      <ShieldCheck size={15} aria-hidden="true" /> Validate &amp; post (human gate)
                    </button>
                  </div>
                  <p className="access-note">
                    <small>Nothing here has posted. Validation confirms the autofill and creates the transaction.</small>
                  </p>
                </>
              ) : (
                <p className="empty-state">Could not read this document's extraction.</p>
              )}
            </section>
          ) : null}

          <section className="panel cockpit-panel">
            <div className="panel-heading">
              <div className="worklist-title">
                <Languages size={15} aria-hidden="true" />
                <h2>Translation memory</h2>
              </div>
              <span className="cc-panel-meta">{memory.length}</span>
            </div>
            <div className="review-decision-form doc-translate-form">
              <label>
                <span>Original phrase</span>
                <input value={tSource} onChange={(event) => setTSource(event.target.value)} placeholder="e.g. Fattura commerciale" />
              </label>
              <div className="doc-translate-row">
                <label>
                  <span>Language</span>
                  <input value={tLang} onChange={(event) => setTLang(event.target.value)} placeholder="it / de / fr" />
                </label>
                <label>
                  <span>English</span>
                  <input value={tTarget} onChange={(event) => setTTarget(event.target.value)} placeholder="Commercial invoice" />
                </label>
              </div>
              <div className="review-form-actions">
                <button type="button" className="review-decide-save" disabled={tSaving} onClick={() => void handleSaveTranslation()}>
                  {tSaving ? "Saving…" : "Remember translation"}
                </button>
                <small>Translate once — reused automatically forever (App-Manager governed, audited).</small>
              </div>
              {tMessage ? <p className="rates-message">{tMessage}</p> : null}
            </div>
            {memory.length > 0 ? (
              <div className="worklist-body doc-memory">
                {memory.slice(0, 8).map((entry) => (
                  <div className="worklist-row" key={entry.key}>
                    <div>
                      <strong>{entry.source_text}</strong>
                      <small>
                        {entry.source_language} → {entry.target_text}
                      </small>
                    </div>
                    {entry.times_reused > 0 ? <span className="tag">reused ×{entry.times_reused}</span> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
