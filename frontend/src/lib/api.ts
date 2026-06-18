import type { DocumentExtractionMaster, DocumentRecord, DocumentType } from "../types/domain";
import { SAMPLE_API_FALLBACKS } from "./sampleApiData";

const DEFAULT_API_BASE_URL =
  typeof window === "undefined"
    ? "http://localhost:8000/api/v1"
    : `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;

// Attribution + auth: the logged-in session token and the current screen are
// attached to every request so the backend can enforce auth and fully attribute
// each action. Set from the app on login and on view changes.
let authToken = "";
let sourceScreen = "";

export function setAuthToken(token: string): void {
  authToken = token || "";
}

export function setSourceScreen(screen: string): void {
  sourceScreen = screen || "";
}

function authHeaders(base: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...base };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  if (sourceScreen) {
    headers["X-Source-Screen"] = sourceScreen;
  }
  return headers;
}

export async function getHealth(): Promise<Response> {
  return fetch(`${API_BASE_URL.replace("/api/v1", "")}/health`);
}

export async function uploadDocument(
  documentType: DocumentType,
  file: File,
): Promise<DocumentRecord> {
  const formData = new FormData();
  formData.append("document_type", documentType);
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail ?? "Upload failed");
  }

  return response.json();
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const response = await fetch(`${API_BASE_URL}/documents`);
  if (!response.ok) {
    throw new Error("Could not load documents");
  }
  return response.json();
}

export async function getExtractionMaster(documentId: string): Promise<DocumentExtractionMaster> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}/extraction-master`);
  if (!response.ok) {
    throw new Error("Could not load extraction master");
  }
  return response.json();
}

export function rescanDocument(documentId: string): Promise<DocumentRecord> {
  return postJson<DocumentRecord, Record<string, never>>(
    `/documents/${encodeURIComponent(documentId)}/rescan`,
    {},
  );
}

// In-flight request counter (Phase 5F): the tab-entry stinger reads this to
// know when the incoming view has truly finished loading its data — views
// render their shells before data arrives, so the network is the honest
// readiness signal.
let pendingReads = 0;

export function getPendingReadCount(): number {
  return pendingReads;
}

async function getJson<T>(path: string): Promise<T> {
  pendingReads += 1;
  // When the backend has no data for a known list endpoint (or is unreachable),
  // serve representative sample data so every tab is populated for demos. Real
  // data always wins — the fallback only fires on error or an empty array.
  const fallback = SAMPLE_API_FALLBACKS[path.split("?")[0]];
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders() });
    if (!response.ok) {
      if (fallback) return fallback() as T;
      throw new Error(`Could not load ${path}`);
    }
    const data = (await response.json()) as T;
    if (fallback && Array.isArray(data) && data.length === 0) {
      return fallback() as T;
    }
    return data;
  } catch (error) {
    if (fallback) return fallback() as T;
    throw error;
  } finally {
    pendingReads -= 1;
  }
}

async function postJson<TResponse, TPayload>(path: string, payload: TPayload): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `Could not submit ${path}` }));
    throw new Error(error.detail ?? `Could not submit ${path}`);
  }

  return response.json();
}

async function patchJson<TResponse, TPayload>(path: string, payload: TPayload): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `Could not submit ${path}` }));
    throw new Error(error.detail ?? `Could not submit ${path}`);
  }

  return response.json();
}

export type ApiProduct = {
  item_code: string;
  product_description: string;
  product_category: string;
  uom: string;
  product_status: "active" | "inactive";
  shelf_life_months: number | null;
};

export type ApiInventoryBatch = {
  item_code: string;
  product_description: string;
  product_category: string;
  batch_number: string;
  warehouse_location: string;
  quantity_available: number;
  manufacturing_date: string;
  expiry_date: string;
  unit_value: number;
  inventory_value: number;
  days_to_expiry: number;
  expiry_bucket: string;
  currency: string | null;
  registered_date: string | null;
};

export type ApiShipment = {
  shipment_id: string;
  request_date: string;
  requestor_name: string;
  customer_name: string;
  destination_country: string;
  city?: string | null;
  priority: "normal" | "urgent";
  required_delivery_date: string;
  status: "draft" | "submitted" | "approved" | "dispatched" | "delivered" | "cancelled";
  lines: Array<{
    shipment_id: string;
    item_code: string;
    batch_number: string;
    warehouse_location: string | null;
    quantity_requested: number;
    quantity_approved: number;
  }>;
};

export type ApiDispatch = {
  dispatch_number: string;
  shipment_id: string;
  dispatch_date: string;
  transporter_courier: string;
  tracking_number: string;
  dispatched_by: string;
  status: string;
};

export type ApiGoodsReceipt = {
  grn_number: string;
  receipt_date: string;
  warehouse: string;
  supplier: string;
  status: string;
  lines: Array<{
    item_code: string;
    batch_number: string;
    quantity_received: number;
    expiry_date: string;
    unit_value: number;
  }>;
};

export type ApiInventoryCount = {
  inventory_count_id: string;
  count_date: string;
  warehouse: string;
  status: string;
  lines: Array<{
    item_code: string;
    batch_number: string;
    system_quantity: number;
    physical_quantity: number;
    variance_quantity: number;
    variance_type: string;
  }>;
};

export type ApiCustomer = {
  customer_code: string;
  customer_name: string;
  country: string;
  city?: string | null;
  customer_type: string;
  contact_person: string;
};

export function createCustomer(payload: {
  customer_name: string;
  country: string;
  city?: string | null;
  customer_type?: string;
  contact_person?: string;
}): Promise<ApiCustomer> {
  return postJson<ApiCustomer, typeof payload>("/customers", payload);
}

export type ApiDashboardSummary = {
  total_inventory_value: number;
  total_inventory_quantity: number;
  inventory_by_warehouse: Record<string, number>;
  inventory_by_category: Record<string, number>;
  expiring_stock_alerts: number;
  expiring_in_30_days: number;
  expiring_in_60_days: number;
  expiring_in_90_days: number;
  expired_inventory_count: number;
  open_shipment_requests: number;
  dispatched_shipments: number;
  goods_received_today: number;
  inventory_variance_summary: Record<string, number>;
  top_customers: Array<Record<string, string | number>>;
};

export type ApiAuditEvent = {
  id: number;
  action: string;
  module_name: string;
  entity_name: string;
  entity_id: string;
  actor: string | null;
  reason: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
};

export type ApiRoleDefinition = {
  role_name: string;
  description: string;
  permissions: string[];
};

