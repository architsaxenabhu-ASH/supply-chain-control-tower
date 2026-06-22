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
  ApiCommitmentDashboard,
  ApiConsignment,
  ApiConsignmentDashboard,
  ApiCountryPerformance,
  ApiCreditControl,
  ApiCustomer,
  ApiCustomerCommitment,
  ApiDecision,
  ApiDispatch,
  ApiExecutiveAction,
  ApiExecutiveDashboard,
  ApiExpiryDashboard,
  ApiExpiryRiskBatch,
  ApiGoodsReceipt,
  ApiImportDashboard,
  ApiImportFileCandidate,
  ApiInventoryBatch,
  ApiInventoryCount,
  ApiInventoryDashboard,
  ApiMovementEvent,
  ApiPayable,
  ApiPerformanceScorecard,
  ApiProduct,
  ApiReceivable,
  ApiReturnDashboard,
  ApiReturnRecord,
  ApiShipment,
  ApiShipmentDashboard,
  ApiValidationQueueItem,
  ApiValidationQueueResponse,
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
  { country: "Netherlands", city: "Amsterdam", whCode: "NL-AMS-01", whName: "Amsterdam DC", entity: "Northwind Benelux B.V.", carrier: "Continental Air Cargo" },
  { country: "South Africa", city: "Johannesburg", whCode: "ZA-JNB-01", whName: "Johannesburg DC", entity: "Northwind South Africa Pty", carrier: "Meridian Air Cargo" },
  { country: "South Korea", city: "Seoul", whCode: "KR-SEL-01", whName: "Seoul DC", entity: "Northwind Korea Ltd.", carrier: "Pacific Air Cargo" },
  { country: "Singapore", city: "Singapore", whCode: "SG-SIN-01", whName: "Singapore DC", entity: "Northwind Asia Pte", carrier: "Pacific Air Cargo" },
  { country: "China", city: "Shanghai", whCode: "CN-SHA-01", whName: "Shanghai DC", entity: "Northwind China Co.", carrier: "Pacific Air Cargo" },
  { country: "Argentina", city: "Buenos Aires", whCode: "AR-BUE-01", whName: "Buenos Aires DC", entity: "Northwind Argentina S.A.", carrier: "Atlantic Sea Lines" },
  { country: "Nigeria", city: "Lagos", whCode: "NG-LOS-01", whName: "Lagos DC", entity: "Northwind Nigeria Ltd.", carrier: "Meridian Air Cargo" },
  { country: "Kenya", city: "Nairobi", whCode: "KE-NBO-01", whName: "Nairobi DC", entity: "Northwind East Africa Ltd.", carrier: "Meridian Air Cargo" },
];

const EXPANSION_CUSTOMERS: CustomerDef[] = [
  { code: "CUST-ES-01", name: "Madrid Salud Hospital", country: "Spain", city: "Madrid", type: "Hospital", contact: "Dr. J. García" },
  { code: "CUST-MX-01", name: "Ciudad de México Salud", country: "Mexico", city: "Mexico City", type: "Hospital Network", contact: "Dr. L. Hernández" },
  { code: "CUST-AU-01", name: "Sydney Health Partners", country: "Australia", city: "Sydney", type: "Hospital Group", contact: "Dr. O. Smith" },
  { code: "CUST-EG-01", name: "Cairo Medical Group", country: "Egypt", city: "Cairo", type: "Hospital Group", contact: "Dr. A. Hassan" },
  { code: "CUST-ID-01", name: "Jakarta Care Network", country: "Indonesia", city: "Jakarta", type: "Hospital Network", contact: "Dr. B. Santoso" },
  { code: "CUST-CA-01", name: "Toronto Health System", country: "Canada", city: "Toronto", type: "Hospital Network", contact: "Dr. E. Tremblay" },
  { code: "CUST-NL-01", name: "Amsterdam Medical Centre", country: "Netherlands", city: "Amsterdam", type: "Hospital", contact: "Dr. S. Bakker" },
  { code: "CUST-ZA-01", name: "Johannesburg Health Group", country: "South Africa", city: "Johannesburg", type: "Hospital Group", contact: "Dr. T. Nkosi" },
  { code: "CUST-KR-01", name: "Seoul Medical Center", country: "South Korea", city: "Seoul", type: "Hospital", contact: "Dr. J. Kim" },
  { code: "CUST-SG-01", name: "Singapore General Partners", country: "Singapore", city: "Singapore", type: "Hospital Network", contact: "Dr. W. Tan" },
  { code: "CUST-CN-01", name: "Shanghai Health Network", country: "China", city: "Shanghai", type: "Hospital Network", contact: "Dr. L. Wang" },
  { code: "CUST-AR-01", name: "Buenos Aires Salud", country: "Argentina", city: "Buenos Aires", type: "Hospital", contact: "Dr. M. González" },
  { code: "CUST-NG-01", name: "Lagos Care Group", country: "Nigeria", city: "Lagos", type: "Hospital Group", contact: "Dr. C. Okafor" },
  { code: "CUST-KE-01", name: "Nairobi Health Trust", country: "Kenya", city: "Nairobi", type: "Health Trust", contact: "Dr. A. Otieno" },
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
  // Computed dashboards + finance/consignment/returns, derived from the static
  // world so every screen is populated even with no backend running (browsing).
  "/dashboard/import": () => computeImportDashboard(staticWorld()),
  "/dashboard/inventory": () => computeInventoryDashboard(staticWorld()),
  "/dashboard/expiry": () => computeExpiryDashboard(staticWorld()),
  "/dashboard/shipment": () => computeShipmentDashboard(staticWorld()),
  "/dashboard/executive": () => computeExecutiveDashboard(staticWorld()),
  "/customer-commitment-dashboard": () => computeCommitmentDashboard(staticWorld()),
  "/consignment-dashboard": () => computeConsignmentDashboard(staticWorld()),
  "/return-dashboard": () => computeReturnDashboard(staticWorld()),
  "/reference/movement-by-country": () => computeMovementByCountry(staticWorld()),
  "/distributor-performance-v2": () => computeDistributorPerformance(staticWorld()),
  "/customer-performance": () => computeCustomerPerformance(staticWorld()),
  "/receivables": () => staticWorld().receivables,
  "/payables": () => staticWorld().payables,
  "/credit-control": () => deriveCredit(staticWorld().receivables),
  "/consignment-inventory": () => staticWorld().consignments,
  "/returns": () => staticWorld().returns,
};

