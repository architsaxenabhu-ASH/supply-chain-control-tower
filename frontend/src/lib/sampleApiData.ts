// Sample API fallback dataset (Phase 7B).
//
// The user asked for representative sample data in every tab. Rather than seed
// the backend, the single `getJson` helper falls back to these generators when an
// endpoint returns nothing — so every screen that reads a core entity (inventory,
// shipments, customers, imports, movements, audit, …) lights up with a coherent
// international medical-device dataset. Real backend data always takes precedence;
// these only fill in when the backend is empty.
//
// One internally consistent world: the same item codes, batches, warehouses,
// markets and customers appear across every list so cross-screen views line up.
// Monetary values are INR (the platform base) so the currency switcher converts.

import type {
  ApiApproval,
  ApiAuditEvent,
  ApiCountryPerformance,
  ApiCustomer,
  ApiDecision,
  ApiDispatch,
  ApiExecutiveAction,
  ApiGoodsReceipt,
  ApiImportFileCandidate,
  ApiInventoryBatch,
  ApiInventoryCount,
  ApiMovementEvent,
  ApiPerformanceScorecard,
  ApiProduct,
  ApiShipment,
  ApiWarehouseLocation,
} from "./api";

function isoDay(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function isoStamp(offsetMinutes: number): string {
  return new Date(Date.now() - offsetMinutes * 60_000).toISOString();
}

function pick<T>(values: T[], index: number): T {
  return values[index % values.length];
}

function expiryBucket(days: number): string {
  if (days < 0) return "Expired";
  if (days <= 30) return "0-30 days";
  if (days <= 60) return "31-60 days";
  if (days <= 90) return "61-90 days";
  return "90+ days";
}

// ---- Reference dimensions --------------------------------------------------

type ProductDef = { code: string; description: string; category: string; uom: string; shelf: number; unit: number };

const PRODUCTS: ProductDef[] = [
  { code: "MRL-CARD-STENT-001", description: "Drug-Eluting Coronary Stent", category: "Cardiology", uom: "EA", shelf: 36, unit: 45000 },
  { code: "MRL-CARD-BALLOON-002", description: "Coronary Balloon Catheter", category: "Cardiology", uom: "EA", shelf: 30, unit: 18000 },
  { code: "MRL-VASC-GRAFT-010", description: "Vascular Graft", category: "Vascular", uom: "EA", shelf: 48, unit: 60000 },
  { code: "MRL-ORTH-KNEE-020", description: "Total Knee Implant System", category: "Orthopedics", uom: "EA", shelf: 60, unit: 220000 },
  { code: "MRL-ORTH-SCREW-021", description: "Orthopedic Bone Screw", category: "Orthopedics", uom: "EA", shelf: 60, unit: 3500 },
  { code: "MRL-ENDO-STAPLER-030", description: "Endoscopic Linear Stapler", category: "Endosurgery", uom: "EA", shelf: 36, unit: 28000 },
  { code: "MRL-DIAG-KIT-040", description: "IVD Diagnostic Kit", category: "Diagnostics", uom: "BOX", shelf: 18, unit: 9000 },
  { code: "MRL-DIAG-REAGENT-041", description: "Diagnostic Reagent Pack", category: "Diagnostics", uom: "BOX", shelf: 12, unit: 6000 },
];

type MarketDef = { country: string; city: string; whCode: string; whName: string; entity: string; carrier: string };

const MARKETS: MarketDef[] = [
  { country: "Germany", city: "Frankfurt", whCode: "DE-FRA-01", whName: "Frankfurt DC", entity: "Meril Germany GmbH", carrier: "Lufthansa Cargo" },
  { country: "United Arab Emirates", city: "Dubai", whCode: "AE-DXB-01", whName: "Dubai DC", entity: "Meril Middle East FZE", carrier: "Emirates SkyCargo" },
  { country: "Italy", city: "Milan", whCode: "IT-MIL-01", whName: "Milan DC", entity: "Meril Italy S.r.l.", carrier: "Lufthansa Cargo" },
  { country: "United States of America", city: "New York", whCode: "US-NYC-01", whName: "New York DC", entity: "Meril Life Sciences USA Inc.", carrier: "Maersk" },
  { country: "Brazil", city: "São Paulo", whCode: "BR-SAO-01", whName: "São Paulo DC", entity: "Meril Brazil Ltda.", carrier: "Maersk" },
  { country: "France", city: "Paris", whCode: "FR-PAR-01", whName: "Paris DC", entity: "Meril France SAS", carrier: "Air France Cargo" },
  { country: "Saudi Arabia", city: "Riyadh", whCode: "SA-RUH-01", whName: "Riyadh DC", entity: "Meril Saudi LLC", carrier: "Qatar Airways Cargo" },
  { country: "Japan", city: "Tokyo", whCode: "JP-TYO-01", whName: "Tokyo DC", entity: "Meril Japan K.K.", carrier: "ANA Cargo" },
  { country: "Turkey", city: "Istanbul", whCode: "TR-IST-01", whName: "Istanbul DC", entity: "Meril Turkey", carrier: "Turkish Cargo" },
  { country: "Poland", city: "Warsaw", whCode: "PL-WAW-01", whName: "Warsaw DC", entity: "Meril Poland Sp. z o.o.", carrier: "Lufthansa Cargo" },
];

type CustomerDef = { code: string; name: string; country: string; city: string; type: string; contact: string };

const CUSTOMERS_DEF: CustomerDef[] = [
  { code: "CUST-DE-01", name: "Charité Klinik", country: "Germany", city: "Berlin", type: "Hospital", contact: "Dr. M. Wagner" },
  { code: "CUST-AE-01", name: "NMC Healthcare", country: "United Arab Emirates", city: "Dubai", type: "Hospital Group", contact: "A. Khan" },
  { code: "CUST-IT-01", name: "Humanitas", country: "Italy", city: "Milan", type: "Hospital", contact: "Dr. L. Rossi" },
  { code: "CUST-US-01", name: "Mercy Health", country: "United States of America", city: "New York", type: "Hospital Network", contact: "J. Carter" },
  { code: "CUST-BR-01", name: "Hospital Albert Einstein", country: "Brazil", city: "São Paulo", type: "Hospital", contact: "Dr. P. Souza" },
  { code: "CUST-SA-01", name: "Dr. Sulaiman Al Habib", country: "Saudi Arabia", city: "Riyadh", type: "Hospital Group", contact: "M. Al Otaibi" },
  { code: "CUST-FR-01", name: "AP-HP Paris", country: "France", city: "Paris", type: "Hospital Network", contact: "Dr. C. Bernard" },
  { code: "CUST-TR-01", name: "Acıbadem", country: "Turkey", city: "Istanbul", type: "Hospital Group", contact: "E. Yılmaz" },
  { code: "CUST-JP-01", name: "St. Luke's Tokyo", country: "Japan", city: "Tokyo", type: "Hospital", contact: "Dr. K. Sato" },
  { code: "CUST-GB-01", name: "Guy's & St Thomas'", country: "United Kingdom", city: "London", type: "NHS Trust", contact: "Dr. R. Patel" },
];

const ORIGIN_SUPPLIER = "Meril Life Sciences (India)";

// ---- Generators ------------------------------------------------------------

function products(): ApiProduct[] {
  return PRODUCTS.map((product) => ({
    item_code: product.code,
    product_description: product.description,
    product_category: product.category,
    uom: product.uom,
    product_status: "active",
    shelf_life_months: product.shelf,
  }));
}

function warehouses(): ApiWarehouseLocation[] {
  return MARKETS.map((market) => ({
    warehouse_code: market.whCode,
    warehouse_name: market.whName,
    country: market.country,
    is_active: true,
  }));
}

const EXPIRY_OFFSETS = [-18, 22, 49, 77, 118, 205, 318, 402];

function batchNumber(market: MarketDef, slot: number): string {
  return `B${market.whCode}-${1000 + slot}`;
}

function batches(): ApiInventoryBatch[] {
  const rows: ApiInventoryBatch[] = [];
  MARKETS.forEach((market, i) => {
    const picks = [pick(PRODUCTS, i), pick(PRODUCTS, i + 2), pick(PRODUCTS, i + 5)];
    picks.forEach((product, j) => {
      const days = EXPIRY_OFFSETS[(i * 3 + j) % EXPIRY_OFFSETS.length];
      const quantity = 200 + ((i * 7 + j * 53) % 26) * 100;
      rows.push({
        item_code: product.code,
        product_description: product.description,
        product_category: product.category,
        batch_number: batchNumber(market, i * 3 + j),
        warehouse_location: market.whName,
        quantity_available: quantity,
        manufacturing_date: isoDay(days - product.shelf * 30),
        expiry_date: isoDay(days),
        unit_value: product.unit,
        inventory_value: quantity * product.unit,
        days_to_expiry: days,
        expiry_bucket: expiryBucket(days),
        currency: "INR",
        registered_date: isoDay(days - product.shelf * 30 + 10),
      });
    });
  });
  return rows;
}

const SHIPMENT_STATUSES: ApiShipment["status"][] = [
  "submitted",
  "approved",
  "dispatched",
  "delivered",
  "approved",
  "dispatched",
  "delivered",
  "submitted",
  "approved",
  "dispatched",
];

function shipments(): ApiShipment[] {
  return CUSTOMERS_DEF.map((customer, i) => {
    const market = MARKETS.find((m) => m.country === customer.country) ?? MARKETS[i % MARKETS.length];
    const product = pick(PRODUCTS, i);
    const quantity = 50 + (i % 6) * 25;
    const status = SHIPMENT_STATUSES[i % SHIPMENT_STATUSES.length];
    const shipmentId = `SHP-${1001 + i}`;
    return {
      shipment_id: shipmentId,
      request_date: isoDay(-(i + 2)),
      requestor_name: `Sales ${customer.country}`,
      customer_name: customer.name,
      destination_country: customer.country,
      city: customer.city,
      priority: i % 4 === 0 ? "urgent" : "normal",
      required_delivery_date: isoDay(7 + i),
      status,
      lines: [
        {
          shipment_id: shipmentId,
          item_code: product.code,
          batch_number: batchNumber(market, i * 3),
          warehouse_location: market.whName,
          quantity_requested: quantity,
          quantity_approved: status === "submitted" ? 0 : quantity,
        },
      ],
    };
  });
}

function dispatches(): ApiDispatch[] {
  const couriers = ["DHL Express", "FedEx", "Aramex", "Maersk"];
  return shipments()
    .filter((shipment) => shipment.status === "dispatched" || shipment.status === "delivered")
    .map((shipment, i) => ({
      dispatch_number: `DSP-${5001 + i}`,
      shipment_id: shipment.shipment_id,
      dispatch_date: isoDay(-(i + 1)),
      transporter_courier: pick(couriers, i),
      tracking_number: `TRK${100000 + i}`,
      dispatched_by: "Logistics",
      status: shipment.status === "delivered" ? "delivered" : "in_transit",
    }));
}

function goodsReceipts(): ApiGoodsReceipt[] {
  return MARKETS.slice(0, 8).map((market, i) => {
    const product = pick(PRODUCTS, i);
    return {
      grn_number: `GRN-${7001 + i}`,
      receipt_date: isoDay(-(i + 1)),
      warehouse: market.whName,
      supplier: ORIGIN_SUPPLIER,
      status: "posted",
      lines: [
        {
          item_code: product.code,
          batch_number: batchNumber(market, i * 3),
          quantity_received: 500 + (i % 5) * 100,
          expiry_date: isoDay(300 + i * 10),
          unit_value: product.unit,
        },
      ],
    };
  });
}

function inventoryCounts(): ApiInventoryCount[] {
  return MARKETS.slice(0, 5).map((market, i) => {
    const product = pick(PRODUCTS, i);
    const variance = (i % 3) * 5;
    return {
      inventory_count_id: `CNT-${8001 + i}`,
      count_date: isoDay(-(i * 3 + 2)),
      warehouse: market.whName,
      status: i % 2 === 0 ? "completed" : "in_progress",
      lines: [
        {
          item_code: product.code,
          batch_number: batchNumber(market, i * 3),
          system_quantity: 1000,
          physical_quantity: 1000 - variance,
          variance_quantity: -variance,
          variance_type: variance === 0 ? "match" : "shortage",
        },
      ],
    };
  });
}

function customers(): ApiCustomer[] {
  return CUSTOMERS_DEF.map((customer) => ({
    customer_code: customer.code,
    customer_name: customer.name,
    country: customer.country,
    city: customer.city,
    customer_type: customer.type,
    contact_person: customer.contact,
  }));
}

const IMPORT_STATUSES = [
  "in_transit",
  "customs",
  "arrived",
  "in_transit",
  "delayed",
  "in_transit",
  "arrived",
  "customs",
  "in_transit",
  "arrived",
];

function imports(): ApiImportFileCandidate[] {
  return MARKETS.map((market, i) => {
    const product = pick(PRODUCTS, i);
    const product2 = pick(PRODUCTS, i + 3);
    const shipmentNumber = String(361 + i);
    const invoice = `INV-${90000 + i}`;
    return {
      import_file_number: `IMP-${market.whCode}-${3001 + i}`,
      shipment_name: `${market.country.toUpperCase()}-${product.category.toUpperCase()}-${shipmentNumber}`,
      shipment_vertical: product.category,
      shipment_number: shipmentNumber,
      supplier_name: ORIGIN_SUPPLIER,
      destination_entity: market.entity,
      destination_country: market.country,
      status: IMPORT_STATUSES[i % IMPORT_STATUSES.length],
      invoice_number: invoice,
      invoice_date: isoDay(-(i + 5)),
      awb_number: `AWB-${157 + i}-${1000 + i}`,
      origin_country: "India",
      carrier_name: market.carrier,
      flight_number: `MR${200 + i}`,
      flight_date: isoDay(-(i + 2)),
      package_count: 10 + i,
      gross_weight_kg: 500 + i * 30,
      chargeable_weight_kg: 520 + i * 30,
      source_document_ids: [],
      invoice_numbers: [invoice],
      commercial_invoice_document_ids: [],
      packing_list_document_ids: [],
      awb_document_id: null,
      extraction_warnings: [],
      lines: [
        {
          item_code: product.code,
          product_description: product.description,
          batch_number: batchNumber(market, i * 3),
          serial_number: null,
          expiry_date: isoDay(300 + i * 9),
          quantity: 300 + (i % 5) * 50,
          uom: product.uom,
          unit_value: product.unit,
          currency: "INR",
          product_profile_status: "known",
        },
        {
          item_code: product2.code,
          product_description: product2.description,
          batch_number: batchNumber(market, i * 3 + 1),
          serial_number: null,
          expiry_date: isoDay(320 + i * 9),
          quantity: 150 + (i % 4) * 40,
          uom: product2.uom,
          unit_value: product2.unit,
          currency: "INR",
          product_profile_status: "known",
        },
      ],
    };
  });
}

function movements(): ApiMovementEvent[] {
  const rows: ApiMovementEvent[] = [];
  let id = 1;
  MARKETS.forEach((market, i) => {
    const product = pick(PRODUCTS, i);
    rows.push({
      event_id: `MV-${id++}`,
      event_type: "received",
      item_code: product.code,
      batch_number: batchNumber(market, i * 3),
      serial_number: null,
      quantity: 500 + (i % 5) * 100,
      warehouse: market.whName,
      location: market.city,
      counterparty: ORIGIN_SUPPLIER,
      reference: `GRN-${7001 + i}`,
      actor: `WH ${market.city}`,
      occurred_at: isoStamp(i * 37 + 10),
      note: null,
    });
    rows.push({
      event_id: `MV-${id++}`,
      event_type: "dispatched",
      item_code: product.code,
      batch_number: batchNumber(market, i * 3),
      serial_number: null,
      quantity: 50 + (i % 6) * 20,
      warehouse: market.whName,
      location: market.city,
      counterparty: pick(CUSTOMERS_DEF, i).name,
      reference: `SHP-${1001 + i}`,
      actor: "Logistics",
      occurred_at: isoStamp(i * 53 + 25),
      note: null,
    });
  });
  return rows;
}

type AuditSeed = { action: string; module: string; entity: string; id: string; actor: string; reason: string | null };

const AUDIT_SEEDS: AuditSeed[] = [
  { action: "approve", module: "imports", entity: "import_candidate", id: "IMP-DE-FRA-01-3001", actor: "k.rao@meril.com", reason: "Documents complete" },
  { action: "post_goods_receipt", module: "goods_receipt", entity: "grn", id: "GRN-7001", actor: "wh.frankfurt@meril.com", reason: null },
  { action: "dispatch", module: "shipments", entity: "shipment", id: "SHP-1003", actor: "logistics.de@meril.com", reason: null },
  { action: "deliver", module: "shipments", entity: "shipment", id: "SHP-1004", actor: "logistics.it@meril.com", reason: null },
  { action: "create", module: "customers", entity: "customer", id: "CUST-AE-01", actor: "sales.ae@meril.com", reason: null },
  { action: "record_payment", module: "receivables", entity: "invoice", id: "INV-90004", actor: "finance@meril.com", reason: "Payment received" },
  { action: "override", module: "currency", entity: "rate_set", id: "EUR/INR", actor: "treasury@meril.com", reason: "Daily ECB lock" },
  { action: "approve", module: "shipments", entity: "shipment", id: "SHP-1002", actor: "country.mgr.ae@meril.com", reason: "Stock confirmed" },
  { action: "complete_review", module: "reviews", entity: "country_review", id: "Germany", actor: "regional.eu@meril.com", reason: null },
  { action: "record_decision", module: "decisions", entity: "decision", id: "DEC-2041", actor: "gm@meril.com", reason: "Expedite Brazil restock" },
  { action: "count", module: "inventory_count", entity: "count", id: "CNT-8001", actor: "wh.frankfurt@meril.com", reason: null },
  { action: "flag_expiry", module: "inventory", entity: "batch", id: "BBR-SAO-01-1012", actor: "quality@meril.com", reason: "Within 90 days" },
  { action: "approve", module: "imports", entity: "import_candidate", id: "IMP-US-NYC-01-3004", actor: "k.rao@meril.com", reason: "Sea freight cleared" },
  { action: "dispatch", module: "shipments", entity: "shipment", id: "SHP-1006", actor: "logistics.us@meril.com", reason: null },
  { action: "create", module: "commitments", entity: "commitment", id: "PO-DE-7781", actor: "sales.de@meril.com", reason: "Q3 framework order" },
  { action: "post_goods_receipt", module: "goods_receipt", entity: "grn", id: "GRN-7003", actor: "wh.milan@meril.com", reason: null },
];

function audit(): ApiAuditEvent[] {
  return AUDIT_SEEDS.map((seed, i) => ({
    id: AUDIT_SEEDS.length - i,
    action: seed.action,
    module_name: seed.module,
    entity_name: seed.entity,
    entity_id: seed.id,
    actor: seed.actor,
    reason: seed.reason,
    old_value: null,
    new_value: null,
    created_at: isoStamp(i * 11 + 3),
  }));
}

// ---- Management & My Work (computed list endpoints) ------------------------

function executiveActions(): ApiExecutiveAction[] {
  return [
    { action_type: "expedite", severity: "high", reference: "IMP-BR-SAO-01-3005", title: "Brazil shipment delayed", detail: "BRAZIL-CARDIOLOGY-0365 is 2 days past ETA at customs.", source: "Primary Sales" },
    { action_type: "expiry", severity: "high", reference: "BBR-SAO-01-1012", title: "Expiry risk in São Paulo", detail: "2,100 units within 90 days — prioritise allocation.", source: "Inventory" },
    { action_type: "approve", severity: "medium", reference: "SHP-1001", title: "Shipment awaiting approval", detail: "Charité Klinik order pending country approval.", source: "Secondary Sales" },
    { action_type: "commitment", severity: "medium", reference: "PO-SA-7790", title: "Open PO due in 15 days", detail: "Dr. Sulaiman Al Habib commitment needs allocation.", source: "Secondary Sales" },
    { action_type: "customs", severity: "medium", reference: "IMP-AE-DXB-01-3002", title: "At customs over 5 days", detail: "UAE-VASCULAR-0362 held at Dubai customs.", source: "Primary Sales" },
    { action_type: "review", severity: "low", reference: "Germany", title: "Country review due", detail: "Germany quarterly review not yet signed off.", source: "Governance" },
  ];
}

function approvals(): ApiApproval[] {
  return [
    { approval_id: "APR-9001", approval_type: "shipment", reference: "SHP-1001", requestor: "sales.de@meril.com", request_date: isoDay(-2), approver: null, approval_date: null, reason: null, outcome: "pending", note: "Charité Klinik — 75 units" },
    { approval_id: "APR-9002", approval_type: "import", reference: "IMP-AE-DXB-01-3002", requestor: "k.rao@meril.com", request_date: isoDay(-1), approver: null, approval_date: null, reason: null, outcome: "pending", note: "UAE inbound, customs cleared" },
    { approval_id: "APR-9003", approval_type: "shipment", reference: "SHP-1008", requestor: "sales.jp@meril.com", request_date: isoDay(-1), approver: null, approval_date: null, reason: null, outcome: "pending", note: "St. Luke's Tokyo" },
    { approval_id: "APR-9004", approval_type: "inventory_adjustment", reference: "CNT-8001", requestor: "wh.frankfurt@meril.com", request_date: isoDay(-3), approver: "country.mgr.de@meril.com", approval_date: isoDay(-2), reason: "Count variance accepted", outcome: "approved", note: null },
    { approval_id: "APR-9005", approval_type: "import", reference: "IMP-US-NYC-01-3004", requestor: "k.rao@meril.com", request_date: isoDay(-4), approver: "country.mgr.us@meril.com", approval_date: isoDay(-3), reason: "Documents verified", outcome: "approved", note: null },
  ];
}

function decisions(): ApiDecision[] {
  return [
    { decision_id: "DEC-2041", decision_type: "expedite", reason: "Expedite Brazil restock to avoid stockout", user: "gm@meril.com", role: "General Manager", problem_type: "supply_risk", owner: "Supply Chain", context: "Brazil cardiology demand up 18%", options_considered: ["Air freight", "Reallocate from USA", "Wait for sea shipment"], decided_at: isoStamp(160), related_product: "MRL-CARD-STENT-001", related_batch: null, related_shipment: null, related_customer: null, related_supplier: null, expected_outcome: "Avoid stockout in 2 weeks", actual_outcome: null, effectiveness: null, status: "open" },
    { decision_id: "DEC-2039", decision_type: "allocation", reason: "Reserve Dubai stock for NMC Q3 commitment", user: "country.mgr.ae@meril.com", role: "Country Manager", problem_type: "allocation", owner: "Sales AE", context: "Large framework order", options_considered: ["Reserve now", "Wait for PO"], decided_at: isoStamp(1500), related_product: "MRL-VASC-GRAFT-010", related_batch: null, related_shipment: null, related_customer: "NMC Healthcare", related_supplier: null, expected_outcome: "Secure the order", actual_outcome: "Order won", effectiveness: "effective", status: "closed" },
    { decision_id: "DEC-2036", decision_type: "expiry", reason: "Discount near-expiry São Paulo stock to local distributors", user: "country.mgr.br@meril.com", role: "Country Manager", problem_type: "expiry", owner: "Sales BR", context: "2,100 units within 90 days", options_considered: ["Discount", "Return to hub", "Write off"], decided_at: isoStamp(3000), related_product: "MRL-DIAG-KIT-040", related_batch: "BBR-SAO-01-1012", related_shipment: null, related_customer: null, related_supplier: null, expected_outcome: "Recover value", actual_outcome: null, effectiveness: null, status: "open" },
  ];
}

function performanceRow(scope: string, name: string, actual: number, achievement: number, growth: number): ApiCountryPerformance {
  const target = Math.round(actual / (achievement / 100));
  const actualQty = Math.round(actual / 4200);
  const targetQty = Math.round(target / 4200);
  return {
    scope,
    name,
    target_value: target,
    actual_value: actual,
    value_achievement_pct: achievement,
    target_quantity: targetQty,
    actual_quantity: actualQty,
    quantity_achievement_pct: achievement,
    growth_pct: growth,
    diagnostics: {},
  };
}

const COUNTRY_PERF: [string, number, number, number][] = [
  ["Germany", 96_000_000, 108, 14],
  ["United States of America", 84_000_000, 96, 11],
  ["United Arab Emirates", 71_000_000, 104, 16],
  ["Italy", 58_000_000, 97, 9],
  ["Brazil", 47_000_000, 88, 6],
  ["Saudi Arabia", 43_000_000, 101, 12],
  ["France", 39_000_000, 94, 7],
  ["Japan", 34_000_000, 91, 5],
  ["Turkey", 31_000_000, 99, 13],
  ["United Kingdom", 27_000_000, 86, 4],
];

function countryPerformance(): ApiCountryPerformance[] {
  return COUNTRY_PERF.map(([name, actual, achievement, growth]) => performanceRow("country", name, actual, achievement, growth));
}

const VERTICAL_PERF: [string, number, number, number][] = [
  ["Cardiology", 168_000_000, 103, 13],
  ["Vascular", 112_000_000, 98, 10],
  ["Orthopedics", 96_000_000, 95, 8],
  ["Endosurgery", 71_000_000, 101, 12],
  ["Diagnostics", 53_000_000, 92, 6],
];

function verticalPerformance(): ApiPerformanceScorecard[] {
  return VERTICAL_PERF.map(([name, actual, achievement, growth]) => performanceRow("vertical", name, actual, achievement, growth));
}

function knownCountries(): string[] {
  const set = new Set<string>(["India", ...MARKETS.map((m) => m.country), ...CUSTOMERS_DEF.map((c) => c.country)]);
  return [...set].sort();
}

/** Path (without query string) → sample data factory. Consumed by `getJson`. */
export const SAMPLE_API_FALLBACKS: Record<string, () => unknown> = {
  "/executive-actions": executiveActions,
  "/approvals": approvals,
  "/decisions": decisions,
  "/country-performance-v2": countryPerformance,
  "/vertical-performance": verticalPerformance,
  "/reference/countries": knownCountries,
  "/products": products,
  "/inventory/batches": batches,
  "/shipments": shipments,
  "/dispatches": dispatches,
  "/goods-receipts": goodsReceipts,
  "/inventory-counts": inventoryCounts,
  "/customers": customers,
  "/imports": imports,
  "/warehouses": warehouses,
  "/movements": movements,
  "/audit": audit,
};
