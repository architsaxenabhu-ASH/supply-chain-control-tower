import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Database,
  Download,
  FileCheck2,
  FileUp,
  FileSpreadsheet,
  History,
  KeyRound,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Ship,
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
  fetchCustomers,
  fetchAuditEvents,
  fetchDashboardSummary,
  fetchDispatches,
  fetchGoodsReceipts,
  fetchImportCandidates,
  fetchInventoryBatches,
  fetchInventoryCounts,
  fetchProducts,
  fetchSecurityOverview,
  fetchShipments,
  fetchWarehouses,
  getExtractionMaster,
  listDocuments,
  loginUser,
  postImportGoodsReceipt,
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
  ApiImportApprovalRequest,
  ApiImportAssemblyRequest,
  ApiImportGoodsReceiptPostRequest,
  ApiInventoryBatch,
  ApiInventoryCount,
  ApiImportFileCandidate,
  ApiSaveApprovalRuleRequest,
  ApiSaveSecurityUserRequest,
  ApiProduct,
  ApiSecurityOverview,
  ApiShipment,
  ApiWarehouseLocation,
} from "../lib/api";
import type {
  DocumentExtractionMaster,
  DocumentRecord,
  DocumentType,
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
  "aria-hidden"?: boolean | "true" | "false";
}>;

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
  { id: "documents", label: "Documents", icon: FileUp },
  { id: "import-validation", label: "Import Validation", icon: ClipboardCheck },
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
  { id: "assistant", label: "Assistant", icon: Bot },
];

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