// =============================================================================
// One source of truth for the live demo (Phase 7H)
// -----------------------------------------------------------------------------
// The presenter's two counters (Primary Sales +, Secondary Sales +) drive every
// screen, not just the Executive overview. The rule:
//   • Browsing normally  → the rich static sample fills every tab (above).
//   • Live presentation  → the WHOLE business starts at zero and grows ONLY from
//     the counters. Every list, map and dashboard is computed from the injected
//     rows, so they all start empty and grow together, consistently, on each
//     click — exactly like a real system coming to life.
// Real backend data still wins whenever a presentation is NOT running.
// =============================================================================

// Whether a live presentation is running. The demo store registers this (it owns
// the counters); we keep the indirection so this module never imports the store.
let presentationProvider: () => boolean = () => false;
export function registerPresentationProvider(fn: () => boolean): void {
  presentationProvider = fn;
}
export function isPresentationActive(): boolean {
  return presentationProvider();
}

// ---- Small shared lookups ---------------------------------------------------
const PRODUCT_BY_CODE = new Map(PRODUCTS.map((p) => [p.code, p]));
const MARKET_BY_COUNTRY = new Map(ALL_MARKETS.map((m) => [m.country, m]));
const CUSTOMER_BY_NAME = new Map(CUSTOMERS_DEF.map((c) => [c.name, c]));
const today = (): string => isoDay(0);
const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);
const units = (value: number): string => Math.round(value).toLocaleString("en-US");

