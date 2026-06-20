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
  ApiCustomerCommitment,
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

// Seeded (deterministic) randomness for injected rows. The demo regenerates the
// injected lists from the shared counters on every device, so generation must be
// a pure function of the row's number — otherwise lists would reshuffle on each
// refresh and differ device-to-device.
function seeded(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function seedInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function seedItem<T>(rng: () => number, values: T[]): T {
  return values[Math.floor(rng() * values.length)] ?? values[0];
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
  { code: "NW-CARD-STENT-001", description: "Drug-Eluting Coronary Stent", category: "Cardiology", uom: "EA", shelf: 36, unit: 45000 },
  { code: "NW-CARD-BALLOON-002", description: "Coronary Balloon Catheter", category: "Cardiology", uom: "EA", shelf: 30, unit: 18000 },
  { code: "NW-VASC-GRAFT-010", description: "Vascular Graft", category: "Vascular", uom: "EA", shelf: 48, unit: 60000 },
  { code: "NW-ORTH-KNEE-020", description: "Total Knee Implant System", category: "Orthopedics", uom: "EA", shelf: 60, unit: 220000 },
  { code: "NW-ORTH-SCREW-021", description: "Orthopedic Bone Screw", category: "Orthopedics", uom: "EA", shelf: 60, unit: 3500 },
  { code: "NW-ENDO-STAPLER-030", description: "Endoscopic Linear Stapler", category: "Endosurgery", uom: "EA", shelf: 36, unit: 28000 },
  { code: "NW-DIAG-KIT-040", description: "IVD Diagnostic Kit", category: "Diagnostics", uom: "BOX", shelf: 18, unit: 9000 },
  { code: "NW-DIAG-REAGENT-041", description: "Diagnostic Reagent Pack", category: "Diagnostics", uom: "BOX", shelf: 12, unit: 6000 },
];

type MarketDef = { country: string; city: string; whCode: string; whName: string; entity: string; carrier: string };

const MARKETS: MarketDef[] = [
  { country: "Germany", city: "Frankfurt", whCode: "DE-FRA-01", whName: "Frankfurt DC", entity: "Northwind Germany GmbH", carrier: "Skyline Air Cargo" },
  { country: "United Arab Emirates", city: "Dubai", whCode: "AE-DXB-01", whName: "Dubai DC", entity: "Northwind Gulf FZE", carrier: "Gulf Air Freight" },
  { country: "Italy", city: "Milan", whCode: "IT-MIL-01", whName: "Milan DC", entity: "Northwind Italy S.r.l.", carrier: "Skyline Air Cargo" },
  { country: "United States of America", city: "New York", whCode: "US-NYC-01", whName: "New York DC", entity: "Northwind USA Inc.", carrier: "Atlantic Sea Lines" },
  { country: "Brazil", city: "São Paulo", whCode: "BR-SAO-01", whName: "São Paulo DC", entity: "Northwind Brazil Ltda.", carrier: "Atlantic Sea Lines" },
  { country: "France", city: "Paris", whCode: "FR-PAR-01", whName: "Paris DC", entity: "Northwind France SAS", carrier: "Continental Air Cargo" },
  { country: "Saudi Arabia", city: "Riyadh", whCode: "SA-RUH-01", whName: "Riyadh DC", entity: "Northwind Saudi LLC", carrier: "Gulf Air Freight" },
  { country: "Japan", city: "Tokyo", whCode: "JP-TYO-01", whName: "Tokyo DC", entity: "Northwind Japan K.K.", carrier: "Pacific Air Cargo" },
  { country: "Turkey", city: "Istanbul", whCode: "TR-IST-01", whName: "Istanbul DC", entity: "Northwind Türkiye", carrier: "Meridian Air Cargo" },
  { country: "Poland", city: "Warsaw", whCode: "PL-WAW-01", whName: "Warsaw DC", entity: "Northwind Poland Sp. z o.o.", carrier: "Skyline Air Cargo" },
];

type CustomerDef = { code: string; name: string; country: string; city: string; type: string; contact: string };

const CUSTOMERS_DEF: CustomerDef[] = [
  { code: "CUST-DE-01", name: "Berlin Mitte Klinikum", country: "Germany", city: "Berlin", type: "Hospital", contact: "Dr. M. Wagner" },
  { code: "CUST-AE-01", name: "Gulf Medical Centre", country: "United Arab Emirates", city: "Dubai", type: "Hospital Group", contact: "A. Khan" },
  { code: "CUST-IT-01", name: "Milano Salute", country: "Italy", city: "Milan", type: "Hospital", contact: "Dr. L. Rossi" },
  { code: "CUST-US-01", name: "Hudson Health Network", country: "United States of America", city: "New York", type: "Hospital Network", contact: "J. Carter" },
  { code: "CUST-BR-01", name: "São Paulo Saúde", country: "Brazil", city: "São Paulo", type: "Hospital", contact: "Dr. P. Souza" },
  { code: "CUST-SA-01", name: "Riyadh Medical Group", country: "Saudi Arabia", city: "Riyadh", type: "Hospital Group", contact: "M. Al Otaibi" },
  { code: "CUST-FR-01", name: "Paris Santé", country: "France", city: "Paris", type: "Hospital Network", contact: "Dr. C. Bernard" },
  { code: "CUST-TR-01", name: "Bosphorus Health Group", country: "Turkey", city: "Istanbul", type: "Hospital Group", contact: "E. Yılmaz" },
  { code: "CUST-JP-01", name: "Tokyo Bay Medical", country: "Japan", city: "Tokyo", type: "Hospital", contact: "Dr. K. Sato" },
  { code: "CUST-GB-01", name: "Thames Health Trust", country: "United Kingdom", city: "London", type: "Health Trust", contact: "Dr. R. Patel" },
];

// New markets the demo can light up by injecting sample data. Kept separate from
// the base MARKETS/CUSTOMERS so they never appear until the presenter adds data;
// they then reveal one-by-one (a fresh country per click) across every tab.
const EXPANSION_MARKETS: MarketDef[] = [
  { country: "Spain", city: "Madrid", whCode: "ES-MAD-01", whName: "Madrid DC", entity: "Northwind Iberia S.L.", carrier: "Continental Air Cargo" },
  { country: "Mexico", city: "Mexico City", whCode: "MX-MEX-01", whName: "Mexico City DC", entity: "Northwind México S.A.", carrier: "Atlantic Sea Lines" },
  { country: "Australia", city: "Sydney", whCode: "AU-SYD-01", whName: "Sydney DC", entity: "Northwind Australia Pty", carrier: "Pacific Air Cargo" },
  { country: "Egypt", city: "Cairo", whCode: "EG-CAI-01", whName: "Cairo DC", entity: "Northwind Egypt LLC", carrier: "Meridian Air Cargo" },
  { country: "Indonesia", city: "Jakarta", whCode: "ID-JKT-01", whName: "Jakarta DC", entity: "Northwind Indonesia PT", carrier: "Pacific Air Cargo" },
  { country: "Canada", city: "Toronto", whCode: "CA-TOR-01", whName: "Toronto DC", entity: "Northwind Canada Inc.", carrier: "Atlantic Sea Lines" },
];

const EXPANSION_CUSTOMERS: CustomerDef[] = [
  { code: "CUST-ES-01", name: "Madrid Salud Hospital", country: "Spain", city: "Madrid", type: "Hospital", contact: "Dr. J. García" },
  { code: "CUST-MX-01", name: "Ciudad de México Salud", country: "Mexico", city: "Mexico City", type: "Hospital Network", contact: "Dr. L. Hernández" },
  { code: "CUST-AU-01", name: "Sydney Health Partners", country: "Australia", city: "Sydney", type: "Hospital Group", contact: "Dr. O. Smith" },
  { code: "CUST-EG-01", name: "Cairo Medical Group", country: "Egypt", city: "Cairo", type: "Hospital Group", contact: "Dr. A. Hassan" },
  { code: "CUST-ID-01", name: "Jakarta Care Network", country: "Indonesia", city: "Jakarta", type: "Hospital Network", contact: "Dr. B. Santoso" },
  { code: "CUST-CA-01", name: "Toronto Health System", country: "Canada", city: "Toronto", type: "Hospital Network", contact: "Dr. E. Tremblay" },
];

/** All markets/customers known to a hover lookup (base + every expansion). */
const ALL_MARKETS: MarketDef[] = [...MARKETS, ...EXPANSION_MARKETS];

/** Markets that are "live" after `seq` injections: all base markets every time,
 *  plus one more expansion market revealed per injection — so each click adds a
 *  fresh country while still refreshing every existing market. */
function activeMarkets(seq: number): MarketDef[] {
  return [...MARKETS, ...EXPANSION_MARKETS.slice(0, Math.max(0, seq))];
}
function activeCustomers(seq: number): CustomerDef[] {
  return [...CUSTOMERS_DEF, ...EXPANSION_CUSTOMERS.slice(0, Math.max(0, seq))];
}

const ORIGIN_SUPPLIER = "Northwind Medical (India)";

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
  { action: "approve", module: "imports", entity: "import_candidate", id: "IMP-DE-FRA-01-3001", actor: "k.rao@northwind.example", reason: "Documents complete" },
  { action: "post_goods_receipt", module: "goods_receipt", entity: "grn", id: "GRN-7001", actor: "wh.frankfurt@northwind.example", reason: null },
  { action: "dispatch", module: "shipments", entity: "shipment", id: "SHP-1003", actor: "logistics.de@northwind.example", reason: null },
  { action: "deliver", module: "shipments", entity: "shipment", id: "SHP-1004", actor: "logistics.it@northwind.example", reason: null },
  { action: "create", module: "customers", entity: "customer", id: "CUST-AE-01", actor: "sales.ae@northwind.example", reason: null },
  { action: "record_payment", module: "receivables", entity: "invoice", id: "INV-90004", actor: "finance@northwind.example", reason: "Payment received" },
  { action: "override", module: "currency", entity: "rate_set", id: "EUR/INR", actor: "treasury@northwind.example", reason: "Daily ECB lock" },
  { action: "approve", module: "shipments", entity: "shipment", id: "SHP-1002", actor: "country.mgr.ae@northwind.example", reason: "Stock confirmed" },
  { action: "complete_review", module: "reviews", entity: "country_review", id: "Germany", actor: "regional.eu@northwind.example", reason: null },
  { action: "record_decision", module: "decisions", entity: "decision", id: "DEC-2041", actor: "gm@northwind.example", reason: "Expedite Brazil restock" },
  { action: "count", module: "inventory_count", entity: "count", id: "CNT-8001", actor: "wh.frankfurt@northwind.example", reason: null },
  { action: "flag_expiry", module: "inventory", entity: "batch", id: "BBR-SAO-01-1012", actor: "quality@northwind.example", reason: "Within 90 days" },
  { action: "approve", module: "imports", entity: "import_candidate", id: "IMP-US-NYC-01-3004", actor: "k.rao@northwind.example", reason: "Sea freight cleared" },
  { action: "dispatch", module: "shipments", entity: "shipment", id: "SHP-1006", actor: "logistics.us@northwind.example", reason: null },
  { action: "create", module: "commitments", entity: "commitment", id: "PO-DE-7781", actor: "sales.de@northwind.example", reason: "Q3 framework order" },
  { action: "post_goods_receipt", module: "goods_receipt", entity: "grn", id: "GRN-7003", actor: "wh.milan@northwind.example", reason: null },
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
    { action_type: "approve", severity: "medium", reference: "SHP-1001", title: "Shipment awaiting approval", detail: "Berlin Mitte Klinikum order pending country approval.", source: "Secondary Sales" },
    { action_type: "commitment", severity: "medium", reference: "PO-SA-7790", title: "Open PO due in 15 days", detail: "Riyadh Medical Group commitment needs allocation.", source: "Secondary Sales" },
    { action_type: "customs", severity: "medium", reference: "IMP-AE-DXB-01-3002", title: "At customs over 5 days", detail: "UAE-VASCULAR-0362 held at Dubai customs.", source: "Primary Sales" },
    { action_type: "review", severity: "low", reference: "Germany", title: "Country review due", detail: "Germany quarterly review not yet signed off.", source: "Governance" },
  ];
}