function getExportRows({
  activeView,
  auditEvents,
  counts,
  customers,
  dispatches,
  documents,
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
      import_file: importCandidate?.import_file_number,
      destination_country: importCandidate?.destination_country,
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

export function App() {
  const [currentUser, setCurrentUser] = useState<ApiAuthenticatedUser | null>(() => loadStoredCurrentUser());
  const [loginMessage, setLoginMessage] = useState("Sign in with a configured Security User email.");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
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
  const [importQueue, setImportQueue] = useState<ApiImportFileCandidate[]>([]);
  const [securityOverview, setSecurityOverview] = useState<ApiSecurityOverview>(fallbackSecurityOverview);
  const [securityMessage, setSecurityMessage] = useState("Enter users and approval rules for email-based access.");
  const [apiStatus, setApiStatus] = useState("Using sample data");
  const [assistantAnswer, setAssistantAnswer] = useState("Found 2 batches expiring within 180 days.");
  const [isAskingAssistant, setIsAskingAssistant] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>("commercial_invoice");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedMaster, setSelectedMaster] = useState<DocumentExtractionMaster | null>(null);
  const [documentMessage, setDocumentMessage] = useState("Upload a document to trigger scanning.");
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [importCandidate, setImportCandidate] = useState<ApiImportFileCandidate | null>(null);
  const [destinationWarehouses, setDestinationWarehouses] = useState<ApiWarehouseLocation[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [importMessage, setImportMessage] = useState("Select uploaded import documents to create a validation file.");

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
    if (!selectedFile) {
      setDocumentMessage("Select a file first.");
      return;
    }

    setIsUploadingDocument(true);
    setDocumentMessage("Uploading and scanning document...");

    try {
      const uploaded = await uploadDocument(documentType, selectedFile);
      const master = await getExtractionMaster(uploaded.document_id);
      setDocuments((current) => [
        uploaded,
        ...current.filter((document) => document.document_id !== uploaded.document_id),
      ]);
      setSelectedMaster(master);
      setSelectedFile(null);
      setDocumentMessage("Document uploaded, scanned, and extraction master generated.");
      setApiStatus("Connected to backend / document scanned");
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

  async function handleAssembleImportFromDocuments(payload: ApiImportAssemblyRequest) {
    setImportMessage("Creating import validation file from selected documents...");
    try {
      const candidate = await assembleImportFromDocuments(payload);
      const warehouses = await fetchWarehouses(candidate.destination_country);
      const [apiImportQueue, apiAuditEvents] = await Promise.all([
        fetchImportCandidates(),
        fetchAuditEvents(20),
      ]);
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
    return `Import file approved by ${payload.approved_by}. Goods Receipt is now allowed.`;
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

  async function handleSaveSecurityUser(payload: ApiSaveSecurityUserRequest) {
    setSecurityMessage("Saving user access...");
    try {
      await saveSecurityUser(payload);
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

  async function handleSaveApprovalRule(payload: ApiSaveApprovalRuleRequest) {
    setSecurityMessage("Saving approval rule...");
    try {
      await saveApprovalRule(payload);
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
  const canExportActiveView = hasPermission(currentUser, "reports_export");

  useEffect(() => {
    if (currentUser && !canAccessView(currentUser, activeView)) {
      setActiveView("dashboard");
    }
  }, [activeView, currentUser]);

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
            <button className="secondary-action" onClick={handleRefreshApp}>
              <RefreshCw size={17} aria-hidden="true" />
              Refresh
            </button>
            <button className="secondary-action" onClick={handleExportActiveView} disabled={!canExportActiveView}>
              <Download size={17} aria-hidden="true" />
              Export
            </button>
          </div>
        </header>

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
          />
        ) : null}
        {activeView === "documents" ? (
          <DocumentsView
            documentMessage={documentMessage}
            documentType={documentType}
            documents={documents}
            isUploading={isUploadingDocument}
            onDocumentTypeChange={setDocumentType}
            onFileChange={setSelectedFile}
            onOpenDocument={handleOpenDocument}
            onUpload={handleDocumentUpload}
            selectedFile={selectedFile}
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
            onNewWarehouseNameChange={setNewWarehouseName}
            onPostGoodsReceipt={handlePostImportGoodsReceipt}
            onSelectedWarehouseChange={setSelectedWarehouse}
            securityOverview={securityOverview}
            selectedWarehouse={selectedWarehouse}
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
        {activeView === "assistant" ? (
          <AssistantView
            answer={assistantAnswer}
            isAsking={isAskingAssistant}
            onAsk={handleAskAssistant}
            question={assistantQuestion}
            setQuestion={setAssistantQuestion}
          />
        ) : null}
      </section>
    </main>
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
}) {
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

function DocumentsView({
  documentMessage,
  documentType,
  documents,
  isUploading,
  onDocumentTypeChange,
  onFileChange,
  onOpenDocument,
  onUpload,
  selectedFile,
  selectedMaster,
}: {
  documentMessage: string;
  documentType: DocumentType;
  documents: DocumentRecord[];
  isUploading: boolean;
  onDocumentTypeChange: (value: DocumentType) => void;
  onFileChange: (value: File | null) => void;
  onOpenDocument: (documentId: string) => void;
  onUpload: () => void;
  selectedFile: File | null;
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
              <span>Source file</span>
              <input
                accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png"
                type="file"
                onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
              />
            </label>
            <button className="primary-action" onClick={onUpload} disabled={isUploading}>
              <Upload size={17} aria-hidden="true" />
              {isUploading ? "Scanning" : "Upload and scan"}
            </button>
            <p className="status-line">{selectedFile ? selectedFile.name : documentMessage}</p>
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
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 ? (
              <tr>
                <td colSpan={4}>No extracted fields yet.</td>
              </tr>
            ) : (
              fields.slice(0, 40).map((field) => (
                <tr key={field.field_name}>
                  <td>{field.field_name}</td>
                  <td>{field.extracted_value ?? "Needs validation"}</td>
                  <td>{field.confidence_score ? `${Math.round(field.confidence_score * 100)}%` : "-"}</td>
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

function ImportValidationView({
  candidate,
  currentUser,
  destinationWarehouses,
  documents,
  importMessage,
  newWarehouseName,
  onApproveImport,
  onAssembleImport,
  onNewWarehouseNameChange,
  onPostGoodsReceipt,
  onSelectedWarehouseChange,
  securityOverview,
  selectedWarehouse,
}: {
  candidate: ApiImportFileCandidate | null;
  currentUser: ApiAuthenticatedUser;
  destinationWarehouses: ApiWarehouseLocation[];
  documents: DocumentRecord[];
  importMessage: string;
  newWarehouseName: string;
  onApproveImport: (payload: ApiImportApprovalRequest) => Promise<string>;
  onAssembleImport: (payload: ApiImportAssemblyRequest) => void;
  onNewWarehouseNameChange: (value: string) => void;
  onPostGoodsReceipt: (payload: ApiImportGoodsReceiptPostRequest) => Promise<string>;
  onSelectedWarehouseChange: (value: string) => void;
  securityOverview: ApiSecurityOverview;
  selectedWarehouse: string;
}) {
  const actorName = currentUser.email;
  const [supplierName, setSupplierName] = useState("");
  const [verticalName, setVerticalName] = useState("");
  const [extraDocumentType, setExtraDocumentType] = useState("");
  const [learningMessage, setLearningMessage] = useState("");
  const [approvalMessage, setApprovalMessage] = useState("");
  const [postingMessage, setPostingMessage] = useState("");
  const [isApprovingImport, setIsApprovingImport] = useState(false);
  const [isPostingReceipt, setIsPostingReceipt] = useState(false);
  const [firstTimeAnswers, setFirstTimeAnswers] = useState<Record<string, string>>({});
  const invoiceDocuments = documents.filter((document) => document.document_type === "commercial_invoice");
  const packingDocuments = documents.filter((document) => document.document_type === "packing_list");
  const awbDocuments = documents.filter((document) => document.document_type === "air_waybill");
  const [selectedInvoiceDocumentId, setSelectedInvoiceDocumentId] = useState("");
  const [selectedPackingDocumentId, setSelectedPackingDocumentId] = useState("");
  const [selectedAwbDocumentId, setSelectedAwbDocumentId] = useState("");
  const unknownProductCount =
    candidate?.lines.filter((line) => line.product_profile_status !== "known").length ?? 0;
  const knownProductCount =
    candidate?.lines.filter((line) => line.product_profile_status === "known").length ?? 0;
  const firstUnknownLine = candidate?.lines.find((line) => line.product_profile_status !== "known");
  const isImportApproved = candidate?.status === "validated";
  const canApproveImport = hasPermission(currentUser, "import_approval");
  const canPostReceipt = hasPermission(currentUser, "goods_receipt");
  const importApprovalRule = candidate
    ? securityOverview.approval_rules.find((rule) =>
        rule.is_active &&
        rule.process_name === "import_validation" &&
        matchesScopeValue(rule.country, candidate.destination_country) &&
        matchesScopeValue(rule.vertical, "All") &&
        matchesScopeValue(rule.material_code, "All"),
      )
    : null;

  useEffect(() => {
    if (!selectedInvoiceDocumentId && invoiceDocuments[0]) {
      setSelectedInvoiceDocumentId(invoiceDocuments[0].document_id);
    }
    if (!selectedPackingDocumentId && packingDocuments[0]) {
      setSelectedPackingDocumentId(packingDocuments[0].document_id);
    }
    if (!selectedAwbDocumentId && awbDocuments[0]) {
      setSelectedAwbDocumentId(awbDocuments[0].document_id);
    }
  }, [
    awbDocuments,
    invoiceDocuments,
    packingDocuments,
    selectedAwbDocumentId,
    selectedInvoiceDocumentId,
    selectedPackingDocumentId,
  ]);

  useEffect(() => {
    if (candidate?.supplier_name && !supplierName) {
      setSupplierName(candidate.supplier_name);
    }
  }, [candidate, supplierName]);

  function handleAssembleImport() {
    if (!selectedInvoiceDocumentId || !selectedPackingDocumentId) {
      setLearningMessage("Upload and select at least Commercial Invoice and Packing List.");
      return;
    }

    setLearningMessage("");
    onAssembleImport({
      commercial_invoice_document_id: selectedInvoiceDocumentId,
      packing_list_document_id: selectedPackingDocumentId,
      awb_document_id: selectedAwbDocumentId || null,
    });
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
      setLearningMessage("Country document rule saved from user input.");
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
    if (!isImportApproved) {
      setPostingMessage("Approve the import file before posting Goods Receipt.");
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
      setPostingMessage("Approval complete. Select warehouse and post Goods Receipt.");
    } catch (error) {
      setApprovalMessage(error instanceof Error ? error.message : "Could not approve import file.");
    } finally {
      setIsApprovingImport(false);
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
            <div className="document-picker-grid">
              <DocumentSelect
                documents={invoiceDocuments}
                emptyLabel="Upload commercial invoice first"
                label="Commercial invoice"
                onChange={setSelectedInvoiceDocumentId}
                value={selectedInvoiceDocumentId}
              />
              <DocumentSelect
                documents={packingDocuments}
                emptyLabel="Upload packing list first"
                label="Packing list"
                onChange={setSelectedPackingDocumentId}
                value={selectedPackingDocumentId}
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
              <SummaryItem label="Import File" value={candidate.import_file_number} />
              <SummaryItem label="Destination Entity" value={candidate.destination_entity} />
              <SummaryItem label="Country" value={candidate.destination_country} />
              <SummaryItem label="Invoice" value={candidate.invoice_number ?? "-"} />
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
            <div className={isImportApproved ? "validation-banner" : "validation-banner warning"}>
              <strong>Approval status</strong>
              <span>{candidate ? candidate.status.replace(/_/g, " ") : "Create import validation file"}</span>
            </div>
            <div className="validation-banner warning">
              <strong>Stock increase rule</strong>
              <span>Only after approval and Goods Receipt in destination warehouse</span>
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
            <button className="secondary-action" onClick={handleApproveImport} disabled={isApprovingImport || isImportApproved || !canApproveImport}>
              {isApprovingImport ? "Approving import file" : isImportApproved ? "Import approved" : "Approve import file"}
            </button>
            <p className="status-line">{approvalMessage}</p>
            <button className="primary-action" onClick={handlePostGoodsReceipt} disabled={isPostingReceipt || !isImportApproved || !canPostReceipt}>
              {isPostingReceipt ? "Posting Goods Receipt" : "Validate and post Goods Receipt"}
            </button>
            <p className="status-line">{postingMessage}</p>
          </div>
        </Panel>
      </section>

      <section className="content-grid">
        <Panel title="Country document learning" meta="Country + Vertical + Material">
          <div className="validation-stack">
            <div className="validation-banner">
              <strong>Destination country</strong>
              <span>{candidate?.destination_country ?? "Create import validation file"}</span>
            </div>
            <div className="validation-banner warning">
              <strong>Learned extra documents</strong>
              <span>No rule learned yet until the user enters and saves it</span>
            </div>
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
                <td colSpan={8}>Create the import validation file to review product lines.</td>
              </tr>
            ) : (
              candidate.lines.map((line) => (
                <tr key={`${line.item_code}-${line.batch_number}`}>
                  <td>{line.item_code}</td>
                  <td>{line.product_description}</td>
                  <td>{line.batch_number}</td>
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
  if (user.role_name === "Admin" || viewId === "dashboard" || viewId === "assistant") {
    return true;
  }

  const permissionByView: Record<string, string[]> = {
    documents: ["import_approval", "goods_receipt"],
    "import-validation": ["import_approval", "goods_receipt"],
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
  onSaveApprovalRule: (payload: ApiSaveApprovalRuleRequest) => Promise<void>;
  onSaveUser: (payload: ApiSaveSecurityUserRequest) => Promise<void>;
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

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
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
              <strong>{candidate.import_file_number}</strong>
              <span>
                {candidate.destination_country} / invoice {candidate.invoice_number ?? "-"}
              </span>
            </div>
            <StatusTag label={candidate.status.replace(/_/g, " ")} />
          </div>
          <div className="queue-row-meta">
            <span>{candidate.lines.length} line(s)</span>
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