function productUnit(code: string): number {
  return PRODUCT_BY_CODE.get(code)?.unit ?? 10000;
}
function productCategory(code: string): string {
  return PRODUCT_BY_CODE.get(code)?.category ?? "Other";
}
// Deterministic seed from a string id, so derived rows are stable across devices.
function hashStr(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const RECEIVED_IMPORT = new Set(["received", "closed"]);
const CLOSED_IMPORT = new Set(["received", "closed", "cancelled", "rejected"]);
const RECEIPTABLE_IMPORT = new Set(["arrived", "received", "closed", "goods_receipt_pending"]);
const CLOSED_COMMITMENT = new Set(["fulfilled", "delivered", "cancelled", "closed"]);

// =============================================================================
// Derive secondary entities from the three primitives (imports / commitments /
// batches). Used for BOTH worlds, so browsing and the live demo stay consistent.
// =============================================================================

function deriveShipments(commitments: ApiCustomerCommitment[]): ApiShipment[] {
  return commitments
    .filter((c) => c.allocated_quantity > 0 || c.shipped_quantity > 0)
    .map((c) => {
      const market = MARKET_BY_COUNTRY.get(c.country);
      const status: ApiShipment["status"] =
        c.ordered_quantity > 0 && c.delivered_quantity >= c.ordered_quantity
          ? "delivered"
          : c.shipped_quantity > 0
            ? "dispatched"
            : c.allocated_quantity > 0
              ? "approved"
              : "submitted";
      const shipmentId = `SHP-${c.commitment_id}`;
      return {
        shipment_id: shipmentId,
        request_date: c.expected_fulfillment_date ?? isoDay(-2),
        requestor_name: `Sales ${c.country}`,
        customer_name: c.customer,
        destination_country: c.country,
        city: market?.city ?? null,
        priority: c.backorder_quantity > 0 ? "urgent" : "normal",
        required_delivery_date: c.required_delivery_date,
        status,
        lines: [
          {
            shipment_id: shipmentId,
            item_code: c.material,
            batch_number: c.batch_number ?? `B-${c.material}`,
            warehouse_location: market?.whName ?? null,
            quantity_requested: c.ordered_quantity,
            quantity_approved: c.allocated_quantity,
          },
        ],
      };
    });
}

function deriveDispatches(shipments: ApiShipment[]): ApiDispatch[] {
  const couriers = ["DHL Express", "FedEx", "Aramex", "Maersk"];
  return shipments
    .filter((s) => s.status === "dispatched" || s.status === "delivered")
    .map((s, i) => ({
      dispatch_number: `DSP-${s.shipment_id}`,
      shipment_id: s.shipment_id,
      dispatch_date: isoDay(-(i % 7) - 1),
      transporter_courier: pick(couriers, hashStr(s.shipment_id)),
      tracking_number: `TRK${100000 + (hashStr(s.shipment_id) % 900000)}`,
      dispatched_by: "Logistics",
      status: s.status === "delivered" ? "delivered" : "in_transit",
    }));
}

function deriveGoodsReceipts(imports: ApiImportFileCandidate[]): ApiGoodsReceipt[] {
  return imports
    .filter((im) => RECEIPTABLE_IMPORT.has(im.status.toLowerCase()))
    .map((im) => {
      const market = MARKET_BY_COUNTRY.get(im.destination_country);
      return {
        grn_number: `GRN-${im.import_file_number}`,
        receipt_date: im.flight_date ?? isoDay(-1),
        warehouse: market?.whName ?? im.destination_country,
        supplier: ORIGIN_SUPPLIER,
        status: "posted",
        lines: im.lines.map((l) => ({
          item_code: l.item_code,
          batch_number: l.batch_number,
          quantity_received: l.quantity,
          expiry_date: l.expiry_date ?? isoDay(365),
          unit_value: l.unit_value ?? productUnit(l.item_code),
        })),
      };
    });
}

function deriveMovements(imports: ApiImportFileCandidate[], shipments: ApiShipment[]): ApiMovementEvent[] {
  const rows: ApiMovementEvent[] = [];
  let id = 1;
  for (const im of imports) {
    if (!RECEIPTABLE_IMPORT.has(im.status.toLowerCase())) continue;
    const market = MARKET_BY_COUNTRY.get(im.destination_country);
    const line = im.lines[0];
    if (!line) continue;
    rows.push({
      event_id: `MV-IN-${im.import_file_number}-${id++}`,
      event_type: "received",
      item_code: line.item_code,
      batch_number: line.batch_number,
      serial_number: null,
      quantity: im.lines.reduce((s, l) => s + l.quantity, 0),
      warehouse: market?.whName ?? im.destination_country,
      location: im.destination_country,
      counterparty: ORIGIN_SUPPLIER,
      reference: `GRN-${im.import_file_number}`,
      actor: `WH ${market?.city ?? im.destination_country}`,
      occurred_at: isoStamp(id * 17 + 5),
      note: null,
    });
  }
  for (const s of shipments) {
    if (s.status !== "dispatched" && s.status !== "delivered") continue;
    const line = s.lines[0];
    if (!line) continue;
    rows.push({
      event_id: `MV-OUT-${s.shipment_id}-${id++}`,
      event_type: "dispatched",
      item_code: line.item_code,
      batch_number: line.batch_number ?? "",
      serial_number: null,
      quantity: line.quantity_approved || line.quantity_requested,
      warehouse: line.warehouse_location ?? s.destination_country,
      location: s.destination_country,
      counterparty: s.customer_name,
      reference: s.shipment_id,
      actor: "Logistics",
      occurred_at: isoStamp(id * 23 + 11),
      note: null,
    });
  }
  return rows;
}

function deriveCustomers(commitments: ApiCustomerCommitment[]): ApiCustomer[] {
  const seen = new Map<string, ApiCustomer>();
  for (const c of commitments) {
    if (seen.has(c.customer)) continue;
    const def = CUSTOMER_BY_NAME.get(c.customer);
    const market = MARKET_BY_COUNTRY.get(c.country);
    seen.set(c.customer, {
      customer_code: def?.code ?? `CUST-${c.customer.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase()}`,
      customer_name: c.customer,
      country: c.country,
      city: def?.city ?? market?.city ?? null,
      customer_type: def?.type ?? "Hospital",
      contact_person: def?.contact ?? "—",
    });
  }
  return [...seen.values()];
}

function deriveReceivables(commitments: ApiCustomerCommitment[]): ApiReceivable[] {
  return commitments
    .filter((c) => c.delivered_quantity > 0 || c.shipped_quantity > 0)
    .map((c) => {
      const qty = c.delivered_quantity > 0 ? c.delivered_quantity : c.shipped_quantity;
      const value = qty * productUnit(c.material);
      const market = MARKET_BY_COUNTRY.get(c.country);
      const r = seeded(hashStr(c.commitment_id));
      const roll = r();
      const paidFrac = roll < 0.4 ? 1 : roll < 0.68 ? 0.5 : 0;
      const paid = Math.round(value * paidFrac);
      const outstanding = value - paid;
      const overdue = outstanding > 0 && roll > 0.82;
      const status = outstanding === 0 ? "paid" : overdue ? "overdue" : paid > 0 ? "partially_paid" : "open";
      return {
        receivable_id: `AR-${c.commitment_id}`,
        distributor: market?.entity ?? c.country,
        country: c.country,
        invoice_number: `SI-${c.po_number}`,
        invoice_date: isoDay(-seedInt(r, 8, 60)),
        due_date: isoDay(seedInt(r, -12, 28)),
        payment_terms: "Net 30",
        invoice_value: value,
        currency: "INR",
        paid_value: paid,
        outstanding_value: outstanding,
        status,
        payment_history: [],
      };
    });
}

function derivePayables(imports: ApiImportFileCandidate[]): ApiPayable[] {
  return imports.map((im) => {
    const goodsValue = im.lines.reduce((s, l) => s + (l.unit_value ?? 0) * l.quantity, 0);
    const freight = Math.max(50000, Math.round(goodsValue * 0.045));
    const market = MARKET_BY_COUNTRY.get(im.destination_country);
    const r = seeded(hashStr(im.import_file_number));
    const roll = r();
    const paid = roll < 0.5 ? freight : 0;
    const outstanding = freight - paid;
    return {
      payable_id: `AP-${im.import_file_number}`,
      partner_type: "freight",
      partner_name: im.carrier_name ?? market?.carrier ?? "Freight Partner",
      country: im.destination_country,
      invoice_number: `FRT-${im.shipment_number}`,
      invoice_date: im.invoice_date ?? isoDay(-10),
      due_date: isoDay(seedInt(r, -6, 26)),
      payment_terms: "Net 30",
      invoice_value: freight,
      paid_value: paid,
      outstanding_value: outstanding,
      status: outstanding === 0 ? "paid" : roll > 0.85 ? "overdue" : "open",
      payment_history: [],
    };
  });
}

function deriveConsignments(commitments: ApiCustomerCommitment[]): ApiConsignment[] {
  return commitments
    .filter((_, i) => i % 3 === 0)
    .map((c) => {
      const market = MARKET_BY_COUNTRY.get(c.country);
      const r = seeded(hashStr(`CON-${c.commitment_id}`));
      const sent = Math.max(20, c.allocated_quantity || c.ordered_quantity);
      const consumed = Math.round(sent * (seedInt(r, 10, 80) / 100));
      const reported = Math.min(sent, consumed + Math.round(sent * 0.1));
      return {
        consignment_id: `CNG-${c.commitment_id}`,
        distributor: market?.entity ?? c.country,
        country: c.country,
        material: c.material,
        batch_number: c.batch_number ?? `B-${c.material}`,
        quantity_sent: sent,
        quantity_reported: reported,
        quantity_consumed: consumed,
        quantity_remaining: Math.max(0, sent - consumed),
        last_report_date: r() > 0.3 ? isoDay(-seedInt(r, 2, 40)) : null,
        sent_date: isoDay(-seedInt(r, 20, 90)),
      };
    });
}

function deriveReturns(commitments: ApiCustomerCommitment[]): ApiReturnRecord[] {
  const reasons = ["Damaged in transit", "Expiry approaching", "Wrong item", "Customer cancellation"];
  return commitments
    .filter((c, i) => c.delivered_quantity > 0 && i % 5 === 0)
    .map((c) => {
      const r = seeded(hashStr(`RET-${c.commitment_id}`));
      const qty = Math.max(1, Math.round(c.delivered_quantity * (seedInt(r, 2, 12) / 100)));
      const reusable = Math.round(qty * (seedInt(r, 30, 80) / 100));
      const status = pick(["received", "inspected", "verified", "closed"], hashStr(c.commitment_id));
      return {
        return_id: `RMA-${c.commitment_id}`,
        material: c.material,
        batch_number: c.batch_number ?? `B-${c.material}`,
        return_reason: pick(reasons, hashStr(c.commitment_id)),
        returned_quantity: qty,
        inspection_result: status === "received" ? null : "passed",
        verification_result: status === "verified" || status === "closed" ? "approved" : null,
        reusable_quantity: reusable,
        rejected_quantity: qty - reusable,
        status,
      };
    });
}

function deriveCredit(receivables: ApiReceivable[]): ApiCreditControl[] {
  const byDistributor = new Map<string, { exposure: number; overdue: number }>();
  for (const r of receivables) {
    const entry = byDistributor.get(r.distributor) ?? { exposure: 0, overdue: 0 };
    entry.exposure += r.outstanding_value;
    if (r.status === "overdue") entry.overdue += r.outstanding_value;
    byDistributor.set(r.distributor, entry);
  }
  return [...byDistributor.entries()].map(([distributor, e]) => {
    const limit = Math.max(5_000_000, Math.ceil((e.exposure * 1.4) / 1_000_000) * 1_000_000);
    const available = limit - e.exposure;
    const status = available < 0 ? "blocked" : available < limit * 0.15 || e.overdue > 0 ? "warning" : "healthy";
    return {
      distributor,
      credit_limit: limit,
      outstanding_exposure: e.exposure,
      available_credit: available,
      overdue_amount: e.overdue,
      status,
      override: false,
    };
  });
}

// =============================================================================
// Workflow queues — derived from the same flow so a from-zero presentation fills
// Alerts / Approvals / Decisions / Validation as imports & orders arrive (not
// empty). Everything keys off the injected imports/commitments/batches.
// =============================================================================

function deriveExecutiveActions(world: RawWorld): ApiExecutiveAction[] {
  const out: ApiExecutiveAction[] = [];
  for (const im of world.imports) {
    const s = im.status.toLowerCase();
    if (s === "delayed") {
      out.push({ action_type: "expedite", severity: "high", reference: im.shipment_name ?? im.import_file_number, title: `${im.destination_country} shipment delayed`, detail: `${im.shipment_name ?? im.import_file_number} is past ETA — chase the carrier.`, source: "Primary Sales" });
    } else if (s === "customs") {
      out.push({ action_type: "customs", severity: "medium", reference: im.import_file_number, title: `At customs — ${im.destination_country}`, detail: `${im.shipment_name ?? im.import_file_number} is held at customs clearance.`, source: "Primary Sales" });
    }
  }
  for (const b of world.batches) {
    if (b.days_to_expiry >= 0 && b.days_to_expiry <= 90) {
      out.push({ action_type: "expiry", severity: b.days_to_expiry <= 30 ? "high" : "medium", reference: b.batch_number, title: `Expiry risk — ${b.warehouse_location}`, detail: `${units(b.quantity_available)} units of ${b.product_description} within ${b.days_to_expiry} days.`, source: "Inventory" });
    }
  }
  for (const c of world.commitments) {
    if (c.backorder_quantity > 0) {
      out.push({ action_type: "commitment", severity: "medium", reference: c.po_number, title: `Backorder — ${c.customer}`, detail: `${units(c.backorder_quantity)} units short for ${c.customer} (${c.country}).`, source: "Secondary Sales" });
    }
  }
  for (const s of world.shipments) {
    if (s.status === "submitted") {
      out.push({ action_type: "approve", severity: "low", reference: s.shipment_id, title: `Order awaiting approval`, detail: `${s.customer_name} order pending country approval.`, source: "Secondary Sales" });
    }
  }
  const rank = { high: 0, medium: 1, low: 2 } as Record<string, number>;
  return out.sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3)).slice(0, 12);
}