function approvals(): ApiApproval[] {
  return [
    { approval_id: "APR-9001", approval_type: "shipment", reference: "SHP-1001", requestor: "sales.de@northwind.example", request_date: isoDay(-2), approver: null, approval_date: null, reason: null, outcome: "pending", note: "Charité Klinik — 75 units" },
    { approval_id: "APR-9002", approval_type: "import", reference: "IMP-AE-DXB-01-3002", requestor: "k.rao@northwind.example", request_date: isoDay(-1), approver: null, approval_date: null, reason: null, outcome: "pending", note: "UAE inbound, customs cleared" },
    { approval_id: "APR-9003", approval_type: "shipment", reference: "SHP-1008", requestor: "sales.jp@northwind.example", request_date: isoDay(-1), approver: null, approval_date: null, reason: null, outcome: "pending", note: "St. Luke's Tokyo" },
    { approval_id: "APR-9004", approval_type: "inventory_adjustment", reference: "CNT-8001", requestor: "wh.frankfurt@northwind.example", request_date: isoDay(-3), approver: "country.mgr.de@northwind.example", approval_date: isoDay(-2), reason: "Count variance accepted", outcome: "approved", note: null },
    { approval_id: "APR-9005", approval_type: "import", reference: "IMP-US-NYC-01-3004", requestor: "k.rao@northwind.example", request_date: isoDay(-4), approver: "country.mgr.us@northwind.example", approval_date: isoDay(-3), reason: "Documents verified", outcome: "approved", note: null },
  ];
}

