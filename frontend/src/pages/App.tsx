import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Activity,
  BarChart3,
  BrainCircuit,
  Bot,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  ClipboardList,
  Database,
  Download,
  FileCheck2,
  FileUp,
  FileSpreadsheet,
  Gauge,
  GitBranch,
  History,
  KeyRound,
  Layers,
  Package,
  Play,
  Plus,
  RadioTower,
  RefreshCw,
  ScanText,
  Search,
  ShieldCheck,
  Moon,
  Ship,
  Sparkles,
  Sun,
  Truck,
  Upload,
  Users,
} from "lucide-react";

import {
  assembleImportFromDocuments,
  approveImportCandidate,
  approveShipment,
  askAssistant,
  confirmDispatch,
  createShipment,
  evaluateImportChecklist,
  fetchCorrectionSuggestion,
  fetchErpTemplates,
  fetchCustomers,
  fetchAuditEvents,
  fetchDashboardSummary,
  fetchDispatches,
  fetchGoodsReceipts,
  fetchBatchTraceability,
  fetchImportCandidates,
  fetchInventoryBatches,
  fetchInventoryCounts,
  fetchLearningInsights,
  fetchMovements,
  fetchProductJourney,
  fetchProducts,
  fetchSecurityOverview,
  fetchShipments,
  fetchValidationQueue,
  fetchWarehouses,
  getExtractionMaster,
  listDocuments,
  loginUser,
  markImportDelivered,
  postImportGoodsReceipt,
  previewErpUpload,
  rescanDocument,
  saveFieldCorrection,
  saveApprovalRule,
  saveCountryDocumentRequirement,
  saveProductFreeTextProfile,
  saveSecurityUser,
  saveWarehouseCandidate,
  uploadDocument,
} from "../lib/api";
import type {
  ApiCustomer,
  ApiDispatch,
  ApiGoodsReceipt,
  ApiAuditEvent,
  ApiAuthenticatedUser,
  ApiCorrectionSuggestion,
  ApiImportChecklistResponse,
  ApiErpTemplate,
  ApiErpUploadPreview,
  ApiImportApprovalRequest,
  ApiImportAssemblyRequest,
  ApiImportDeliveryRequest,
  ApiImportGoodsReceiptPostRequest,
  ApiInventoryBatch,
  ApiInventoryCount,
  ApiLearningInsights,
  ApiMovementEvent,
  ApiBatchTraceability,
  ApiProductJourney,
  ApiImportFileCandidate,
  ApiFieldCorrectionRequest,
  ApiSaveApprovalRuleRequest,
  ApiSaveSecurityUserRequest,
  ApiProduct,
  ApiSecurityOverview,
  ApiShipment,
  ApiValidationQueueItem,
  ApiValidationQueueResponse,
  ApiWarehouseLocation,
} from "../lib/api";
import type {
  DocumentExtractionMaster,
  DocumentRecord,
  DocumentType,
  ExtractedField,
} from "../types/domain";

type Product = {
  itemCode: string;
  description: string;
  category: string;
  uom: string;
  status: "Active" | "Inactive";
  shelfLifeMonths?: number | null;
};

type IconComponent = ComponentType<{
  size?: number;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

type PlatformStatus = "complete" | "partial" | "planned";

type PlatformCapability = {
  module: string;
  area: string;
  status: PlatformStatus;
  progress: number;
  whatDone: string;
  stillLeft: string;
  icon: IconComponent;
};

type InventoryBatch = {
  itemCode: string;
  description: string;
  category: string;
  batch: string;
  warehouse: string;
  quantity: number;
  mfgDate: string;
  expiryDate: string;
  unitValue: number;
  daysToExpiry: number;
  expiryBucket: string;
};

type ShipmentLine = {
  itemCode: string;
  batch: string;
  warehouse: string;
  quantityRequested: number;
  quantityApproved: number;
};

type Shipment = {
  shipmentId: string;
  requestDate: string;
  requestor: string;
  customer: string;
  destination: string;
  priority: "Normal" | "Urgent";
  requiredDate: string;
  status: "Draft" | "Submitted" | "Approved" | "Dispatched" | "Delivered" | "Cancelled";
  lines: ShipmentLine[];
};

type Dispatch = {
  dispatchNo: string;
  shipmentId: string;
  dispatchDate: string;
  courier: string;
  trackingNo: string;
  dispatchedBy: string;
  status: string;
};

type Receipt = {
  grnNo: string;
  receiptDate: string;
  warehouse: string;
  supplier: string;
  itemCode: string;
  batch: string;
  quantity: number;
  expiryDate: string;
};

type CountLine = {
  countId: string;
  warehouse: string;
  itemCode: string;
  batch: string;
  systemQty: number;
  physicalQty: number;
};

type Customer = {
  code: string;
  name: string;
  country: string;
  type: string;
  contact: string;
};

const CURRENT_USER_STORAGE_KEY = "supply-chain-control-tower-current-user";
const TOUR_SEEN_STORAGE_PREFIX = "supply-chain-control-tower-tour-seen";

const fallbackProducts: Product[] = [
  {
    itemCode: "AOAC-10/35",
    description: "Aortic Occlusion Catheter 10/35",
    category: "Cardio",
    uom: "EA",
    status: "Active",
  },
  {
    itemCode: "MYVAL-THV-26",
    description: "Myval Transcatheter Heart Valve 26mm",
    category: "Cardio",
    uom: "EA",
    status: "Active",
  },
  {
    itemCode: "ENDO-STENT-08",
    description: "Endoscopy Stent 8mm",
    category: "Endo",
    uom: "EA",
    status: "Active",
  },
];

const fallbackInventory: InventoryBatch[] = [
  {
    itemCode: "AOAC-10/35",
    description: "Aortic Occlusion Catheter 10/35",
    category: "Cardio",
    batch: "AOAC-B2401",
    warehouse: "Mumbai WH",
    quantity: 120,
    mfgDate: "2025-01-10",
    expiryDate: "2026-09-30",
    unitValue: 1250,
    daysToExpiry: 114,
    expiryBucket: "91-180 Days",
  },
  {
    itemCode: "MYVAL-THV-26",
    description: "Myval Transcatheter Heart Valve 26mm",
    category: "Cardio",
    batch: "B240501",
    warehouse: "Mumbai WH",
    quantity: 25,
    mfgDate: "2025-05-01",
    expiryDate: "2026-08-15",
    unitValue: 18400,
    daysToExpiry: 67,
    expiryBucket: "0-90 Days",
  },
  {
    itemCode: "ENDO-STENT-08",
    description: "Endoscopy Stent 8mm",
    category: "Endo",
    batch: "ES-2502",
    warehouse: "Delhi WH",
    quantity: 210,
    mfgDate: "2025-02-14",
    expiryDate: "2027-02-14",
    unitValue: 780,
    daysToExpiry: 252,
    expiryBucket: "181-365 Days",
  },
];

const fallbackShipments: Shipment[] = [
  {
    shipmentId: "SHP-2026-0001",
    requestDate: "2026-06-07",
    requestor: "Sales North",
    customer: "Apollo Hospital",
    destination: "India",
    priority: "Urgent",
    requiredDate: "2026-06-10",
    status: "Approved",
    lines: [
      {
        itemCode: "MYVAL-THV-26",
        batch: "B240501",
        warehouse: "Mumbai WH",
        quantityRequested: 5,
        quantityApproved: 5,
      },
    ],
  },
  {
    shipmentId: "SHP-2026-0002",
    requestDate: "2026-06-06",
    requestor: "Export Sales",
    customer: "Dubai Health Authority",
    destination: "UAE",
    priority: "Normal",
    requiredDate: "2026-06-18",
    status: "Submitted",
    lines: [
      {
        itemCode: "AOAC-10/35",
        batch: "AOAC-B2401",
        warehouse: "Mumbai WH",
        quantityRequested: 30,
        quantityApproved: 0,
      },
    ],
  },
];

const fallbackDispatches: Dispatch[] = [
  {
    dispatchNo: "DSP-2026-0001",
    shipmentId: "SHP-2026-0001",
    dispatchDate: "2026-06-08",
    courier: "Blue Dart Aviation",
    trackingNo: "176-12345678",
    dispatchedBy: "Warehouse Executive",
    status: "Dispatched",
  },
];

const fallbackReceipts: Receipt[] = [
  {
    grnNo: "GRN-2026-0001",
    receiptDate: "2026-06-05",
    warehouse: "Mumbai WH",
    supplier: "ABC Medical Devices Pvt Ltd",
    itemCode: "MYVAL-THV-26",
    batch: "B240501",
    quantity: 25,
    expiryDate: "2026-08-15",
  },
];

const fallbackCounts: CountLine[] = [
  {
    countId: "CNT-2026-0001",
    warehouse: "Mumbai WH",
    itemCode: "AOAC-10/35",
    batch: "AOAC-B2401",
    systemQty: 120,
    physicalQty: 118,
  },
  {
    countId: "CNT-2026-0001",
    warehouse: "Mumbai WH",
    itemCode: "MYVAL-THV-26",
    batch: "B240501",
    systemQty: 25,
    physicalQty: 26,
  },
];

const fallbackCustomers: Customer[] = [
  {
    code: "CUST-APOLLO",
    name: "Apollo Hospital",
    country: "India",
    type: "Hospital",
    contact: "Procurement Head",
  },
  {
    code: "CUST-DHA",
    name: "Dubai Health Authority",
    country: "UAE",
    type: "Distributor",
    contact: "Supply Chain Lead",
  },
];

const fallbackSecurityOverview: ApiSecurityOverview = {
  role_definitions: [
    {
      role_name: "Admin",
      description: "System setup and full control",
      permissions: ["masters", "security", "imports", "inventory", "shipments", "audit"],
    },
    {
      role_name: "Country Incharge",
      description: "Country-level import and shipment approval",
      permissions: ["import_approval", "shipment_approval", "country_dashboard"],
    },
    {
      role_name: "Warehouse Executive",
      description: "Goods receipt, dispatch, and cycle count entry",
      permissions: ["goods_receipt", "dispatch", "inventory_count"],
    },
    {
      role_name: "Warehouse Manager",
      description: "Warehouse approval and reconciliation",
      permissions: ["inventory_approval", "dispatch_approval", "reconciliation"],
    },
    {
      role_name: "Sales User",
      description: "Shipment request and customer visibility",
      permissions: ["shipment_request", "customer_read"],
    },
    {
      role_name: "Finance User",
      description: "Inventory value and export visibility",
      permissions: ["inventory_value", "reports_export"],
    },
    {
      role_name: "QA User",
      description: "Expiry, batch, and compliance review",
      permissions: ["expiry_review", "batch_traceability", "quality_hold"],
    },
  ],
  users: [],
  approval_rules: [],
};

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "goods-tracking", label: "Goods Tracking", icon: RadioTower },
  { id: "traceability", label: "Traceability", icon: GitBranch },
  { id: "platform-progress", label: "Progress", icon: GitBranch },
  { id: "documents", label: "Documents", icon: FileUp },
  { id: "import-validation", label: "Import Validation", icon: ClipboardCheck },
  { id: "erp-uploads", label: "ERP Upload", icon: Upload },
  { id: "products", label: "Products", icon: Package },
  { id: "inventory", label: "Inventory", icon: Boxes },
  { id: "shipments", label: "Shipments", icon: Ship },
  { id: "dispatches", label: "Dispatches", icon: Truck },
  { id: "receipts", label: "Receipts", icon: FileSpreadsheet },
  { id: "counts", label: "Counts", icon: ClipboardCheck },
  { id: "expiry", label: "Expiry", icon: ClipboardList },
  { id: "customers", label: "Customers", icon: Users },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "audit", label: "Audit", icon: History },
  { id: "learning", label: "Learning", icon: BrainCircuit },
  { id: "assistant", label: "Assistant", icon: Bot },
];

const platformCapabilities: PlatformCapability[] = [
  {
    module: "Document upload portal",
    area: "Documents",
    status: "complete",
    progress: 90,
    whatDone: "PDF, Excel, CSV, JPG, and PNG upload with saved document records.",
    stillLeft: "Multi-document bulk upload and TIFF support.",
    icon: FileUp,
  },
  {
    module: "OCR and extraction",
    area: "Documents",
    status: "partial",
    progress: 56,
    whatDone: "Text/OCR fallback, field catalog, structured import patterns, line detection, calculated expiry.",
    stillLeft: "Production OCR engine install, table confidence scoring, layout learning.",
    icon: ScanText,
  },
  {
    module: "Import validation",
    area: "Imports",
    status: "complete",
    progress: 78,
    whatDone: "Invoice, Packing List, and AWB combine into one import validation file.",
    stillLeft: "Country-specific customs and extra document flows.",
    icon: ClipboardCheck,
  },
  {
    module: "Learning engine",
    area: "Intelligence",
    status: "partial",
    progress: 48,
    whatDone: "First-time product profile questions, warehouse candidates, document rules.",
    stillLeft: "Alias memory, correction scoring, supplier/customer layout memory.",
    icon: BrainCircuit,
  },
  {
    module: "RBAC and approvals",
    area: "Security",
    status: "complete",
    progress: 74,
    whatDone: "Email login, roles, permissions, approval matrix, session tokens.",
    stillLeft: "Field-level rules and password reset workflow.",
    icon: ShieldCheck,
  },
  {
    module: "Audit trail",
    area: "Compliance",
    status: "complete",
    progress: 72,
    whatDone: "Critical actions record user, timestamp, old/new value, and reason.",
    stillLeft: "Immutable audit export signatures and retention policy.",
    icon: History,
  },
  {
    module: "Goods receipt and inventory posting",
    area: "Inventory",
    status: "complete",
    progress: 80,
    whatDone: "Approved imports create GRNs and increase batch inventory.",
    stillLeft: "Partial receipt splits and quality hold posting.",
    icon: Database,
  },
  {
    module: "Inventory and expiry control",
    area: "Inventory",
    status: "partial",
    progress: 66,
    whatDone: "Batch inventory, FEFO visibility, expiry buckets, valuation, filters.",
    stillLeft: "Serial, UDI, GTIN, quarantine, transfer, and adjustment workflows.",
    icon: Boxes,
  },
  {
    module: "Shipment request, approval, dispatch",
    area: "Shipments",
    status: "complete",
    progress: 76,
    whatDone: "Shipment creation, approval, exact batch/warehouse dispatch deduction.",
    stillLeft: "Milestone tracking, carrier status feeds, returns, and intercompany transfer.",
    icon: Truck,
  },
  {
    module: "Dashboards and alerts",
    area: "Analytics",
    status: "partial",
    progress: 58,
    whatDone: "Inventory value, expiry risk, route monitor, what-if delay simulator.",
    stillLeft: "Role-specific dashboards and predictive KPI drilldowns.",
    icon: Gauge,
  },
  {
    module: "AI assistant",
    area: "Decision Support",
    status: "partial",
    progress: 35,
    whatDone: "Rule-based answers for inventory, expiry, shipment, and variance questions.",
    stillLeft: "Real AI model integration, source citations, reasoning comparison, memory.",
    icon: Sparkles,
  },
  {
    module: "Forecasting",
    area: "Planning",
    status: "planned",
    progress: 12,
    whatDone: "Architecture planned.",
    stillLeft: "Forecast upload, coverage calculation, demand forecast, variance reports.",
    icon: Activity,
  },
  {
    module: "Template and ERP upload engine",
    area: "Integrations",
    status: "partial",
    progress: 46,
    whatDone: "ERP upload center, configurable backend templates, validation preview, CSV export.",
    stillLeft: "User-defined template master, true XLSX formatting, SAP/ERP API posting.",
    icon: FileSpreadsheet,
  },
  {
    module: "Traceability and compliance",
    area: "Medical Device",
    status: "planned",
    progress: 18,
    whatDone: "Batch traceability concept and expiry logic started.",
    stillLeft: "UDI, GTIN, recall readiness, regulatory document vault, QA workflows.",
    icon: RadioTower,
  },
  {
    module: "Sales, purchase, supplier, customer portals",
    area: "Commercial",
    status: "planned",
    progress: 8,
    whatDone: "Masters and shipment links started.",
    stillLeft: "Sales orders, purchase orders, supplier performance, customer forecasts.",
    icon: Users,
  },
  {
    module: "Enterprise deployment readiness",
    area: "Platform",
    status: "partial",
    progress: 52,
    whatDone: "FastAPI, React, Neon/PostgreSQL persistence, GitHub source control.",
    stillLeft: "Cloud deployment, backups, environment management, monitoring, CI/CD.",
    icon: Layers,
  },
];

type TourGuideStep = {
  title: string;
  detail: string;
  viewId: string;
  icon: IconComponent;
};

const tourGuideContent: Record<string, Omit<TourGuideStep, "viewId">> = {
  dashboard: {
    title: "Dashboard",
    detail: "Start here for live inventory value, expiry risk, open shipments, route monitoring, and the what-if delay simulator.",
    icon: BarChart3,
  },
  "platform-progress": {
    title: "Progress command center",
    detail: "See what is complete, what is partial, and what remains before the control tower becomes fully autonomous.",
    icon: GitBranch,
  },
  documents: {
    title: "Documents",
    detail: "Upload Commercial Invoice, Packing List, AWB, and future country documents. Upload triggers scan, extraction, required-field checks, and master candidates.",
    icon: FileUp,
  },
  "import-validation": {
    title: "Import validation",
    detail: "Combine invoice, packing list, and AWB, correct extracted fields with mandatory reason, learn first-time products, approve, then post Goods Receipt.",
    icon: ClipboardCheck,
  },
  "erp-uploads": {
    title: "ERP upload center",
    detail: "Generate ERP-ready inventory, receipt, dispatch, and import upload rows with mandatory-field checks before download.",
    icon: Upload,
  },
  products: {
    title: "Products",
    detail: "Search product masters. New products can be learned from documents and first-time free-text answers.",
    icon: Package,
  },
  inventory: {
    title: "Inventory",
    detail: "Review stock by warehouse, vertical, item code, batch, expiry, quantity, and value. Inventory changes only through controlled transactions.",
    icon: Boxes,
  },
  shipments: {
    title: "Shipments",
    detail: "Create shipment requests, validate stock, approve quantities, and keep shipment status under role control.",
    icon: Ship,
  },
  dispatches: {
    title: "Dispatches",
    detail: "Confirm dispatch with transporter, tracking number, dispatch user, and exact inventory deduction.",
    icon: Truck,
  },
  receipts: {
    title: "Receipts",
    detail: "View Goods Receipt history created after approved imports or warehouse receipts.",
    icon: FileSpreadsheet,
  },
  counts: {
    title: "Counts",
    detail: "Review physical inventory counts, system quantity, physical quantity, variance, excess, and deficit.",
    icon: ClipboardCheck,
  },
  expiry: {
    title: "Expiry",
    detail: "Monitor expiry buckets, days to expiry, and FEFO risk for medical-device batches.",
    icon: ClipboardList,
  },
  customers: {
    title: "Customers",
    detail: "View customers linked to shipment and dispatch flows.",
    icon: Users,
  },
  security: {
    title: "Security",
    detail: "Manage email-based users, roles, approval rules, country scope, warehouse scope, and RBAC controls.",
    icon: ShieldCheck,
  },
  audit: {
    title: "Audit",
    detail: "Track who changed what, when, why, and which transaction or extracted field was affected.",
    icon: History,
  },
  assistant: {
    title: "Assistant",
    detail: "Ask operational questions about stock, expiry, shipments, value, variance, and traceability.",
    icon: Bot,
  },
};

const documentTypes: Array<{ label: string; value: DocumentType }> = [
  { label: "Commercial Invoice", value: "commercial_invoice" },
  { label: "Packing List", value: "packing_list" },
  { label: "Air Waybill", value: "air_waybill" },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);