function deriveApprovals(world: RawWorld): ApiApproval[] {
  const out: ApiApproval[] = [];
  for (const im of world.imports) {
    const s = im.status.toLowerCase();
    if (s === "arrived" || s === "customs" || s === "goods_receipt_pending") {
      out.push({ approval_id: `APR-${im.import_file_number}`, approval_type: "import", reference: im.import_file_number, requestor: `ops.${im.destination_country.slice(0, 2).toLowerCase()}@northwind.example`, request_date: im.flight_date ?? isoDay(-1), approver: null, approval_date: null, reason: null, outcome: "pending", note: `${im.shipment_name ?? im.import_file_number} inbound to ${im.destination_country}` });
    }
  }
  for (const sh of world.shipments) {
    if (sh.status === "submitted") {
      out.push({ approval_id: `APR-${sh.shipment_id}`, approval_type: "shipment", reference: sh.shipment_id, requestor: `sales.${sh.destination_country.slice(0, 2).toLowerCase()}@northwind.example`, request_date: sh.request_date, approver: null, approval_date: null, reason: null, outcome: "pending", note: `${sh.customer_name} — ${sh.destination_country}` });
    }
  }
  return out.slice(0, 20);
}

function deriveDecisions(world: RawWorld): ApiDecision[] {
  const out: ApiDecision[] = [];
  const expiring = world.batches.filter((b) => b.days_to_expiry >= 0 && b.days_to_expiry <= 90).slice(0, 2);
  for (const b of expiring) {
    out.push({ decision_id: `DEC-${b.batch_number}`, decision_type: "expiry", reason: `Discount or move near-expiry ${b.product_description} at ${b.warehouse_location}`, user: "gm@northwind.example", role: "General Manager", problem_type: "expiry", owner: "Supply Chain", context: `${units(b.quantity_available)} units within ${b.days_to_expiry} days`, options_considered: ["Discount", "Reallocate", "Write off"], decided_at: isoStamp(120), related_product: b.item_code, related_batch: b.batch_number, related_shipment: null, related_customer: null, related_supplier: null, expected_outcome: "Recover value before expiry", actual_outcome: null, effectiveness: null, status: "open" });
  }
  const back = world.commitments.filter((c) => c.backorder_quantity > 0).slice(0, 2);
  for (const c of back) {
    out.push({ decision_id: `DEC-${c.commitment_id}`, decision_type: "allocation", reason: `Cover backorder for ${c.customer}`, user: `country.mgr.${c.country.slice(0, 2).toLowerCase()}@northwind.example`, role: "Country Manager", problem_type: "allocation", owner: `Sales ${c.country}`, context: `${units(c.backorder_quantity)} units short`, options_considered: ["Expedite import", "Reallocate stock", "Partial ship"], decided_at: isoStamp(300), related_product: c.material, related_batch: null, related_shipment: null, related_customer: c.customer, related_supplier: null, expected_outcome: "Fulfil the order", actual_outcome: null, effectiveness: null, status: "open" });
  }
  return out;
}

