import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  Bot,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileUp,
  FileSpreadsheet,
  Package,
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
  askAssistant,
  fetchCustomers,
  fetchDashboardSummary,
  fetchDispatches,
  fetchGoodsReceipts,
  fetchInventoryBatches,
  fetchInventoryCounts,
  fetchProducts,
  fetchShipments,
  fetchWarehouses,
  getExtractionMaster,
  listDocuments,
  postImportGoodsReceipt,
  saveCountryDocumentRequirement,
  saveProductFreeTextProfile,
  saveWarehouseCandidate,
  uploadDocument,
} from "../lib/api";
import type {
  ApiCustomer,
  ApiDispatch,
  ApiGoodsReceipt,
  ApiImportApprovalRequest,
  ApiImportAssemblyRequest,
  ApiImportGoodsReceiptPostRequest,
  ApiInventoryBatch,
  ApiInventoryCount,
  ApiImportFileCandidate,
  ApiProduct,
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

type Shipment = {
  shipmentId: string;
  requestDate: string;
  requestor: string;
  customer: string;
  destination: string;
  priority: "Normal" | "Urgent";
  requiredDate: string;
  status: "Draft" | "Submitted" | "Approved" | "Dispatched" | "Delivered" | "Cancelled";
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

const roles = [
  ["Admin", "Full access"],
  ["Warehouse Executive", "Receipt, dispatch, counts"],
  ["Warehouse Manager", "Approval and reconciliation"],
  ["Country Incharge", "Import validation approval"],
  ["Sales User", "Shipment requests"],
  ["Finance User", "Inventory value and exports"],
  ["QA User", "Expiry and batch review"],
];

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

const toTitleCase = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

function getDateStamp() {
  return new Date().toISOString().slice(0, 10);
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
  counts,
  customers,
  dispatches,
  documents,
  filteredInventory,
  filteredProducts,
  importCandidate,
  receipts,
  shipments,
}: {
  activeView: string;
  counts: CountLine[];
  customers: Customer[];
  dispatches: Dispatch[];
  documents: DocumentRecord[];
  filteredInventory: InventoryBatch[];
  filteredProducts: Product[];
  importCandidate: ApiImportFileCandidate | null;
  receipts: Receipt[];
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
    return shipments.map((shipment) => ({ ...shipment }));
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

export function App() {
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
        ] = await Promise.all([
          fetchProducts(),
          fetchInventoryBatches(),
          fetchShipments(),
          fetchDispatches(),
          fetchGoodsReceipts(),
          fetchInventoryCounts(),
          fetchCustomers(),
          fetchDashboardSummary(),
        ]);

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
      setImportCandidate(candidate);
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
    setInventory(apiInventory.map(mapInventoryBatch));
    setReceipts(flattenReceipts(apiReceipts));
    setImportCandidate((current) => current ? { ...current, status: "received" } : current);
    setApiStatus(`Connected to backend / ${formatCurrency(apiSummary.total_inventory_value)}`);
    return result.message;
  }

  async function handleApproveImportCandidate(payload: ApiImportApprovalRequest) {
    const approvedCandidate = await approveImportCandidate(payload);
    setImportCandidate(approvedCandidate);
    setApiStatus(`Connected to backend / ${approvedCandidate.import_file_number} approved`);
    return `Import file approved by ${payload.approved_by}. Goods Receipt is now allowed.`;
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
    [search],
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

  function handleExportActiveView() {
    const rows = getExportRows({
      activeView,
      counts,
      customers,
      dispatches,
      documents,
      filteredInventory,
      filteredProducts,
      importCandidate,
      receipts,
      shipments,
    });

    if (rows.length === 0) {
      setApiStatus(`No export data for ${activeNav.label}`);
      return;
    }

    downloadCsv(`${activeView}-${getDateStamp()}.csv`, rows);
    setApiStatus(`Exported ${rows.length} row(s) from ${activeNav.label}`);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">WH</div>
          <div>
            <strong>Warehouse Control</strong>
            <span>Healthcare SCM</span>
          </div>
        </div>
        <nav className="nav-list" aria-label="Primary navigation">
          {navItems.map((item) => (
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
            <button className="secondary-action" onClick={handleExportActiveView}>
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
            inventory={inventory}
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
            destinationWarehouses={destinationWarehouses}
            documents={documents}
            importMessage={importMessage}
            newWarehouseName={newWarehouseName}
            onApproveImport={handleApproveImportCandidate}
            onAssembleImport={handleAssembleImportFromDocuments}
            onNewWarehouseNameChange={setNewWarehouseName}
            onPostGoodsReceipt={handlePostImportGoodsReceipt}
            onSelectedWarehouseChange={setSelectedWarehouse}
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
        {activeView === "shipments" ? <ShipmentsView shipments={shipments} /> : null}
        {activeView === "dispatches" ? <DispatchesView dispatches={dispatches} /> : null}
        {activeView === "receipts" ? <ReceiptsView receipts={receipts} /> : null}
        {activeView === "counts" ? <CountsView counts={counts} /> : null}
        {activeView === "expiry" ? <ExpiryView inventory={inventory} /> : null}
        {activeView === "customers" ? <CustomersView customers={customers} /> : null}
        {activeView === "security" ? <SecurityView /> : null}
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
  inventory,
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
  inventory: InventoryBatch[];
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

  return (
    <>
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
        <Panel title="Open shipment requests" meta="Status">
          <ShipmentTable rows={shipments} compact />
        </Panel>
      </section>
    </>
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
  destinationWarehouses,
  documents,
  importMessage,
  newWarehouseName,
  onApproveImport,
  onAssembleImport,
  onNewWarehouseNameChange,
  onPostGoodsReceipt,
  onSelectedWarehouseChange,
  selectedWarehouse,
}: {
  candidate: ApiImportFileCandidate | null;
  destinationWarehouses: ApiWarehouseLocation[];
  documents: DocumentRecord[];
  importMessage: string;
  newWarehouseName: string;
  onApproveImport: (payload: ApiImportApprovalRequest) => Promise<string>;
  onAssembleImport: (payload: ApiImportAssemblyRequest) => void;
  onNewWarehouseNameChange: (value: string) => void;
  onPostGoodsReceipt: (payload: ApiImportGoodsReceiptPostRequest) => Promise<string>;
  onSelectedWarehouseChange: (value: string) => void;
  selectedWarehouse: string;
}) {
  const [actorName, setActorName] = useState("");
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
      setLearningMessage("Enter your name and warehouse name before saving.");
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
      setLearningMessage("Enter your name, vertical, material, and required document type.");
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
      setLearningMessage("Enter your name and load an import line that needs first-time questions.");
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
      setPostingMessage("Enter validator name before posting Goods Receipt.");
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
      setApprovalMessage("Enter Country Incharge name before approval.");
      return;
    }

    setIsApprovingImport(true);
    setApprovalMessage("Approving import validation file...");
    try {
      const message = await onApproveImport({
        candidate,
        approved_by: actorName,
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
              <span>User / approver name</span>
              <input
                placeholder="Enter user name for audit trail"
                value={actorName}
                onChange={(event) => setActorName(event.target.value)}
              />
            </label>
            <div className="validation-banner">
              <strong>Approver</strong>
              <span>Country Incharge</span>
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
            <button className="secondary-action" onClick={handleApproveImport} disabled={isApprovingImport || isImportApproved}>
              {isApprovingImport ? "Approving import file" : isImportApproved ? "Import approved" : "Approve import file"}
            </button>
            <p className="status-line">{approvalMessage}</p>
            <button className="primary-action" onClick={handlePostGoodsReceipt} disabled={isPostingReceipt || !isImportApproved}>
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

function ShipmentsView({ shipments }: { shipments: Shipment[] }) {
  return (
    <Panel title="Shipment requests" meta="Approval workflow">
      <ShipmentTable rows={shipments} />
    </Panel>
  );
}

function DispatchesView({ dispatches }: { dispatches: Dispatch[] }) {
  return (
    <Panel title="Dispatch history" meta="Inventory reducing transaction">
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

function SecurityView() {
  return (
    <section className="role-grid">
      {roles.map(([role, access]) => (
        <article className="role-card" key={role}>
          <ShieldCheck size={22} aria-hidden="true" />
          <strong>{role}</strong>
          <span>{access}</span>
        </article>
      ))}
    </section>
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

function ShipmentTable({ rows, compact = false }: { rows: Shipment[]; compact?: boolean }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Shipment ID</th>
          <th>Customer</th>
          {!compact ? <th>Destination</th> : null}
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