export type ApiSecurityUser = {
  email: string;
  full_name: string;
  role_name: string;
  country_scope: string[];
  warehouse_scope: string[];
  is_active: boolean;
  has_password: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type ApiApprovalRule = {
  rule_id: string;
  process_name: string;
  country: string;
  vertical: string;
  material_code: string;
  approver_role: string;
  approver_email: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type ApiSecurityOverview = {
  role_definitions: ApiRoleDefinition[];
  users: ApiSecurityUser[];
  approval_rules: ApiApprovalRule[];
};

export type ApiAuthenticatedUser = {
  email: string;
  full_name: string;
  role_name: string;
  country_scope: string[];
  warehouse_scope: string[];
  permissions: string[];
  session_token: string;
};

export type ApiSaveSecurityUserRequest = {
  email: string;
  full_name: string;
  role_name: string;
  country_scope: string[];
  warehouse_scope: string[];
  is_active: boolean;
  password?: string | null;
  changed_by: string;
  change_reason: string;
  auth_token: string;
};

export type ApiSaveApprovalRuleRequest = {
  process_name: string;
  country: string;
  vertical: string;
  material_code: string;
  approver_role: string;
  approver_email: string;
  is_active: boolean;
  changed_by: string;
  change_reason: string;
  auth_token: string;
};

export type ApiAssistantAnswer = {
  question: string;
  answer: string;
  data: Array<Record<string, unknown>>;
};

export type ApiWorkflowResult = {
  status: string;
  message: string;
  data: Record<string, unknown>;
};

export type ApiProductLearningProfileResponse = {
  item_code: string;
  is_known: boolean;
  profile: Record<string, unknown> | null;
  questions: Array<{
    field_name: string;
    question: string;
    reason: string;
  }>;
};

export type ApiLearningStat = {
  label: string;
  count: number;
};

export type ApiLearningRule = {
  document_type: string;
  source_text: string;
  target_field: string;
  corrected_value: string | null;
  confidence: number;
  success_count: number;
  failure_count: number;
};

export type ApiCorrectionSuggestion = {
  suggested_value: string;
  confidence: number;
  times_seen: number;
  based_on: string;
};

export type ApiCorrectionSuggestionResponse = {
  field_name: string;
  current_value: string | null;
  suggestion: ApiCorrectionSuggestion | null;
};

export type ApiImportChecklistItem = {
  required_document_type: string;
  confidence: number;
  success_count: number;
  present: boolean;
};

export type ApiImportChecklistResponse = {
  country: string;
  vertical: string;
  material_code: string;
  is_known: boolean;
  items: ApiImportChecklistItem[];
  required_count: number;
  present_count: number;
  missing_count: number;
};

export type ApiCountryDocumentRule = {
  country: string;
  vertical: string;
  material_code: string;
  required_document_type: string;
  confidence: number;
  success_count: number;
};

export type ApiCorrectionEvent = {
  document_type: string;
  field_name: string;
  original_value: string | null;
  corrected_value: string | null;
  correction_reason: string | null;
  corrected_by: string;
  document_reference: string | null;
};

export type ApiEntityAlias = {
  entity_type: string;
  alias_text: string;
  master_code: string;
  approved: boolean;
};

export type ApiWarehouseCandidate = {
  country: string;
  warehouse_name: string;
  created_from_import_file: string | null;
  status: string;
  created_by: string;
  created_at: string;
};

export type ApiLearningInsights = {
  total_learning_rules: number;
  total_corrections: number;
  total_product_profiles: number;
  total_country_document_rules: number;
  total_entity_aliases: number;
  total_warehouse_candidates: number;
  average_rule_confidence: number;
  top_corrected_fields: ApiLearningStat[];
  corrections_by_document_type: ApiLearningStat[];
  top_learned_rules: ApiLearningRule[];
  country_document_rules: ApiCountryDocumentRule[];
  recent_corrections: ApiCorrectionEvent[];
  recent_entity_aliases: ApiEntityAlias[];
  recent_warehouse_candidates: ApiWarehouseCandidate[];
};

export type ApiImportFileCandidate = {
  import_file_number: string;
  shipment_name: string | null;
  shipment_vertical: string | null;
  shipment_number: string | null;
  supplier_name: string | null;
  destination_entity: string;
  destination_country: string;
  status: string;
  invoice_number: string | null;
  invoice_date: string | null;
  awb_number: string | null;
  origin_country: string | null;
  carrier_name: string | null;
  flight_number: string | null;
  flight_date: string | null;
  package_count: number | null;
  gross_weight_kg: number | null;
  chargeable_weight_kg: number | null;
  source_document_ids: string[];
  invoice_numbers: string[];
  commercial_invoice_document_ids: string[];
  packing_list_document_ids: string[];
  awb_document_id: string | null;
  extraction_warnings: string[];
  lines: Array<{
    item_code: string;
    product_description: string;
    batch_number: string;
    serial_number: string | null;
    expiry_date: string | null;
    quantity: number;
    uom: string;
    unit_value: number | null;
    currency: string | null;
    product_profile_status: string;
  }>;
};

export type ApiImportAssemblyRequest = {
  commercial_invoice_document_ids: string[];
  packing_list_document_ids: string[];
  commercial_invoice_document_id?: string | null;
  packing_list_document_id?: string | null;
  awb_document_id?: string | null;
  shipment_country?: string | null;
  shipment_vertical?: string | null;
  shipment_number?: string | null;
};

export type ApiImportGoodsReceiptPostRequest = {
  candidate: ApiImportFileCandidate;
  warehouse_name: string;
  posted_by: string;
  auth_token: string;
  supplier_name?: string | null;
  // "subsidiary" adds the goods to inventory; "direct" is a pass-through sale
  // that bypasses inventory.
  channel?: "subsidiary" | "direct";
};

export type ApiImportApprovalRequest = {
  candidate: ApiImportFileCandidate;
  approved_by: string;
  auth_token: string;
  approval_note?: string | null;
};

export type ApiImportDeliveryRequest = {
  candidate: ApiImportFileCandidate;
  delivered_by: string;
  auth_token: string;
  delivery_note?: string | null;
};

export type ApiWarehouseLocation = {
  warehouse_code: string;
  warehouse_name: string;
  country: string;
  is_active: boolean;
};

export type ApiValidationQueueItem = {
  queue_id: string;
  document_id: string;
  filename: string;
  document_type: DocumentType;
  field_name: string;
  extracted_value: string | null;
  corrected_value: string | null;
  effective_value: string | null;
  confidence_score: number | null;
  validation_status: "pending" | "approved" | "corrected" | "rejected";
  issue_type: string;
  issue_label: string;
  required_group: string | null;
  source_engine: string | null;
  created_at: string;
};

export type ApiValidationQueueResponse = {
  items: ApiValidationQueueItem[];
  total_count: number;
  missing_required_count: number;
  pending_review_count: number;
  corrected_count: number;
};

export type ApiFieldCorrectionRequest = {
  document_id: string;
  field_name: string;
  corrected_value: string;
  correction_reason: string;
  corrected_by: string;
  auth_token: string;
};

export type ApiFieldCorrectionResponse = {
  item: ApiValidationQueueItem;
  message: string;
};

export type ApiErpTemplate = {
  template_key: string;
  template_name: string;
  description: string;
  source_module: string;
  columns: string[];
};

export type ApiErpUploadRow = {
  row_number: number;
  source_reference: string;
  values: Record<string, unknown>;
  missing_fields: string[];
};

export type ApiErpUploadPreview = {
  template_key: string;
  template_name: string;
  generated_at: string;
  export_filename: string;
  columns: string[];
  rows: ApiErpUploadRow[];
  total_rows: number;
  valid_rows: number;
  blocked_rows: number;
  warnings: string[];
};

export function fetchProducts(): Promise<ApiProduct[]> {
  return getJson<ApiProduct[]>("/products");
}

export function fetchInventoryBatches(): Promise<ApiInventoryBatch[]> {
  return getJson<ApiInventoryBatch[]>("/inventory/batches");
}

export function fetchShipments(): Promise<ApiShipment[]> {
  return getJson<ApiShipment[]>("/shipments");
}

export function fetchDispatches(): Promise<ApiDispatch[]> {
  return getJson<ApiDispatch[]>("/dispatches");
}

export function fetchGoodsReceipts(): Promise<ApiGoodsReceipt[]> {
  return getJson<ApiGoodsReceipt[]>("/goods-receipts");
}

export function fetchInventoryCounts(): Promise<ApiInventoryCount[]> {
  return getJson<ApiInventoryCount[]>("/inventory-counts");
}

export function fetchCustomers(): Promise<ApiCustomer[]> {
  return getJson<ApiCustomer[]>("/customers");
}

export function fetchDashboardSummary(): Promise<ApiDashboardSummary> {
  return getJson<ApiDashboardSummary>("/dashboard/summary");
}

export function fetchValidationQueue(): Promise<ApiValidationQueueResponse> {
  return getJson<ApiValidationQueueResponse>("/validation/queue");
}

export function saveFieldCorrection(
  payload: ApiFieldCorrectionRequest,
): Promise<ApiFieldCorrectionResponse> {
  return postJson<ApiFieldCorrectionResponse, typeof payload>("/validation/corrections", payload);
}

export function fetchErpTemplates(): Promise<ApiErpTemplate[]> {
  return getJson<ApiErpTemplate[]>("/erp-uploads/templates");
}

export function previewErpUpload(payload: {
  template_key: string;
  auth_token: string;
}): Promise<ApiErpUploadPreview> {
  return postJson<ApiErpUploadPreview, typeof payload>("/erp-uploads/preview", payload);
}

export function askAssistant(question: string): Promise<ApiAssistantAnswer> {
  return postJson<ApiAssistantAnswer, { question: string }>("/assistant/query", { question });
}

export function createProduct(payload: {
  item_code: string;
  product_description: string;
  product_category: string;
  uom: string;
  product_status: "active" | "inactive";
  shelf_life_months?: number | null;
}): Promise<ApiProduct> {
  return postJson<ApiProduct, typeof payload>("/products", payload);
}

export function postGoodsReceipt(payload: {
  grn_number: string;
  receipt_date: string;
  warehouse: string;
  supplier: string;
  lines: Array<{
    item_code: string;
    batch_number: string;
    quantity_received: number;
    manufacturing_date?: string;
    expiry_date: string;
    unit_value: number;
  }>;
}): Promise<ApiWorkflowResult> {
  return postJson<ApiWorkflowResult, typeof payload>("/goods-receipts/post", payload);
}

export function createShipment(payload: {
  request_date: string;
  requestor_name: string;
  customer_name: string;
  destination_country: string;
  city?: string | null;
  priority: "normal" | "urgent";
  required_delivery_date: string;
  auth_token: string;
  submit_for_approval: boolean;
  lines: Array<{
    item_code: string;
    batch_number: string;
    warehouse_location: string;
    quantity_requested: number;
  }>;
}): Promise<ApiShipment> {
  return postJson<ApiShipment, typeof payload>("/shipments", payload);
}

export function approveShipment(
  shipmentId: string,
  payload: {
    approved_by: string;
    auth_token: string;
    lines: Array<{
      item_code: string;
      batch_number: string;
      warehouse_location?: string | null;
      quantity_approved: number;
    }>;
  },
): Promise<ApiWorkflowResult> {
  return postJson<ApiWorkflowResult, typeof payload>(`/shipments/${shipmentId}/approve`, payload);
}

export function confirmDispatch(
  shipmentId: string,
  payload: {
    dispatch_number: string;
    dispatch_date: string;
    transporter_courier: string;
    tracking_number: string;
    dispatched_by: string;
    auth_token: string;
  },
): Promise<ApiWorkflowResult> {
  return postJson<ApiWorkflowResult, typeof payload>(`/dispatches/${shipmentId}/confirm`, payload);
}

export function createInventoryCount(payload: {
  inventory_count_id: string;
  count_date: string;
  warehouse: string;
  counted_by: string;
  lines: Array<{
    item_code: string;
    batch_number: string;
    system_quantity: number;
    physical_quantity: number;
  }>;
}): Promise<ApiInventoryCount> {
  return postJson<ApiInventoryCount, typeof payload>("/inventory-counts", payload);
}

export function fetchProductLearningProfile(itemCode: string): Promise<ApiProductLearningProfileResponse> {
  return getJson<ApiProductLearningProfileResponse>(`/learning/product-profiles/${encodeURIComponent(itemCode)}`);
}

export function fetchLatestImportPreview(): Promise<ApiImportFileCandidate> {
  return getJson<ApiImportFileCandidate>("/imports/latest-preview");
}

export function fetchImportCandidates(): Promise<ApiImportFileCandidate[]> {
  return getJson<ApiImportFileCandidate[]>("/imports");
}

export function assembleImportFromDocuments(
  payload: ApiImportAssemblyRequest,
): Promise<ApiImportFileCandidate> {
  return postJson<ApiImportFileCandidate, typeof payload>("/imports/assemble-from-documents", payload);
}

export function approveImportCandidate(
  payload: ApiImportApprovalRequest,
): Promise<ApiImportFileCandidate> {
  return postJson<ApiImportFileCandidate, typeof payload>("/imports/approve", payload);
}

export function markImportDelivered(
  payload: ApiImportDeliveryRequest,
): Promise<ApiImportFileCandidate> {
  return postJson<ApiImportFileCandidate, typeof payload>("/imports/mark-delivered", payload);
}

export function postImportGoodsReceipt(
  payload: ApiImportGoodsReceiptPostRequest,
): Promise<ApiWorkflowResult> {
  return postJson<ApiWorkflowResult, typeof payload>("/imports/post-goods-receipt", payload);
}

export function fetchWarehouses(country?: string): Promise<ApiWarehouseLocation[]> {
  const query = country ? `?country=${encodeURIComponent(country)}` : "";
  return getJson<ApiWarehouseLocation[]>(`/warehouses${query}`);
}

export function fetchAuditEvents(limit = 100): Promise<ApiAuditEvent[]> {
  return getJson<ApiAuditEvent[]>(`/audit?limit=${limit}`);
}

export function fetchSecurityOverview(): Promise<ApiSecurityOverview> {
  return getJson<ApiSecurityOverview>("/security");
}

export type ApiAuditChainStatus = {
  valid: boolean;
  broken_at_id: number | null;
  verified_count: number;
  legacy_unhashed_count: number;
  total: number;
};

export function fetchAuditChainStatus(): Promise<ApiAuditChainStatus> {
  return getJson<ApiAuditChainStatus>("/audit/verify");
}

export function loginUser(payload: { email: string; password: string }): Promise<ApiAuthenticatedUser> {
  return postJson<ApiAuthenticatedUser, typeof payload>("/security/login", payload);
}

export function saveSecurityUser(payload: ApiSaveSecurityUserRequest): Promise<ApiSecurityUser> {
  return postJson<ApiSecurityUser, typeof payload>("/security/users", payload);
}

export function saveApprovalRule(payload: ApiSaveApprovalRuleRequest): Promise<ApiApprovalRule> {
  return postJson<ApiApprovalRule, typeof payload>("/security/approval-rules", payload);
}

export function saveProductFreeTextProfile(payload: {
  item_code: string;
  answered_by: string;
  answers: Record<string, string>;
}): Promise<Record<string, unknown>> {
  return postJson<Record<string, unknown>, typeof payload>("/learning/product-profiles/free-text", payload);
}

export function editProductLearningProfile(payload: {
  item_code: string;
  field_name: string;
  old_value?: string | null;
  new_value: string;
  edit_reason: string;
  edited_by: string;
}): Promise<Record<string, unknown>> {
  return postJson<Record<string, unknown>, typeof payload>("/learning/product-profiles/edits", payload);
}

export function saveWarehouseCandidate(payload: {
  country: string;
  warehouse_name: string;
  created_from_import_file?: string | null;
  created_by: string;
}): Promise<Record<string, unknown>> {
  return postJson<Record<string, unknown>, typeof payload>("/learning/warehouse-candidates", payload);
}

export function saveCountryDocumentRequirement(payload: {
  country: string;
  vertical: string;
  material_code: string;
  required_document_type: string;
  approved_by: string;
}): Promise<Record<string, unknown>> {
  return postJson<Record<string, unknown>, typeof payload>("/learning/country-document-requirements", payload);
}

export function fetchLearningInsights(): Promise<ApiLearningInsights> {
  return getJson<ApiLearningInsights>("/learning/insights");
}

// --- Dashboard data layer (Phase 1 consumption) ---

export type ApiExecutiveDashboard = {
  total_inventory_value: number;
  total_inventory_quantity: number;
  open_import_shipments: number;
  imports_in_transit: number;
  imports_awaiting_receipt: number;
  imports_received: number;
  open_shipment_requests: number;
  dispatched_shipments: number;
  delivered_shipments: number;
  expiry_risk_90: number;
  expired_inventory: number;
  active_warehouses: number;
  active_countries: number;
  learning_rules: number;
  audit_events: number;
};

export type ApiInventoryDashboard = {
  total_value: number;
  total_quantity: number;
  batch_count: number;
  by_warehouse_value: Record<string, number>;
  by_category_value: Record<string, number>;
  expiring_30: number;
  expiring_60: number;
  expiring_90: number;
  expired: number;
};

export type ApiImportDashboard = {
  total: number;
  by_status: Record<string, number>;
  open_shipments: number;
  awaiting_receipt: number;
  received: number;
  by_country: Record<string, number>;
};

export type ApiExpiryRiskBatch = {
  item_code: string;
  batch_number: string;
  warehouse: string;
  expiry_date: string;
  days_to_expiry: number;
  quantity: number;
  value: number;
};

export type ApiExpiryDashboard = {
  expiring_30: number;
  expiring_60: number;
  expiring_90: number;
  expiring_180: number;
  expired: number;
  value_at_risk_90: number;
  by_warehouse_90: Record<string, number>;
  soonest: ApiExpiryRiskBatch[];
};

export type ApiShipmentDashboard = {
  total: number;
  by_status: Record<string, number>;
  dispatched: number;
  delivered: number;
  by_country: Record<string, number>;
};

export type ApiSystemHealth = {
  total_users: number;
  total_products: number;
  total_documents: number;
  ocr_success_rate: number;
  validation_queue_size: number;
  open_shipments: number;
  inventory_records: number;
  learning_rules: number;
  audit_events: number;
  audit_chain_valid: boolean;
  database_health: string;
};

export function fetchExecutiveDashboard(): Promise<ApiExecutiveDashboard> {
  return getJson<ApiExecutiveDashboard>("/dashboard/executive");
}

export function fetchInventoryDashboard(): Promise<ApiInventoryDashboard> {
  return getJson<ApiInventoryDashboard>("/dashboard/inventory");
}

export function fetchImportDashboard(): Promise<ApiImportDashboard> {
  return getJson<ApiImportDashboard>("/dashboard/import");
}

export function fetchExpiryDashboard(): Promise<ApiExpiryDashboard> {
  return getJson<ApiExpiryDashboard>("/dashboard/expiry");
}

export function fetchShipmentDashboard(): Promise<ApiShipmentDashboard> {
  return getJson<ApiShipmentDashboard>("/dashboard/shipment");
}

export function fetchSystemHealth(): Promise<ApiSystemHealth> {
  return getJson<ApiSystemHealth>("/dashboard/system-health");
}

export type ApiMovementEvent = {
  event_id: string;
  event_type: string;
  item_code: string;
  batch_number: string;
  serial_number: string | null;
  quantity: number;
  warehouse: string | null;
  location: string | null;
  counterparty: string | null;
  reference: string | null;
  actor: string | null;
  occurred_at: string;
  note: string | null;
};

export type ApiBatchTraceability = {
  batch_number: string;
  found: boolean;
  item_codes: string[];
  received_quantity: number;
  dispatched_quantity: number;
  allocated_quantity: number;
  current_quantity: number;
  remaining_quantity: number;
  expiry_date: string | null;
  current_location: string | null;
  warehouses: string[];
  customers: string[];
  events: ApiMovementEvent[];
};

export type ApiProductJourney = {
  query: string;
  found: boolean;
  events: ApiMovementEvent[];
};

export function fetchMovements(): Promise<ApiMovementEvent[]> {
  return getJson<ApiMovementEvent[]>("/movements");
}

export function fetchBatchTraceability(batchNumber: string): Promise<ApiBatchTraceability> {
  return getJson<ApiBatchTraceability>(`/movements/traceability?batch_number=${encodeURIComponent(batchNumber)}`);
}

export function fetchProductJourney(query: string): Promise<ApiProductJourney> {
  return getJson<ApiProductJourney>(`/movements/journey?query=${encodeURIComponent(query)}`);
}

export type ApiShipmentMilestone = {
  stage: string;
  planned_date: string | null;
  actual_date: string | null;
  status: string;
};

export type ApiShipmentTimeline = {
  import_file_number: string;
  shipment_name: string | null;
  milestones: ApiShipmentMilestone[];
  on_time_count: number;
  late_count: number;
  pending_count: number;
};

export function fetchShipmentTimeline(importFileNumber: string): Promise<ApiShipmentTimeline> {
  return getJson<ApiShipmentTimeline>(`/imports/timeline?import_file_number=${encodeURIComponent(importFileNumber)}`);
}

export function saveShipmentPlan(payload: {
  import_file_number: string;
  planned_arrival_date?: string | null;
  planned_delivery_date?: string | null;
  actor: string;
}): Promise<Record<string, unknown>> {
  return postJson<Record<string, unknown>, typeof payload>("/imports/plan", payload);
}

export function recordMovement(payload: {
  event_type: string;
  item_code: string;
  batch_number: string;
  serial_number?: string | null;
  quantity?: number;
  location?: string | null;
  counterparty?: string | null;
  reference?: string | null;
  actor: string;
  note?: string | null;
}): Promise<ApiMovementEvent> {
  return postJson<ApiMovementEvent, typeof payload>("/movements", payload);
}

export function evaluateImportChecklist(payload: {
  country: string;
  vertical: string;
  material_code: string;
  present_document_types: string[];
}): Promise<ApiImportChecklistResponse> {
  return postJson<ApiImportChecklistResponse, typeof payload>("/learning/import-checklist", payload);
}

export function fetchCorrectionSuggestion(
  documentType: string,
  fieldName: string,
  currentValue: string | null,
): Promise<ApiCorrectionSuggestionResponse> {
  const params = new URLSearchParams({
    document_type: documentType,
    field_name: fieldName,
  });
  if (currentValue) {
    params.set("current_value", currentValue);
  }
  return getJson<ApiCorrectionSuggestionResponse>(`/learning/suggest-correction?${params.toString()}`);
}

// --- Phase 5A: Management OS fetchers (Phase 2-4 backend endpoints) ---

export type ApiDistributorScoreRow = {
  distributor: string;
  financial_score: number | null;
  sales_score: number | null;
  expiry_score: number | null;
  health_score: number | null;
};

export type ApiExecutiveCommandCenterV3 = {
  receivables_outstanding: number;
  payables_outstanding: number;
  net_exposure: number;
  payment_risk_count: number;
  payables_risk_count: number;
  partner_risk_count: number;
  command_center_v2: {
    total_inventory_value: number;
    inventory_at_risk_value: number;
    available_inventory: number;
    reserved_inventory: number;
    allocated_inventory: number;
    not_sellable_inventory: number;
    confirmed_demand: number;
    forecast_demand: number;
    tender_demand: number;
    opportunity_demand: number;
    demand_coverage_pct: number | null;
    top_distributors: string[] | null;
    underperforming_distributors: string[] | null;
    high_expiry_risk_distributors: string[] | null;
    highest_demand_products: string[] | null;
    highest_expiry_risk_products: string[] | null;
    reservation_value_at_risk: number;
    reservations_expiring_soon: number;
    shipments_ready: number;
    shipments_delayed: number;
    shipments_missing_documents: number;
    distributor_scores: ApiDistributorScoreRow[];
  };
};

export type ApiExecutiveAction = {
  action_type: string;
  severity: string;
  reference: string | null;
  title: string;
  detail: string | null;
  source: string;
};

export type ApiApproval = {
  approval_id: string;
  approval_type: string;
  reference: string | null;
  requestor: string;
  request_date: string;
  approver: string | null;
  approval_date: string | null;
  reason: string | null;
  outcome: string;
  note: string | null;
};

export type ApiDecision = {
  decision_id: string;
  decision_type: string;
  reason: string;
  user: string;
  role: string | null;
  problem_type: string | null;
  owner: string | null;
  context: string | null;
  options_considered: string[];
  decided_at: string;
  related_product: string | null;
  related_batch: string | null;
  related_shipment: string | null;
  related_customer: string | null;
  related_supplier: string | null;
  expected_outcome: string | null;
  actual_outcome: string | null;
  effectiveness: string | null;
  status: string;
};

export type ApiCountryPerformance = {
  scope: string;
  name: string;
  target_value: number;
  actual_value: number;
  value_achievement_pct: number | null;
  target_quantity: number;
  actual_quantity: number;
  quantity_achievement_pct: number | null;
  growth_pct: number | null;
  diagnostics: Record<string, string>;
};

// Same scorecard shape for vertical / distributor / customer drill-downs.
export type ApiPerformanceScorecard = ApiCountryPerformance;

export type ApiCommitmentDashboard = {
  total_commitments: number;
  open_commitments: number;
  fulfilled_commitments: number;
  delayed_commitments: number;
  backordered_commitments: number;
  average_fill_rate_pct: number | null;
  otif_pct: number | null;
  total_backorder_value: number;
  high_risk_commitments: number;
};

export type ApiReviewItem = { reference: string; source: string; detail: Record<string, unknown> };
export type ApiReview = { review_type: string; summary: Record<string, number | string | null>; items: ApiReviewItem[] };

export type ApiDecisionLearningInsights = {
  total_decisions: number;
  decisions_with_outcome: number;
  overall_success_rate_pct: number | null;
  most_common_decisions: { key: string; count: number; effective: number; success_rate_pct: number | null }[];
  most_successful_decisions: { key: string; count: number; effective: number; success_rate_pct: number | null }[];
  by_owner: { key: string; count: number; effective: number; success_rate_pct: number | null }[];
  by_problem_type: { key: string; count: number; effective: number; success_rate_pct: number | null }[];
};

export function fetchExecutiveCommandCenterV3(): Promise<ApiExecutiveCommandCenterV3> {
  return getJson<ApiExecutiveCommandCenterV3>("/executive-command-center-v3");
}

export function fetchExecutiveActions(severity?: string): Promise<ApiExecutiveAction[]> {
  const query = severity ? `?severity=${encodeURIComponent(severity)}` : "";
  return getJson<ApiExecutiveAction[]>(`/executive-actions${query}`);
}

export function fetchApprovals(outcome?: string): Promise<ApiApproval[]> {
  const query = outcome ? `?outcome=${encodeURIComponent(outcome)}` : "";
  return getJson<ApiApproval[]>(`/approvals${query}`);
}

export function fetchDecisions(status?: string): Promise<ApiDecision[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return getJson<ApiDecision[]>(`/decisions${query}`);
}

export type ApiDecisionRequest = {
  decision_type: string;
  reason: string;
  user: string;
  role?: string | null;
  problem_type?: string | null;
  owner?: string | null;
  context?: string | null;
  options_considered?: string[];
  related_product?: string | null;
  related_batch?: string | null;
  related_shipment?: string | null;
  related_customer?: string | null;
  related_supplier?: string | null;
  expected_outcome?: string | null;
  status?: string;
};

export type ApiDecisionOutcomeRequest = {
  actual_outcome?: string | null;
  effectiveness?: "effective" | "partially_effective" | "ineffective" | null;
  status: string;
  actor: string;
};

export type ApiDecisionEffectiveness = {
  decision_id: string;
  decision_type: string;
  problem_type: string | null;
  owner: string | null;
  expected_outcome: string | null;
  actual_outcome: string | null;
  effectiveness: string | null;
  status: string;
};

export type ApiSimilarDecision = {
  decision_id: string;
  decision_type: string;
  problem_type: string | null;
  owner: string | null;
  reason: string;
  expected_outcome: string | null;
  actual_outcome: string | null;
  effectiveness: string | null;
  similarity_score: number;
  matched_on: string[];
};

export function createDecision(request: ApiDecisionRequest): Promise<ApiDecision> {
  return postJson<ApiDecision, ApiDecisionRequest>("/decisions", request);
}

export function recordDecisionOutcome(
  decisionId: string,
  request: ApiDecisionOutcomeRequest,
): Promise<ApiDecision> {
  return patchJson<ApiDecision, ApiDecisionOutcomeRequest>(
    `/decisions/${encodeURIComponent(decisionId)}/outcome`,
    request,
  );
}

export function fetchDecisionEffectiveness(params?: {
  owner?: string;
  problem_type?: string;
}): Promise<ApiDecisionEffectiveness[]> {
  const query = buildQuery(params);
  return getJson<ApiDecisionEffectiveness[]>(`/decision-effectiveness${query}`);
}

export function fetchDecisionHistory(params?: {
  owner?: string;
  problem_type?: string;
  related?: string;
}): Promise<ApiDecision[]> {
  const query = buildQuery(params);
  return getJson<ApiDecision[]>(`/decision-history${query}`);
}

export function fetchSimilarDecisions(params?: {
  problem_type?: string;
  decision_type?: string;
  context?: string;
  related_product?: string;
  related_customer?: string;
  limit?: number;
}): Promise<ApiSimilarDecision[]> {
  const query = buildQuery(params);
  return getJson<ApiSimilarDecision[]>(`/decision-similarity${query}`);
}

function buildQuery(params?: Record<string, string | number | undefined>): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export type ApiDecideApprovalRequest = {
  outcome: "approved" | "rejected";
  approver: string;
  note?: string | null;
};

export function decideApproval(approvalId: string, request: ApiDecideApprovalRequest): Promise<ApiApproval> {
  return postJson<ApiApproval, ApiDecideApprovalRequest>(
    `/approvals/${encodeURIComponent(approvalId)}/decide`,
    request,
  );
}

export function fetchCountryPerformanceV2(): Promise<ApiCountryPerformance[]> {
  return getJson<ApiCountryPerformance[]>("/country-performance-v2");
}

// Every country the system currently knows about, learned from live data
// (warehouses, shipments, imports, secondary shipments, rules, master data,
// user scopes). Used to populate country selectors so they are never empty.
export function fetchKnownCountries(): Promise<string[]> {
  return getJson<string[]>("/reference/countries");
}

// Shipment movement per country (outbound + inbound + secondary), for the
// management movement maps. Empty object = zero movement (the map shows zero).
export function fetchMovementByCountry(): Promise<Record<string, number>> {
  return getJson<Record<string, number>>("/reference/movement-by-country");
}

export function fetchVerticalPerformance(country?: string): Promise<ApiPerformanceScorecard[]> {
  const query = country ? `?country=${encodeURIComponent(country)}` : "";
  return getJson<ApiPerformanceScorecard[]>(`/vertical-performance${query}`);
}

export function fetchCommitmentDashboard(): Promise<ApiCommitmentDashboard> {
  return getJson<ApiCommitmentDashboard>("/customer-commitment-dashboard");
}

export function fetchReview(name: string): Promise<ApiReview> {
  return getJson<ApiReview>(`/${name}-review`);
}

export function fetchDecisionLearningInsights(): Promise<ApiDecisionLearningInsights> {
  return getJson<ApiDecisionLearningInsights>("/learning-insights");
}

// ---- Commercial drill-down (Phase 5A) -------------------------------------

export function fetchDistributorPerformanceV2(params?: {
  country?: string;
  vertical?: string;
}): Promise<ApiPerformanceScorecard[]> {
  return getJson<ApiPerformanceScorecard[]>(`/distributor-performance-v2${buildQuery(params)}`);
}

export function fetchCustomerPerformance(params?: {
  country?: string;
  vertical?: string;
  distributor?: string;
}): Promise<ApiPerformanceScorecard[]> {
  return getJson<ApiPerformanceScorecard[]>(`/customer-performance${buildQuery(params)}`);
}

export type ApiCommercialTarget = {
  scope: string;
  scope_value: string;
  target_value: number;
  target_quantity: number;
  period: string | null;
  updated_by: string | null;
  updated_at: string | null;
};

export type ApiSetTargetRequest = {
  scope: string;
  scope_value: string;
  target_value?: number;
  target_quantity?: number;
  period?: string | null;
  actor: string;
};

export function setCommercialTarget(request: ApiSetTargetRequest): Promise<ApiCommercialTarget> {
  return postJson<ApiCommercialTarget, ApiSetTargetRequest>("/commercial-targets", request);
}

// ---- Receivables / Payables (Phase 5A) -------------------------------------

export type ApiPaymentEntry = { amount: number; paid_date: string; note: string | null; actor: string | null };

export type ApiReceivable = {
  receivable_id: string;
  distributor: string;
  country: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  payment_terms: string | null;
  invoice_value: number;
  currency: string | null;
  paid_value: number;
  outstanding_value: number;
  status: string;
  payment_history: ApiPaymentEntry[];
};

export type ApiPaymentRisk = {
  distributor: string;
  risk_level: string;
  outstanding_amount: number;
  past_due_amount: number;
  past_due_days: number;
  payment_trend: string;
  reasons: string[];
};

export type ApiCreditControl = {
  distributor: string;
  credit_limit: number;
  outstanding_exposure: number;
  available_credit: number;
  overdue_amount: number;
  status: string;
  override: boolean;
};

export function fetchReceivables(params?: {
  distributor?: string;
  status?: string;
  country?: string;
}): Promise<ApiReceivable[]> {
  return getJson<ApiReceivable[]>(`/receivables${buildQuery(params)}`);
}

export function fetchPaymentRisks(): Promise<ApiPaymentRisk[]> {
  return getJson<ApiPaymentRisk[]>("/payment-risk");
}

export function fetchCreditControl(): Promise<ApiCreditControl[]> {
  return getJson<ApiCreditControl[]>("/credit-control");
}

export type ApiRecordPaymentRequest = { amount: number; paid_date?: string | null; note?: string | null; actor: string };

export function recordReceivablePayment(receivableId: string, request: ApiRecordPaymentRequest): Promise<ApiReceivable> {
  return postJson<ApiReceivable, ApiRecordPaymentRequest>(
    `/receivables/${encodeURIComponent(receivableId)}/payment`,
    request,
  );
}

export type ApiPayable = {
  payable_id: string;
  partner_type: string;
  partner_name: string;
  country: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  payment_terms: string | null;
  invoice_value: number;
  paid_value: number;
  outstanding_value: number;
  status: string;
  payment_history: ApiPaymentEntry[];
};

export type ApiPayablesRisk = {
  partner_name: string;
  partner_type: string;
  risk_level: string;
  outstanding_amount: number;
  past_due_amount: number;
  days_to_next_due: number | null;
  dependency_pct: number;
  reasons: string[];
};

export function fetchPayables(params?: {
  partner_name?: string;
  partner_type?: string;
  status?: string;
}): Promise<ApiPayable[]> {
  return getJson<ApiPayable[]>(`/payables${buildQuery(params)}`);
}

export function fetchPayablesRisks(): Promise<ApiPayablesRisk[]> {
  return getJson<ApiPayablesRisk[]>("/payables-risk");
}

export function recordPayablePayment(payableId: string, request: ApiRecordPaymentRequest): Promise<ApiPayable> {
  return postJson<ApiPayable, ApiRecordPaymentRequest>(
    `/payables/${encodeURIComponent(payableId)}/payment`,
    request,
  );
}

// ---- Consignment / Returns / Commitments (Phase 5A) ------------------------

export type ApiConsignment = {
  consignment_id: string;
  distributor: string;
  country: string;
  material: string;
  batch_number: string;
  quantity_sent: number;
  quantity_reported: number;
  quantity_consumed: number;
  quantity_remaining: number;
  last_report_date: string | null;
  sent_date: string;
};

export type ApiConsignmentRisk = {
  consignment_id: string;
  distributor: string;
  material: string;
  batch_number: string;
  risk_level: string;
  days_since_sent: number;
  days_since_report: number | null;
  consumption_pct: number;
  recommended_action: string;
  reasons: string[];
};

export type ApiConsignmentDashboard = {
  total_consignments: number;
  total_quantity_sent: number;
  total_remaining: number;
  no_report_count: number;
  aging_count: number;
  expiry_exposure_count: number;
  low_consumption_count: number;
  high_risk_count: number;
};

export function fetchConsignments(params?: { distributor?: string; country?: string }): Promise<ApiConsignment[]> {
  return getJson<ApiConsignment[]>(`/consignment-inventory${buildQuery(params)}`);
}

export function fetchConsignmentRisks(): Promise<ApiConsignmentRisk[]> {
  return getJson<ApiConsignmentRisk[]>("/consignment-risk");
}

export function fetchConsignmentDashboard(): Promise<ApiConsignmentDashboard> {
  return getJson<ApiConsignmentDashboard>("/consignment-dashboard");
}

export type ApiReturnRecord = {
  return_id: string;
  material: string;
  batch_number: string | null;
  return_reason: string | null;
  returned_quantity: number;
  inspection_result: string | null;
  verification_result: string | null;
  reusable_quantity: number;
  rejected_quantity: number;
  status: string;
};

export type ApiReturnDashboard = {
  total_returns: number;
  total_returned_quantity: number;
  reusable_quantity: number;
  rejected_quantity: number;
  available_quantity: number;
  pending_inspection: number;
  pending_verification: number;
  by_reason: Record<string, number>;
};

export function fetchReturns(params?: { status?: string; material?: string }): Promise<ApiReturnRecord[]> {
  return getJson<ApiReturnRecord[]>(`/returns${buildQuery(params)}`);
}

export function fetchReturnDashboard(): Promise<ApiReturnDashboard> {
  return getJson<ApiReturnDashboard>("/return-dashboard");
}

export function inspectReturn(
  returnId: string,
  request: { inspection_result: string; reusable_quantity?: number; rejected_quantity?: number; actor: string },
): Promise<ApiReturnRecord> {
  return postJson(`/returns/${encodeURIComponent(returnId)}/inspect`, request);
}

export function verifyReturn(
  returnId: string,
  request: { verification_result: string; actor: string },
): Promise<ApiReturnRecord> {
  return postJson(`/returns/${encodeURIComponent(returnId)}/verify`, request);
}

export type ApiCustomerCommitment = {
  commitment_id: string;
  po_number: string;
  customer: string;
  distributor: string;
  country: string;
  material: string;
  batch_number: string | null;
  ordered_quantity: number;
  allocated_quantity: number;
  shipped_quantity: number;
  delivered_quantity: number;
  backorder_quantity: number;
  required_delivery_date: string;
  expected_fulfillment_date: string | null;
  status: string;
};

export type ApiCommitmentRisk = {
  commitment_id: string;
  po_number: string;
  customer: string;
  material: string;
  risk_level: string;
  fill_rate_pct: number;
  otif: boolean;
  delay_days: number;
  backorder_quantity: number;
  backorder_value: number;
  days_to_required: number;
  reasons: string[];
};

export function fetchCustomerCommitments(params?: {
  status?: string;
  customer?: string;
  country?: string;
}): Promise<ApiCustomerCommitment[]> {
  return getJson<ApiCustomerCommitment[]>(`/customer-commitments${buildQuery(params)}`);
}

export function fetchCommitmentRisks(): Promise<ApiCommitmentRisk[]> {
  return getJson<ApiCommitmentRisk[]>("/customer-commitment-risk");
}

// ---- Currency (Phase 5D/5G) ----

export type ApiCurrencyRateSet = {
  rate_date: string;
  base_currency: string;
  rates: Record<string, number>;
  source: string;
  book: string;
  locked_at: string;
  updated_by: string | null;
  note: string | null;
};

export function listCurrencyRates(limit = 30, book?: string): Promise<ApiCurrencyRateSet[]> {
  const bookQuery = book ? `&book=${encodeURIComponent(book)}` : "";
  return getJson<ApiCurrencyRateSet[]>(`/currency/rates?limit=${limit}${bookQuery}`);
}

export function fetchCurrencyRates(
  rateDate: string,
  base = "INR",
  book = "primary",
): Promise<ApiCurrencyRateSet> {
  return getJson<ApiCurrencyRateSet>(
    `/currency/rates/${rateDate}?base=${encodeURIComponent(base)}&book=${encodeURIComponent(book)}`,
  );
}

export type ApiSaveCurrencyRatesRequest = {
  rate_date: string;
  base_currency?: string;
  rates: Record<string, number>;
  source?: string;
  book?: string;
  actor?: string | null;
  reason?: string | null;
};

export function saveCurrencyRates(payload: ApiSaveCurrencyRatesRequest): Promise<ApiCurrencyRateSet> {
  return postJson<ApiCurrencyRateSet, ApiSaveCurrencyRatesRequest>("/currency/rates", payload);
}

// ---- Translation Memory (Phase 6 — Document Intelligence) ----

export type ApiTranslationEntry = {
  key: string;
  source_text: string;
  source_language: string;
  target_text: string;
  target_language: string;
  document_type: string | null;
  times_reused: number;
  updated_by: string | null;
  updated_at: string;
};

export function listTranslationMemory(limit = 200): Promise<ApiTranslationEntry[]> {
  return getJson<ApiTranslationEntry[]>(`/translation/memory?limit=${limit}`);
}

export type ApiSaveTranslationRequest = {
  source_text: string;
  source_language: string;
  target_text: string;
  target_language?: string;
  document_type?: string | null;
  actor?: string | null;
};

export function saveTranslation(payload: ApiSaveTranslationRequest): Promise<ApiTranslationEntry> {
  return postJson<ApiTranslationEntry, ApiSaveTranslationRequest>("/translation/memory", payload);
}

// ---- Secondary Sales document bundles (Phase 6F) ----

export type ApiSecondaryDocumentRow = { label: string; value: string };
export type ApiSecondaryDocument = {
  document_id: string;
  filename: string;
  kind: string;
  rows: ApiSecondaryDocumentRow[];
};
export type ApiSecondaryShipment = {
  shipment_id: string;
  customer: string;
  country: string;
  order_number: string;
  shipment_type: string;
  status: string;
  documents: ApiSecondaryDocument[];
  uploaded_by: string | null;
  uploaded_at: string;
  validated_by: string | null;
  validated_at: string | null;
  note: string | null;
  deleted_by?: string | null;
  deleted_at?: string | null;
  delete_reason?: string | null;
};

export function listSecondaryShipments(): Promise<ApiSecondaryShipment[]> {
  return getJson<ApiSecondaryShipment[]>("/secondary-documents/shipments");
}

export type ApiSaveSecondaryShipmentRequest = {
  customer: string;
  country: string;
  order_number: string;
  shipment_type?: string;
  documents: ApiSecondaryDocument[];
  actor?: string | null;
};

export function saveSecondaryShipment(payload: ApiSaveSecondaryShipmentRequest): Promise<ApiSecondaryShipment> {
  return postJson<ApiSecondaryShipment, ApiSaveSecondaryShipmentRequest>("/secondary-documents/shipments", payload);
}

export function approveSecondaryShipment(
  shipmentId: string,
  payload: { actor?: string | null; note?: string | null },
): Promise<ApiSecondaryShipment> {
  return postJson<ApiSecondaryShipment, typeof payload>(
    `/secondary-documents/shipments/${encodeURIComponent(shipmentId)}/approve`,
    payload,
  );
}

export function rejectSecondaryShipment(
  shipmentId: string,
  payload: { actor?: string | null; note?: string | null },
): Promise<ApiSecondaryShipment> {
  return postJson<ApiSecondaryShipment, typeof payload>(
    `/secondary-documents/shipments/${encodeURIComponent(shipmentId)}/reject`,
    payload,
  );
}

// Soft delete — marks the shipment deleted (with who/when/why); never removed.
export function deleteSecondaryShipment(
  shipmentId: string,
  payload: { actor?: string | null; note?: string | null },
): Promise<ApiSecondaryShipment> {
  return postJson<ApiSecondaryShipment, typeof payload>(
    `/secondary-documents/shipments/${encodeURIComponent(shipmentId)}/delete`,
    payload,
  );
}