function deriveValidationQueue(world: RawWorld): ApiValidationQueueResponse {
  const items: ApiValidationQueueItem[] = [];
  for (const im of world.imports.slice(0, 12)) {
    const line = im.lines[0];
    items.push({
      queue_id: `VQ-${im.import_file_number}`,
      document_id: im.import_file_number,
      filename: `${im.shipment_name ?? im.import_file_number}.pdf`,
      document_type: "commercial_invoice" as ApiValidationQueueItem["document_type"],
      field_name: "unit_value",
      extracted_value: line ? String(line.unit_value ?? "") : null,
      corrected_value: null,
      effective_value: line ? String(line.unit_value ?? "") : null,
      confidence_score: 0.72,
      validation_status: "pending",
      issue_type: "low_confidence",
      issue_label: "Low confidence — please confirm",
      required_group: null,
      source_engine: "ocr",
      created_at: im.invoice_date ?? isoDay(-1),
    });
  }
  return {
    items,
    total_count: items.length,
    missing_required_count: 0,
    pending_review_count: items.length,
    corrected_count: 0,
  };
}

// =============================================================================
// Computed dashboards — pure functions of a world's raw lists.
// =============================================================================

type RawWorld = {
  imports: ApiImportFileCandidate[];
  batches: ApiInventoryBatch[];
  commitments: ApiCustomerCommitment[];
  shipments: ApiShipment[];
  dispatches: ApiDispatch[];
  goodsReceipts: ApiGoodsReceipt[];
  movements: ApiMovementEvent[];
  customers: ApiCustomer[];
  counts: ApiInventoryCount[];
  receivables: ApiReceivable[];
  payables: ApiPayable[];
  consignments: ApiConsignment[];
  returns: ApiReturnRecord[];
};

