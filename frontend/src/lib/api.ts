import type { DocumentExtractionMaster, DocumentRecord, DocumentType } from "../types/domain";

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

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders() });
  if (!response.ok) {
    throw new Error(`Could not load ${path}`);
  }
  return response.json();
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
};

export type ApiShipment = {
  shipment_id: string;
  request_date: string;
  requestor_name: string;
  customer_name: string;
  destination_country: string;
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
  customer_type: string;
  contact_person: string;
};

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