function decisions(): ApiDecision[] {
  return [
    { decision_id: "DEC-2041", decision_type: "expedite", reason: "Expedite Brazil restock to avoid stockout", user: "gm@northwind.example", role: "General Manager", problem_type: "supply_risk", owner: "Supply Chain", context: "Brazil cardiology demand up 18%", options_considered: ["Air freight", "Reallocate from USA", "Wait for sea shipment"], decided_at: isoStamp(160), related_product: "NW-CARD-STENT-001", related_batch: null, related_shipment: null, related_customer: null, related_supplier: null, expected_outcome: "Avoid stockout in 2 weeks", actual_outcome: null, effectiveness: null, status: "open" },
    { decision_id: "DEC-2039", decision_type: "allocation", reason: "Reserve Dubai stock for Gulf Medical Centre Q3 commitment", user: "country.mgr.ae@northwind.example", role: "Country Manager", problem_type: "allocation", owner: "Sales AE", context: "Large framework order", options_considered: ["Reserve now", "Wait for PO"], decided_at: isoStamp(1500), related_product: "NW-VASC-GRAFT-010", related_batch: null, related_shipment: null, related_customer: "Gulf Medical Centre", related_supplier: null, expected_outcome: "Secure the order", actual_outcome: "Order won", effectiveness: "effective", status: "closed" },
    { decision_id: "DEC-2036", decision_type: "expiry", reason: "Discount near-expiry São Paulo stock to local distributors", user: "country.mgr.br@northwind.example", role: "Country Manager", problem_type: "expiry", owner: "Sales BR", context: "2,100 units within 90 days", options_considered: ["Discount", "Return to hub", "Write off"], decided_at: isoStamp(3000), related_product: "NW-DIAG-KIT-040", related_batch: "BBR-SAO-01-1012", related_shipment: null, related_customer: null, related_supplier: null, expected_outcome: "Recover value", actual_outcome: null, effectiveness: null, status: "open" },
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
  const set = new Set<string>([
    "India",
    ...MARKETS.map((m) => m.country),
    ...CUSTOMERS_DEF.map((c) => c.country),
    ...EXPANSION_MARKETS.map((m) => m.country),
    ...EXPANSION_CUSTOMERS.map((c) => c.country),
  ]);
  return [...set].sort();
}

// ---- Secondary Sales: customer commitments (PO → product → quantity) --------

const COMMITMENT_STATUSES = ["open", "allocated", "partially_shipped", "shipped", "delivered"];

function customerCommitments(): ApiCustomerCommitment[] {
  return CUSTOMERS_DEF.map((customer, i) => {
    const product = pick(PRODUCTS, i);
    const market = MARKETS.find((m) => m.country === customer.country);
    const ordered = 100 + (i % 6) * 50;
    const allocated = Math.round(ordered * 0.7);
    const shipped = Math.round(ordered * 0.45);
    const delivered = Math.round(ordered * 0.3);
    return {
      commitment_id: `COM-${4001 + i}`,
      po_number: `PO-${customer.code.split("-")[1] ?? "XX"}-${7700 + i}`,
      customer: customer.name,
      distributor: market?.entity ?? "",
      country: customer.country,
      material: product.code,
      batch_number: null,
      ordered_quantity: ordered,
      allocated_quantity: allocated,
      shipped_quantity: shipped,
      delivered_quantity: delivered,
      backorder_quantity: Math.max(0, ordered - allocated),
      required_delivery_date: isoDay(7 + i),
      expected_fulfillment_date: isoDay(5 + i),
      status: pick(COMMITMENT_STATUSES, i),
    };
  });
}

// ---- On-demand injection (the presenter's "Add Sample Data" button) ----------
// Random product + quantity entries that the demo store generates on each click.
// A provider indirection keeps this module free of any import back from the demo
// store (no cycle): the store registers getters for whatever it has injected.

let injectedImportsProvider: () => ApiImportFileCandidate[] = () => [];
let injectedCommitmentsProvider: () => ApiCustomerCommitment[] = () => [];
let injectedBatchesProvider: () => ApiInventoryBatch[] = () => [];

export function registerInjectProviders(
  imports: () => ApiImportFileCandidate[],
  commitments: () => ApiCustomerCommitment[],
  batches: () => ApiInventoryBatch[],
): void {
  injectedImportsProvider = imports;
  injectedCommitmentsProvider = commitments;
  injectedBatchesProvider = batches;
}

/** Presenter-injected rows for a given endpoint, so `getJson` can surface them
 *  on top of real backend data too (not only when the sample fallback fires). */
export function injectedRowsFor(basePath: string): unknown[] {
  if (basePath === "/imports") return injectedImportsProvider();
  if (basePath === "/customer-commitments") return injectedCommitmentsProvider();
  if (basePath === "/inventory/batches") return injectedBatchesProvider();
  return [];
}

function makeInjectedImport(seq: number, k: number, market: MarketDef): ApiImportFileCandidate {
  const n = 5000 + seq * 100 + k;
  const r = seeded(n * 2654435761);
  const product = seedItem(r, PRODUCTS);
  const product2 = seedItem(r, PRODUCTS);
  const shipmentNumber = String(n);
  const invoice = `INV-${95000 + n}`;
  return {
    import_file_number: `IMP-${market.whCode}-${n}`,
    shipment_name: `${market.country.toUpperCase()}-${product.category.toUpperCase()}-${shipmentNumber}`,
    shipment_vertical: product.category,
    shipment_number: shipmentNumber,
    supplier_name: ORIGIN_SUPPLIER,
    destination_entity: market.entity,
    destination_country: market.country,
    status: seedItem(r, IMPORT_STATUSES),
    invoice_number: invoice,
    invoice_date: isoDay(0),
    awb_number: `AWB-${seedInt(r, 100, 999)}-${n}`,
    origin_country: "India",
    carrier_name: market.carrier,
    flight_number: `MR${seedInt(r, 200, 900)}`,
    flight_date: isoDay(0),
    package_count: seedInt(r, 5, 30),
    gross_weight_kg: seedInt(r, 300, 1500),
    chargeable_weight_kg: seedInt(r, 320, 1600),
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
        batch_number: `B${market.whCode}-${n}`,
        serial_number: null,
        expiry_date: isoDay(seedInt(r, 120, 600)),
        quantity: seedInt(r, 2, 24) * 50,
        uom: product.uom,
        unit_value: product.unit,
        currency: "INR",
        product_profile_status: "known",
      },
      {
        item_code: product2.code,
        product_description: product2.description,
        batch_number: `B${market.whCode}-${n}b`,
        serial_number: null,
        expiry_date: isoDay(seedInt(r, 120, 600)),
        quantity: seedInt(r, 1, 15) * 40,
        uom: product2.uom,
        unit_value: product2.unit,
        currency: "INR",
        product_profile_status: "known",
      },
    ],
  };
}