function countBy<T>(rows: T[], key: (row: T) => string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of rows) {
    const k = key(row);
    map[k] = (map[k] ?? 0) + 1;
  }
  return map;
}
function sumBy<T>(rows: T[], key: (row: T) => string, value: (row: T) => number): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of rows) {
    const k = key(row);
    map[k] = (map[k] ?? 0) + value(row);
  }
  return map;
}

function computeImportDashboard(world: RawWorld): ApiImportDashboard {
  const im = world.imports;
  const open = im.filter((c) => !CLOSED_IMPORT.has(c.status.toLowerCase()));
  return {
    total: im.length,
    by_status: countBy(im, (c) => c.status),
    open_shipments: open.length,
    awaiting_receipt: im.filter((c) => ["arrived", "goods_receipt_pending"].includes(c.status.toLowerCase())).length,
    received: im.filter((c) => RECEIVED_IMPORT.has(c.status.toLowerCase())).length,
    by_country: countBy(open, (c) => c.destination_country),
  };
}

function computeInventoryDashboard(world: RawWorld): ApiInventoryDashboard {
  const b = world.batches;
  return {
    total_value: sum(b.map((x) => x.inventory_value)),
    total_quantity: sum(b.map((x) => x.quantity_available)),
    batch_count: b.length,
    by_warehouse_value: sumBy(b, (x) => x.warehouse_location, (x) => x.inventory_value),
    by_category_value: sumBy(b, (x) => x.product_category, (x) => x.inventory_value),
    expiring_30: b.filter((x) => x.days_to_expiry >= 0 && x.days_to_expiry <= 30).length,
    expiring_60: b.filter((x) => x.days_to_expiry > 30 && x.days_to_expiry <= 60).length,
    expiring_90: b.filter((x) => x.days_to_expiry > 60 && x.days_to_expiry <= 90).length,
    expired: b.filter((x) => x.days_to_expiry < 0).length,
  };
}

function computeExpiryDashboard(world: RawWorld): ApiExpiryDashboard {
  const b = world.batches;
  const within90 = b.filter((x) => x.days_to_expiry >= 0 && x.days_to_expiry <= 90);
  const soonest: ApiExpiryRiskBatch[] = [...b]
    .filter((x) => x.days_to_expiry <= 180)
    .sort((a, z) => a.days_to_expiry - z.days_to_expiry)
    .slice(0, 8)
    .map((x) => ({
      item_code: x.item_code,
      batch_number: x.batch_number,
      warehouse: x.warehouse_location,
      expiry_date: x.expiry_date,
      days_to_expiry: x.days_to_expiry,
      quantity: x.quantity_available,
      value: x.inventory_value,
    }));
  return {
    expiring_30: b.filter((x) => x.days_to_expiry >= 0 && x.days_to_expiry <= 30).length,
    expiring_60: b.filter((x) => x.days_to_expiry > 30 && x.days_to_expiry <= 60).length,
    expiring_90: b.filter((x) => x.days_to_expiry > 60 && x.days_to_expiry <= 90).length,
    expiring_180: b.filter((x) => x.days_to_expiry > 90 && x.days_to_expiry <= 180).length,
    expired: b.filter((x) => x.days_to_expiry < 0).length,
    value_at_risk_90: sum(within90.map((x) => x.inventory_value)),
    by_warehouse_90: sumBy(within90, (x) => x.warehouse_location, (x) => x.inventory_value),
    soonest,
  };
}

function computeShipmentDashboard(world: RawWorld): ApiShipmentDashboard {
  const s = world.shipments;
  const active = s.filter((x) => x.status !== "delivered" && x.status !== "cancelled");
  return {
    total: s.length,
    by_status: countBy(s, (x) => x.status),
    dispatched: s.filter((x) => x.status === "dispatched").length,
    delivered: s.filter((x) => x.status === "delivered").length,
    by_country: countBy(active, (x) => x.destination_country),
  };
}

function computeCommitmentDashboard(world: RawWorld): ApiCommitmentDashboard {
  const c = world.commitments;
  const todayStr = today();
  const open = c.filter((x) => !CLOSED_COMMITMENT.has(x.status.toLowerCase()));
  const fulfilled = c.filter((x) => ["fulfilled", "delivered", "closed"].includes(x.status.toLowerCase()));
  const delayed = c.filter((x) => x.required_delivery_date < todayStr && x.delivered_quantity < x.ordered_quantity);
  const backordered = c.filter((x) => x.backorder_quantity > 0);
  const fillRates = c.filter((x) => x.ordered_quantity > 0).map((x) => (x.allocated_quantity / x.ordered_quantity) * 100);
  const delivered = c.filter((x) => x.delivered_quantity > 0);
  const onTime = delivered.filter((x) => x.required_delivery_date >= (x.expected_fulfillment_date ?? x.required_delivery_date));
  return {
    total_commitments: c.length,
    open_commitments: open.length,
    fulfilled_commitments: fulfilled.length,
    delayed_commitments: delayed.length,
    backordered_commitments: backordered.length,
    average_fill_rate_pct: fillRates.length ? Math.round(sum(fillRates) / fillRates.length) : null,
    otif_pct: delivered.length ? Math.round((onTime.length / delivered.length) * 100) : null,
    total_backorder_value: sum(backordered.map((x) => x.backorder_quantity * productUnit(x.material))),
    high_risk_commitments: c.filter((x) => x.backorder_quantity > 0 && x.required_delivery_date < todayStr).length,
  };
}