const formatDaysToExpiry = (expiryDate: string | null) => {
  if (!expiryDate) {
    return "-";
  }

  const expiry = new Date(`${expiryDate}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) {
    return "-";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
  return days < 0 ? `Expired ${Math.abs(days)} days` : `${days} days`;
};

function daysUntil(dateText: string) {
  const targetDate = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(targetDate.getTime())) {
    return 0;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((targetDate.getTime() - today.getTime()) / 86_400_000);
}

const toTitleCase = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

function getDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function inventoryBatchKey(batch: InventoryBatch) {
  return `${batch.itemCode}|${batch.batch}|${batch.warehouse}`;
}

function generateDispatchNumber(dispatches: Dispatch[]) {
  const year = new Date().getFullYear();
  const prefix = `DSP-${year}-`;
  const nextNumber = dispatches.reduce((max, dispatch) => {
    if (!dispatch.dispatchNo.startsWith(prefix)) {
      return max;
    }
    const currentNumber = Number(dispatch.dispatchNo.replace(prefix, ""));
    return Number.isFinite(currentNumber) ? Math.max(max, currentNumber + 1) : max;
  }, 1);
  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

function getPlatformCompletionStats() {
  const totalProgress = platformCapabilities.reduce((sum, capability) => sum + capability.progress, 0);
  const score = Math.round(totalProgress / platformCapabilities.length);
  const complete = platformCapabilities.filter((capability) => capability.status === "complete").length;
  const partial = platformCapabilities.filter((capability) => capability.status === "partial").length;
  const planned = platformCapabilities.filter((capability) => capability.status === "planned").length;
  return { complete, partial, planned, score, total: platformCapabilities.length };
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const csv = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function erpRowsForExport(preview: ApiErpUploadPreview | null) {
  if (!preview) {
    return [];
  }
  return preview.rows.map((row) => ({
    row_number: row.row_number,
    source_reference: row.source_reference,
    validation_status: row.missing_fields.length ? "blocked" : "ready",
    missing_fields: row.missing_fields.join("; "),
    ...preview.columns.reduce<Record<string, unknown>>((record, column) => {
      record[column] = row.values[column];
      return record;
    }, {}),
  }));
}

function getExportRows({
  activeView,
  auditEvents,
  counts,
  customers,
  dispatches,
  documents,
  erpPreview,
  filteredInventory,
  filteredProducts,
  importCandidate,
  receipts,
  securityOverview,
  shipments,
}: {
  activeView: string;
  auditEvents: ApiAuditEvent[];
  counts: CountLine[];
  customers: Customer[];
  dispatches: Dispatch[];
  documents: DocumentRecord[];
  erpPreview: ApiErpUploadPreview | null;
  filteredInventory: InventoryBatch[];
  filteredProducts: Product[];
  importCandidate: ApiImportFileCandidate | null;
  receipts: Receipt[];
  securityOverview: ApiSecurityOverview;
  shipments: Shipment[];
}) {
  if (activeView === "products") {
    return filteredProducts.map((product) => ({
      item_code: product.itemCode,
      description: product.description,
      category: product.category,
      uom: product.uom,
      status: product.status,
    }));
  }

  if (activeView === "inventory" || activeView === "dashboard" || activeView === "expiry") {
    return filteredInventory.map((batch) => ({
      item_code: batch.itemCode,
      description: batch.description,
      category: batch.category,
      batch: batch.batch,
      warehouse: batch.warehouse,
      quantity: batch.quantity,
      manufacturing_date: batch.mfgDate,
      expiry_date: batch.expiryDate,
      unit_value: batch.unitValue,
      inventory_value: batch.quantity * batch.unitValue,
      expiry_bucket: batch.expiryBucket,
    }));
  }

  if (activeView === "import-validation") {
    return (importCandidate?.lines ?? []).map((line) => ({
      shipment_name: importCandidate?.shipment_name ?? importCandidate?.import_file_number,
      shipment_vertical: importCandidate?.shipment_vertical,
      shipment_number: importCandidate?.shipment_number,
      import_file: importCandidate?.import_file_number,
      destination_country: importCandidate?.destination_country,
      invoice_numbers: importCandidate?.invoice_numbers.join("; ") || importCandidate?.invoice_number,
      commercial_invoice_document_count: importCandidate?.commercial_invoice_document_ids.length ?? 0,
      packing_list_document_count: importCandidate?.packing_list_document_ids.length ?? 0,
      awb_document_linked: importCandidate?.awb_document_id ? "yes" : "no",
      invoice_number: importCandidate?.invoice_number,
      awb_number: importCandidate?.awb_number,
      item_code: line.item_code,
      description: line.product_description,
      batch: line.batch_number,
      expiry_date: line.expiry_date,
      days_to_expiry: formatDaysToExpiry(line.expiry_date),
      quantity: line.quantity,
      uom: line.uom,
      unit_value: line.unit_value,
      currency: line.currency,
      learning_status: line.product_profile_status,
    }));
  }

  if (activeView === "documents") {
    return documents.map((document) => ({
      document_id: document.document_id,
      filename: document.filename,
      document_type: document.document_type,
      status: document.status,
      extracted_field_count: document.extracted_field_count,
      missing_required_count: document.missing_required_count,
      created_at: document.created_at,
    }));
  }

  if (activeView === "erp-uploads") {
    return erpRowsForExport(erpPreview);
  }

  if (activeView === "platform-progress") {
    return platformCapabilities.map((capability) => ({
      module: capability.module,
      area: capability.area,
      status: capability.status,
      progress: capability.progress,
      completed_scope: capability.whatDone,
      remaining_work: capability.stillLeft,
    }));
  }

  if (activeView === "shipments") {
    return shipments.flatMap((shipment) =>
      shipment.lines.map((line) => ({
        shipment_id: shipment.shipmentId,
        request_date: shipment.requestDate,
        requestor: shipment.requestor,
        customer: shipment.customer,
        destination: shipment.destination,
        priority: shipment.priority,
        required_date: shipment.requiredDate,
        status: shipment.status,
        item_code: line.itemCode,
        batch: line.batch,
        warehouse: line.warehouse,
        quantity_requested: line.quantityRequested,
        quantity_approved: line.quantityApproved,
      })),
    );
  }

  if (activeView === "dispatches") {
    return dispatches.map((dispatch) => ({ ...dispatch }));
  }

  if (activeView === "receipts") {
    return receipts.map((receipt) => ({ ...receipt }));
  }

  if (activeView === "counts") {
    return counts.map((count) => ({ ...count }));
  }

  if (activeView === "customers") {
    return customers.map((customer) => ({ ...customer }));
  }

  if (activeView === "audit") {
    return auditEvents.map((event) => ({
      id: event.id,
      action: event.action,
      module: event.module_name,
      entity: event.entity_name,
      entity_id: event.entity_id,
      actor: event.actor,
      reason: event.reason,
      old_value: formatAuditValue(event.old_value),
      new_value: formatAuditValue(event.new_value),
      created_at: event.created_at,
    }));
  }

  if (activeView === "security") {
    return [
      ...securityOverview.users.map((user) => ({
        record_type: "user",
        email: user.email,
        full_name: user.full_name,
        role: user.role_name,
        countries: user.country_scope.join("; "),
        warehouses: user.warehouse_scope.join("; "),
        password_status: user.has_password ? "set" : "missing",
        status: user.is_active ? "active" : "inactive",
      })),
      ...securityOverview.approval_rules.map((rule) => ({
        record_type: "approval_rule",
        rule_id: rule.rule_id,
        process: rule.process_name,
        country: rule.country,
        vertical: rule.vertical,
        material_code: rule.material_code,
        approver_role: rule.approver_role,
        approver_email: rule.approver_email,
        status: rule.is_active ? "active" : "inactive",
      })),
    ];
  }

  return [];
}

function mapProduct(product: ApiProduct): Product {
  return {
    itemCode: product.item_code,
    description: product.product_description,
    category: product.product_category,
    uom: product.uom,
    status: product.product_status === "active" ? "Active" : "Inactive",
    shelfLifeMonths: product.shelf_life_months,
  };
}

function mapInventoryBatch(batch: ApiInventoryBatch): InventoryBatch {
  return {
    itemCode: batch.item_code,
    description: batch.product_description,
    category: batch.product_category,
    batch: batch.batch_number,
    warehouse: batch.warehouse_location,
    quantity: batch.quantity_available,
    mfgDate: batch.manufacturing_date,
    expiryDate: batch.expiry_date,
    unitValue: batch.unit_value,
    daysToExpiry: batch.days_to_expiry,
    expiryBucket: batch.expiry_bucket,
  };
}

function mapShipment(shipment: ApiShipment): Shipment {
  return {
    shipmentId: shipment.shipment_id,
    requestDate: shipment.request_date,
    requestor: shipment.requestor_name,
    customer: shipment.customer_name,
    destination: shipment.destination_country,
    priority: shipment.priority === "urgent" ? "Urgent" : "Normal",
    requiredDate: shipment.required_delivery_date,
    status: toTitleCase(shipment.status) as Shipment["status"],
    lines: shipment.lines.map((line) => ({
      itemCode: line.item_code,
      batch: line.batch_number,
      warehouse: line.warehouse_location ?? "Unassigned warehouse",
      quantityRequested: line.quantity_requested,
      quantityApproved: line.quantity_approved,
    })),
  };
}

function mapDispatch(dispatch: ApiDispatch): Dispatch {
  return {
    dispatchNo: dispatch.dispatch_number,
    shipmentId: dispatch.shipment_id,
    dispatchDate: dispatch.dispatch_date,
    courier: dispatch.transporter_courier,
    trackingNo: dispatch.tracking_number,
    dispatchedBy: dispatch.dispatched_by,
    status: toTitleCase(dispatch.status),
  };
}

function flattenReceipts(receipts: ApiGoodsReceipt[]): Receipt[] {
  return receipts.flatMap((receipt) =>
    receipt.lines.map((line) => ({
      grnNo: receipt.grn_number,
      receiptDate: receipt.receipt_date,
      warehouse: receipt.warehouse,
      supplier: receipt.supplier,
      itemCode: line.item_code,
      batch: line.batch_number,
      quantity: line.quantity_received,
      expiryDate: line.expiry_date,
    })),
  );
}

function flattenCounts(counts: ApiInventoryCount[]): CountLine[] {
  return counts.flatMap((count) =>
    count.lines.map((line) => ({
      countId: count.inventory_count_id,
      warehouse: count.warehouse,
      itemCode: line.item_code,
      batch: line.batch_number,
      systemQty: line.system_quantity,
      physicalQty: line.physical_quantity,
    })),
  );
}

function mapCustomer(customer: ApiCustomer): Customer {
  return {
    code: customer.customer_code,
    name: customer.customer_name,
    country: customer.country,
    type: customer.customer_type,
    contact: customer.contact_person,
  };
}

function loadStoredCurrentUser(): ApiAuthenticatedUser | null {
  try {
    const stored = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    return stored ? JSON.parse(stored) as ApiAuthenticatedUser : null;
  } catch {
    return null;
  }
}

function getInitialViewId() {
  try {
    const hashView = window.location.hash.replace("#", "");
    return navItems.some((item) => item.id === hashView) ? hashView : "dashboard";
  } catch {
    return "dashboard";
  }
}

export function App() {
  const [currentUser, setCurrentUser] = useState<ApiAuthenticatedUser | null>(() => loadStoredCurrentUser());
  const [loginMessage, setLoginMessage] = useState("Sign in with a configured Security User email.");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeView, setActiveView] = useState(() => getInitialViewId());
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") {
      return "dark";
    }
    return window.localStorage.getItem("ct-theme") === "light" ? "light" : "dark";
  });
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);
  const [search, setSearch] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryWarehouseFilter, setInventoryWarehouseFilter] = useState("all");
  const [inventoryVerticalFilter, setInventoryVerticalFilter] = useState("all");
  const [assistantQuestion, setAssistantQuestion] = useState("Show all batches expiring within 180 days.");
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [inventory, setInventory] = useState<InventoryBatch[]>(fallbackInventory);
  const [shipments, setShipments] = useState<Shipment[]>(fallbackShipments);
  const [dispatches, setDispatches] = useState<Dispatch[]>(fallbackDispatches);
  const [receipts, setReceipts] = useState<Receipt[]>(fallbackReceipts);
  const [counts, setCounts] = useState<CountLine[]>(fallbackCounts);
  const [customers, setCustomers] = useState<Customer[]>(fallbackCustomers);
  const [auditEvents, setAuditEvents] = useState<ApiAuditEvent[]>([]);
  const [learningInsights, setLearningInsights] = useState<ApiLearningInsights | null>(null);
  const [importQueue, setImportQueue] = useState<ApiImportFileCandidate[]>([]);
  const [securityOverview, setSecurityOverview] = useState<ApiSecurityOverview>(fallbackSecurityOverview);
  const [securityMessage, setSecurityMessage] = useState("Enter users and approval rules for email-based access.");
  const [apiStatus, setApiStatus] = useState("Using sample data");
  const [assistantAnswer, setAssistantAnswer] = useState("Found 2 batches expiring within 180 days.");
  const [isAskingAssistant, setIsAskingAssistant] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>("commercial_invoice");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedMaster, setSelectedMaster] = useState<DocumentExtractionMaster | null>(null);
  const [documentMessage, setDocumentMessage] = useState("Upload a document to trigger scanning.");
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [importCandidate, setImportCandidate] = useState<ApiImportFileCandidate | null>(null);
  const [destinationWarehouses, setDestinationWarehouses] = useState<ApiWarehouseLocation[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [importMessage, setImportMessage] = useState("Select uploaded import documents to create a validation file.");
  const [validationQueue, setValidationQueue] = useState<ApiValidationQueueResponse>({
    items: [],
    total_count: 0,
    missing_required_count: 0,
    pending_review_count: 0,
    corrected_count: 0,
  });
  const [validationMessage, setValidationMessage] = useState("Load documents to review extracted values.");
  const [erpTemplates, setErpTemplates] = useState<ApiErpTemplate[]>([]);
  const [selectedErpTemplate, setSelectedErpTemplate] = useState("inventory_balance");
  const [erpPreview, setErpPreview] = useState<ApiErpUploadPreview | null>(null);
  const [erpMessage, setErpMessage] = useState("Select a template and generate an ERP upload preview.");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("ct-theme", theme);
  }, [theme]);

  useEffect(() => {
    let isMounted = true;

    async function loadWarehouseData() {
      try {
        const [
          apiProducts,
          apiInventory,
          apiShipments,
          apiDispatches,
          apiReceipts,
          apiCounts,
          apiCustomers,
          apiSummary,
          apiAuditEvents,
          apiImportQueue,
          apiValidationQueue,
          apiErpTemplates,
        ] = await Promise.all([
          fetchProducts(),
          fetchInventoryBatches(),
          fetchShipments(),
          fetchDispatches(),
          fetchGoodsReceipts(),
          fetchInventoryCounts(),
          fetchCustomers(),
          fetchDashboardSummary(),
          fetchAuditEvents(20),
          fetchImportCandidates(),
          fetchValidationQueue(),
          fetchErpTemplates(),
        ]);
        const initialImportCandidate = apiImportQueue[0] ?? null;
        const initialWarehouses = initialImportCandidate
          ? await fetchWarehouses(initialImportCandidate.destination_country)
          : [];

        if (!isMounted) {
          return;
        }

        setProducts(apiProducts.map(mapProduct));
        setInventory(apiInventory.map(mapInventoryBatch));
        setShipments(apiShipments.map(mapShipment));
        setDispatches(apiDispatches.map(mapDispatch));
        setReceipts(flattenReceipts(apiReceipts));
        setCounts(flattenCounts(apiCounts));
        setCustomers(apiCustomers.map(mapCustomer));
        setAuditEvents(apiAuditEvents);
        setImportQueue(apiImportQueue);
        setValidationQueue(apiValidationQueue);
        setErpTemplates(apiErpTemplates);
        setSelectedErpTemplate((current) => current || apiErpTemplates[0]?.template_key || "inventory_balance");
        setImportCandidate(initialImportCandidate);
        setDestinationWarehouses(initialWarehouses);
        setSelectedWarehouse(initialWarehouses[0]?.warehouse_code ?? "");
        setApiStatus(`Connected to backend / ${formatCurrency(apiSummary.total_inventory_value)}`);
      } catch {
        if (isMounted) {
          setApiStatus("Backend not connected / sample data active");
        }
      }
    }

    loadWarehouseData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetchSecurityOverview()
      .then((overview) => {
        if (isMounted) {
          setSecurityOverview(overview);
          setSecurityMessage("Security setup loaded.");
        }
      })
      .catch(() => {
        if (isMounted) {
          setSecurityMessage("Backend not connected. Security setup will load after backend starts.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (activeView !== "learning") {
      return;
    }
    let isMounted = true;

    fetchLearningInsights()
      .then((insights) => {
        if (isMounted) {
          setLearningInsights(insights);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLearningInsights(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeView]);

  useEffect(() => {
    let isMounted = true;

    listDocuments()
      .then((records) => {
        if (isMounted) {
          setDocuments(records);
        }
      })
      .catch(() => {
        if (isMounted) {
          setDocumentMessage("Backend not connected. Upload will work after backend starts.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleLogin(email: string, password: string) {
    setIsLoggingIn(true);
    setLoginMessage("Checking login...");
    try {
      const user = await loginUser({ email, password });
      window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
      setCurrentUser(user);
      setLoginMessage("Login successful.");
      setApiStatus(`Logged in as ${user.role_name}`);
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  function handleLogout() {
    window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    setCurrentUser(null);
    setActiveView("dashboard");
    setLoginMessage("Signed out.");
  }

  async function handleDocumentUpload() {
    if (selectedFiles.length === 0) {
      setDocumentMessage("Select one or more files first.");
      return;
    }

    setIsUploadingDocument(true);
    setDocumentMessage(`Uploading and scanning ${selectedFiles.length} document(s)...`);

    try {
      const uploadedDocuments: DocumentRecord[] = [];
      let latestMaster: DocumentExtractionMaster | null = null;

      for (const file of selectedFiles) {
        setDocumentMessage(`Uploading and scanning ${file.name}...`);
        const uploaded = await uploadDocument(documentType, file);
        latestMaster = await getExtractionMaster(uploaded.document_id);
        uploadedDocuments.push(uploaded);
      }

      setDocuments((current) => [
        ...uploadedDocuments,
        ...current.filter(
          (document) => !uploadedDocuments.some((uploaded) => uploaded.document_id === document.document_id),
        ),
      ]);
      setSelectedMaster(latestMaster);
      setSelectedFiles([]);
      setDocumentMessage(
        uploadedDocuments.length === 1
          ? "Document uploaded, scanned, and extraction master generated."
          : `${uploadedDocuments.length} documents uploaded, scanned, and saved.`,
      );
      setApiStatus("Connected to backend / document scanned");
      await refreshValidationQueue("Validation queue refreshed after document scan.");
    } catch (error) {
      setDocumentMessage(error instanceof Error ? error.message : "Document upload failed.");
      setApiStatus("Backend not connected / document upload unavailable");
    } finally {
      setIsUploadingDocument(false);
    }
  }

  async function handleOpenDocument(documentId: string) {
    setDocumentMessage("Loading extraction master...");
    try {
      const master = await getExtractionMaster(documentId);
      setSelectedMaster(master);
      setDocumentMessage("Extraction master loaded.");
    } catch (error) {
      setDocumentMessage(error instanceof Error ? error.message : "Could not load extraction master.");
    }
  }

  async function refreshValidationQueue(nextMessage?: string) {
    const queue = await fetchValidationQueue();
    setValidationQueue(queue);
    if (nextMessage) {
      setValidationMessage(nextMessage);
    }
    return queue;
  }

  async function handleRescanSelectedDocument() {
    if (!selectedMaster) {
      setDocumentMessage("Open a saved document first, then rescan it.");
      return;
    }

    setIsUploadingDocument(true);
    setDocumentMessage("Rescanning selected document with latest extraction rules...");
    try {
      const rescanned = await rescanDocument(selectedMaster.document.document_id);
      const master = await getExtractionMaster(rescanned.document_id);
      setDocuments((current) => [
        rescanned,
        ...current.filter((document) => document.document_id !== rescanned.document_id),
      ]);
      setSelectedMaster(master);
      setDocumentMessage("Document rescanned and extraction master refreshed.");
      setApiStatus("Connected to backend / document rescanned");
      await refreshValidationQueue("Validation queue refreshed after rescan.");
    } catch (error) {
      setDocumentMessage(error instanceof Error ? error.message : "Document rescan failed.");
      setApiStatus("Backend not connected / document rescan unavailable");
    } finally {
      setIsUploadingDocument(false);
    }
  }

  async function handleAssembleImportFromDocuments(payload: ApiImportAssemblyRequest) {
    setImportMessage("Creating import validation file from selected documents...");
    try {
      const candidate = await assembleImportFromDocuments(payload);
      const warehouses = await fetchWarehouses(candidate.destination_country);
      const [apiImportQueue, apiAuditEvents] = await Promise.all([
        fetchImportCandidates(),
        fetchAuditEvents(20),
      ]);
      await refreshValidationQueue("Validation queue refreshed from selected documents.");
      setImportCandidate(candidate);
      setImportQueue(apiImportQueue);
      setAuditEvents(apiAuditEvents);
      setDestinationWarehouses(warehouses);
      setSelectedWarehouse(warehouses[0]?.warehouse_code ?? "");
      setImportMessage(
        warehouses.length > 0
          ? "Import validation file created. Select destination warehouse."
          : "Import validation file created. No warehouse found for this country; enter warehouse name.",
      );
      setApiStatus("Connected to backend / import file loaded");
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Could not create import validation file.");
      setApiStatus("Backend not connected / import file unavailable");
    }
  }

  async function handleSaveFieldCorrection(payload: ApiFieldCorrectionRequest) {
    setValidationMessage("Saving correction, audit reason, and learning memory...");
    const response = await saveFieldCorrection(payload);
    const [queue, records, apiAuditEvents] = await Promise.all([
      fetchValidationQueue(),
      listDocuments(),
      fetchAuditEvents(20),
    ]);
    setValidationQueue(queue);
    setDocuments(records);
    setAuditEvents(apiAuditEvents);
    if (selectedMaster?.document.document_id === payload.document_id) {
      setSelectedMaster(await getExtractionMaster(payload.document_id));
    }
    setValidationMessage(response.message);
    setApiStatus("Connected to backend / correction learned");
    return response.message;
  }

  async function handleGenerateErpPreview(templateKey: string) {
    if (!currentUser) {
      setErpMessage("Log in before generating ERP upload rows.");
      return;
    }
    setErpMessage("Generating ERP upload preview...");
    try {
      const preview = await previewErpUpload({
        template_key: templateKey,
        auth_token: currentUser.session_token,
      });
      setErpPreview(preview);
      setErpMessage(
        `Generated ${preview.total_rows} row(s): ${preview.valid_rows} ready, ${preview.blocked_rows} blocked.`,
      );
      setApiStatus("Connected to backend / ERP preview ready");
    } catch (error) {
      setErpMessage(error instanceof Error ? error.message : "Could not generate ERP preview.");
    }
  }

  async function handlePostImportGoodsReceipt(payload: ApiImportGoodsReceiptPostRequest) {
    const result = await postImportGoodsReceipt(payload);
    const [apiInventory, apiReceipts, apiSummary] = await Promise.all([
      fetchInventoryBatches(),
      fetchGoodsReceipts(),
      fetchDashboardSummary(),
    ]);
    const [apiImportQueue, apiAuditEvents] = await Promise.all([
      fetchImportCandidates(),
      fetchAuditEvents(20),
    ]);
    setInventory(apiInventory.map(mapInventoryBatch));
    setReceipts(flattenReceipts(apiReceipts));
    setImportCandidate((current) => current ? { ...current, status: "received" } : current);
    setImportQueue(apiImportQueue);
    setAuditEvents(apiAuditEvents);
    setApiStatus(`Connected to backend / ${formatCurrency(apiSummary.total_inventory_value)}`);
    return result.message;
  }

  async function handleApproveImportCandidate(payload: ApiImportApprovalRequest) {
    const approvedCandidate = await approveImportCandidate(payload);
    const [apiImportQueue, apiAuditEvents] = await Promise.all([
      fetchImportCandidates(),
      fetchAuditEvents(20),
    ]);
    setImportCandidate(approvedCandidate);
    setImportQueue(apiImportQueue);
    setAuditEvents(apiAuditEvents);
    setApiStatus(`Connected to backend / ${approvedCandidate.import_file_number} approved`);
    return `Import file approved by ${payload.approved_by}. Mark the shipment delivered, then post Goods Receipt.`;
  }

  async function handleMarkImportDelivered(payload: ApiImportDeliveryRequest) {
    const deliveredCandidate = await markImportDelivered(payload);
    const [apiImportQueue, apiAuditEvents] = await Promise.all([
      fetchImportCandidates(),
      fetchAuditEvents(20),
    ]);
    setImportCandidate(deliveredCandidate);
    setImportQueue(apiImportQueue);
    setAuditEvents(apiAuditEvents);
    setApiStatus(`Connected to backend / ${deliveredCandidate.import_file_number} delivered`);
    return `Shipment marked delivered by ${payload.delivered_by}. Goods Receipt is now allowed.`;
  }

  async function refreshWarehouseSnapshot(statusMessage?: string) {
    const [apiInventory, apiShipments, apiDispatches, apiSummary, apiAuditEvents] = await Promise.all([
      fetchInventoryBatches(),
      fetchShipments(),
      fetchDispatches(),
      fetchDashboardSummary(),
      fetchAuditEvents(20),
    ]);
    setInventory(apiInventory.map(mapInventoryBatch));
    setShipments(apiShipments.map(mapShipment));
    setDispatches(apiDispatches.map(mapDispatch));
    setAuditEvents(apiAuditEvents);
    setApiStatus(statusMessage ?? `Connected to backend / ${formatCurrency(apiSummary.total_inventory_value)}`);
  }

  async function handleCreateShipment(payload: Parameters<typeof createShipment>[0]) {
    const shipment = await createShipment(payload);
    await refreshWarehouseSnapshot(`Connected to backend / ${shipment.shipment_id} created`);
    return `${shipment.shipment_id} created and submitted for approval.`;
  }

  async function handleApproveShipment(shipment: Shipment) {
    if (!currentUser) {
      throw new Error("Login session is required.");
    }
    const result = await approveShipment(shipment.shipmentId, {
      approved_by: currentUser.email,
      auth_token: currentUser.session_token,
      lines: shipment.lines.map((line) => ({
        item_code: line.itemCode,
        batch_number: line.batch,
        warehouse_location: line.warehouse,
        quantity_approved: line.quantityRequested,
      })),
    });
    await refreshWarehouseSnapshot(`Connected to backend / ${shipment.shipmentId} approved`);
    return result.message;
  }

  async function handleConfirmDispatch(payload: {
    shipmentId: string;
    dispatchNumber: string;
    dispatchDate: string;
    courier: string;
    trackingNumber: string;
  }) {
    if (!currentUser) {
      throw new Error("Login session is required.");
    }
    const result = await confirmDispatch(payload.shipmentId, {
      dispatch_number: payload.dispatchNumber,
      dispatch_date: payload.dispatchDate,
      transporter_courier: payload.courier,
      tracking_number: payload.trackingNumber,
      dispatched_by: currentUser.email,
      auth_token: currentUser.session_token,
    });
    await refreshWarehouseSnapshot(`Connected to backend / ${payload.dispatchNumber} dispatched`);
    return result.message;
  }

  async function handleSaveSecurityUser(payload: Omit<ApiSaveSecurityUserRequest, "auth_token">) {
    if (!currentUser) {
      setSecurityMessage("Your session expired. Please log in again.");
      return;
    }
    setSecurityMessage("Saving user access...");
    try {
      await saveSecurityUser({ ...payload, auth_token: currentUser.session_token });
      const [overview, apiAuditEvents] = await Promise.all([
        fetchSecurityOverview(),
        fetchAuditEvents(20),
      ]);
      setSecurityOverview(overview);
      setAuditEvents(apiAuditEvents);
      setSecurityMessage(`Saved access for ${payload.email}.`);
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : "Could not save user access.");
    }
  }

  async function handleSaveApprovalRule(payload: Omit<ApiSaveApprovalRuleRequest, "auth_token">) {
    if (!currentUser) {
      setSecurityMessage("Your session expired. Please log in again.");
      return;
    }
    setSecurityMessage("Saving approval rule...");
    try {
      await saveApprovalRule({ ...payload, auth_token: currentUser.session_token });
      const [overview, apiAuditEvents] = await Promise.all([
        fetchSecurityOverview(),
        fetchAuditEvents(20),
      ]);
      setSecurityOverview(overview);
      setAuditEvents(apiAuditEvents);
      setSecurityMessage(`Saved approval rule for ${payload.country}.`);
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : "Could not save approval rule.");
    }
  }

  async function handleAskAssistant() {
    setIsAskingAssistant(true);
    try {
      const answer = await askAssistant(assistantQuestion);
      setAssistantAnswer(answer.answer);
      setApiStatus("Connected to backend / assistant answered");
    } catch {
      setAssistantAnswer("Backend not connected. Sample answer is being shown.");
      setApiStatus("Backend not connected / sample data active");
    } finally {
      setIsAskingAssistant(false);
    }
  }

  const totalInventoryValue = inventory.reduce(
    (sum, batch) => sum + batch.quantity * batch.unitValue,
    0,
  );
  const totalInventoryQuantity = inventory.reduce((sum, batch) => sum + batch.quantity, 0);
  const expiringCount = inventory.filter((batch) =>
    ["0-90 Days", "91-180 Days"].includes(batch.expiryBucket),
  ).length;
  const expiringIn30Days = inventory.filter((batch) => batch.daysToExpiry >= 0 && batch.daysToExpiry <= 30).length;
  const expiringIn60Days = inventory.filter((batch) => batch.daysToExpiry >= 0 && batch.daysToExpiry <= 60).length;
  const expiringIn90Days = inventory.filter((batch) => batch.daysToExpiry >= 0 && batch.daysToExpiry <= 90).length;
  const expiredInventoryCount = inventory.filter((batch) => batch.daysToExpiry < 0).length;
  const openShipments = shipments.filter((shipment) =>
    ["Draft", "Submitted", "Approved"].includes(shipment.status),
  ).length;
  const goodsReceivedToday = new Set(
    receipts.filter((receipt) => receipt.receiptDate === getDateStamp()).map((receipt) => receipt.grnNo),
  ).size;
  const varianceTotal = counts.reduce(
    (sum, count) => sum + Math.abs(count.physicalQty - count.systemQty),
    0,
  );

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const query = search.toLowerCase();
        return (
          product.itemCode.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query) ||
          product.category.toLowerCase().includes(query)
        );
      }),
    [products, search],
  );

  const inventoryWarehouses = useMemo(
    () => Array.from(new Set(inventory.map((batch) => batch.warehouse))).sort(),
    [inventory],
  );

  const inventoryVerticals = useMemo(
    () => Array.from(new Set(inventory.map((batch) => batch.category))).sort(),
    [inventory],
  );

  const filteredInventory = useMemo(
    () =>
      inventory.filter((batch) => {
        const query = inventorySearch.toLowerCase().trim();
        const matchesSearch =
          !query ||
          batch.itemCode.toLowerCase().includes(query) ||
          batch.batch.toLowerCase().includes(query) ||
          batch.description.toLowerCase().includes(query) ||
          batch.category.toLowerCase().includes(query);
        const matchesWarehouse =
          inventoryWarehouseFilter === "all" || batch.warehouse === inventoryWarehouseFilter;
        const matchesVertical =
          inventoryVerticalFilter === "all" || batch.category === inventoryVerticalFilter;
        return matchesSearch && matchesWarehouse && matchesVertical;
      }),
    [inventory, inventorySearch, inventoryVerticalFilter, inventoryWarehouseFilter],
  );

  const activeNav = navItems.find((item) => item.id === activeView) ?? navItems[0];
  const visibleNavItems = useMemo(
    () => navItems.filter((item) => canAccessView(currentUser, item.id)),
    [currentUser],
  );
  const visibleWalkthroughSteps = useMemo(
    () => buildVisibleWalkthroughSteps(visibleNavItems),
    [visibleNavItems],
  );
  const canExportActiveView = hasPermission(currentUser, "reports_export");

  useEffect(() => {
    if (currentUser && !canAccessView(currentUser, activeView)) {
      setActiveView("dashboard");
    }
  }, [activeView, currentUser]);

  useEffect(() => {
    function handleHashChange() {
      setActiveView(getInitialViewId());
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    const nextHash = `#${activeView}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${nextHash}`);
    }
  }, [activeView]);

  useEffect(() => {
    if (!currentUser || visibleWalkthroughSteps.length === 0) {
      return;
    }
    const storageKey = `${TOUR_SEEN_STORAGE_PREFIX}:${currentUser.email}`;
    if (window.localStorage.getItem(storageKey)) {
      return;
    }
    setWalkthroughStep(0);
    setIsWalkthroughOpen(true);
    window.localStorage.setItem(storageKey, "true");
  }, [currentUser, visibleWalkthroughSteps.length]);

  function handleExportActiveView() {
    if (!canExportActiveView) {
      setApiStatus("Export is allowed for Admin or Finance User.");
      return;
    }

    const rows = getExportRows({
      activeView,
      auditEvents,
      counts,
      customers,
      dispatches,
      documents,
      erpPreview,
      filteredInventory,
      filteredProducts,
      importCandidate,
      receipts,
      securityOverview,
      shipments,
    });

    if (rows.length === 0) {
      setApiStatus(`No export data for ${activeNav.label}`);
      return;
    }

    downloadCsv(`${activeView}-${getDateStamp()}.csv`, rows);
    setApiStatus(`Exported ${rows.length} row(s) from ${activeNav.label}`);
  }

  function handleRefreshApp() {
    window.location.reload();
  }

  function handleStartWalkthrough() {
    if (visibleWalkthroughSteps.length === 0) {
      return;
    }
    setWalkthroughStep(0);
    setIsWalkthroughOpen(true);
    setActiveView(visibleWalkthroughSteps[0].viewId);
  }

  function handleCloseWalkthrough() {
    if (currentUser) {
      window.localStorage.setItem(`${TOUR_SEEN_STORAGE_PREFIX}:${currentUser.email}`, "true");
    }
    setIsWalkthroughOpen(false);
  }

  if (!currentUser) {
    return (
      <LoginView
        isLoggingIn={isLoggingIn}
        message={loginMessage}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">CT</div>
          <div>
            <strong>Supply Chain Tower</strong>
            <span>Healthcare logistics</span>
          </div>
        </div>
        <nav className="nav-list" aria-label="Primary navigation">
          {visibleNavItems.map((item) => (
            <button
              className={activeView === item.id ? "nav-item active" : "nav-item"}
              key={item.id}
              onClick={() => setActiveView(item.id)}
            >
              <item.icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Medical Device Supply Chain</p>
            <h1>{activeNav.label}</h1>
          </div>
          <div className="topbar-actions">
            <span className="connection-status">{apiStatus}</span>
            <span className="connection-status">{currentUser.email} / {currentUser.role_name}</span>
            <button className="secondary-action" onClick={handleLogout}>
              Logout
            </button>
            <button
              className="secondary-action"
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <button className="secondary-action" onClick={handleRefreshApp}>
              <RefreshCw size={17} aria-hidden="true" />
              Refresh
            </button>
            <button className="secondary-action" onClick={handleStartWalkthrough}>
              <Play size={17} aria-hidden="true" />
              Tour Guide
            </button>
            <button className="secondary-action" onClick={handleExportActiveView} disabled={!canExportActiveView}>
              <Download size={17} aria-hidden="true" />
              Export
            </button>
          </div>
        </header>

        <div className="view-stage" key={activeView}>
        {activeView === "dashboard" ? (
          <DashboardView
            expiredInventoryCount={expiredInventoryCount}
            expiringCount={expiringCount}
            expiringIn30Days={expiringIn30Days}
            expiringIn60Days={expiringIn60Days}
            expiringIn90Days={expiringIn90Days}
            goodsReceivedToday={goodsReceivedToday}
            openShipments={openShipments}
            totalInventoryQuantity={totalInventoryQuantity}
            totalInventoryValue={totalInventoryValue}
            varianceTotal={varianceTotal}
            auditEvents={auditEvents}
            importQueue={importQueue}
            inventory={inventory}
            onNavigate={setActiveView}
            shipments={shipments}
            validationQueue={validationQueue}
          />
        ) : null}
        {activeView === "goods-tracking" ? (
          <GoodsTrackingView
            documents={documents}
            importQueue={importQueue}
            inventory={inventory}
            onNavigate={setActiveView}
            shipments={shipments}
          />
        ) : null}
        {activeView === "traceability" ? <TraceabilityView /> : null}
        {activeView === "documents" ? (
          <DocumentsView
            documentMessage={documentMessage}
            documentType={documentType}
            documents={documents}
            isUploading={isUploadingDocument}
            onDocumentTypeChange={setDocumentType}
            onFileChange={setSelectedFiles}
            onOpenDocument={handleOpenDocument}
            onRescan={handleRescanSelectedDocument}
            onUpload={handleDocumentUpload}
            selectedFiles={selectedFiles}
            selectedMaster={selectedMaster}
          />
        ) : null}
        {activeView === "import-validation" ? (
          <ImportValidationView
            candidate={importCandidate}
            currentUser={currentUser}
            destinationWarehouses={destinationWarehouses}
            documents={documents}
            importMessage={importMessage}
            newWarehouseName={newWarehouseName}
            onApproveImport={handleApproveImportCandidate}
            onAssembleImport={handleAssembleImportFromDocuments}
            onMarkDelivered={handleMarkImportDelivered}
            onNewWarehouseNameChange={setNewWarehouseName}
            onPostGoodsReceipt={handlePostImportGoodsReceipt}
            onSaveFieldCorrection={handleSaveFieldCorrection}
            onSelectedWarehouseChange={setSelectedWarehouse}
            securityOverview={securityOverview}
            selectedWarehouse={selectedWarehouse}
            validationMessage={validationMessage}
            validationQueue={validationQueue}
          />
        ) : null}
        {activeView === "erp-uploads" ? (
          <ErpUploadView
            message={erpMessage}
            onDownload={(preview) => downloadCsv(preview.export_filename, erpRowsForExport(preview))}
            onGenerate={handleGenerateErpPreview}
            preview={erpPreview}
            selectedTemplate={selectedErpTemplate}
            setSelectedTemplate={setSelectedErpTemplate}
            templates={erpTemplates}
          />
        ) : null}
        {activeView === "products" ? (
          <ProductsView products={filteredProducts} search={search} setSearch={setSearch} />
        ) : null}
        {activeView === "inventory" ? (
          <InventoryView
            inventory={filteredInventory}
            search={inventorySearch}
            setSearch={setInventorySearch}
            setWarehouseFilter={setInventoryWarehouseFilter}
            setVerticalFilter={setInventoryVerticalFilter}
            verticalFilter={inventoryVerticalFilter}
            verticals={inventoryVerticals}
            warehouseFilter={inventoryWarehouseFilter}
            warehouses={inventoryWarehouses}
          />
        ) : null}
        {activeView === "shipments" ? (
          <ShipmentsView
            currentUser={currentUser}
            customers={customers}
            inventory={inventory}
            onApproveShipment={handleApproveShipment}
            onCreateShipment={handleCreateShipment}
            shipments={shipments}
          />
        ) : null}
        {activeView === "dispatches" ? (
          <DispatchesView
            currentUser={currentUser}
            dispatches={dispatches}
            onConfirmDispatch={handleConfirmDispatch}
            shipments={shipments}
          />
        ) : null}
        {activeView === "receipts" ? <ReceiptsView receipts={receipts} /> : null}
        {activeView === "counts" ? <CountsView counts={counts} /> : null}
        {activeView === "expiry" ? <ExpiryView inventory={inventory} /> : null}
        {activeView === "customers" ? <CustomersView customers={customers} /> : null}
        {activeView === "security" ? (
          <SecurityView
            currentUser={currentUser}
            message={securityMessage}
            onSaveApprovalRule={handleSaveApprovalRule}
            onSaveUser={handleSaveSecurityUser}
            securityOverview={securityOverview}
          />
        ) : null}
        {activeView === "audit" ? <AuditView auditEvents={auditEvents} /> : null}
        {activeView === "learning" ? <LearningCenterView insights={learningInsights} /> : null}
        {activeView === "assistant" ? (
          <AssistantView
            answer={assistantAnswer}
            isAsking={isAskingAssistant}
            onAsk={handleAskAssistant}
            question={assistantQuestion}
            setQuestion={setAssistantQuestion}
          />
        ) : null}
        {activeView === "platform-progress" ? (
          <PlatformProgressView
            auditEvents={auditEvents}
            documents={documents}
            importQueue={importQueue}
            inventory={inventory}
            onNavigate={setActiveView}
            securityOverview={securityOverview}
            shipments={shipments}
          />
        ) : null}
        </div>
        {isWalkthroughOpen ? (
          <GuidedWalkthrough
            onClose={handleCloseWalkthrough}
            onNavigate={setActiveView}
            setStep={setWalkthroughStep}
            step={walkthroughStep}
            steps={visibleWalkthroughSteps}
          />
        ) : null}
      </section>
    </main>
  );
}

function MovementRow({ event }: { event: ApiMovementEvent }) {
  const inbound = event.quantity >= 0;
  return (
    <div className="movement-row">
      <span className={`movement-dot ${inbound ? "movement-in" : "movement-out"}`} aria-hidden="true" />
      <div className="movement-main">
        <strong>
          {toTitleCase(event.event_type)} · {event.item_code} / {event.batch_number}
          {event.serial_number ? ` / ${event.serial_number}` : ""}
        </strong>
        <span>
          {[event.warehouse, event.counterparty, event.reference].filter(Boolean).join(" · ") || "—"}
        </span>
      </div>
      <div className="movement-meta">
        <strong className={inbound ? "movement-qty-in" : "movement-qty-out"}>
          {inbound ? "+" : ""}
          {event.quantity}
        </strong>
        <span>{event.occurred_at}</span>
      </div>
    </div>
  );
}

function TraceabilityView() {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<ApiMovementEvent[]>([]);
  const [traceability, setTraceability] = useState<ApiBatchTraceability | null>(null);
  const [journey, setJourney] = useState<ApiProductJourney | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    fetchMovements()
      .then((events) => {
        if (mounted) setRecent(events);
      })
      .catch(() => {
        if (mounted) setRecent([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSearch() {
    const term = query.trim();
    if (!term) {
      setMessage("Enter a batch number, product code, or serial number.");
      return;
    }
    setIsSearching(true);
    setMessage("");
    try {
      const [trace, jrn] = await Promise.all([
        fetchBatchTraceability(term),
        fetchProductJourney(term),
      ]);
      setTraceability(trace.found ? trace : null);
      setJourney(jrn);
      if (!trace.found && !jrn.found) {
        setMessage(`No movements found for "${term}" yet.`);
      }
    } catch {
      setMessage("Could not search movements. Is the backend running?");
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <>
      <section className="learning-hero panel">
        <div className="learning-hero-mark">
          <GitBranch size={26} aria-hidden="true" />
        </div>
        <div>
          <p className="eyebrow">Batch &amp; Product Traceability</p>
          <h2>Follow any batch, product, or serial from receipt to customer</h2>
          <p className="status-line">
            Every goods movement is recorded as an event. Search a batch, product code, or serial
            number to see its full journey and where the stock is now.
          </p>
        </div>
      </section>

      <Panel title="Search traceability" meta="Batch / product / serial">
        <div className="search-box tracking-search">
          <Search size={16} aria-hidden="true" />
          <input
            placeholder="Enter batch (e.g. MOZSAB24), product code, or serial number"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void handleSearch();
              }
            }}
          />
          <button className="primary-action" type="button" onClick={() => void handleSearch()} disabled={isSearching}>
            {isSearching ? "Searching" : "Trace"}
          </button>
        </div>
        {message ? <p className="status-line">{message}</p> : null}
      </Panel>

      {traceability ? (
        <>
          <section className="kpi-grid" aria-label="Batch traceability">
            <MetricCard label="Received" value={formatNumber(traceability.received_quantity)} detail={`Batch ${traceability.batch_number}`} />
            <MetricCard label="Dispatched" value={formatNumber(traceability.dispatched_quantity)} detail="Sent to customers" />
            <MetricCard label="Allocated" value={formatNumber(traceability.allocated_quantity)} detail="Reserved on shipments" />
            <MetricCard label="Current Stock" value={formatNumber(traceability.current_quantity)} detail="On hand now" />
            <MetricCard label="Batch Expiry" value={traceability.expiry_date ?? "-"} detail="Earliest expiry" />
          </section>
          <div className="learning-grid">
            <Panel title="Warehouses visited" meta={String(traceability.warehouses.length)}>
              {traceability.warehouses.length === 0 ? (
                <p className="empty-state">No warehouse movements recorded.</p>
              ) : (
                <ul className="checklist-list">
                  {traceability.warehouses.map((warehouse) => (
                    <li className="checklist-row" key={warehouse}>
                      <span>{warehouse}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Customers served" meta={String(traceability.customers.length)}>
              {traceability.customers.length === 0 ? (
                <p className="empty-state">Not dispatched to any customer yet.</p>
              ) : (
                <ul className="checklist-list">
                  {traceability.customers.map((customer) => (
                    <li className="checklist-row" key={customer}>
                      <span>{customer}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      ) : null}

      {journey && journey.found ? (
        <Panel title="Product journey" meta={`${journey.events.length} event(s)`}>
          <div className="movement-list">
            {journey.events.map((event) => (
              <MovementRow event={event} key={event.event_id} />
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel title="Recent movements" meta={`${recent.length} event(s)`}>
        {recent.length === 0 ? (
          <p className="empty-state">
            No goods movements recorded yet. Post a Goods Receipt or confirm a dispatch to start the ledger.
          </p>
        ) : (
          <div className="movement-list">
            {recent.slice(0, 25).map((event) => (
              <MovementRow event={event} key={event.event_id} />
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

const TRACKING_STATUS_LABELS: Record<string, string> = {
  documents_pending: "Documents Pending",
  uploaded: "Document Uploaded",
  extracted: "OCR Processing",
  validation_pending: "Validation Pending",
  validated: "Approved",
  country_documents_pending: "Customs Documents",
  customs_in_progress: "Customs Clearance",
  in_transit: "In Transit",
  arrived: "Awaiting Receipt",
  goods_receipt_pending: "Awaiting Receipt",
  received: "Received",
  closed: "Closed",
};

function trackingStatusLabel(status: string): string {
  return TRACKING_STATUS_LABELS[status] ?? toTitleCase(status.replace(/_/g, " "));
}

// The Goods Tracking Control Tower: one screen answering "where are my goods,
// what stage are they in, what risks exist, and what action is required". Every
// number is derived from data the platform already holds (no hardcoded values).
function GoodsTrackingView({
  documents,
  importQueue,
  inventory,
  onNavigate,
  shipments,
}: {
  documents: DocumentRecord[];
  importQueue: ApiImportFileCandidate[];
  inventory: InventoryBatch[];
  onNavigate: (view: string) => void;
  shipments: Shipment[];
}) {
  const [search, setSearch] = useState("");
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const inTransitStatuses = ["validated", "in_transit", "customs_in_progress", "country_documents_pending"];
  const approvedPlusStatuses = [...inTransitStatuses, "arrived", "goods_receipt_pending", "received", "closed"];

  const openImports = importQueue.filter((candidate) => !["received", "closed"].includes(candidate.status));
  const inTransit = importQueue.filter((candidate) => inTransitStatuses.includes(candidate.status)).length;
  const awaitingReceipt = importQueue.filter((candidate) => candidate.status === "arrived").length;
  const receivedImports = importQueue.filter((candidate) => candidate.status === "received").length;
  const validationPending = importQueue.filter((candidate) => candidate.status === "validation_pending").length;
  const approvedPlus = importQueue.filter((candidate) => approvedPlusStatuses.includes(candidate.status)).length;
  const inventoryQty = inventory.reduce((total, batch) => total + batch.quantity, 0);
  const expiryRisk = inventory.filter((batch) => batch.daysToExpiry >= 0 && batch.daysToExpiry <= 90).length;
  const expiredCount = inventory.filter((batch) => batch.daysToExpiry < 0).length;
  const dispatchedOpen = shipments.filter((shipment) => shipment.status === "Dispatched").length;
  const deliveredCount = shipments.filter((shipment) => shipment.status === "Delivered").length;

  const pipeline = [
    { label: "Documents Uploaded", count: documents.length },
    { label: "Validation Pending", count: validationPending },
    { label: "Approved Imports", count: approvedPlus },
    { label: "In Transit", count: inTransit },
    { label: "Awaiting Receipt", count: awaitingReceipt },
    { label: "Received", count: receivedImports },
    { label: "Available Inventory", count: inventory.length },
    { label: "Dispatched", count: dispatchedOpen },
    { label: "Delivered", count: deliveredCount },
  ];
  const maxPipeline = Math.max(...pipeline.map((stage) => stage.count), 1);

  type Risk = { severity: "danger" | "warn" | "active"; message: string; action: string; view: string };
  const risks: Risk[] = [];
  if (validationPending > 0) {
    risks.push({ severity: "warn", message: `${validationPending} import(s) pending validation / approval`, action: "Approve imports", view: "import-validation" });
  }
  if (awaitingReceipt > 0) {
    risks.push({ severity: "active", message: `${awaitingReceipt} delivered shipment(s) awaiting Goods Receipt`, action: "Post Goods Receipt", view: "import-validation" });
  }
  const missingAwb = openImports.filter((candidate) => !candidate.awb_number).length;
  if (missingAwb > 0) {
    risks.push({ severity: "warn", message: `${missingAwb} open shipment(s) missing an AWB number`, action: "Open imports", view: "import-validation" });
  }
  const missingDocs = openImports.filter((candidate) => !candidate.invoice_number || candidate.packing_list_document_ids.length === 0).length;
  if (missingDocs > 0) {
    risks.push({ severity: "warn", message: `${missingDocs} open shipment(s) missing invoice or packing list`, action: "Open documents", view: "documents" });
  }
  if (expiryRisk > 0) {
    risks.push({ severity: "danger", message: `${expiryRisk} inventory batch(es) expiring within 90 days`, action: "Review expiry", view: "expiry" });
  }
  if (expiredCount > 0) {
    risks.push({ severity: "danger", message: `${expiredCount} expired inventory batch(es) need disposal review`, action: "Review inventory", view: "inventory" });
  }

  const term = search.trim().toLowerCase();
  const rows = importQueue
    .map((candidate) => {
      const expiryDates = candidate.lines.map((line) => line.expiry_date).filter((value): value is string => Boolean(value));
      const earliestExpiry = expiryDates.length ? [...expiryDates].sort()[0] : null;
      const expiryDays = earliestExpiry ? daysUntil(earliestExpiry) : null;
      let score = 0;
      if (!candidate.awb_number) score += 25;
      if (!candidate.invoice_number) score += 20;
      if (candidate.status === "validation_pending") score += 20;
      if (expiryDays !== null && expiryDays <= 90) score += 30;
      const riskLevel = score >= 50 ? "High" : score >= 25 ? "Medium" : "Low";
      const haystack = [
        candidate.shipment_name,
        candidate.import_file_number,
        candidate.awb_number,
        candidate.invoice_number,
        candidate.supplier_name,
        candidate.destination_country,
        candidate.destination_entity,
        candidate.carrier_name,
        ...candidate.lines.map((line) => line.item_code),
        ...candidate.lines.map((line) => line.batch_number),
        ...candidate.lines.map((line) => line.serial_number ?? ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return { candidate, earliestExpiry, riskLevel, haystack };
    })
    .filter((row) => !term || row.haystack.includes(term));

  return (
    <>
      <section className="learning-hero panel">
        <div className="learning-hero-mark">
          <RadioTower size={26} aria-hidden="true" />
        </div>
        <div>
          <p className="eyebrow">Goods Tracking Control Tower</p>
          <h2>Where your goods are, what stage they are in, and what needs action</h2>
          <p className="status-line">
            End-to-end visibility from supplier to customer, built live from your documents,
            imports, inventory, and dispatches.
          </p>
        </div>
      </section>

      <section className="kpi-grid" aria-label="Goods tracking metrics">
        <MetricCard label="Open Import Shipments" value={String(openImports.length)} detail="Not yet received" />
        <MetricCard label="Goods In Transit" value={String(inTransit)} detail="Approved, en route" />
        <MetricCard label="Awaiting Receipt" value={String(awaitingReceipt)} detail="Delivered, not posted" />
        <MetricCard label="Received Imports" value={String(receivedImports)} detail="Posted to inventory" />
        <MetricCard label="Inventory Available" value={formatNumber(inventoryQty)} detail="On-hand quantity" />
        <MetricCard label="Goods At Expiry Risk" value={String(expiryRisk)} detail="Within 90 days" />
        <MetricCard label="Dispatched" value={String(dispatchedOpen)} detail="Out for delivery" />
        <MetricCard label="Delivered" value={String(deliveredCount)} detail="Customer confirmed" />
      </section>

      <div className="learning-grid">
        <Panel title="Goods status pipeline" meta="Live funnel">
          <div className="funnel">
            {pipeline.map((stage) => (
              <div className="funnel-row" key={stage.label}>
                <span className="funnel-label">{stage.label}</span>
                <div className="funnel-track">
                  <span style={{ width: revealed ? `${Math.max((stage.count / maxPipeline) * 100, 2)}%` : "0%" }} />
                </div>
                <strong className="funnel-count">{stage.count}</strong>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Risks & recommended actions" meta={`${risks.length} open`}>
          {risks.length === 0 ? (
            <p className="empty-state">No open risks. Every shipment is on track.</p>
          ) : (
            <div className="review-list">
              {risks.map((risk) => (
                <button
                  type="button"
                  className="review-row"
                  key={risk.message}
                  onClick={() => onNavigate(risk.view)}
                >
                  <div>
                    <strong>
                      <span className={`risk-dot risk-${risk.severity}`} aria-hidden="true" /> {risk.message}
                    </strong>
                    <span>Recommended: {risk.action}</span>
                  </div>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Live goods tracking" meta={`${rows.length} shipment(s)`}>
        <div className="search-box tracking-search">
          <Search size={16} aria-hidden="true" />
          <input
            placeholder="Search shipment, AWB, invoice, supplier, product, batch, or serial"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {rows.length === 0 ? (
          <p className="empty-state">No shipments match your search.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Shipment</th>
                <th>Status</th>
                <th>AWB</th>
                <th>Invoice</th>
                <th>Supplier</th>
                <th>Country</th>
                <th>Carrier / Flight</th>
                <th>Lines</th>
                <th>Earliest Expiry</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ candidate, earliestExpiry, riskLevel }) => (
                <tr key={candidate.import_file_number}>
                  <td>{candidate.shipment_name ?? candidate.import_file_number}</td>
                  <td><StatusTag label={trackingStatusLabel(candidate.status)} /></td>
                  <td><span className="muted-cell">{candidate.awb_number ?? "-"}</span></td>
                  <td><span className="muted-cell">{candidate.invoice_number ?? "-"}</span></td>
                  <td>{candidate.supplier_name ?? "-"}</td>
                  <td>{candidate.destination_country}</td>
                  <td>
                    {candidate.carrier_name ?? "-"}
                    {candidate.flight_number ? <span className="muted-cell"> · {candidate.flight_number}</span> : null}
                  </td>
                  <td>{candidate.lines.length}</td>
                  <td>{earliestExpiry ?? "-"}</td>
                  <td><StatusTag label={riskLevel} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

function DashboardView({
  expiredInventoryCount,
  totalInventoryValue,
  totalInventoryQuantity,
  expiringCount,
  expiringIn30Days,
  expiringIn60Days,
  expiringIn90Days,
  goodsReceivedToday,
  openShipments,
  varianceTotal,
  auditEvents,
  importQueue,
  inventory,
  onNavigate,
  shipments,
  validationQueue,
}: {
  expiredInventoryCount: number;
  totalInventoryValue: number;
  totalInventoryQuantity: number;
  expiringCount: number;
  expiringIn30Days: number;
  expiringIn60Days: number;
  expiringIn90Days: number;
  goodsReceivedToday: number;
  openShipments: number;
  varianceTotal: number;
  auditEvents: ApiAuditEvent[];
  importQueue: ApiImportFileCandidate[];
  inventory: InventoryBatch[];
  onNavigate: (view: string) => void;
  shipments: Shipment[];
  validationQueue: ApiValidationQueueResponse;
}) {
  const scoredItems = validationQueue.items.filter(
    (item) => item.confidence_score !== null && item.confidence_score !== undefined,
  );
  const asPercent = (score: number) => (score <= 1 ? score * 100 : score);
  const highConfidence = scoredItems.filter((item) => asPercent(item.confidence_score as number) >= 85).length;
  const reviewConfidence = scoredItems.filter((item) => {
    const percent = asPercent(item.confidence_score as number);
    return percent >= 60 && percent < 85;
  }).length;
  const lowConfidence = scoredItems.filter((item) => asPercent(item.confidence_score as number) < 60).length;
  const confidenceChecked = scoredItems.length;
  const extractionNeedsReview = reviewConfidence + lowConfidence;
  const reviewList = [...scoredItems]
    .sort((a, b) => asPercent(a.confidence_score as number) - asPercent(b.confidence_score as number))
    .filter((item) => asPercent(item.confidence_score as number) < 85)
    .slice(0, 6);
  const warehouseValues = inventory.reduce<Record<string, number>>((totals, batch) => {
    totals[batch.warehouse] = (totals[batch.warehouse] ?? 0) + batch.quantity * batch.unitValue;
    return totals;
  }, {});
  const categoryValues = inventory.reduce<Record<string, number>>((totals, batch) => {
    totals[batch.category] = (totals[batch.category] ?? 0) + batch.quantity * batch.unitValue;
    return totals;
  }, {});
  const maxWarehouseValue = Math.max(...Object.values(warehouseValues), 1);
  const maxCategoryValue = Math.max(...Object.values(categoryValues), 1);
  const activeImports = importQueue.filter((candidate) =>
    !["received", "closed"].includes(candidate.status),
  );
  const pendingApproval = importQueue.filter((candidate) => candidate.status === "validation_pending").length;
  const pendingReceipt = importQueue.filter((candidate) => candidate.status === "validated").length;

  return (
    <>
      <section className="workflow-strip" aria-label="Import workflow">
        <WorkflowStep
          icon={FileUp}
          label="Documents"
          detail={`${importQueue.length} import file(s)`}
          state={importQueue.length > 0 ? "done" : "active"}
        />
        <WorkflowStep
          icon={ClipboardCheck}
          label="Validation"
          detail={`${pendingApproval} pending approval`}
          state={pendingApproval > 0 ? "active" : "done"}
        />
        <WorkflowStep
          icon={CheckCircle2}
          label="Approval"
          detail={`${pendingReceipt} ready for receipt`}
          state={pendingReceipt > 0 ? "active" : "waiting"}
        />
        <WorkflowStep
          icon={Database}
          label="Inventory"
          detail={`${formatNumber(totalInventoryQuantity)} on hand`}
          state={goodsReceivedToday > 0 ? "done" : "waiting"}
        />
      </section>

      <section className="kpi-grid" aria-label="Key metrics">
        <MetricCard label="Total Inventory Value" value={formatCurrency(totalInventoryValue)} detail="All warehouses" />
        <MetricCard label="Total Inventory Qty" value={formatNumber(totalInventoryQuantity)} detail="On-hand stock" />
        <MetricCard label="Expiry 30 Days" value={String(expiringIn30Days)} detail="Immediate risk" />
        <MetricCard label="Expiry 60 Days" value={String(expiringIn60Days)} detail="Near-term risk" />
        <MetricCard label="Expiry 90 Days" value={String(expiringIn90Days)} detail="Control watchlist" />
        <MetricCard label="Expiring Stock Alerts" value={String(expiringCount)} detail="Within 180 days" />
        <MetricCard label="Open Shipments" value={String(openShipments)} detail="Draft to approved" />
        <MetricCard label="Receipts Today" value={String(goodsReceivedToday)} detail="Posted GRNs" />
        <MetricCard label="Expired Inventory" value={String(expiredInventoryCount)} detail="Blocked review" />
        <MetricCard label="Variance Quantity" value={String(varianceTotal)} detail="Open count variance" />
        <MetricCard label="Extraction Review" value={String(extractionNeedsReview)} detail="Low/medium confidence fields" />
      </section>

      <section className="action-grid" aria-label="Next actions">
        <ActionCard
          icon={FileCheck2}
          label="Import Work Queue"
          value={String(activeImports.length)}
          detail="Files waiting for approval, receipt, or closure"
          action="Open imports"
          onClick={() => onNavigate("import-validation")}
        />
        <ActionCard
          icon={Activity}
          label="Inventory Risk"
          value={String(expiringIn90Days + expiredInventoryCount)}
          detail="Expiry and blocked review items"
          action="Review inventory"
          onClick={() => onNavigate("inventory")}
        />
        <ActionCard
          icon={History}
          label="Audit Trail"
          value={String(auditEvents.length)}
          detail="Latest persisted workflow events"
          action="Open audit"
          onClick={() => onNavigate("audit")}
        />
      </section>

      <section className="content-grid" aria-label="Extraction quality">
        <Panel title="Extraction quality" meta={`${confidenceChecked} checked field(s)`}>
          <ConfidenceMeter high={highConfidence} review={reviewConfidence} low={lowConfidence} />
        </Panel>
        <Panel title="Needs a human" meta="Lowest confidence first">
          {reviewList.length === 0 ? (
            <p className="empty-state">No low-confidence extractions. Everything read cleanly.</p>
          ) : (
            <div className="review-list">
              {reviewList.map((item) => (
                <button
                  type="button"
                  className="review-row"
                  key={item.queue_id}
                  onClick={() => onNavigate("import-validation")}
                >
                  <div>
                    <strong>{item.field_name}</strong>
                    <span>{item.filename}</span>
                  </div>
                  <ConfidenceBadge score={item.confidence_score} />
                </button>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="control-grid" aria-label="Control tower intelligence">
        <Warehouse3DMap inventory={inventory} />
        <WhatIfSimulator inventory={inventory} shipments={shipments} />
      </section>

      <section className="content-grid wide-left">
        <ShipmentRoutePanel shipments={shipments} />
        <Panel title="Operations pulse" meta="Live queue">
          <div className="pulse-stack">
            <PulseItem label="Imports pending approval" value={String(pendingApproval)} state={pendingApproval > 0 ? "warn" : "ok"} />
            <PulseItem label="Imports ready for receipt" value={String(pendingReceipt)} state={pendingReceipt > 0 ? "active" : "ok"} />
            <PulseItem label="Shipment requests open" value={String(openShipments)} state={openShipments > 0 ? "active" : "ok"} />
            <PulseItem label="Expiry alerts under 90 days" value={String(expiringIn90Days)} state={expiringIn90Days > 0 ? "danger" : "ok"} />
          </div>
        </Panel>
      </section>

      <section className="content-grid">
        <Panel title="Inventory by warehouse" meta="Value">
          {Object.entries(warehouseValues).map(([warehouse, value]) => (
            <BarRow label={warehouse} value={value} max={maxWarehouseValue} key={warehouse} />
          ))}
        </Panel>
        <Panel title="Inventory by category" meta="Value">
          {Object.entries(categoryValues).map(([category, value]) => (
            <BarRow label={category} value={value} max={maxCategoryValue} key={category} />
          ))}
        </Panel>
      </section>
      <section className="content-grid wide-left">
        <Panel title="Upcoming expiries" meta="FEFO">
          <InventoryTable rows={inventory.filter((batch) => batch.expiryBucket !== "Above 365 Days")} compact />
        </Panel>
        <Panel title="Import work queue" meta={`${activeImports.length} active`}>
          <ImportQueueList rows={importQueue.slice(0, 6)} />
        </Panel>
      </section>
      <section className="content-grid wide-left">
        <Panel title="Open shipment requests" meta="Status">
          <ShipmentTable rows={shipments} compact />
        </Panel>
        <Panel title="Recent audit" meta={`${auditEvents.length} events`}>
          <AuditEventList rows={auditEvents.slice(0, 5)} />
        </Panel>
      </section>
    </>
  );
}

function Warehouse3DMap({ inventory }: { inventory: InventoryBatch[] }) {
  const warehouseStats = Object.values(
    inventory.reduce<Record<string, { warehouse: string; quantity: number; value: number; risky: number }>>(
      (totals, batch) => {
        const current = totals[batch.warehouse] ?? {
          warehouse: batch.warehouse,
          quantity: 0,
          value: 0,
          risky: 0,
        };
        current.quantity += batch.quantity;
        current.value += batch.quantity * batch.unitValue;
        current.risky += batch.daysToExpiry <= 180 ? 1 : 0;
        totals[batch.warehouse] = current;
        return totals;
      },
      {},
    ),
  ).sort((a, b) => b.value - a.value);
  const maxQuantity = Math.max(...warehouseStats.map((warehouse) => warehouse.quantity), 1);

  return (
    <Panel title="3D warehouse inventory map" meta={`${warehouseStats.length} warehouse(s)`}>
      <div className="warehouse-scene" aria-label="Warehouse inventory capacity map">
        {warehouseStats.length === 0 ? (
          <p className="empty-state">No inventory available for mapping.</p>
        ) : (
          warehouseStats.map((warehouse, index) => {
            const height = Math.max(18, Math.round((warehouse.quantity / maxQuantity) * 100));
            return (
              <article className="warehouse-column" key={warehouse.warehouse}>
                <div className="warehouse-column-stage">
                  <div
                    className={warehouse.risky > 0 ? "warehouse-bar warning" : "warehouse-bar"}
                    style={{ height: `${height}%` }}
                  />
                  <span className="warehouse-floor">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div>
                  <strong>{warehouse.warehouse}</strong>
                  <span>{formatNumber(warehouse.quantity)} units</span>
                  <small>{formatCurrency(warehouse.value)}</small>
                </div>
              </article>
            );
          })
        )}
      </div>
    </Panel>
  );
}

function WhatIfSimulator({
  inventory,
  shipments,
}: {
  inventory: InventoryBatch[];
  shipments: Shipment[];
}) {
  const [portDelay, setPortDelay] = useState(2);
  const [customsDelay, setCustomsDelay] = useState(3);
  const totalDelay = portDelay + customsDelay;
  const openShipments = shipments.filter((shipment) =>
    ["Draft", "Submitted", "Approved"].includes(shipment.status),
  );
  const impactedShipments = openShipments.filter((shipment) => daysUntil(shipment.requiredDate) <= totalDelay + 5);
  const stockRisk = inventory.filter((batch) => batch.daysToExpiry >= 0 && batch.daysToExpiry <= totalDelay * 20).length;
  const riskScore = Math.min(100, impactedShipments.length * 22 + stockRisk * 8 + totalDelay * 3);

  return (
    <Panel title="What-if delay simulator" meta={`${totalDelay} day impact`}>
      <div className="simulator-stack">
        <SliderControl
          label="Port congestion delay"
          max={14}
          min={0}
          onChange={setPortDelay}
          value={portDelay}
        />
        <SliderControl
          label="Customs clearance delay"
          max={14}
          min={0}
          onChange={setCustomsDelay}
          value={customsDelay}
        />
        <div className="risk-meter">
          <div>
            <span>Risk score</span>
            <strong>{riskScore}</strong>
          </div>
          <div className="risk-track">
            <span style={{ width: `${riskScore}%` }} />
          </div>
        </div>
        <div className="simulator-results">
          <SummaryItem label="Impacted shipments" value={String(impactedShipments.length)} />
          <SummaryItem label="Expiry-sensitive batches" value={String(stockRisk)} />
        </div>
      </div>
    </Panel>
  );
}

function SliderControl({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="slider-control">
      <span>{label}</span>
      <div>
        <input
          max={max}
          min={min}
          type="range"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <strong>{value}d</strong>
      </div>
    </label>
  );
}

function ShipmentRoutePanel({ shipments }: { shipments: Shipment[] }) {
  const openShipments = shipments
    .filter((shipment) => ["Draft", "Submitted", "Approved"].includes(shipment.status))
    .slice(0, 6);

  return (
    <Panel title="Shipment route monitor" meta={`${openShipments.length} active`}>
      <div className="route-list">
        {openShipments.length === 0 ? (
          <p className="empty-state">No active shipments to monitor.</p>
        ) : (
          openShipments.map((shipment) => (
            <article className="route-row" key={shipment.shipmentId}>
              <div className="route-line">
                <span />
                <i />
                <span />
              </div>
              <div>
                <strong>{shipment.shipmentId}</strong>
                <span>{shipment.customer} to {shipment.destination}</span>
              </div>
              <div>
                <StatusTag label={shipment.status} />
                <small>{daysUntil(shipment.requiredDate)}d due</small>
              </div>
            </article>
          ))
        )}
      </div>
    </Panel>
  );
}

function PulseItem({
  label,
  state,
  value,
}: {
  label: string;
  state: "active" | "danger" | "ok" | "warn";
  value: string;
}) {
  return (
    <article className={`pulse-item ${state}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function PlatformProgressView({
  auditEvents,
  documents,
  importQueue,
  inventory,
  onNavigate,
  securityOverview,
  shipments,
}: {
  auditEvents: ApiAuditEvent[];
  documents: DocumentRecord[];
  importQueue: ApiImportFileCandidate[];
  inventory: InventoryBatch[];
  onNavigate: (view: string) => void;
  securityOverview: ApiSecurityOverview;
  shipments: Shipment[];
}) {
  const stats = getPlatformCompletionStats();
  const completeCapabilities = platformCapabilities.filter((capability) => capability.status === "complete");
  const partialCapabilities = platformCapabilities.filter((capability) => capability.status === "partial");
  const plannedCapabilities = platformCapabilities.filter((capability) => capability.status === "planned");
  const openShipments = shipments.filter((shipment) =>
    ["Draft", "Submitted", "Approved"].includes(shipment.status),
  ).length;
  const importFilesNeedingWork = importQueue.filter((candidate) =>
    !["received", "closed"].includes(candidate.status),
  ).length;
  const expiryRisk = inventory.filter((batch) => batch.daysToExpiry >= 0 && batch.daysToExpiry <= 180).length;

  return (
    <>
      <section className="progress-hero">
        <div className="completion-orbit">
          <PlatformScoreRing score={stats.score} />
        </div>
        <div className="progress-hero-copy">
          <span className="section-label">Core idea assessment</span>
          <h2>Production foundation is working. Enterprise intelligence is still being built.</h2>
          <p>
            The platform now handles document-led imports, validation, learning capture, approvals, inventory posting,
            shipment approval, dispatch, dashboards, RBAC, audit logs, PostgreSQL persistence, and GitHub backup.
          </p>
          <div className="truth-grid">
            <SummaryItem label="Completed modules" value={String(stats.complete)} />
            <SummaryItem label="Partial modules" value={String(stats.partial)} />
            <SummaryItem label="Planned modules" value={String(stats.planned)} />
          </div>
          <div className="form-action-row">
            <button className="primary-action" onClick={() => onNavigate("documents")}>
              <FileUp size={17} aria-hidden="true" />
              Start document flow
            </button>
            <button className="secondary-action" onClick={() => onNavigate("dashboard")}>
              <RadioTower size={17} aria-hidden="true" />
              Open control tower
            </button>
          </div>
        </div>
        <div className="live-readiness-panel">
          <StatusTag label="Honest progress" />
          <strong>{stats.score}%</strong>
          <span>Weighted build maturity</span>
          <div className="readiness-lines">
            <ReadinessLine label="Documents uploaded" value={documents.length} max={12} />
            <ReadinessLine label="Active import files" value={importFilesNeedingWork} max={8} />
            <ReadinessLine label="Open shipments" value={openShipments} max={8} />
            <ReadinessLine label="Expiry risk batches" value={expiryRisk} max={12} />
            <ReadinessLine label="Audit events" value={auditEvents.length} max={30} />
          </div>
        </div>
      </section>

      <Panel title="Platform architecture and data flow" meta="Document to decision">
        <ProgressArchitectureFlow />
      </Panel>

      <section className="content-grid wide-left">
        <Panel title="Completion matrix" meta={`${platformCapabilities.length} modules`}>
          <div className="capability-grid">
            {platformCapabilities.map((capability) => (
              <CapabilityCard capability={capability} key={capability.module} />
            ))}
          </div>
        </Panel>
        <Panel title="What is left" meta="Build sequence">
          <RemainingWorkPanel
            completeCapabilities={completeCapabilities}
            partialCapabilities={partialCapabilities}
            plannedCapabilities={plannedCapabilities}
          />
        </Panel>
      </section>

      <section className="control-grid">
        <GlobalIntelligenceMap importQueue={importQueue} shipments={shipments} />
        <CopilotReadinessCard />
      </section>

      <Panel title="Next build sequence" meta="No distraction order">
        <NextBuildSequence />
      </Panel>
    </>
  );
}

function PlatformScoreRing({ score }: { score: number }) {
  return (
    <div
      className="platform-score-ring"
      style={{ background: `conic-gradient(var(--tower-emerald) ${score}%, rgba(138, 165, 181, 0.14) 0)` }}
    >
      <div>
        <strong>{score}%</strong>
        <span>complete</span>
      </div>
    </div>
  );
}

function ReadinessLine({ label, max, value }: { label: string; max: number; value: number }) {
  const width = `${Math.min(100, Math.max(8, (value / Math.max(max, 1)) * 100))}%`;
  return (
    <div className="readiness-line">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="mini-track">
        <span style={{ width }} />
      </div>
    </div>
  );
}

function ProgressArchitectureFlow() {
  const flowNodes = [
    { label: "Docs", detail: "Upload", icon: FileUp, state: "complete" },
    { label: "OCR", detail: "Extract", icon: ScanText, state: "partial" },
    { label: "Validate", detail: "Review", icon: ClipboardCheck, state: "complete" },
    { label: "Learn", detail: "Memory", icon: BrainCircuit, state: "partial" },
    { label: "Approve", detail: "RBAC", icon: ShieldCheck, state: "complete" },
    { label: "Stock", detail: "Post", icon: Boxes, state: "complete" },
    { label: "Ship", detail: "Dispatch", icon: Truck, state: "complete" },
    { label: "Analytics", detail: "KPIs", icon: BarChart3, state: "partial" },
    { label: "AI", detail: "Recs", icon: Sparkles, state: "partial" },
  ];

  return (
    <div className="architecture-flow">
      {flowNodes.map((node, index) => {
        const Icon = node.icon;
        return (
          <div className="architecture-flow-item" key={node.label}>
            <article className={`architecture-node ${node.state}`}>
              <Icon size={22} aria-hidden="true" />
              <strong>{node.label}</strong>
              <span>{node.detail}</span>
            </article>
            {index < flowNodes.length - 1 ? (
              <div className="flow-connector">
                <span />
                <ChevronRight size={18} aria-hidden="true" />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function CapabilityCard({ capability }: { capability: PlatformCapability }) {
  const Icon = capability.icon;
  return (
    <article className={`capability-card ${capability.status}`}>
      <div className="capability-card-head">
        <Icon size={20} aria-hidden="true" />
        <StatusTag label={capability.status} />
      </div>
      <strong>{capability.module}</strong>
      <span>{capability.area}</span>
      <div className="mini-track">
        <span style={{ width: `${capability.progress}%` }} />
      </div>
      <small>{capability.whatDone}</small>
    </article>
  );
}

function RemainingWorkPanel({
  completeCapabilities,
  partialCapabilities,
  plannedCapabilities,
}: {
  completeCapabilities: PlatformCapability[];
  partialCapabilities: PlatformCapability[];
  plannedCapabilities: PlatformCapability[];
}) {
  return (
    <div className="remaining-stack">
      <RemainingGroup title="Completed foundation" capabilities={completeCapabilities} state="complete" />
      <RemainingGroup title="Partial, needs hardening" capabilities={partialCapabilities} state="partial" />
      <RemainingGroup title="Still to build" capabilities={plannedCapabilities} state="planned" />
    </div>
  );
}

function RemainingGroup({
  capabilities,
  state,
  title,
}: {
  capabilities: PlatformCapability[];
  state: PlatformStatus;
  title: string;
}) {
  return (
    <article className={`remaining-group ${state}`}>
      <div>
        <strong>{title}</strong>
        <span>{capabilities.length} module(s)</span>
      </div>
      {capabilities.slice(0, 5).map((capability) => (
        <p key={capability.module}>
          <CircleDot size={13} aria-hidden="true" />
          {capability.module}
        </p>
      ))}
    </article>
  );
}

function GlobalIntelligenceMap({
  importQueue,
  shipments,
}: {
  importQueue: ApiImportFileCandidate[];
  shipments: Shipment[];
}) {
  const activeImports = importQueue.filter((candidate) => candidate.status !== "received").length;
  const activeShipments = shipments.filter((shipment) =>
    ["Draft", "Submitted", "Approved"].includes(shipment.status),
  ).length;

  return (
    <Panel title="Animated global control map" meta="India to subsidiaries">
      <div className="global-map-shell">
        <div className="rotating-globe">
          <span className="map-node origin">India</span>
          <span className="map-node node-eu">Europe</span>
          <span className="map-node node-us">USA</span>
          <span className="map-node node-me">UAE</span>
          <i className="route-arc arc-one" />
          <i className="route-arc arc-two" />
          <i className="route-arc arc-three" />
        </div>
        <div className="map-signal-grid">
          <SummaryItem label="Active import files" value={String(activeImports)} />
          <SummaryItem label="Active shipments" value={String(activeShipments)} />
          <SummaryItem label="Global origin" value="India" />
          <SummaryItem label="Mode" value="Import first" />
        </div>
      </div>
    </Panel>
  );
}

function CopilotReadinessCard() {
  const readiness = [
    { label: "Data foundation", value: 72 },
    { label: "Workflow automation", value: 68 },
    { label: "Learning memory", value: 48 },
    { label: "Predictive intelligence", value: 22 },
    { label: "Natural language answers", value: 35 },
  ];

  return (
    <Panel title="AI copilot readiness" meta="Current truth">
      <div className="copilot-readiness">
        <div className="brain-orbit">
          <BrainCircuit size={52} aria-hidden="true" />
          <span />
          <span />
          <span />
        </div>
        <strong>AI can assist. It cannot fully decide yet.</strong>
        <p>
          We need cleaner data, more validation history, and stronger traceability before real autonomous decisions.
        </p>
        <div className="readiness-lines">
          {readiness.map((item) => (
            <ReadinessLine key={item.label} label={item.label} max={100} value={item.value} />
          ))}
        </div>
      </div>
    </Panel>
  );
}

function NextBuildSequence() {
  const nextSteps = [
    {
      title: "Production OCR engine",
      detail: "Add PaddleOCR/Tesseract pipeline, table extraction, confidence score, and correction memory.",
      icon: ScanText,
      target: "Stop manual document reading.",
    },
    {
      title: "Template and ERP upload engine",
      detail: "Let users upload Excel templates, map fields, generate ERP-ready files, and download.",
      icon: FileSpreadsheet,
      target: "Stop retyping into ERP upload files.",
    },
    {
      title: "Traceability and compliance",
      detail: "Add serial, UDI, GTIN, recall readiness, quality hold, and regulatory document linkage.",
      icon: RadioTower,
      target: "Make medical-device compliance defendable.",
    },
    {
      title: "Forecast and stock coverage",
      detail: "Upload forecasts, calculate coverage, identify stockout risk, and compare demand versus stock.",
      icon: Activity,
      target: "Move from reactive to proactive planning.",
    },
    {
      title: "True AI copilot",
      detail: "Connect model-backed assistant after the data foundation is strong enough to trust.",
      icon: Sparkles,
      target: "Ask questions, get sourced operational recommendations.",
    },
  ];

  return (
    <div className="next-build-grid">
      {nextSteps.map((step, index) => {
        const Icon = step.icon;
        return (
          <article className="next-build-card" key={step.title}>
            <div className="next-build-index">{index + 1}</div>
            <Icon size={22} aria-hidden="true" />
            <strong>{step.title}</strong>
            <span>{step.detail}</span>
            <small>{step.target}</small>
          </article>
        );
      })}
    </div>
  );
}

function DocumentsView({
  documentMessage,
  documentType,
  documents,
  isUploading,
  onDocumentTypeChange,
  onFileChange,
  onOpenDocument,
  onRescan,
  onUpload,
  selectedFiles,
  selectedMaster,
}: {
  documentMessage: string;
  documentType: DocumentType;
  documents: DocumentRecord[];
  isUploading: boolean;
  onDocumentTypeChange: (value: DocumentType) => void;
  onFileChange: (value: File[]) => void;
  onOpenDocument: (documentId: string) => void;
  onRescan: () => void;
  onUpload: () => void;
  selectedFiles: File[];
  selectedMaster: DocumentExtractionMaster | null;
}) {
  const fields = selectedMaster?.fields ?? [];
  const requiredChecks = selectedMaster?.required_field_checks ?? [];
  const masterCandidates = selectedMaster?.master_candidates ?? [];
  const missingRequired = requiredChecks.filter((check) => !check.is_satisfied).length;

  return (
    <>
      <section className="content-grid">
        <Panel title="Upload and scan document" meta="Auto trigger">
          <div className="upload-form">
            <label>
              <span>Document type</span>
              <select
                value={documentType}
                onChange={(event) => onDocumentTypeChange(event.target.value as DocumentType)}
              >
                {documentTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Source files</span>
              <input
                accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png"
                multiple
                type="file"
                onChange={(event) => onFileChange(Array.from(event.target.files ?? []))}
              />
            </label>
            <button className="primary-action" onClick={onUpload} disabled={isUploading}>
              <Upload size={17} aria-hidden="true" />
              {isUploading ? "Scanning" : "Upload and scan"}
            </button>
            <button className="secondary-action" onClick={onRescan} disabled={isUploading || !selectedMaster}>
              <RefreshCw size={17} aria-hidden="true" />
              Rescan selected
            </button>
            <p className="status-line">
              {selectedFiles.length > 0 ? formatSelectedFiles(selectedFiles) : documentMessage}
            </p>
          </div>
        </Panel>

        <Panel title="Uploaded documents" meta={`${documents.length} saved`}>
          <div className="document-list">
            {documents.length === 0 ? (
              <p className="empty-state">No documents uploaded yet.</p>
            ) : (
              documents.map((document) => (
                <button
                  className="document-row"
                  key={document.document_id}
                  onClick={() => onOpenDocument(document.document_id)}
                >
                  <div>
                    <strong>{document.filename}</strong>
                    <span>{document.document_type.replace(/_/g, " ")}</span>
                  </div>
                  <span>
                    {document.missing_required_count === 0
                      ? "Ready"
                      : `${document.missing_required_count} missing`}
                  </span>
                </button>
              ))
            )}
          </div>
        </Panel>
      </section>

      <section className="content-grid wide-left">
        <Panel
          title="Required-field readiness"
          meta={
            requiredChecks.length === 0
              ? "Pending upload"
              : missingRequired === 0
                ? "Ready for validation"
                : `${missingRequired} missing`
          }
        >
          <div className="required-grid">
            {requiredChecks.length === 0 ? (
              <p className="empty-state">Upload a document to check mandatory fields.</p>
            ) : (
              requiredChecks.map((check) => (
                <article
                  className={check.is_satisfied ? "required-card satisfied" : "required-card missing"}
                  key={check.requirement_name}
                >
                  <span>{check.is_satisfied ? "Found" : "Missing"}</span>
                  <strong>{check.requirement_name}</strong>
                  <small>
                    {check.matched_field
                      ? `${check.matched_field}: ${check.matched_value}`
                      : check.accepted_fields.join(", ")}
                  </small>
                </article>
              ))
            )}
          </div>
        </Panel>

        <Panel title="Master candidates" meta={`${masterCandidates.length} pending`}>
          <div className="candidate-grid">
            {masterCandidates.length === 0 ? (
              <p className="empty-state">No master candidates generated yet.</p>
            ) : (
              masterCandidates.map((candidate) => (
                <article
                  className="candidate-card"
                  key={`${candidate.candidate_type}-${candidate.candidate_name}`}
                >
                  <span>{candidate.candidate_type}</span>
                  <strong>{candidate.candidate_name}</strong>
                  <small>{candidate.candidate_code ?? candidate.status}</small>
                </article>
              ))
            )}
          </div>
        </Panel>
      </section>

      <Panel title="Extracted details" meta={`${fields.length} fields`}>
        <table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Extracted Value</th>
              <th>Confidence</th>
              <th>Source</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 ? (
              <tr>
                <td colSpan={5}>No extracted fields yet.</td>
              </tr>
            ) : (
              fields.slice(0, 40).map((field) => (
                <tr key={field.field_name}>
                  <td>{field.field_name}</td>
                  <td>{formatExtractedValue(field)}</td>
                  <td><ConfidenceBadge score={field.confidence_score} /></td>
                  <td>
                    {field.page_number ? `Page ${field.page_number}` : "—"}
                    {field.source_engine ? <span className="muted-cell"> · {field.source_engine}</span> : null}
                  </td>
                  <td><StatusTag label={field.validation_status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

function formatExtractedValue(field: ExtractedField): string {
  const value = field.extracted_value;
  if (!value) {
    return "Needs validation";
  }

  if (field.field_name === "Line Items JSON") {
    try {
      const lineItems = JSON.parse(value) as unknown[];
      return `${lineItems.length} line item(s) extracted`;
    } catch {
      return "Line items extracted";
    }
  }

  return value.length > 140 ? `${value.slice(0, 137)}...` : value;
}

function formatSelectedFiles(files: File[]): string {
  if (files.length === 1) {
    return files[0].name;
  }
  const visibleNames = files.slice(0, 2).map((file) => file.name).join(", ");
  const remainingCount = files.length - 2;
  return remainingCount > 0
    ? `${visibleNames} + ${remainingCount} more file(s)`
    : visibleNames;
}

function ImportValidationView({
  candidate,
  currentUser,
  destinationWarehouses,
  documents,
  importMessage,
  newWarehouseName,
  onApproveImport,
  onAssembleImport,
  onMarkDelivered,
  onNewWarehouseNameChange,
  onPostGoodsReceipt,
  onSaveFieldCorrection,
  onSelectedWarehouseChange,
  securityOverview,
  selectedWarehouse,
  validationMessage,
  validationQueue,
}: {
  candidate: ApiImportFileCandidate | null;
  currentUser: ApiAuthenticatedUser;
  destinationWarehouses: ApiWarehouseLocation[];
  documents: DocumentRecord[];
  importMessage: string;
  newWarehouseName: string;
  onApproveImport: (payload: ApiImportApprovalRequest) => Promise<string>;
  onAssembleImport: (payload: ApiImportAssemblyRequest) => void;
  onMarkDelivered: (payload: ApiImportDeliveryRequest) => Promise<string>;
  onNewWarehouseNameChange: (value: string) => void;
  onPostGoodsReceipt: (payload: ApiImportGoodsReceiptPostRequest) => Promise<string>;
  onSaveFieldCorrection: (payload: ApiFieldCorrectionRequest) => Promise<string>;
  onSelectedWarehouseChange: (value: string) => void;
  securityOverview: ApiSecurityOverview;
  selectedWarehouse: string;
  validationMessage: string;
  validationQueue: ApiValidationQueueResponse;
}) {
  const actorName = currentUser.email;
  const [supplierName, setSupplierName] = useState("");
  const [verticalName, setVerticalName] = useState("");
  const [extraDocumentType, setExtraDocumentType] = useState("");
  const [checklist, setChecklist] = useState<ApiImportChecklistResponse | null>(null);
  const [isCheckingChecklist, setIsCheckingChecklist] = useState(false);
  const [learningMessage, setLearningMessage] = useState("");
  const [approvalMessage, setApprovalMessage] = useState("");
  const [postingMessage, setPostingMessage] = useState("");
  const [correctionMessage, setCorrectionMessage] = useState("");
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [isApprovingImport, setIsApprovingImport] = useState(false);
  const [isMarkingDelivered, setIsMarkingDelivered] = useState(false);
  const [isPostingReceipt, setIsPostingReceipt] = useState(false);
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);
  const [firstTimeAnswers, setFirstTimeAnswers] = useState<Record<string, string>>({});
  const [selectedQueueId, setSelectedQueueId] = useState("");
  const [correctionValue, setCorrectionValue] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [suggestion, setSuggestion] = useState<ApiCorrectionSuggestion | null>(null);
  const [queueFilter, setQueueFilter] = useState<"all" | "review" | "low" | "corrected">("all");
  const invoiceDocuments = useMemo(
    () => documents.filter((document) => document.document_type === "commercial_invoice"),
    [documents],
  );
  const packingDocuments = useMemo(
    () => documents.filter((document) => document.document_type === "packing_list"),
    [documents],
  );
  const awbDocuments = useMemo(
    () => documents.filter((document) => document.document_type === "air_waybill"),
    [documents],
  );
  const presentDocumentTypes = useMemo(
    () => Array.from(new Set(documents.map((document) => document.document_type))),
    [documents],
  );
  const [selectedInvoiceDocumentIds, setSelectedInvoiceDocumentIds] = useState<string[]>([]);
  const [selectedPackingDocumentIds, setSelectedPackingDocumentIds] = useState<string[]>([]);
  const [selectedAwbDocumentId, setSelectedAwbDocumentId] = useState("");
  const [shipmentCountry, setShipmentCountry] = useState(candidate?.destination_country ?? "");
  const [shipmentVerticalInput, setShipmentVerticalInput] = useState(candidate?.shipment_vertical ?? "");
  const [shipmentNumberInput, setShipmentNumberInput] = useState(candidate?.shipment_number ?? "");
  const unknownProductCount =
    candidate?.lines.filter((line) => line.product_profile_status !== "known").length ?? 0;
  const knownProductCount =
    candidate?.lines.filter((line) => line.product_profile_status === "known").length ?? 0;
  const firstUnknownLine = candidate?.lines.find((line) => line.product_profile_status !== "known");
  const isImportApproved = candidate?.status === "validated";
  const isImportDelivered = candidate?.status === "arrived";
  const isImportReceived = candidate?.status === "received";
  const canApproveImport = hasPermission(currentUser, "import_approval");
  const canPostReceipt = hasPermission(currentUser, "goods_receipt");
  const importApprovalRule = candidate
    ? securityOverview.approval_rules.find((rule) =>
        rule.is_active &&
        rule.process_name === "import_approval" &&
        matchesScopeValue(rule.country, candidate.destination_country) &&
        matchesScopeValue(rule.vertical, "All") &&
        matchesScopeValue(rule.material_code, "All"),
      )
    : null;
  const queueScorePercent = (score: number | null) =>
    score === null || score === undefined ? null : score <= 1 ? score * 100 : score;
  const isLowConfidence = (item: ApiValidationQueueItem) => {
    const percent = queueScorePercent(item.confidence_score);
    return percent !== null && percent < 60;
  };
  const queueFilterCounts = {
    all: validationQueue.items.length,
    review: validationQueue.items.filter((item) => item.validation_status === "pending").length,
    low: validationQueue.items.filter(isLowConfidence).length,
    corrected: validationQueue.items.filter((item) => item.validation_status === "corrected").length,
  };
  const filteredQueueItems = validationQueue.items.filter((item) => {
    if (queueFilter === "review") return item.validation_status === "pending";
    if (queueFilter === "low") return isLowConfidence(item);
    if (queueFilter === "corrected") return item.validation_status === "corrected";
    return true;
  });
  const selectedQueueItem =
    filteredQueueItems.find((item) => item.queue_id === selectedQueueId)
    ?? validationQueue.items.find((item) => item.queue_id === selectedQueueId)
    ?? filteredQueueItems[0]
    ?? validationQueue.items[0]
    ?? null;

  useEffect(() => {
    const invoiceIdSet = new Set(invoiceDocuments.map((document) => document.document_id));
    const nextInvoiceIds = selectedInvoiceDocumentIds.filter((documentId) => invoiceIdSet.has(documentId));
    if (nextInvoiceIds.length !== selectedInvoiceDocumentIds.length) {
      setSelectedInvoiceDocumentIds(nextInvoiceIds);
    } else if (selectedInvoiceDocumentIds.length === 0 && invoiceDocuments[0]) {
      setSelectedInvoiceDocumentIds([invoiceDocuments[0].document_id]);
    }

    const packingIdSet = new Set(packingDocuments.map((document) => document.document_id));
    const nextPackingIds = selectedPackingDocumentIds.filter((documentId) => packingIdSet.has(documentId));
    if (nextPackingIds.length !== selectedPackingDocumentIds.length) {
      setSelectedPackingDocumentIds(nextPackingIds);
    } else if (selectedPackingDocumentIds.length === 0 && packingDocuments[0]) {
      setSelectedPackingDocumentIds([packingDocuments[0].document_id]);
    }

    if (!selectedAwbDocumentId && awbDocuments[0]) {
      setSelectedAwbDocumentId(awbDocuments[0].document_id);
    } else if (
      selectedAwbDocumentId &&
      !awbDocuments.some((document) => document.document_id === selectedAwbDocumentId)
    ) {
      setSelectedAwbDocumentId("");
    }
  }, [
    awbDocuments,
    invoiceDocuments,
    packingDocuments,
    selectedAwbDocumentId,
    selectedInvoiceDocumentIds,
    selectedPackingDocumentIds,
  ]);

  useEffect(() => {
    if (candidate?.supplier_name && !supplierName) {
      setSupplierName(candidate.supplier_name);
    }
    if (candidate?.destination_country && !shipmentCountry) {
      setShipmentCountry(candidate.destination_country);
    }
    if (candidate?.shipment_vertical && !shipmentVerticalInput) {
      setShipmentVerticalInput(candidate.shipment_vertical);
    }
    if (candidate?.shipment_number && !shipmentNumberInput) {
      setShipmentNumberInput(candidate.shipment_number);
    }
  }, [candidate, shipmentCountry, shipmentNumberInput, shipmentVerticalInput, supplierName]);

  useEffect(() => {
    if (!selectedQueueItem) {
      setSelectedQueueId("");
      setCorrectionValue("");
      return;
    }
    if (selectedQueueId !== selectedQueueItem.queue_id) {
      setSelectedQueueId(selectedQueueItem.queue_id);
    }
    setCorrectionValue(selectedQueueItem.effective_value ?? "");
    setCorrectionReason("");
  }, [selectedQueueItem, selectedQueueId]);

  useEffect(() => {
    if (!selectedQueueItem) {
      setSuggestion(null);
      return;
    }
    let isMounted = true;
    fetchCorrectionSuggestion(
      selectedQueueItem.document_type,
      selectedQueueItem.field_name,
      selectedQueueItem.extracted_value,
    )
      .then((response) => {
        if (isMounted) {
          setSuggestion(response.suggestion);
        }
      })
      .catch(() => {
        if (isMounted) {
          setSuggestion(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedQueueItem]);

  useEffect(() => {
    // Auto-check the document checklist whenever a different import file loads.
    void runChecklist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate?.import_file_number, presentDocumentTypes]);

  function handleAssembleImport() {
    if (selectedInvoiceDocumentIds.length === 0 || selectedPackingDocumentIds.length === 0) {
      setLearningMessage("Upload and select at least Commercial Invoice and Packing List.");
      return;
    }
    if (!shipmentCountry.trim() || !shipmentVerticalInput.trim() || !shipmentNumberInput.trim()) {
      setLearningMessage("Enter shipment country, vertical, and shipment number. This creates the shipment relationship key.");
      return;
    }

    setLearningMessage("");
    onAssembleImport({
      commercial_invoice_document_ids: selectedInvoiceDocumentIds,
      packing_list_document_ids: selectedPackingDocumentIds,
      awb_document_id: selectedAwbDocumentId || null,
      shipment_country: shipmentCountry.trim(),
      shipment_vertical: shipmentVerticalInput.trim(),
      shipment_number: shipmentNumberInput.trim(),
    });
  }

  async function handleSaveCorrection() {
    if (!selectedQueueItem) {
      setCorrectionMessage("Select a validation queue item first.");
      return;
    }
    if (!correctionValue.trim()) {
      setCorrectionMessage("Corrected value is mandatory.");
      return;
    }
    if (!correctionReason.trim()) {
      setCorrectionMessage("Correction reason is mandatory.");
      return;
    }

    setIsSavingCorrection(true);
    setCorrectionMessage("Saving correction...");
    try {
      const message = await onSaveFieldCorrection({
        document_id: selectedQueueItem.document_id,
        field_name: selectedQueueItem.field_name,
        corrected_value: correctionValue,
        correction_reason: correctionReason,
        corrected_by: currentUser.email,
        auth_token: currentUser.session_token,
      });
      setCorrectionMessage(message);
    } catch (error) {
      setCorrectionMessage(error instanceof Error ? error.message : "Could not save correction.");
    } finally {
      setIsSavingCorrection(false);
    }
  }

  async function handleSaveWarehouseCandidate() {
    if (!candidate || !newWarehouseName.trim() || !actorName.trim()) {
      setLearningMessage("Enter your email and warehouse name before saving.");
      return;
    }

    try {
      await saveWarehouseCandidate({
        country: candidate.destination_country,
        warehouse_name: newWarehouseName,
        created_from_import_file: candidate.import_file_number,
        created_by: actorName,
      });
      setLearningMessage("Warehouse candidate saved for validation.");
    } catch (error) {
      setLearningMessage(error instanceof Error ? error.message : "Could not save warehouse candidate.");
    }
  }

  async function runChecklist() {
    if (!candidate) {
      setChecklist(null);
      return;
    }
    const vertical = (verticalName.trim() || candidate.shipment_vertical || "").trim();
    const material = firstUnknownLine?.item_code ?? candidate.lines[0]?.item_code ?? "";
    if (!vertical || !material) {
      setChecklist(null);
      return;
    }
    setIsCheckingChecklist(true);
    try {
      const result = await evaluateImportChecklist({
        country: candidate.destination_country,
        vertical,
        material_code: material,
        present_document_types: presentDocumentTypes,
      });
      setChecklist(result);
    } catch {
      setChecklist(null);
    } finally {
      setIsCheckingChecklist(false);
    }
  }

  async function handleSaveCountryDocumentRule() {
    if (!candidate || !firstUnknownLine || !verticalName.trim() || !extraDocumentType.trim() || !actorName.trim()) {
      setLearningMessage("Enter your email, vertical, material, and required document type.");
      return;
    }

    try {
      await saveCountryDocumentRequirement({
        country: candidate.destination_country,
        vertical: verticalName,
        material_code: firstUnknownLine.item_code,
        required_document_type: extraDocumentType,
        approved_by: actorName,
      });
      setLearningMessage("Country document rule saved. The checklist now remembers it.");
      setExtraDocumentType("");
      await runChecklist();
    } catch (error) {
      setLearningMessage(error instanceof Error ? error.message : "Could not save document rule.");
    }
  }

  async function handleSaveFirstTimeProductAnswers() {
    if (!firstUnknownLine || !actorName.trim()) {
      setLearningMessage("Enter your email and load an import line that needs first-time questions.");
      return;
    }

    try {
      await saveProductFreeTextProfile({
        item_code: firstUnknownLine.item_code,
        answered_by: actorName,
        answers: {
          product_description: firstUnknownLine.product_description,
          uom: firstUnknownLine.uom,
          ...firstTimeAnswers,
        },
      });
      setLearningMessage(`Product profile saved for ${firstUnknownLine.item_code}.`);
    } catch (error) {
      setLearningMessage(error instanceof Error ? error.message : "Could not save product profile.");
    }
  }

  async function handlePostGoodsReceipt() {
    if (!candidate) {
      setPostingMessage("Create the import validation file first.");
      return;
    }
    if (!isImportDelivered) {
      setPostingMessage("Mark the shipment delivered before posting Goods Receipt.");
      return;
    }
    if (!actorName.trim()) {
      setPostingMessage("Enter validator email before posting Goods Receipt.");
      return;
    }

    const warehouseName = getDestinationWarehouseName(
      destinationWarehouses,
      selectedWarehouse,
      newWarehouseName,
    );
    if (!warehouseName) {
      setPostingMessage("Select or enter destination warehouse before posting Goods Receipt.");
      return;
    }
    if (!supplierName.trim()) {
      setPostingMessage("Enter supplier name before posting Goods Receipt.");
      return;
    }

    setIsPostingReceipt(true);
    setPostingMessage("Posting Goods Receipt and increasing inventory...");
    try {
      const message = await onPostGoodsReceipt({
        candidate,
        warehouse_name: warehouseName,
        posted_by: actorName,
        auth_token: currentUser.session_token,
        supplier_name: supplierName,
      });
      setPostingMessage(message);
    } catch (error) {
      setPostingMessage(error instanceof Error ? error.message : "Could not post Goods Receipt.");
    } finally {
      setIsPostingReceipt(false);
    }
  }

  async function handleApproveImport() {
    if (!candidate) {
      setApprovalMessage("Create the import validation file first.");
      return;
    }
    if (!actorName.trim()) {
      setApprovalMessage("Enter Country Incharge email before approval.");
      return;
    }

    setIsApprovingImport(true);
    setApprovalMessage("Approving import validation file...");
    try {
      const message = await onApproveImport({
        candidate,
        approved_by: actorName,
        auth_token: currentUser.session_token,
        approval_note: "Approved from Import Validation screen",
      });
      setApprovalMessage(message);
      setDeliveryMessage("Approval complete. Mark the shipment delivered once goods arrive.");
    } catch (error) {
      setApprovalMessage(error instanceof Error ? error.message : "Could not approve import file.");
    } finally {
      setIsApprovingImport(false);
    }
  }

  async function handleMarkDelivered() {
    if (!candidate) {
      setDeliveryMessage("Create and approve the import validation file first.");
      return;
    }
    setIsMarkingDelivered(true);
    setDeliveryMessage("Recording delivery...");
    try {
      const message = await onMarkDelivered({
        candidate,
        delivered_by: actorName,
        auth_token: currentUser.session_token,
        delivery_note: "Marked delivered from Import Validation screen",
      });
      setDeliveryMessage(message);
      setPostingMessage("Delivery confirmed. Select warehouse and post Goods Receipt.");
    } catch (error) {
      setDeliveryMessage(error instanceof Error ? error.message : "Could not mark shipment delivered.");
    } finally {
      setIsMarkingDelivered(false);
    }
  }

  function updateFirstTimeAnswer(fieldName: string, value: string) {
    setFirstTimeAnswers((current) => ({ ...current, [fieldName]: value }));
  }

  return (
    <>
      <section className="content-grid">
        <Panel title="Import document assembly" meta="Invoice + Packing List + AWB">
          <div className="import-actions">
            <div className="shipment-key-grid">
              <label className="field-control">
                <span>Shipment country</span>
                <input
                  placeholder="Example: Italy"
                  value={shipmentCountry}
                  onChange={(event) => setShipmentCountry(event.target.value)}
                />
              </label>
              <label className="field-control">
                <span>Vertical</span>
                <input
                  placeholder="Example: Cardio"
                  value={shipmentVerticalInput}
                  onChange={(event) => setShipmentVerticalInput(event.target.value)}
                />
              </label>
              <label className="field-control">
                <span>Shipment number</span>
                <input
                  placeholder="Example: 0361"
                  value={shipmentNumberInput}
                  onChange={(event) => setShipmentNumberInput(event.target.value)}
                />
              </label>
            </div>
            <div className="document-picker-grid">
              <DocumentMultiSelect
                documents={invoiceDocuments}
                emptyLabel="Upload commercial invoice first"
                label="Commercial invoices"
                onChange={setSelectedInvoiceDocumentIds}
                selectedIds={selectedInvoiceDocumentIds}
              />
              <DocumentMultiSelect
                documents={packingDocuments}
                emptyLabel="Upload packing list first"
                label="Packing lists"
                onChange={setSelectedPackingDocumentIds}
                selectedIds={selectedPackingDocumentIds}
              />
              <DocumentSelect
                documents={awbDocuments}
                emptyLabel="Upload AWB first"
                label="Air waybill"
                onChange={setSelectedAwbDocumentId}
                optional
                value={selectedAwbDocumentId}
              />
            </div>
            <button className="primary-action" onClick={handleAssembleImport}>
              Create import validation file
            </button>
            <p className="status-line">{importMessage}</p>
          </div>
          {candidate ? (
            <div className="import-summary-grid">
              <SummaryItem label="Shipment Name" value={candidate.shipment_name ?? candidate.import_file_number} />
              <SummaryItem label="Vertical" value={candidate.shipment_vertical ?? "-"} />
              <SummaryItem label="Shipment No" value={candidate.shipment_number ?? "-"} />
              <SummaryItem label="Import File" value={candidate.import_file_number} />
              <SummaryItem label="Destination Entity" value={candidate.destination_entity} />
              <SummaryItem label="Country" value={candidate.destination_country} />
              <SummaryItem label="Invoices" value={candidate.invoice_numbers.length ? candidate.invoice_numbers.join(", ") : candidate.invoice_number ?? "-"} />
              <SummaryItem label="Invoice Docs" value={String(candidate.commercial_invoice_document_ids.length || "-")} />
              <SummaryItem label="Packing Docs" value={String(candidate.packing_list_document_ids.length || "-")} />
              <SummaryItem label="AWB" value={candidate.awb_number ?? "-"} />
              <SummaryItem label="Carrier" value={candidate.carrier_name ?? "-"} />
              <SummaryItem label="Flight" value={`${candidate.flight_number ?? "-"} / ${candidate.flight_date ?? "-"}`} />
              <SummaryItem label="Status" value={candidate.status.replace(/_/g, " ")} />
            </div>
          ) : null}
          {candidate?.extraction_warnings.length ? (
            <div className="warning-list">
              {candidate.extraction_warnings.map((warning) => (
                <div className="validation-banner warning" key={warning}>
                  <strong>Needs validation</strong>
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          ) : null}
        </Panel>

        <Panel title="Approval and receipt control" meta="RBAC">
          <div className="validation-stack">
            <label className="field-control">
              <span>Logged-in user</span>
              <input
                value={actorName}
                readOnly
              />
            </label>
            <div className="validation-banner">
              <strong>Approver</strong>
              <span>Country Incharge</span>
            </div>
            <div className={importApprovalRule ? "validation-banner" : "validation-banner warning"}>
              <strong>Configured approver</strong>
              <span>
                {importApprovalRule
                  ? `${importApprovalRule.approver_email} / ${importApprovalRule.approver_role}`
                  : "No rule configured for this destination country"}
              </span>
            </div>
            <div className="validation-banner">
              <strong>Shipment stage</strong>
              <span>{candidate ? candidate.status.replace(/_/g, " ") : "Create import validation file"}</span>
            </div>
            <ImportStageTracker status={candidate?.status} />
            <div className="validation-banner warning">
              <strong>Stock increase rule</strong>
              <span>Stock increases only after approval, delivery, and Goods Receipt in the destination warehouse</span>
            </div>
            <label className="field-control">
              <span>Supplier</span>
              <input
                placeholder="Enter supplier name from validated invoice"
                value={supplierName}
                onChange={(event) => setSupplierName(event.target.value)}
              />
            </label>
            <label className="field-control">
              <span>Destination warehouse</span>
              {destinationWarehouses.length > 0 ? (
                <select
                  value={selectedWarehouse}
                  onChange={(event) => onSelectedWarehouseChange(event.target.value)}
                >
                  {destinationWarehouses.map((warehouse) => (
                    <option key={warehouse.warehouse_code} value={warehouse.warehouse_code}>
                      {warehouse.warehouse_name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  placeholder="Enter warehouse name because no country warehouse is configured"
                  value={newWarehouseName}
                  onChange={(event) => onNewWarehouseNameChange(event.target.value)}
                />
              )}
            </label>
            {destinationWarehouses.length === 0 ? (
              <button className="secondary-action" onClick={handleSaveWarehouseCandidate}>
                Save warehouse candidate
              </button>
            ) : null}
            <button
              className="secondary-action"
              onClick={handleApproveImport}
              disabled={isApprovingImport || isImportApproved || isImportDelivered || isImportReceived || !canApproveImport}
            >
              {isApprovingImport
                ? "Approving import file"
                : isImportApproved || isImportDelivered || isImportReceived
                  ? "Import approved"
                  : "1 · Approve import file"}
            </button>
            <p className="status-line">{approvalMessage}</p>
            <button
              className="secondary-action"
              onClick={handleMarkDelivered}
              disabled={isMarkingDelivered || !isImportApproved || !canPostReceipt}
            >
              <Truck size={17} aria-hidden="true" />
              {isMarkingDelivered
                ? "Recording delivery"
                : isImportDelivered || isImportReceived
                  ? "Goods delivered"
                  : "2 · Mark goods delivered"}
            </button>
            <p className="status-line">{deliveryMessage}</p>
            <button
              className="primary-action"
              onClick={handlePostGoodsReceipt}
              disabled={isPostingReceipt || !isImportDelivered || !canPostReceipt}
            >
              {isPostingReceipt
                ? "Posting Goods Receipt"
                : isImportReceived
                  ? "Goods Receipt posted"
                  : "3 · Validate and post Goods Receipt"}
            </button>
            <p className="status-line">{postingMessage}</p>
          </div>
        </Panel>
      </section>

      <section className="content-grid wide-left">
        <Panel title="Field validation queue" meta={`${validationQueue.total_count} item(s)`}>
          <div className="validation-stack">
            <div className="import-summary-grid">
              <SummaryItem label="Missing Required" value={String(validationQueue.missing_required_count)} />
              <SummaryItem label="Pending Review" value={String(validationQueue.pending_review_count)} />
              <SummaryItem label="Corrected" value={String(validationQueue.corrected_count)} />
              <SummaryItem label="Visible To" value={currentUser.role_name} />
            </div>
            {validationQueue.items.length === 0 ? (
              <p className="empty-state">No extracted fields are waiting for validation.</p>
            ) : (
              <>
                <div className="queue-filter-chips" role="group" aria-label="Filter validation queue">
                  {([
                    { key: "all", label: "All" },
                    { key: "review", label: "Needs review" },
                    { key: "low", label: "Low confidence" },
                    { key: "corrected", label: "Corrected" },
                  ] as const).map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      className={queueFilter === chip.key ? "queue-chip active" : "queue-chip"}
                      onClick={() => {
                        setQueueFilter(chip.key);
                        const next = validationQueue.items.filter((item) => {
                          if (chip.key === "review") return item.validation_status === "pending";
                          if (chip.key === "low") return isLowConfidence(item);
                          if (chip.key === "corrected") return item.validation_status === "corrected";
                          return true;
                        });
                        if (next[0]) {
                          setSelectedQueueId(next[0].queue_id);
                        }
                      }}
                    >
                      {chip.label} <span className="queue-chip-count">{queueFilterCounts[chip.key]}</span>
                    </button>
                  ))}
                </div>
                {filteredQueueItems.length === 0 ? (
                  <p className="empty-state">No items match this filter. Try "All".</p>
                ) : (
                  <>
                <label className="field-control">
                  <span>Queue item</span>
                  <select
                    value={selectedQueueId}
                    onChange={(event) => setSelectedQueueId(event.target.value)}
                  >
                    {filteredQueueItems.slice(0, 80).map((item) => (
                      <option key={item.queue_id} value={item.queue_id}>
                        {item.issue_label} / {item.filename} / {item.field_name}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedQueueItem ? (
                  <div className="validation-correction-grid">
                    <div className="validation-banner warning">
                      <strong>{selectedQueueItem.field_name}</strong>
                      <span>{selectedQueueItem.issue_label}</span>
                    </div>
                    <div className="validation-banner">
                      <strong>Source document</strong>
                      <span>{selectedQueueItem.filename}</span>
                    </div>
                    <div className="validation-banner">
                      <strong>Extraction confidence</strong>
                      <span className="confidence-line">
                        <ConfidenceBadge score={selectedQueueItem.confidence_score} />
                        {selectedQueueItem.source_engine ? ` · read by ${selectedQueueItem.source_engine}` : ""}
                      </span>
                    </div>
                    <label className="field-control">
                      <span>Extracted value</span>
                      <textarea readOnly value={selectedQueueItem.extracted_value ?? "Missing"} />
                    </label>
                    {suggestion ? (
                      <div className="learning-suggestion">
                        <div>
                          <strong>Learned suggestion: {suggestion.suggested_value}</strong>
                          <span>
                            Seen {suggestion.times_seen} time{suggestion.times_seen === 1 ? "" : "s"} ·{" "}
                            {Math.round(suggestion.confidence)}% confidence · from {suggestion.based_on}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => {
                            setCorrectionValue(suggestion.suggested_value);
                            if (!correctionReason.trim()) {
                              setCorrectionReason("Applied learned correction from previous fixes.");
                            }
                          }}
                        >
                          <Sparkles size={16} aria-hidden="true" />
                          Apply
                        </button>
                      </div>
                    ) : null}
                    <label className="field-control">
                      <span>Corrected value</span>
                      <textarea
                        value={correctionValue}
                        onChange={(event) => setCorrectionValue(event.target.value)}
                      />
                    </label>
                    <label className="field-control">
                      <span>Correction reason</span>
                      <textarea
                        placeholder="Mandatory: why are you changing or confirming this value?"
                        value={correctionReason}
                        onChange={(event) => setCorrectionReason(event.target.value)}
                      />
                    </label>
                    <div className="validation-stack">
                      <div className="validation-banner">
                        <strong>Recorded user</strong>
                        <span>{currentUser.email}</span>
                      </div>
                      <button className="primary-action" onClick={handleSaveCorrection} disabled={isSavingCorrection}>
                        <ClipboardCheck size={17} aria-hidden="true" />
                        {isSavingCorrection ? "Saving correction" : "Save correction and learn"}
                      </button>
                      <p className="status-line">{correctionMessage || validationMessage}</p>
                    </div>
                  </div>
                ) : null}
                  </>
                )}
              </>
            )}
          </div>
        </Panel>

        <Panel title="Recent validation items" meta="Priority order">
          <table>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Document</th>
                <th>Field</th>
                <th>Confidence</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueueItems.length === 0 ? (
                <tr>
                  <td colSpan={5}>No queue items for this filter.</td>
                </tr>
              ) : (
                filteredQueueItems.slice(0, 10).map((item) => (
                  <tr key={item.queue_id}>
                    <td><StatusTag label={formatValidationIssue(item.issue_type)} /></td>
                    <td>{item.filename}</td>
                    <td>{item.field_name}</td>
                    <td><ConfidenceBadge score={item.confidence_score} /></td>
                    <td>{item.effective_value ?? "Missing"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Panel>
      </section>

      <section className="content-grid">
        <Panel title="Country document learning" meta="Country + Vertical + Material">
          <div className="validation-stack">
            <div className="validation-banner">
              <strong>Destination country</strong>
              <span>{candidate?.destination_country ?? "Create import validation file"}</span>
            </div>
            {!candidate ? (
              <div className="validation-banner">
                <strong>Learned document checklist</strong>
                <span>Create an import validation file to check learned document requirements.</span>
              </div>
            ) : checklist && checklist.is_known ? (
              <div className="validation-stack">
                <div className={checklist.missing_count > 0 ? "validation-banner warning" : "validation-banner"}>
                  <strong>
                    Checklist · {checklist.country} / {checklist.vertical} / {checklist.material_code}
                  </strong>
                  <span>
                    {checklist.present_count} of {checklist.required_count} learned document(s) present
                    {checklist.missing_count > 0 ? ` · ${checklist.missing_count} missing` : " · all present"}
                  </span>
                </div>
                <ul className="checklist-list">
                  {checklist.items.map((item) => (
                    <li className="checklist-row" key={item.required_document_type}>
                      <span>{toTitleCase(item.required_document_type.replace(/_/g, " "))}</span>
                      <StatusTag label={item.present ? "Present" : "Missing"} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="validation-banner warning">
                <strong>New combination — not learned yet</strong>
                <span>
                  The platform has not learned which documents{" "}
                  {candidate.destination_country} /{" "}
                  {verticalName.trim() || candidate.shipment_vertical || "this vertical"} requires for{" "}
                  {firstUnknownLine?.item_code ?? candidate.lines[0]?.item_code ?? "this material"}. Add
                  them below and they will be remembered.
                </span>
              </div>
            )}
            <button
              className="secondary-action"
              type="button"
              onClick={() => void runChecklist()}
              disabled={isCheckingChecklist || !candidate}
            >
              <RefreshCw size={16} aria-hidden="true" />
              {isCheckingChecklist ? "Checking" : "Re-check requirements"}
            </button>
            <label className="field-control">
              <span>Vertical / product category</span>
              <input
                placeholder="Enter vertical or product category"
                value={verticalName}
                onChange={(event) => setVerticalName(event.target.value)}
              />
            </label>
            <label className="field-control">
              <span>Required extra document</span>
              <input
                placeholder="Example: Import Declaration, Customs Entry, Certificate of Origin"
                value={extraDocumentType}
                onChange={(event) => setExtraDocumentType(event.target.value)}
              />
            </label>
            <button className="secondary-action" onClick={handleSaveCountryDocumentRule}>
              Learn document requirement
            </button>
          </div>
        </Panel>

        <Panel title="Learning status" meta={`${unknownProductCount} first-time items`}>
          <div className="validation-stack">
            <div className="validation-banner">
              <strong>Known product autofill</strong>
              <span>
                {candidate
                  ? `${knownProductCount} known item(s), ${unknownProductCount} item(s) need first-time answers`
                  : "Create import validation file to check learned product profiles"}
              </span>
            </div>
            <div className="validation-banner warning">
              <strong>First-time handling</strong>
              <span>Unknown items ask free-text questions, then autofill next time</span>
            </div>
            <div className="validation-banner danger">
              <strong>Edit rule</strong>
              <span>Edit reason is mandatory and user/time are recorded</span>
            </div>
          </div>
        </Panel>
      </section>

      <Panel
        title="First-time product questions"
        meta={firstUnknownLine ? firstUnknownLine.item_code : "No unknown item selected"}
      >
        {firstUnknownLine ? (
          <div className="learning-form-grid">
            <label className="field-control">
              <span>Product description</span>
              <input
                value={firstTimeAnswers.product_description ?? firstUnknownLine.product_description}
                onChange={(event) => updateFirstTimeAnswer("product_description", event.target.value)}
              />
            </label>
            <label className="field-control">
              <span>Product category / vertical</span>
              <input
                placeholder="Enter product category or vertical"
                value={firstTimeAnswers.product_category ?? ""}
                onChange={(event) => updateFirstTimeAnswer("product_category", event.target.value)}
              />
            </label>
            <label className="field-control">
              <span>UOM</span>
              <input
                placeholder="Example: EA"
                value={firstTimeAnswers.uom ?? firstUnknownLine.uom}
                onChange={(event) => updateFirstTimeAnswer("uom", event.target.value)}
              />
            </label>
            <label className="field-control">
              <span>Storage condition</span>
              <input
                placeholder="Free text"
                value={firstTimeAnswers.storage_condition ?? ""}
                onChange={(event) => updateFirstTimeAnswer("storage_condition", event.target.value)}
              />
            </label>
            <label className="field-control">
              <span>Temperature requirement</span>
              <input
                placeholder="Free text"
                value={firstTimeAnswers.temperature_requirement ?? ""}
                onChange={(event) => updateFirstTimeAnswer("temperature_requirement", event.target.value)}
              />
            </label>
            <label className="field-control">
              <span>HS / HSN code</span>
              <input
                value={firstTimeAnswers.hs_code ?? ""}
                onChange={(event) => updateFirstTimeAnswer("hs_code", event.target.value)}
              />
            </label>
            <div className="learning-form-actions">
              <button className="primary-action" onClick={handleSaveFirstTimeProductAnswers}>
                Save and learn product profile
              </button>
              <p className="status-line">{learningMessage || "Saved answers will autofill next time."}</p>
            </div>
          </div>
        ) : (
          <p className="empty-state">No first-time product questions are required for this preview.</p>
        )}
      </Panel>

      <Panel title="Import product lines" meta={candidate ? `${candidate.lines.length} lines` : "Pending assembly"}>
        <table>
          <thead>
            <tr>
              <th>Item Code</th>
              <th>Description</th>
              <th>Batch</th>
              <th>Serial</th>
              <th>Expiry</th>
              <th>Days to Expiry</th>
              <th>Qty</th>
              <th>Value</th>
              <th>Learning</th>
            </tr>
          </thead>
          <tbody>
            {!candidate ? (
              <tr>
                <td colSpan={9}>Create the import validation file to review product lines.</td>
              </tr>
            ) : (
              candidate.lines.map((line, lineIndex) => (
                <tr key={`${line.item_code}-${line.batch_number}-${line.serial_number ?? lineIndex}`}>
                  <td>{line.item_code}</td>
                  <td>{line.product_description}</td>
                  <td>{line.batch_number}</td>
                  <td>{line.serial_number ? <span className="muted-cell">{line.serial_number}</span> : "-"}</td>
                  <td>{line.expiry_date ?? "-"}</td>
                  <td>{formatDaysToExpiry(line.expiry_date)}</td>
                  <td>{line.quantity} {line.uom}</td>
                  <td>
                    {line.currency && line.unit_value
                      ? `${line.currency} ${line.unit_value.toFixed(2)}`
                      : "-"}
                  </td>
                  <td>
                    <StatusTag
                      label={
                        line.product_profile_status === "known"
                          ? "Autofill"
                          : "Ask First Time"
                      }
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

function DocumentMultiSelect({
  documents,
  emptyLabel,
  label,
  onChange,
  selectedIds,
}: {
  documents: DocumentRecord[];
  emptyLabel: string;
  label: string;
  onChange: (value: string[]) => void;
  selectedIds: string[];
}) {
  function toggleDocument(documentId: string) {
    if (selectedIds.includes(documentId)) {
      onChange(selectedIds.filter((savedId) => savedId !== documentId));
      return;
    }
    onChange([...selectedIds, documentId]);
  }

  return (
    <div className="field-control document-multi-select">
      <span>{label}</span>
      {documents.length === 0 ? (
        <p className="empty-state">{emptyLabel}</p>
      ) : (
        <>
          <small className="selection-count">{selectedIds.length} selected</small>
          <div className="document-checklist">
            {documents.map((document) => (
              <label className="document-check-row" key={document.document_id}>
                <input
                  checked={selectedIds.includes(document.document_id)}
                  onChange={() => toggleDocument(document.document_id)}
                  type="checkbox"
                />
                <span>
                  <strong>{document.filename}</strong>
                  <small>
                    {formatDocumentStatus(document.status)} / {document.extracted_field_count} fields / {document.missing_required_count} missing
                  </small>
                </span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DocumentSelect({
  documents,
  emptyLabel,
  label,
  onChange,
  optional = false,
  value,
}: {
  documents: DocumentRecord[];
  emptyLabel: string;
  label: string;
  onChange: (value: string) => void;
  optional?: boolean;
  value: string;
}) {
  return (
    <label className="field-control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{optional ? "Optional" : emptyLabel}</option>
        {documents.map((document) => (
          <option key={document.document_id} value={document.document_id}>
            {formatDocumentOption(document)}
          </option>
        ))}
      </select>
    </label>
  );
}

function getDestinationWarehouseName(
  warehouses: ApiWarehouseLocation[],
  selectedWarehouseCode: string,
  typedWarehouseName: string,
) {
  const selectedWarehouse = warehouses.find(
    (warehouse) => warehouse.warehouse_code === selectedWarehouseCode,
  );
  return selectedWarehouse?.warehouse_name ?? typedWarehouseName.trim();
}

function formatDocumentOption(document: DocumentRecord): string {
  const createdAt = new Date(document.created_at);
  const createdLabel = Number.isNaN(createdAt.getTime())
    ? ""
    : ` / ${createdAt.toLocaleDateString()}`;
  return `${document.filename}${createdLabel}`;
}

function formatDocumentStatus(value: string) {
  return toTitleCase(value.replace(/_/g, " "));
}

function formatValidationIssue(value: string) {
  return toTitleCase(value.replace(/_/g, " "));
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatAuditValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `${value.length} item(s)`;
  }

  if (typeof value === "object") {
    const pairs = Object.entries(value as Record<string, unknown>).slice(0, 4);
    return pairs.map(([key, item]) => `${key}: ${String(item)}`).join(", ");
  }

  return String(value);
}

function parseCommaList(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatProcessName(value: string) {
  return toTitleCase(value.replace(/_/g, " "));
}

function matchesScopeValue(ruleValue: string, requestedValue: string) {
  return ruleValue.toLowerCase() === "all" || ruleValue.toLowerCase() === requestedValue.toLowerCase();
}

function hasPermission(user: ApiAuthenticatedUser | null, permission: string) {
  if (!user) {
    return false;
  }
  return user.role_name === "Admin" || user.permissions.includes(permission);
}

function canAccessView(user: ApiAuthenticatedUser | null, viewId: string) {
  if (!user) {
    return false;
  }
  if (
    user.role_name === "Admin" ||
    viewId === "dashboard" ||
    viewId === "goods-tracking" ||
    viewId === "traceability" ||
    viewId === "assistant" ||
    viewId === "platform-progress" ||
    viewId === "learning"
  ) {
    return true;
  }

  const permissionByView: Record<string, string[]> = {
    documents: ["import_approval", "goods_receipt"],
    "import-validation": ["import_approval", "goods_receipt"],
    "erp-uploads": ["reports_export", "import_approval", "goods_receipt"],
    products: ["masters"],
    inventory: ["goods_receipt", "inventory_approval", "inventory_value", "expiry_review"],
    shipments: ["shipment_request", "shipment_approval"],
    dispatches: ["dispatch", "dispatch_approval"],
    receipts: ["goods_receipt"],
    counts: ["inventory_count", "reconciliation"],
    expiry: ["expiry_review", "batch_traceability"],
    customers: ["customer_read", "shipment_request"],
    security: ["security"],
    audit: ["audit"],
  };
  return (permissionByView[viewId] ?? []).some((permission) => user.permissions.includes(permission));
}

function buildVisibleWalkthroughSteps(
  items: Array<{ id: string; label: string; icon: IconComponent }>,
): TourGuideStep[] {
  return items.map((item) => {
    const content = tourGuideContent[item.id] ?? {
      title: item.label,
      detail: "This page is available for your role and follows the same RBAC and audit rules as the rest of the control tower.",
      icon: item.icon,
    };
    return {
      ...content,
      viewId: item.id,
    };
  });
}

function GuidedWalkthrough({
  onClose,
  onNavigate,
  setStep,
  step,
  steps,
}: {
  onClose: () => void;
  onNavigate: (viewId: string) => void;
  setStep: (step: number) => void;
  step: number;
  steps: TourGuideStep[];
}) {
  const currentStep = steps[step] ?? steps[0];
  const Icon = currentStep.icon;
  const isLastStep = step >= steps.length - 1;

  useEffect(() => {
    onNavigate(currentStep.viewId);
  }, [currentStep.viewId, onNavigate]);

  function handleNext() {
    if (isLastStep) {
      onClose();
      return;
    }
    setStep(step + 1);
  }

  function handlePrevious() {
    setStep(Math.max(0, step - 1));
  }

  return (
    <aside className="walkthrough-panel" aria-live="polite">
      <div className="walkthrough-header">
        <div className="walkthrough-icon">
          <Icon size={22} aria-hidden="true" />
        </div>
        <div>
          <span>Guided walkthrough</span>
          <strong>{currentStep.title}</strong>
        </div>
        <button className="walkthrough-close" onClick={onClose} aria-label="Close walkthrough">
          x
        </button>
      </div>
      <p>{currentStep.detail}</p>
      <div className="walkthrough-rail">
        {steps.map((item, index) => {
          const StepIcon = item.icon;
          return (
            <button
              className={index === step ? "walkthrough-step-dot active" : "walkthrough-step-dot"}
              key={item.title}
              onClick={() => setStep(index)}
              aria-label={item.title}
            >
              <StepIcon size={16} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div className="walkthrough-actions">
        <button className="secondary-action" onClick={handlePrevious} disabled={step === 0}>
          Previous
        </button>
        <button className="primary-action" onClick={handleNext}>
          {isLastStep ? "Finish" : "Next"}
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

function LoginView({
  isLoggingIn,
  message,
  onLogin,
}: {
  isLoggingIn: boolean;
  message: string;
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit() {
    await onLogin(email, password);
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand login-brand">
          <div className="brand-mark">CT</div>
          <div>
            <strong>Supply Chain Tower</strong>
            <span>Healthcare logistics</span>
          </div>
        </div>
        <div>
          <p className="eyebrow">Secure Access</p>
          <h1>Sign in</h1>
        </div>
        <div className="login-form">
          <label className="field-control">
            <span>Email</span>
            <input
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="field-control">
            <span>Password</span>
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleSubmit();
                }
              }}
            />
          </label>
          <button className="primary-action" onClick={handleSubmit} disabled={isLoggingIn}>
            {isLoggingIn ? "Signing in" : "Sign in"}
          </button>
          <p className="status-line">{message}</p>
        </div>
      </section>
    </main>
  );
}

function ErpUploadView({
  message,
  onDownload,
  onGenerate,
  preview,
  selectedTemplate,
  setSelectedTemplate,
  templates,
}: {
  message: string;
  onDownload: (preview: ApiErpUploadPreview) => void;
  onGenerate: (templateKey: string) => Promise<void>;
  preview: ApiErpUploadPreview | null;
  selectedTemplate: string;
  setSelectedTemplate: (templateKey: string) => void;
  templates: ApiErpTemplate[];
}) {
  const activeTemplate =
    templates.find((template) => template.template_key === selectedTemplate)
    ?? templates[0]
    ?? null;
  const visibleRows = preview?.rows.slice(0, 40) ?? [];

  return (
    <>
      <section className="content-grid wide-left">
        <Panel title="ERP template selector" meta={`${templates.length} template(s)`}>
          {templates.length === 0 ? (
            <p className="empty-state">No ERP templates loaded yet.</p>
          ) : (
            <div className="erp-template-grid">
              {templates.map((template) => (
                <button
                  className={
                    template.template_key === selectedTemplate
                      ? "erp-template-card active"
                      : "erp-template-card"
                  }
                  key={template.template_key}
                  onClick={() => setSelectedTemplate(template.template_key)}
                >
                  <span>{template.source_module}</span>
                  <strong>{template.template_name}</strong>
                  <small>{template.description}</small>
                </button>
              ))}
            </div>
          )}
          <div className="form-action-row">
            <button
              className="primary-action"
              disabled={!activeTemplate}
              onClick={() => activeTemplate && onGenerate(activeTemplate.template_key)}
            >
              <Upload size={17} aria-hidden="true" />
              Generate preview
            </button>
            <button
              className="secondary-action"
              disabled={!preview || preview.total_rows === 0}
              onClick={() => preview && onDownload(preview)}
            >
              <Download size={17} aria-hidden="true" />
              Download CSV
            </button>
          </div>
          <p className="status-line">{message}</p>
        </Panel>

        <Panel title="Upload readiness" meta={preview ? preview.template_name : "Pending preview"}>
          <div className="import-summary-grid">
            <SummaryItem label="Total Rows" value={preview ? String(preview.total_rows) : "-"} />
            <SummaryItem label="Ready Rows" value={preview ? String(preview.valid_rows) : "-"} />
            <SummaryItem label="Blocked Rows" value={preview ? String(preview.blocked_rows) : "-"} />
            <SummaryItem label="Columns" value={preview ? String(preview.columns.length) : "-"} />
          </div>
          {preview?.warnings.length ? (
            <div className="warning-list">
              {preview.warnings.map((warning) => (
                <div className="validation-banner warning" key={warning}>
                  <strong>Check before upload</strong>
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="status-line">
              ERP rows are generated from live application transactions and validated against mandatory fields.
            </p>
          )}
        </Panel>
      </section>

      <Panel title="ERP row preview" meta={preview ? preview.export_filename : "Generate a preview first"}>
        {!preview ? (
          <p className="empty-state">Choose a template and generate preview to see ERP upload rows.</p>
        ) : preview.rows.length === 0 ? (
          <p className="empty-state">No rows available for this template.</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Source</th>
                  {preview.columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={`${row.row_number}-${row.source_reference}`}>
                    <td>
                      <StatusTag label={row.missing_fields.length ? "Blocked" : "Ready"} />
                      {row.missing_fields.length ? (
                        <span className="muted-cell">{row.missing_fields.join(", ")}</span>
                      ) : null}
                    </td>
                    <td>{row.source_reference}</td>
                    {preview.columns.map((column) => (
                      <td key={`${row.row_number}-${column}`}>{formatErpCell(row.values[column])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > visibleRows.length ? (
              <p className="status-line">Showing first {visibleRows.length} rows. Download CSV for full output.</p>
            ) : null}
          </>
        )}
      </Panel>
    </>
  );
}

function formatErpCell(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

function ProductsView({
  products,
  search,
  setSearch,
}: {
  products: Product[];
  search: string;
  setSearch: (value: string) => void;
}) {
  return (
    <Panel title="Product master" meta={`${products.length} records`}>
      <div className="toolbar">
        <div className="search-box">
          <Search size={17} aria-hidden="true" />
          <input
            placeholder="Search item, description, category"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <button className="secondary-action">Filter</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Item Code</th>
            <th>Description</th>
            <th>Category</th>
            <th>UOM</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.itemCode}>
              <td>{product.itemCode}</td>
              <td>{product.description}</td>
              <td>{product.category}</td>
              <td>{product.uom}</td>
              <td><StatusTag label={product.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function InventoryView({
  inventory,
  search,
  setSearch,
  setVerticalFilter,
  setWarehouseFilter,
  verticalFilter,
  verticals,
  warehouseFilter,
  warehouses,
}: {
  inventory: InventoryBatch[];
  search: string;
  setSearch: (value: string) => void;
  setVerticalFilter: (value: string) => void;
  setWarehouseFilter: (value: string) => void;
  verticalFilter: string;
  verticals: string[];
  warehouseFilter: string;
  warehouses: string[];
}) {
  return (
    <Panel title="Inventory and batch management" meta={`${inventory.length} visible batches`}>
      <div className="toolbar inventory-toolbar">
        <div className="search-box">
          <Search size={17} aria-hidden="true" />
          <input
            placeholder="Search material code, batch, description"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <label className="filter-control">
          <span>Warehouse</span>
          <select value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)}>
            <option value="all">All warehouses</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse} value={warehouse}>
                {warehouse}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-control">
          <span>Vertical</span>
          <select value={verticalFilter} onChange={(event) => setVerticalFilter(event.target.value)}>
            <option value="all">All verticals</option>
            {verticals.map((vertical) => (
              <option key={vertical} value={vertical}>
                {vertical}
              </option>
            ))}
          </select>
        </label>
      </div>
      <InventoryTable rows={inventory} />
    </Panel>
  );
}

function ShipmentsView({
  currentUser,
  customers,
  inventory,
  onApproveShipment,
  onCreateShipment,
  shipments,
}: {
  currentUser: ApiAuthenticatedUser;
  customers: Customer[];
  inventory: InventoryBatch[];
  onApproveShipment: (shipment: Shipment) => Promise<string>;
  onCreateShipment: (payload: Parameters<typeof createShipment>[0]) => Promise<string>;
  shipments: Shipment[];
}) {
  const availableBatches = useMemo(
    () => inventory.filter((batch) => batch.quantity > 0).sort((a, b) => a.daysToExpiry - b.daysToExpiry),
    [inventory],
  );
  const firstCustomer = customers[0]?.name ?? "";
  const firstBatchKey = availableBatches[0] ? inventoryBatchKey(availableBatches[0]) : "";
  const [customerName, setCustomerName] = useState(firstCustomer);
  const [destinationCountry, setDestinationCountry] = useState(customers[0]?.country ?? "");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [requiredDate, setRequiredDate] = useState(getDateStamp());
  const [selectedBatchKey, setSelectedBatchKey] = useState(firstBatchKey);
  const [quantityRequested, setQuantityRequested] = useState("1");
  const [shipmentMessage, setShipmentMessage] = useState("Create shipment requests from available inventory.");
  const [isCreating, setIsCreating] = useState(false);
  const [approvingShipmentId, setApprovingShipmentId] = useState("");
  const canCreateShipment = hasPermission(currentUser, "shipment_request");
  const canApproveShipment = hasPermission(currentUser, "shipment_approval");
  const selectedCustomer = customers.find((customer) => customer.name === customerName);
  const selectedBatch = availableBatches.find((batch) => inventoryBatchKey(batch) === selectedBatchKey);
  const pendingApprovalShipments = shipments.filter((shipment) =>
    ["Draft", "Submitted"].includes(shipment.status),
  );

  useEffect(() => {
    if (!customerName && firstCustomer) {
      setCustomerName(firstCustomer);
    }
  }, [customerName, firstCustomer]);

  useEffect(() => {
    if (selectedCustomer) {
      setDestinationCountry(selectedCustomer.country);
    }
  }, [selectedCustomer]);

  useEffect(() => {
    if (!selectedBatchKey && firstBatchKey) {
      setSelectedBatchKey(firstBatchKey);
    }
  }, [firstBatchKey, selectedBatchKey]);

  async function handleCreateShipment() {
    if (!canCreateShipment) {
      setShipmentMessage("Your role cannot create shipment requests.");
      return;
    }
    if (!selectedBatch) {
      setShipmentMessage("Select an available inventory batch.");
      return;
    }
    const requestedQuantity = Number(quantityRequested);
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
      setShipmentMessage("Enter a valid requested quantity.");
      return;
    }
    if (requestedQuantity > selectedBatch.quantity) {
      setShipmentMessage(`Requested quantity cannot exceed available stock ${selectedBatch.quantity}.`);
      return;
    }
    if (!customerName.trim() || !destinationCountry.trim() || !requiredDate) {
      setShipmentMessage("Customer, destination country, and required date are mandatory.");
      return;
    }

    setIsCreating(true);
    setShipmentMessage("Creating shipment request...");
    try {
      const message = await onCreateShipment({
        request_date: getDateStamp(),
        requestor_name: currentUser.email,
        customer_name: customerName,
        destination_country: destinationCountry,
        priority,
        required_delivery_date: requiredDate,
        auth_token: currentUser.session_token,
        submit_for_approval: true,
        lines: [
          {
            item_code: selectedBatch.itemCode,
            batch_number: selectedBatch.batch,
            warehouse_location: selectedBatch.warehouse,
            quantity_requested: requestedQuantity,
          },
        ],
      });
      setShipmentMessage(message);
      setQuantityRequested("1");
    } catch (error) {
      setShipmentMessage(error instanceof Error ? error.message : "Could not create shipment request.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleApproveShipment(shipment: Shipment) {
    if (!canApproveShipment) {
      setShipmentMessage("Your role cannot approve shipment requests.");
      return;
    }

    setApprovingShipmentId(shipment.shipmentId);
    setShipmentMessage(`Approving ${shipment.shipmentId}...`);
    try {
      const message = await onApproveShipment(shipment);
      setShipmentMessage(message);
    } catch (error) {
      setShipmentMessage(error instanceof Error ? error.message : "Could not approve shipment.");
    } finally {
      setApprovingShipmentId("");
    }
  }

  return (
    <>
      <section className="content-grid">
        <Panel title="Create shipment request" meta="Stock checked before approval">
          <div className="shipment-form-grid">
            <label className="field-control">
              <span>Customer</span>
              <select value={customerName} onChange={(event) => setCustomerName(event.target.value)}>
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.code} value={customer.name}>
                    {customer.name} / {customer.country}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-control">
              <span>Destination country</span>
              <input
                value={destinationCountry}
                onChange={(event) => setDestinationCountry(event.target.value)}
              />
            </label>
            <label className="field-control">
              <span>Priority</span>
              <select value={priority} onChange={(event) => setPriority(event.target.value as "normal" | "urgent")}>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label className="field-control">
              <span>Required delivery date</span>
              <input
                type="date"
                value={requiredDate}
                onChange={(event) => setRequiredDate(event.target.value)}
              />
            </label>
            <label className="field-control wide-field">
              <span>FEFO batch</span>
              <select value={selectedBatchKey} onChange={(event) => setSelectedBatchKey(event.target.value)}>
                <option value="">Select inventory batch</option>
                {availableBatches.map((batch) => (
                  <option key={inventoryBatchKey(batch)} value={inventoryBatchKey(batch)}>
                    {batch.itemCode} / {batch.batch} / {batch.warehouse} / Qty {batch.quantity} / Exp {batch.expiryDate}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-control">
              <span>Quantity requested</span>
              <input
                min="1"
                step="1"
                type="number"
                value={quantityRequested}
                onChange={(event) => setQuantityRequested(event.target.value)}
              />
            </label>
            <div className="learning-form-actions">
              <button className="primary-action" onClick={handleCreateShipment} disabled={isCreating || !canCreateShipment}>
                <Plus size={17} aria-hidden="true" />
                {isCreating ? "Creating" : "Create shipment"}
              </button>
              <p className="status-line">{shipmentMessage}</p>
            </div>
          </div>
        </Panel>

        <Panel title="Approval queue" meta={`${pendingApprovalShipments.length} waiting`}>
          <div className="validation-stack">
            {pendingApprovalShipments.length === 0 ? (
              <p className="empty-state">No shipments are waiting for approval.</p>
            ) : (
              pendingApprovalShipments.map((shipment) => (
                <article className="queue-row" key={shipment.shipmentId}>
                  <div className="queue-row-main">
                    <div>
                      <strong>{shipment.shipmentId}</strong>
                      <span>{shipment.customer} / {shipment.destination}</span>
                    </div>
                    <StatusTag label={shipment.status} />
                  </div>
                  <div className="queue-row-meta">
                    <span>{shipment.lines.length} line(s)</span>
                    <span>{shipment.priority}</span>
                  </div>
                  <button
                    className="secondary-action"
                    onClick={() => void handleApproveShipment(shipment)}
                    disabled={!canApproveShipment || approvingShipmentId === shipment.shipmentId}
                  >
                    {approvingShipmentId === shipment.shipmentId ? "Approving" : "Approve"}
                  </button>
                </article>
              ))
            )}
          </div>
        </Panel>
      </section>

      <Panel title="Shipment requests" meta="Create, approve, dispatch">
        <ShipmentTable rows={shipments} showLines />
      </Panel>
    </>
  );
}

function DispatchesView({
  currentUser,
  dispatches,
  onConfirmDispatch,
  shipments,
}: {
  currentUser: ApiAuthenticatedUser;
  dispatches: Dispatch[];
  onConfirmDispatch: (payload: {
    shipmentId: string;
    dispatchNumber: string;
    dispatchDate: string;
    courier: string;
    trackingNumber: string;
  }) => Promise<string>;
  shipments: Shipment[];
}) {
  const approvedShipments = shipments.filter((shipment) => shipment.status === "Approved");
  const firstApprovedShipment = approvedShipments[0]?.shipmentId ?? "";
  const [selectedShipmentId, setSelectedShipmentId] = useState(firstApprovedShipment);
  const [dispatchNumber, setDispatchNumber] = useState(generateDispatchNumber(dispatches));
  const [dispatchDate, setDispatchDate] = useState(getDateStamp());
  const [courier, setCourier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [dispatchMessage, setDispatchMessage] = useState("Confirm dispatch only after shipment approval.");
  const [isDispatching, setIsDispatching] = useState(false);
  const canDispatch = hasPermission(currentUser, "dispatch");

  useEffect(() => {
    if (!selectedShipmentId && firstApprovedShipment) {
      setSelectedShipmentId(firstApprovedShipment);
    }
  }, [firstApprovedShipment, selectedShipmentId]);

  useEffect(() => {
    setDispatchNumber(generateDispatchNumber(dispatches));
  }, [dispatches]);

  async function handleConfirmDispatch() {
    if (!canDispatch) {
      setDispatchMessage("Your role cannot confirm dispatch.");
      return;
    }
    if (!selectedShipmentId) {
      setDispatchMessage("Select an approved shipment.");
      return;
    }
    if (!dispatchNumber.trim() || !dispatchDate || !courier.trim() || !trackingNumber.trim()) {
      setDispatchMessage("Dispatch number, date, courier, and tracking number are mandatory.");
      return;
    }

    setIsDispatching(true);
    setDispatchMessage("Confirming dispatch and reducing inventory...");
    try {
      const message = await onConfirmDispatch({
        shipmentId: selectedShipmentId,
        dispatchNumber,
        dispatchDate,
        courier,
        trackingNumber,
      });
      setDispatchMessage(message);
      setCourier("");
      setTrackingNumber("");
    } catch (error) {
      setDispatchMessage(error instanceof Error ? error.message : "Could not confirm dispatch.");
    } finally {
      setIsDispatching(false);
    }
  }

  return (
    <>
      <section className="content-grid">
        <Panel title="Confirm dispatch" meta="Inventory reducing transaction">
          <div className="shipment-form-grid">
            <label className="field-control wide-field">
              <span>Approved shipment</span>
              <select value={selectedShipmentId} onChange={(event) => setSelectedShipmentId(event.target.value)}>
                <option value="">Select approved shipment</option>
                {approvedShipments.map((shipment) => (
                  <option key={shipment.shipmentId} value={shipment.shipmentId}>
                    {shipment.shipmentId} / {shipment.customer} / {shipment.destination}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-control">
              <span>Dispatch number</span>
              <input value={dispatchNumber} onChange={(event) => setDispatchNumber(event.target.value)} />
            </label>
            <label className="field-control">
              <span>Dispatch date</span>
              <input type="date" value={dispatchDate} onChange={(event) => setDispatchDate(event.target.value)} />
            </label>
            <label className="field-control">
              <span>Transporter / courier</span>
              <input value={courier} onChange={(event) => setCourier(event.target.value)} />
            </label>
            <label className="field-control">
              <span>Tracking number</span>
              <input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} />
            </label>
            <div className="learning-form-actions">
              <button className="primary-action" onClick={handleConfirmDispatch} disabled={isDispatching || !canDispatch}>
                <Truck size={17} aria-hidden="true" />
                {isDispatching ? "Dispatching" : "Confirm dispatch"}
              </button>
              <p className="status-line">{dispatchMessage}</p>
            </div>
          </div>
        </Panel>

        <Panel title="Approved shipment lines" meta={`${approvedShipments.length} ready`}>
          <ShipmentTable rows={approvedShipments} compact showLines />
        </Panel>
      </section>

      <Panel title="Dispatch history" meta={`${dispatches.length} records`}>
        <table>
          <thead>
            <tr>
              <th>Dispatch No</th>
              <th>Shipment ID</th>
              <th>Dispatch Date</th>
              <th>Courier</th>
              <th>Tracking No</th>
              <th>Dispatched By</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {dispatches.map((dispatch) => (
              <tr key={dispatch.dispatchNo}>
                <td>{dispatch.dispatchNo}</td>
                <td>{dispatch.shipmentId}</td>
                <td>{dispatch.dispatchDate}</td>
                <td>{dispatch.courier}</td>
                <td>{dispatch.trackingNo}</td>
                <td>{dispatch.dispatchedBy}</td>
                <td><StatusTag label={dispatch.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

function ReceiptsView({ receipts }: { receipts: Receipt[] }) {
  return (
    <Panel title="Goods receipts" meta="Inventory increasing transaction">
      <table>
        <thead>
          <tr>
            <th>GRN No</th>
            <th>Receipt Date</th>
            <th>Warehouse</th>
            <th>Supplier</th>
            <th>Item Code</th>
            <th>Batch</th>
            <th>Quantity</th>
            <th>Expiry</th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((receipt) => (
            <tr key={receipt.grnNo}>
              <td>{receipt.grnNo}</td>
              <td>{receipt.receiptDate}</td>
              <td>{receipt.warehouse}</td>
              <td>{receipt.supplier}</td>
              <td>{receipt.itemCode}</td>
              <td>{receipt.batch}</td>
              <td>{receipt.quantity}</td>
              <td>{receipt.expiryDate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function CountsView({ counts }: { counts: CountLine[] }) {
  return (
    <Panel title="Physical inventory counts" meta="Variance control">
      <table>
        <thead>
          <tr>
            <th>Count ID</th>
            <th>Warehouse</th>
            <th>Item Code</th>
            <th>Batch</th>
            <th>System Qty</th>
            <th>Physical Qty</th>
            <th>Variance</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {counts.map((count) => {
            const variance = count.physicalQty - count.systemQty;
            return (
              <tr key={`${count.countId}-${count.itemCode}`}>
                <td>{count.countId}</td>
                <td>{count.warehouse}</td>
                <td>{count.itemCode}</td>
                <td>{count.batch}</td>
                <td>{count.systemQty}</td>
                <td>{count.physicalQty}</td>
                <td>{variance}</td>
                <td><StatusTag label={variance > 0 ? "Excess" : variance < 0 ? "Deficit" : "Matched"} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

function ExpiryView({ inventory }: { inventory: InventoryBatch[] }) {
  return (
    <section className="content-grid wide-left">
      <Panel title="Expiry management" meta="Days to expiry">
        <InventoryTable rows={inventory} />
      </Panel>
      <Panel title="Expiry buckets" meta="Alert bands">
        {["0-90 Days", "91-180 Days", "181-365 Days", "Above 365 Days"].map((bucket) => (
          <div className="bucket-row" key={bucket}>
            <span>{bucket}</span>
            <strong>{inventory.filter((batch) => batch.expiryBucket === bucket).length}</strong>
          </div>
        ))}
      </Panel>
    </section>
  );
}

function CustomersView({ customers }: { customers: Customer[] }) {
  return (
    <Panel title="Customer master" meta="Linked to shipments">
      <table>
        <thead>
          <tr>
            <th>Customer Code</th>
            <th>Name</th>
            <th>Country</th>
            <th>Type</th>
            <th>Contact</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr key={customer.code}>
              <td>{customer.code}</td>
              <td>{customer.name}</td>
              <td>{customer.country}</td>
              <td>{customer.type}</td>
              <td>{customer.contact}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function SecurityView({
  currentUser,
  message,
  onSaveApprovalRule,
  onSaveUser,
  securityOverview,
}: {
  currentUser: ApiAuthenticatedUser;
  message: string;
  onSaveApprovalRule: (payload: Omit<ApiSaveApprovalRuleRequest, "auth_token">) => Promise<void>;
  onSaveUser: (payload: Omit<ApiSaveSecurityUserRequest, "auth_token">) => Promise<void>;
  securityOverview: ApiSecurityOverview;
}) {
  const defaultRole = securityOverview.role_definitions[0]?.role_name ?? "Admin";
  const [userEmail, setUserEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [userRole, setUserRole] = useState(defaultRole);
  const [userPassword, setUserPassword] = useState("");
  const [countryScope, setCountryScope] = useState("");
  const [warehouseScope, setWarehouseScope] = useState("");
  const [userIsActive, setUserIsActive] = useState(true);
  const [ruleProcess, setRuleProcess] = useState("import_validation");
  const [ruleCountry, setRuleCountry] = useState("");
  const [ruleVertical, setRuleVertical] = useState("All");
  const [ruleMaterialCode, setRuleMaterialCode] = useState("All");
  const [approverRole, setApproverRole] = useState("Country Incharge");
  const [approverEmail, setApproverEmail] = useState("");
  const [ruleIsActive, setRuleIsActive] = useState(true);
  const [changeReason, setChangeReason] = useState("");

  useEffect(() => {
    if (!securityOverview.role_definitions.some((role) => role.role_name === userRole)) {
      setUserRole(defaultRole);
    }
    if (!securityOverview.role_definitions.some((role) => role.role_name === approverRole)) {
      setApproverRole(defaultRole);
    }
  }, [approverRole, defaultRole, securityOverview.role_definitions, userRole]);

  async function handleSubmitUser() {
    await onSaveUser({
      email: userEmail,
      full_name: fullName,
      role_name: userRole,
      country_scope: parseCommaList(countryScope),
      warehouse_scope: parseCommaList(warehouseScope),
      is_active: userIsActive,
      password: userPassword || null,
      changed_by: currentUser.email,
      change_reason: changeReason,
    });
  }

  async function handleSubmitApprovalRule() {
    await onSaveApprovalRule({
      process_name: ruleProcess,
      country: ruleCountry,
      vertical: ruleVertical || "All",
      material_code: ruleMaterialCode || "All",
      approver_role: approverRole,
      approver_email: approverEmail,
      is_active: ruleIsActive,
      changed_by: currentUser.email,
      change_reason: changeReason,
    });
  }

  return (
    <>
      <section className="kpi-grid">
        <MetricCard
          label="Configured Users"
          value={String(securityOverview.users.length)}
          detail="Email based"
        />
        <MetricCard
          label="Approval Rules"
          value={String(securityOverview.approval_rules.length)}
          detail="Process by scope"
        />
        <MetricCard
          label="Active Users"
          value={String(securityOverview.users.filter((user) => user.is_active).length)}
          detail="Allowed access"
        />
        <MetricCard
          label="Active Rules"
          value={String(securityOverview.approval_rules.filter((rule) => rule.is_active).length)}
          detail="Approval matrix"
        />
      </section>

      <section className="content-grid">
        <Panel title="User access" meta="Email + role">
          <div className="security-form-grid">
            <label className="field-control">
              <span>Email</span>
              <input value={userEmail} onChange={(event) => setUserEmail(event.target.value)} />
            </label>
            <label className="field-control">
              <span>Full name</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </label>
            <label className="field-control">
              <span>Role</span>
              <select value={userRole} onChange={(event) => setUserRole(event.target.value)}>
                {securityOverview.role_definitions.map((role) => (
                  <option key={role.role_name} value={role.role_name}>
                    {role.role_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-control">
              <span>Password</span>
              <input
                autoComplete="new-password"
                type="password"
                value={userPassword}
                onChange={(event) => setUserPassword(event.target.value)}
              />
            </label>
            <label className="field-control">
              <span>Country scope</span>
              <input value={countryScope} onChange={(event) => setCountryScope(event.target.value)} />
            </label>
            <label className="field-control">
              <span>Warehouse scope</span>
              <input value={warehouseScope} onChange={(event) => setWarehouseScope(event.target.value)} />
            </label>
            <label className="toggle-control">
              <input
                checked={userIsActive}
                type="checkbox"
                onChange={(event) => setUserIsActive(event.target.checked)}
              />
              <span>Active</span>
            </label>
          </div>
          <SecurityChangeFields
            changedBy={currentUser.email}
            changeReason={changeReason}
            setChangeReason={setChangeReason}
          />
          <div className="form-action-row">
            <button className="primary-action" onClick={handleSubmitUser}>
              <Plus size={17} aria-hidden="true" />
              Save user access
            </button>
            <p className="status-line">{message}</p>
          </div>
        </Panel>

        <Panel title="Approval rule" meta="Process + approver">
          <div className="security-form-grid">
            <label className="field-control">
              <span>Process</span>
              <select value={ruleProcess} onChange={(event) => setRuleProcess(event.target.value)}>
                <option value="import_validation">Import validation</option>
                <option value="shipment_approval">Shipment approval</option>
                <option value="goods_receipt">Goods receipt</option>
                <option value="inventory_adjustment">Inventory adjustment</option>
              </select>
            </label>
            <label className="field-control">
              <span>Country</span>
              <input value={ruleCountry} onChange={(event) => setRuleCountry(event.target.value)} />
            </label>
            <label className="field-control">
              <span>Vertical</span>
              <input value={ruleVertical} onChange={(event) => setRuleVertical(event.target.value)} />
            </label>
            <label className="field-control">
              <span>Material code</span>
              <input value={ruleMaterialCode} onChange={(event) => setRuleMaterialCode(event.target.value)} />
            </label>
            <label className="field-control">
              <span>Approver role</span>
              <select value={approverRole} onChange={(event) => setApproverRole(event.target.value)}>
                {securityOverview.role_definitions.map((role) => (
                  <option key={role.role_name} value={role.role_name}>
                    {role.role_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-control">
              <span>Approver email</span>
              <input value={approverEmail} onChange={(event) => setApproverEmail(event.target.value)} />
            </label>
            <label className="toggle-control">
              <input
                checked={ruleIsActive}
                type="checkbox"
                onChange={(event) => setRuleIsActive(event.target.checked)}
              />
              <span>Active</span>
            </label>
          </div>
          <SecurityChangeFields
            changedBy={currentUser.email}
            changeReason={changeReason}
            setChangeReason={setChangeReason}
          />
          <div className="form-action-row">
            <button className="primary-action" onClick={handleSubmitApprovalRule}>
              <KeyRound size={17} aria-hidden="true" />
              Save approval rule
            </button>
          </div>
        </Panel>
      </section>

      <Panel title="Role definitions" meta={`${securityOverview.role_definitions.length} roles`}>
        <section className="role-grid">
          {securityOverview.role_definitions.map((role) => (
            <article className="role-card" key={role.role_name}>
              <ShieldCheck size={22} aria-hidden="true" />
              <strong>{role.role_name}</strong>
              <span>{role.description}</span>
              <div className="permission-list">
                {role.permissions.map((permission) => (
                  <StatusTag key={permission} label={permission.replace(/_/g, " ")} />
                ))}
              </div>
            </article>
          ))}
        </section>
      </Panel>

      <section className="content-grid wide-left">
        <Panel title="User master" meta={`${securityOverview.users.length} records`}>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Countries</th>
                <th>Warehouses</th>
                <th>Password</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {securityOverview.users.length === 0 ? (
                <tr>
                  <td colSpan={7}>No users configured yet.</td>
                </tr>
              ) : (
                securityOverview.users.map((user) => (
                  <tr key={user.email}>
                    <td>{user.email}</td>
                    <td>{user.full_name}</td>
                    <td>{user.role_name}</td>
                    <td>{user.country_scope.join(", ") || "All"}</td>
                    <td>{user.warehouse_scope.join(", ") || "All"}</td>
                    <td><StatusTag label={user.has_password ? "Set" : "Missing"} /></td>
                    <td><StatusTag label={user.is_active ? "Active" : "Inactive"} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Panel>

        <Panel title="Approval matrix" meta={`${securityOverview.approval_rules.length} rules`}>
          <table>
            <thead>
              <tr>
                <th>Process</th>
                <th>Scope</th>
                <th>Approver</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {securityOverview.approval_rules.length === 0 ? (
                <tr>
                  <td colSpan={4}>No approval rules configured yet.</td>
                </tr>
              ) : (
                securityOverview.approval_rules.map((rule) => (
                  <tr key={rule.rule_id}>
                    <td>{formatProcessName(rule.process_name)}</td>
                    <td>
                      {rule.country}
                      <br />
                      <span className="muted-cell">
                        {rule.vertical} / {rule.material_code}
                      </span>
                    </td>
                    <td>
                      {rule.approver_role}
                      <br />
                      <span className="muted-cell">{rule.approver_email}</span>
                    </td>
                    <td><StatusTag label={rule.is_active ? "Active" : "Inactive"} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Panel>
      </section>
    </>
  );
}

function SecurityChangeFields({
  changedBy,
  changeReason,
  setChangeReason,
}: {
  changedBy: string;
  changeReason: string;
  setChangeReason: (value: string) => void;
}) {
  return (
    <div className="security-change-grid">
      <label className="field-control">
        <span>Changed by</span>
        <input value={changedBy} readOnly />
      </label>
      <label className="field-control">
        <span>Change reason</span>
        <input value={changeReason} onChange={(event) => setChangeReason(event.target.value)} />
      </label>
    </div>
  );
}

function AssistantView({
  answer,
  isAsking,
  onAsk,
  question,
  setQuestion,
}: {
  answer: string;
  isAsking: boolean;
  onAsk: () => void;
  question: string;
  setQuestion: (value: string) => void;
}) {
  return (
    <section className="content-grid wide-left">
      <Panel title="AI assistant" meta="Operational Q&A">
        <div className="assistant-box">
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} />
          <button className="primary-action" onClick={onAsk} disabled={isAsking}>
            {isAsking ? "Asking" : "Ask"}
          </button>
        </div>
      </Panel>
      <Panel title="Answer preview" meta="Mapped report">
        <div className="answer-card">
          <Bot size={24} aria-hidden="true" />
          <strong>{answer}</strong>
          <span>Source: Expiry Report and Inventory Batch table</span>
        </div>
      </Panel>
    </section>
  );
}

function InventoryTable({ rows, compact = false }: { rows: InventoryBatch[]; compact?: boolean }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Item Code</th>
          {!compact ? <th>Description</th> : null}
          <th>Batch</th>
          <th>Warehouse</th>
          <th>Qty</th>
          {!compact ? <th>Value</th> : null}
          <th>Expiry</th>
          <th>Bucket</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((batch) => (
          <tr key={`${batch.itemCode}-${batch.batch}`}>
            <td>{batch.itemCode}</td>
            {!compact ? <td>{batch.description}</td> : null}
            <td>{batch.batch}</td>
            <td>{batch.warehouse}</td>
            <td>{batch.quantity}</td>
            {!compact ? <td>{formatCurrency(batch.quantity * batch.unitValue)}</td> : null}
            <td>{batch.expiryDate}</td>
            <td><StatusTag label={batch.expiryBucket} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ShipmentTable({
  rows,
  compact = false,
  showLines = false,
}: {
  rows: Shipment[];
  compact?: boolean;
  showLines?: boolean;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>Shipment ID</th>
          <th>Customer</th>
          {!compact ? <th>Destination</th> : null}
          {showLines ? <th>Line / Batch / Warehouse</th> : null}
          <th>Priority</th>
          <th>Required Date</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((shipment) => (
          <tr key={shipment.shipmentId}>
            <td>{shipment.shipmentId}</td>
            <td>{shipment.customer}</td>
            {!compact ? <td>{shipment.destination}</td> : null}
            {showLines ? (
              <td>
                <div className="line-stack">
                  {shipment.lines.map((line) => (
                    <span key={`${shipment.shipmentId}-${line.itemCode}-${line.batch}-${line.warehouse}`}>
                      {line.itemCode} / {line.batch} / {line.warehouse} / {formatNumber(line.quantityApproved || line.quantityRequested)}
                    </span>
                  ))}
                </div>
              </td>
            ) : null}
            <td>{shipment.priority}</td>
            <td>{shipment.requiredDate}</td>
            <td><StatusTag label={shipment.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Pulls the first number out of a display string like "$1,234,567", "1,234",
// "5", or "-3" so it can be animated while keeping the original prefix/suffix
// (currency symbol, units) and grouping/decimal style intact.
function parseMetricNumber(value: string) {
  const match = value.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/s);
  if (!match) {
    return null;
  }
  const [, prefix, numberPart, suffix] = match;
  const target = Number(numberPart.replace(/,/g, ""));
  if (!Number.isFinite(target)) {
    return null;
  }
  const decimals = numberPart.includes(".") ? numberPart.split(".")[1].length : 0;
  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: numberPart.includes(","),
  });
  return { prefix, suffix, target, formatter };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Counts a metric up from zero to its final value on mount. Falls back to the
// plain value for non-numeric strings or when the user prefers reduced motion.
function useCountUp(value: string, durationMs = 900): string {
  const parsed = parseMetricNumber(value);
  const [display, setDisplay] = useState(() =>
    parsed && !prefersReducedMotion()
      ? `${parsed.prefix}${parsed.formatter.format(0)}${parsed.suffix}`
      : value,
  );

  useEffect(() => {
    const target = parseMetricNumber(value);
    if (!target || prefersReducedMotion()) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(`${target.prefix}${target.formatter.format(target.target * eased)}${target.suffix}`);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return display;
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  const animatedValue = useCountUp(value);
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{animatedValue}</strong>
      <small>{detail}</small>
    </article>
  );
}

const IMPORT_STAGES = ["Validation", "Approved", "Delivered", "Received"] as const;

function importStageIndex(status: string | undefined): number {
  switch (status) {
    case "validated":
    case "country_documents_pending":
    case "customs_in_progress":
    case "in_transit":
      return 1;
    case "arrived":
    case "goods_receipt_pending":
      return 2;
    case "received":
    case "closed":
      return 3;
    default:
      return 0;
  }
}

// Animated stage tracker for an import shipment: Validation -> Approved ->
// Delivered -> Received, highlighting the stage the shipment is currently in.
function ImportStageTracker({ status }: { status?: string }) {
  const current = importStageIndex(status);
  return (
    <div className="stage-tracker" aria-label="Import shipment progress">
      {IMPORT_STAGES.map((label, index) => {
        const state = index < current ? "done" : index === current ? "active" : "pending";
        return (
          <div className={`stage-step stage-${state}`} key={label}>
            <span className="stage-dot" aria-hidden="true">
              {index < current ? <CheckCircle2 size={14} /> : index + 1}
            </span>
            <span className="stage-label">{label}</span>
            {index < IMPORT_STAGES.length - 1 ? <span className="stage-line" aria-hidden="true" /> : null}
          </div>
        );
      })}
    </div>
  );
}

function WorkflowStep({
  detail,
  icon: Icon,
  label,
  state,
}: {
  detail: string;
  icon: IconComponent;
  label: string;
  state: "active" | "done" | "waiting";
}) {
  return (
    <article className={`workflow-step ${state}`}>
      <div className="workflow-icon">
        <Icon size={19} aria-hidden="true" />
      </div>
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
    </article>
  );
}

function ActionCard({
  action,
  detail,
  icon: Icon,
  label,
  onClick,
  value,
}: {
  action: string;
  detail: string;
  icon: IconComponent;
  label: string;
  onClick: () => void;
  value: string;
}) {
  return (
    <article className="action-card">
      <div className="action-card-top">
        <span className="action-icon">
          <Icon size={20} aria-hidden="true" />
        </span>
        <strong>{value}</strong>
      </div>
      <div>
        <h2>{label}</h2>
        <p>{detail}</p>
      </div>
      <button className="secondary-action" onClick={onClick}>
        {action}
      </button>
    </article>
  );
}

function ImportQueueList({ rows }: { rows: ApiImportFileCandidate[] }) {
  if (rows.length === 0) {
    return <p className="empty-state">No import files are waiting right now.</p>;
  }

  return (
    <div className="queue-list">
      {rows.map((candidate) => (
        <article className="queue-row" key={candidate.import_file_number}>
          <div className="queue-row-main">
            <div>
              <strong>{candidate.shipment_name ?? candidate.import_file_number}</strong>
              <span>
                {candidate.destination_country} / {candidate.shipment_vertical ?? "General"} / invoice{" "}
                {candidate.invoice_numbers.length ? candidate.invoice_numbers.join(", ") : candidate.invoice_number ?? "-"}
              </span>
            </div>
            <StatusTag label={candidate.status.replace(/_/g, " ")} />
          </div>
          <div className="queue-row-meta">
            <span>{candidate.lines.length} line(s)</span>
            <span>{candidate.commercial_invoice_document_ids.length || 0} invoice doc(s)</span>
            <span>{candidate.packing_list_document_ids.length || 0} packing doc(s)</span>
            <span>AWB {candidate.awb_number ?? "-"}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function AuditEventList({ rows }: { rows: ApiAuditEvent[] }) {
  if (rows.length === 0) {
    return <p className="empty-state">No audit events recorded yet.</p>;
  }

  return (
    <div className="audit-list">
      {rows.map((event) => (
        <article className="audit-event" key={event.id}>
          <div className="audit-event-main">
            <div>
              <strong>{toTitleCase(event.action)}</strong>
              <span>
                {event.module_name} / {event.entity_name}
              </span>
            </div>
            <span className="audit-time">{formatTimestamp(event.created_at)}</span>
          </div>
          <div className="audit-event-meta">
            <span>{event.entity_id}</span>
            <span>{event.actor ?? "system"}</span>
          </div>
          {event.reason ? <p>{event.reason}</p> : null}
        </article>
      ))}
    </div>
  );
}

function AuditView({ auditEvents }: { auditEvents: ApiAuditEvent[] }) {
  const importEvents = auditEvents.filter((event) => event.module_name === "import").length;
  const learningEvents = auditEvents.filter((event) => event.module_name === "learning").length;

  return (
    <>
      <section className="kpi-grid">
        <MetricCard label="Audit Events" value={String(auditEvents.length)} detail="Latest loaded events" />
        <MetricCard label="Import Events" value={String(importEvents)} detail="Document to receipt flow" />
        <MetricCard label="Learning Events" value={String(learningEvents)} detail="Master learning actions" />
        <MetricCard
          label="Latest Action"
          value={auditEvents[0] ? toTitleCase(auditEvents[0].action) : "-"}
          detail={auditEvents[0]?.actor ?? "No actor yet"}
        />
      </section>

      <Panel title="Audit trail" meta="Newest first">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Module</th>
              <th>Entity</th>
              <th>Actor</th>
              <th>Reason</th>
              <th>New Value</th>
            </tr>
          </thead>
          <tbody>
            {auditEvents.length === 0 ? (
              <tr>
                <td colSpan={7}>No audit records yet.</td>
              </tr>
            ) : (
              auditEvents.map((event) => (
                <tr key={event.id}>
                  <td>{formatTimestamp(event.created_at)}</td>
                  <td>{toTitleCase(event.action)}</td>
                  <td>{event.module_name}</td>
                  <td>
                    {event.entity_name}
                    <br />
                    <span className="muted-cell">{event.entity_id}</span>
                  </td>
                  <td>{event.actor ?? "system"}</td>
                  <td>{event.reason ?? "-"}</td>
                  <td>{formatAuditValue(event.new_value)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

function LearningBars({ stats }: { stats: ApiLearningInsights["top_corrected_fields"] }) {
  if (stats.length === 0) {
    return <p className="empty-state">Nothing learned here yet.</p>;
  }
  const maxCount = Math.max(...stats.map((stat) => stat.count), 1);
  return (
    <div className="learning-bars">
      {stats.map((stat) => {
        const width = `${Math.max((stat.count / maxCount) * 100, 4)}%`;
        return (
          <div className="bar-row" key={stat.label}>
            <div>
              <span>{toTitleCase(stat.label.replace(/_/g, " "))}</span>
              <strong>{stat.count}</strong>
            </div>
            <div className="bar-track">
              <span style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LearningCenterView({ insights }: { insights: ApiLearningInsights | null }) {
  if (!insights) {
    return (
      <Panel title="Learning Center" meta="Waiting for data">
        <p className="empty-state">
          This page shows what the platform has learned from your work. It will fill in
          automatically once the backend is connected and you start correcting fields,
          confirming document rules, and building product profiles.
        </p>
      </Panel>
    );
  }

  const hasLearned =
    insights.total_learning_rules +
      insights.total_corrections +
      insights.total_product_profiles +
      insights.total_country_document_rules >
    0;

  return (
    <>
      <section className="learning-hero panel">
        <div className="learning-hero-mark">
          <BrainCircuit size={26} aria-hidden="true" />
        </div>
        <div>
          <p className="eyebrow">Self-learning platform</p>
          <h2>Everything the control tower has learned so far</h2>
          <p className="status-line">
            Each correction you make, every document rule you confirm, and every product
            profile you complete is remembered here and reused to make future imports
            faster and safer.
          </p>
        </div>
      </section>

      <section className="kpi-grid" aria-label="Learning metrics">
        <MetricCard
          label="Learned Rules"
          value={String(insights.total_learning_rules)}
          detail="Extraction shortcuts learned"
        />
        <MetricCard
          label="Corrections Captured"
          value={String(insights.total_corrections)}
          detail="Human fixes remembered"
        />
        <MetricCard
          label="Product Profiles"
          value={String(insights.total_product_profiles)}
          detail="Known medical devices"
        />
        <MetricCard
          label="Country Doc Rules"
          value={String(insights.total_country_document_rules)}
          detail="Import checklist rules"
        />
        <MetricCard
          label="Avg Rule Confidence"
          value={`${insights.average_rule_confidence}%`}
          detail="Across learned rules"
        />
        <MetricCard
          label="Entity Aliases"
          value={String(insights.total_entity_aliases)}
          detail="Name variations mapped"
        />
        <MetricCard
          label="Warehouse Candidates"
          value={String(insights.total_warehouse_candidates)}
          detail="Discovered from imports"
        />
      </section>

      {!hasLearned ? (
        <Panel title="Learning starts with your first correction" meta="No data yet">
          <p className="empty-state">
            The platform has not learned anything yet. As soon as you correct an extracted
            field, confirm a country document rule, or save a product profile, it will show
            up here and start improving automatic results.
          </p>
        </Panel>
      ) : null}

      <div className="learning-grid">
        <Panel title="Most corrected fields" meta="Where humans help most">
          <LearningBars stats={insights.top_corrected_fields} />
        </Panel>
        <Panel title="Corrections by document type" meta="By source document">
          <LearningBars stats={insights.corrections_by_document_type} />
        </Panel>
      </div>

      <Panel title="Top learned rules" meta="Highest confidence first">
        {insights.top_learned_rules.length === 0 ? (
          <p className="empty-state">No extraction rules learned yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Field</th>
                <th>When it sees</th>
                <th>Auto-fills to</th>
                <th>Confidence</th>
                <th>Times used</th>
              </tr>
            </thead>
            <tbody>
              {insights.top_learned_rules.map((rule, index) => (
                <tr key={`${rule.document_type}-${rule.target_field}-${index}`}>
                  <td>{toTitleCase(rule.document_type.replace(/_/g, " "))}</td>
                  <td>{toTitleCase(rule.target_field.replace(/_/g, " "))}</td>
                  <td>
                    <span className="muted-cell">{rule.source_text}</span>
                  </td>
                  <td>{rule.corrected_value ?? "—"}</td>
                  <td>
                    <StatusTag label={`${Math.round(rule.confidence)}%`} />
                  </td>
                  <td>{rule.success_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <div className="learning-grid">
        <Panel title="Country document rules" meta="Import checklist learning">
          {insights.country_document_rules.length === 0 ? (
            <p className="empty-state">No country document rules confirmed yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Vertical</th>
                  <th>Material</th>
                  <th>Required document</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {insights.country_document_rules.map((rule, index) => (
                  <tr key={`${rule.country}-${rule.required_document_type}-${index}`}>
                    <td>{rule.country}</td>
                    <td>{rule.vertical}</td>
                    <td>
                      <span className="muted-cell">{rule.material_code}</span>
                    </td>
                    <td>{toTitleCase(rule.required_document_type.replace(/_/g, " "))}</td>
                    <td>
                      <StatusTag label={`${Math.round(rule.confidence)}%`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Recent corrections" meta="Newest first">
          {insights.recent_corrections.length === 0 ? (
            <p className="empty-state">No corrections captured yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Changed to</th>
                  <th>Reason</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {insights.recent_corrections.map((event, index) => (
                  <tr key={`${event.field_name}-${index}`}>
                    <td>{toTitleCase(event.field_name.replace(/_/g, " "))}</td>
                    <td>{event.corrected_value ?? "-"}</td>
                    <td>
                      <span className="muted-cell">{event.correction_reason ?? "-"}</span>
                    </td>
                    <td>{event.corrected_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <div className="learning-grid">
        <Panel title="Entity aliases" meta="Name variations mapped">
          {insights.recent_entity_aliases.length === 0 ? (
            <p className="empty-state">No name aliases learned yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Alias</th>
                  <th>Maps to</th>
                  <th>Approved</th>
                </tr>
              </thead>
              <tbody>
                {insights.recent_entity_aliases.map((alias, index) => (
                  <tr key={`${alias.alias_text}-${index}`}>
                    <td>{toTitleCase(alias.entity_type)}</td>
                    <td><span className="muted-cell">{alias.alias_text}</span></td>
                    <td>{alias.master_code}</td>
                    <td><StatusTag label={alias.approved ? "Approved" : "Pending"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Warehouse candidates" meta="Discovered from imports">
          {insights.recent_warehouse_candidates.length === 0 ? (
            <p className="empty-state">No warehouse candidates discovered yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Warehouse</th>
                  <th>Status</th>
                  <th>Added by</th>
                </tr>
              </thead>
              <tbody>
                {insights.recent_warehouse_candidates.map((candidate, index) => (
                  <tr key={`${candidate.warehouse_name}-${index}`}>
                    <td>{candidate.country}</td>
                    <td>{candidate.warehouse_name}</td>
                    <td><StatusTag label={toTitleCase(candidate.status.replace(/_/g, " "))} /></td>
                    <td><span className="muted-cell">{candidate.created_by}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Panel({
  title,
  meta,
  children,
}: {
  title: string;
  meta: string;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        <span>{meta}</span>
      </div>
      {children}
    </section>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? `${Math.max((value / max) * 100, 3)}%` : "0%";
  return (
    <div className="bar-row">
      <div>
        <span>{label}</span>
        <strong>{formatCurrency(value)}</strong>
      </div>
      <div className="bar-track">
        <span style={{ width }} />
      </div>
    </div>
  );
}

function StatusTag({ label }: { label: string }) {
  const normalized = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return <span className={`status-tag status-${normalized}`}>{label}</span>;
}

// Colour-coded extraction confidence. Accepts a 0-1 fraction or a 0-100 number.
// High (>=85%) reads green, medium (60-84%) amber "review", low (<60%) red.
function ConfidenceBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return (
      <span className="confidence-badge confidence-unknown" title="No confidence score">
        —
      </span>
    );
  }
  const percent = score <= 1 ? Math.round(score * 100) : Math.round(score);
  const level = percent >= 85 ? "high" : percent >= 60 ? "medium" : "low";
  const labelText = level === "high" ? "High" : level === "medium" ? "Review" : "Low";
  return (
    <span className={`confidence-badge confidence-${level}`} title={`${labelText} confidence`}>
      <span className="confidence-dot" aria-hidden="true" />
      {percent}%
    </span>
  );
}

// Animated stacked bar of extraction-confidence buckets. The segments grow from
// zero on mount for a smooth reveal (and collapse to instant under reduced motion).
function ConfidenceMeter({ high, review, low }: { high: number; review: number; low: number }) {
  const total = high + review + low;
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (total === 0) {
    return (
      <p className="empty-state">
        No extraction confidence data yet. Upload and scan documents to see quality here.
      </p>
    );
  }

  const width = (count: number) => (revealed ? `${(count / total) * 100}%` : "0%");
  return (
    <div className="confidence-meter">
      <div className="confidence-meter-track">
        <span className="confidence-seg confidence-seg-high" style={{ width: width(high) }} />
        <span className="confidence-seg confidence-seg-review" style={{ width: width(review) }} />
        <span className="confidence-seg confidence-seg-low" style={{ width: width(low) }} />
      </div>
      <div className="confidence-meter-legend">
        <span className="confidence-high"><span className="confidence-dot" aria-hidden="true" /> High {high}</span>
        <span className="confidence-medium"><span className="confidence-dot" aria-hidden="true" /> Review {review}</span>
        <span className="confidence-low"><span className="confidence-dot" aria-hidden="true" /> Low {low}</span>
      </div>
    </div>
  );
}
