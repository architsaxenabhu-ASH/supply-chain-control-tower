import type { DocumentExtractionMaster, DocumentRecord, DocumentType } from "../types/domain";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

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

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Could not load ${path}`);
  }
  return response.json();
}

async function postJson<TResponse, TPayload>(path: string, payload: TPayload): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

export type ApiImportFileCandidate = {
  import_file_number: string;
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
  extraction_warnings: string[];
  lines: Array<{
    item_code: string;
    product_description: string;
    batch_number: string;
    expiry_date: string | null;
    quantity: number;
    uom: string;
    unit_value: number | null;
    currency: string | null;
    product_profile_status: string;
  }>;
};

export type ApiImportAssemblyRequest = {
  commercial_invoice_document_id: string;
  packing_list_document_id: string;
  awb_document_id?: string | null;
};

export type ApiImportGoodsReceiptPostRequest = {
  candidate: ApiImportFileCandidate;
  warehouse_name: string;
  posted_by: string;
  supplier_name?: string | null;
};

export type ApiImportApprovalRequest = {
  candidate: ApiImportFileCandidate;
  approved_by: string;
  approval_note?: string | null;
};

export type ApiWarehouseLocation = {
  warehouse_code: string;
  warehouse_name: string;
  country: string;
  is_active: boolean;
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

export function approveShipment(
  shipmentId: string,
  payload: {
    approved_by: string;
    lines: Array<{
      item_code: string;
      batch_number: string;
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

export function postImportGoodsReceipt(
  payload: ApiImportGoodsReceiptPostRequest,
): Promise<ApiWorkflowResult> {
  return postJson<ApiWorkflowResult, typeof payload>("/imports/post-goods-receipt", payload);
}

export function fetchWarehouses(country?: string): Promise<ApiWarehouseLocation[]> {
  const query = country ? `?country=${encodeURIComponent(country)}` : "";
  return getJson<ApiWarehouseLocation[]>(`/warehouses${query}`);
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