function computeConsignmentDashboard(world: RawWorld): ApiConsignmentDashboard {
  const c = world.consignments;
  return {
    total_consignments: c.length,
    total_quantity_sent: sum(c.map((x) => x.quantity_sent)),
    total_remaining: sum(c.map((x) => x.quantity_remaining)),
    no_report_count: c.filter((x) => !x.last_report_date).length,
    aging_count: c.filter((x) => x.sent_date < isoDay(-60)).length,
    expiry_exposure_count: c.filter((x) => x.quantity_remaining > 0 && x.sent_date < isoDay(-45)).length,
    low_consumption_count: c.filter((x) => x.quantity_sent > 0 && x.quantity_consumed / x.quantity_sent < 0.3).length,
    high_risk_count: c.filter((x) => !x.last_report_date && x.sent_date < isoDay(-30)).length,
  };
}

function computeReturnDashboard(world: RawWorld): ApiReturnDashboard {
  const r = world.returns;
  return {
    total_returns: r.length,
    total_returned_quantity: sum(r.map((x) => x.returned_quantity)),
    reusable_quantity: sum(r.map((x) => x.reusable_quantity)),
    rejected_quantity: sum(r.map((x) => x.rejected_quantity)),
    available_quantity: sum(r.map((x) => x.reusable_quantity)),
    pending_inspection: r.filter((x) => !x.inspection_result).length,
    pending_verification: r.filter((x) => x.inspection_result != null && !x.verification_result).length,
    by_reason: countBy(r, (x) => x.return_reason ?? "Unspecified"),
  };
}

function computeExecutiveDashboard(world: RawWorld): ApiExecutiveDashboard {
  const im = world.imports;
  const b = world.batches;
  const s = world.shipments;
  const countries = new Set<string>([...im.map((x) => x.destination_country), ...s.map((x) => x.destination_country)]);
  return {
    total_inventory_value: sum(b.map((x) => x.inventory_value)),
    total_inventory_quantity: sum(b.map((x) => x.quantity_available)),
    open_import_shipments: im.filter((x) => !CLOSED_IMPORT.has(x.status.toLowerCase())).length,
    imports_in_transit: im.filter((x) => x.status.toLowerCase() === "in_transit").length,
    imports_awaiting_receipt: im.filter((x) => ["arrived", "goods_receipt_pending"].includes(x.status.toLowerCase())).length,
    imports_received: im.filter((x) => RECEIVED_IMPORT.has(x.status.toLowerCase())).length,
    open_shipment_requests: s.filter((x) => x.status === "submitted" || x.status === "approved").length,
    dispatched_shipments: s.filter((x) => x.status === "dispatched").length,
    delivered_shipments: s.filter((x) => x.status === "delivered").length,
    expiry_risk_90: b.filter((x) => x.days_to_expiry >= 0 && x.days_to_expiry <= 90).length,
    expired_inventory: b.filter((x) => x.days_to_expiry < 0).length,
    active_warehouses: new Set(b.map((x) => x.warehouse_location)).size,
    active_countries: countries.size,
    learning_rules: 0,
    audit_events: world.goodsReceipts.length + world.dispatches.length,
  };
}

function computeMovementByCountry(world: RawWorld): Record<string, number> {
  const map: Record<string, number> = {};
  for (const im of world.imports) {
    if (CLOSED_IMPORT.has(im.status.toLowerCase())) continue;
    map[im.destination_country] = (map[im.destination_country] ?? 0) + im.lines.reduce((s, l) => s + l.quantity, 0);
  }
  for (const s of world.shipments) {
    if (s.status === "cancelled") continue;
    const qty = s.lines.reduce((a, l) => a + (l.quantity_approved || l.quantity_requested), 0);
    map[s.destination_country] = (map[s.destination_country] ?? 0) + qty;
  }
  return map;
}

// ---- Performance scorecards (target vs actual), aggregated from commitments --
function scorecards(world: RawWorld, scope: string, key: (c: ApiCustomerCommitment) => string): ApiPerformanceScorecard[] {
  const byName = new Map<string, number>();
  for (const c of world.commitments) {
    const qty = c.delivered_quantity > 0 ? c.delivered_quantity : c.shipped_quantity;
    if (qty <= 0) continue;
    byName.set(key(c), (byName.get(key(c)) ?? 0) + qty * productUnit(c.material));
  }
  return [...byName.entries()]
    .sort((a, z) => z[1] - a[1])
    .map(([name, actual]) => {
      const r = seeded(hashStr(`${scope}-${name}`));
      const achievement = seedInt(r, 82, 116);
      const growth = seedInt(r, -4, 22);
      return performanceRow(scope, name, Math.max(actual, 1), achievement, growth);
    });
}
function computeCountryPerformance(world: RawWorld): ApiCountryPerformance[] {
  return scorecards(world, "country", (c) => c.country);
}
function computeVerticalPerformance(world: RawWorld): ApiPerformanceScorecard[] {
  return scorecards(world, "vertical", (c) => productCategory(c.material));
}
function computeDistributorPerformance(world: RawWorld): ApiPerformanceScorecard[] {
  return scorecards(world, "distributor", (c) => c.distributor || c.country);
}
function computeCustomerPerformance(world: RawWorld): ApiPerformanceScorecard[] {
  return scorecards(world, "customer", (c) => c.customer);
}