export function generateInjectedImports(seq: number): ApiImportFileCandidate[] {
  return activeMarkets(seq).map((market, k) => makeInjectedImport(seq, k, market));
}

function makeInjectedCommitment(seq: number, k: number, customer: CustomerDef): ApiCustomerCommitment {
  const n = 6000 + seq * 100 + k;
  const r = seeded(n * 2654435761);
  const product = seedItem(r, PRODUCTS);
  const market = ALL_MARKETS.find((m) => m.country === customer.country);
  const ordered = seedInt(r, 2, 30) * 25;
  const allocated = Math.round(ordered * (seedInt(r, 40, 90) / 100));
  const shipped = Math.round(allocated * 0.6);
  const delivered = Math.round(shipped * 0.7);
  return {
    commitment_id: `COM-${n}`,
    po_number: `PO-${customer.code.split("-")[1] ?? "XX"}-${n}`,
    customer: customer.name,
    distributor: market?.entity ?? "",
    country: customer.country,
    material: product.code,
    batch_number: null,
    ordered_quantity: ordered,
    allocated_quantity: allocated,
    shipped_quantity: shipped,
    delivered_quantity: delivered,
    backorder_quantity: Math.max(0, ordered - allocated),
    required_delivery_date: isoDay(seedInt(r, 3, 21)),
    expected_fulfillment_date: isoDay(seedInt(r, 1, 14)),
    status: seedItem(r, COMMITMENT_STATUSES),
  };
}