// =============================================================================
// The two worlds. Static = the rich sample (browsing). Injected = built purely
// from the presenter's counters (the live demo), so it starts at zero and grows.
// =============================================================================

function worldFrom(
  imports: ApiImportFileCandidate[],
  batches: ApiInventoryBatch[],
  commitments: ApiCustomerCommitment[],
  base?: Partial<RawWorld>,
): RawWorld {
  const shipments = base?.shipments ?? deriveShipments(commitments);
  return {
    imports,
    batches,
    commitments,
    shipments,
    dispatches: base?.dispatches ?? deriveDispatches(shipments),
    goodsReceipts: base?.goodsReceipts ?? deriveGoodsReceipts(imports),
    movements: base?.movements ?? deriveMovements(imports, shipments),
    customers: base?.customers ?? deriveCustomers(commitments),
    counts: base?.counts ?? [],
    receivables: deriveReceivables(commitments),
    payables: derivePayables(imports),
    consignments: deriveConsignments(commitments),
    returns: deriveReturns(commitments),
  };
}

// Static world keeps the existing hand-authored lists where they exist (so
// browsing looks exactly as before) and derives the rest.
function staticWorld(): RawWorld {
  return worldFrom(imports(), batches(), customerCommitments(), {
    shipments: shipments(),
    dispatches: dispatches(),
    goodsReceipts: goodsReceipts(),
    movements: movements(),
    customers: customers(),
    counts: inventoryCounts(),
  });
}

// Injected world: everything flows from the three injected primitives, which are
// pure functions of the shared counters — so it is identical on every device and
// starts empty, growing one click at a time.
function injectedWorld(): RawWorld {
  return worldFrom(injectedImportsProvider(), injectedBatchesProvider(), injectedCommitmentsProvider());
}

// =============================================================================
// Presentation routing: during a live walkthrough, every covered endpoint is
// served from the injected world (zero-based, growing). Anything not listed here
// falls through to normal behaviour (real backend, then static sample), so
// master/admin/meta screens keep working.
// =============================================================================
const PRESENTATION_BUILDERS: Record<string, (w: RawWorld) => unknown> = {
  "/imports": (w) => w.imports,
  "/inventory/batches": (w) => w.batches,
  "/customer-commitments": (w) => w.commitments,
  "/shipments": (w) => w.shipments,
  "/dispatches": (w) => w.dispatches,
  "/goods-receipts": (w) => w.goodsReceipts,
  "/movements": (w) => w.movements,
  "/customers": (w) => w.customers,
  "/inventory-counts": (w) => w.counts,
  "/receivables": (w) => w.receivables,
  "/payables": (w) => w.payables,
  "/consignment-inventory": (w) => w.consignments,
  "/returns": (w) => w.returns,
  "/credit-control": (w) => deriveCredit(w.receivables),
  "/country-performance-v2": (w) => computeCountryPerformance(w),
  "/vertical-performance": (w) => computeVerticalPerformance(w),
  "/distributor-performance-v2": (w) => computeDistributorPerformance(w),
  "/customer-performance": (w) => computeCustomerPerformance(w),
  "/dashboard/import": (w) => computeImportDashboard(w),
  "/dashboard/inventory": (w) => computeInventoryDashboard(w),
  "/dashboard/expiry": (w) => computeExpiryDashboard(w),
  "/dashboard/shipment": (w) => computeShipmentDashboard(w),
  "/dashboard/executive": (w) => computeExecutiveDashboard(w),
  "/customer-commitment-dashboard": (w) => computeCommitmentDashboard(w),
  "/consignment-dashboard": (w) => computeConsignmentDashboard(w),
  "/return-dashboard": (w) => computeReturnDashboard(w),
  "/reference/movement-by-country": (w) => computeMovementByCountry(w),
  // Workflow / alert queues auto-fill from the same flow, so a from-zero
  // presentation surfaces real work as imports & orders arrive (not empty).
  "/executive-actions": (w) => deriveExecutiveActions(w),
  "/approvals": (w) => deriveApprovals(w),
  "/decisions": (w) => deriveDecisions(w),
  "/validation-queue": (w) => deriveValidationQueue(w),
  // No synthetic audit/risk lists during a presentation (these record real
  // user actions / model output) — they stay empty until genuinely produced.
  "/audit": () => [],
  "/payment-risk": () => [],
  "/payables-risk": () => [],
  "/consignment-risk": () => [],
  "/commitment-risk": () => [],
};

/** During a live presentation, the value for an endpoint computed purely from
 *  the counters (zero-based and growing), or null when the endpoint is not part
 *  of the presentation (so the caller should fall through to normal behaviour). */
export function presentationValueFor(basePath: string): { value: unknown } | null {
  if (!isPresentationActive()) return null;
  const builder = PRESENTATION_BUILDERS[basePath];
  if (!builder) return null;
  return { value: builder(injectedWorld()) };
}