export function generateInjectedCommitments(seq: number): ApiCustomerCommitment[] {
  return activeCustomers(seq).map((customer, k) => makeInjectedCommitment(seq, k, customer));
}

function makeInjectedBatch(seq: number, k: number, market: MarketDef): ApiInventoryBatch {
  const n = 7000 + seq * 100 + k;
  const r = seeded(n * 2654435761);
  const product = seedItem(r, PRODUCTS);
  const days = seedInt(r, 40, 540);
  const quantity = seedInt(r, 2, 30) * 100;
  return {
    item_code: product.code,
    product_description: product.description,
    product_category: product.category,
    batch_number: `B${market.whCode}-${n}`,
    warehouse_location: market.whName,
    quantity_available: quantity,
    manufacturing_date: isoDay(days - product.shelf * 30),
    expiry_date: isoDay(days),
    unit_value: product.unit,
    inventory_value: quantity * product.unit,
    days_to_expiry: days,
    expiry_bucket: expiryBucket(days),
    currency: "INR",
    registered_date: isoDay(0),
  };
}

export function generateInjectedBatches(seq: number): ApiInventoryBatch[] {
  return activeMarkets(seq).map((market, k) => makeInjectedBatch(seq, k, market));
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
  "/inventory/batches": () => [...injectedBatchesProvider(), ...batches()],
  "/shipments": shipments,
  "/dispatches": dispatches,
  "/goods-receipts": goodsReceipts,
  "/inventory-counts": inventoryCounts,
  "/customers": customers,
  "/imports": () => [...injectedImportsProvider(), ...imports()],
  "/customer-commitments": () => [...injectedCommitmentsProvider(), ...customerCommitments()],
  "/warehouses": warehouses,
  "/movements": movements,
  "/audit": audit,
};
