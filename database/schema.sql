-- Warehouse Inventory and Shipment Management Application
-- PostgreSQL schema for healthcare / medical device operations.

CREATE TABLE roles (
    id BIGSERIAL PRIMARY KEY,
    role_name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_roles (
    user_id BIGINT NOT NULL REFERENCES users(id),
    role_id BIGINT NOT NULL REFERENCES roles(id),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE role_permissions (
    id BIGSERIAL PRIMARY KEY,
    role_id BIGINT NOT NULL REFERENCES roles(id),
    module_name TEXT NOT NULL,
    can_view BOOLEAN NOT NULL DEFAULT FALSE,
    can_create BOOLEAN NOT NULL DEFAULT FALSE,
    can_update BOOLEAN NOT NULL DEFAULT FALSE,
    can_approve BOOLEAN NOT NULL DEFAULT FALSE,
    can_export BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (role_id, module_name)
);

CREATE TABLE product_categories (
    id BIGSERIAL PRIMARY KEY,
    category_code TEXT NOT NULL UNIQUE,
    category_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE uoms (
    id BIGSERIAL PRIMARY KEY,
    uom_code TEXT NOT NULL UNIQUE,
    uom_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    item_code TEXT NOT NULL UNIQUE,
    product_description TEXT NOT NULL,
    product_category_id BIGINT NOT NULL REFERENCES product_categories(id),
    uom_id BIGINT NOT NULL REFERENCES uoms(id),
    product_status TEXT NOT NULL CHECK (product_status IN ('active', 'inactive')),
    shelf_life_months INTEGER CHECK (shelf_life_months IS NULL OR shelf_life_months >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE warehouses (
    id BIGSERIAL PRIMARY KEY,
    warehouse_code TEXT NOT NULL UNIQUE,
    warehouse_name TEXT NOT NULL,
    country TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE customers (
    id BIGSERIAL PRIMARY KEY,
    customer_code TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    country TEXT NOT NULL,
    customer_type TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE suppliers (
    id BIGSERIAL PRIMARY KEY,
    supplier_code TEXT NOT NULL UNIQUE,
    supplier_name TEXT NOT NULL,
    country TEXT NOT NULL,
    contact_person TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE transporters (
    id BIGSERIAL PRIMARY KEY,
    transporter_code TEXT NOT NULL UNIQUE,
    transporter_name TEXT NOT NULL,
    transporter_type TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE inventory_batches (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    batch_number TEXT NOT NULL,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
    quantity_available NUMERIC(18, 3) NOT NULL CHECK (quantity_available >= 0),
    manufacturing_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    unit_value NUMERIC(18, 4) NOT NULL CHECK (unit_value >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, batch_number, warehouse_id)
);

CREATE TABLE inventory_movements (
    id BIGSERIAL PRIMARY KEY,
    movement_number TEXT NOT NULL UNIQUE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('receipt', 'dispatch', 'adjustment', 'reconciliation')),
    product_id BIGINT NOT NULL REFERENCES products(id),
    batch_number TEXT NOT NULL,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
    quantity_change NUMERIC(18, 3) NOT NULL,
    unit_value NUMERIC(18, 4),
    reference_module TEXT NOT NULL,
    reference_id BIGINT NOT NULL,
    movement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by BIGINT REFERENCES users(id)
);

CREATE TABLE goods_receipts (
    id BIGSERIAL PRIMARY KEY,
    grn_number TEXT NOT NULL UNIQUE,
    receipt_date DATE NOT NULL,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
    supplier_id BIGINT NOT NULL REFERENCES suppliers(id),
    status TEXT NOT NULL CHECK (status IN ('draft', 'posted', 'cancelled')),
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE goods_receipt_lines (
    id BIGSERIAL PRIMARY KEY,
    goods_receipt_id BIGINT NOT NULL REFERENCES goods_receipts(id),
    product_id BIGINT NOT NULL REFERENCES products(id),
    batch_number TEXT NOT NULL,
    quantity_received NUMERIC(18, 3) NOT NULL CHECK (quantity_received > 0),
    manufacturing_date DATE,
    expiry_date DATE NOT NULL,
    unit_value NUMERIC(18, 4) NOT NULL CHECK (unit_value >= 0)
);

CREATE TABLE shipment_requests (
    id BIGSERIAL PRIMARY KEY,
    shipment_id TEXT NOT NULL UNIQUE,
    request_date DATE NOT NULL,
    requestor_name TEXT NOT NULL,
    customer_id BIGINT NOT NULL REFERENCES customers(id),
    destination_country TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('normal', 'urgent')),
    required_delivery_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'approved', 'dispatched', 'delivered', 'cancelled')),
    created_by BIGINT REFERENCES users(id),
    approved_by BIGINT REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shipment_lines (
    id BIGSERIAL PRIMARY KEY,
    shipment_request_id BIGINT NOT NULL REFERENCES shipment_requests(id),
    product_id BIGINT NOT NULL REFERENCES products(id),
    inventory_batch_id BIGINT NOT NULL REFERENCES inventory_batches(id),
    quantity_requested NUMERIC(18, 3) NOT NULL CHECK (quantity_requested > 0),
    quantity_approved NUMERIC(18, 3) CHECK (quantity_approved >= 0),
    CHECK (quantity_approved IS NULL OR quantity_approved <= quantity_requested)
);

CREATE TABLE dispatches (
    id BIGSERIAL PRIMARY KEY,
    dispatch_number TEXT NOT NULL UNIQUE,
    shipment_request_id BIGINT NOT NULL REFERENCES shipment_requests(id),
    dispatch_date DATE NOT NULL,
    transporter_id BIGINT NOT NULL REFERENCES transporters(id),
    tracking_number TEXT NOT NULL,
    dispatched_by BIGINT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL CHECK (status IN ('created', 'dispatched', 'delivered', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE physical_inventory_counts (
    id BIGSERIAL PRIMARY KEY,
    inventory_count_id TEXT NOT NULL UNIQUE,
    count_date DATE NOT NULL,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
    status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'approved', 'posted')),
    counted_by BIGINT REFERENCES users(id),
    approved_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE physical_inventory_count_lines (
    id BIGSERIAL PRIMARY KEY,
    physical_inventory_count_id BIGINT NOT NULL REFERENCES physical_inventory_counts(id),
    product_id BIGINT NOT NULL REFERENCES products(id),
    batch_number TEXT NOT NULL,
    system_quantity NUMERIC(18, 3) NOT NULL,
    physical_quantity NUMERIC(18, 3) NOT NULL,
    variance_quantity NUMERIC(18, 3) GENERATED ALWAYS AS (physical_quantity - system_quantity) STORED
);

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id BIGINT REFERENCES users(id),
    action TEXT NOT NULL,
    module_name TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_search ON products (item_code, product_description);
CREATE INDEX idx_inventory_product_batch ON inventory_batches (product_id, batch_number);
CREATE INDEX idx_inventory_expiry ON inventory_batches (expiry_date);
CREATE INDEX idx_shipments_status ON shipment_requests (status);
CREATE INDEX idx_dispatch_tracking ON dispatches (tracking_number);
CREATE INDEX idx_audit_entity ON audit_logs (module_name, entity_name, entity_id);

CREATE TABLE import_files (
    id BIGSERIAL PRIMARY KEY,
    import_file_number TEXT NOT NULL UNIQUE,
    destination_entity TEXT NOT NULL,
    destination_country TEXT NOT NULL,
    destination_warehouse TEXT,
    status TEXT NOT NULL CHECK (
        status IN (
            'documents_pending',
            'uploaded',
            'extracted',
            'validation_pending',
            'validated',
            'country_documents_pending',
            'customs_in_progress',
            'in_transit',
            'arrived',
            'goods_receipt_pending',
            'received',
            'closed'
        )
    ),
    invoice_number TEXT,
    invoice_date DATE,
    awb_number TEXT,
    origin_country TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE import_file_documents (
    id BIGSERIAL PRIMARY KEY,
    import_file_id BIGINT NOT NULL REFERENCES import_files(id),
    document_type TEXT NOT NULL,
    document_number TEXT,
    document_date DATE,
    storage_path TEXT NOT NULL,
    extraction_status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE import_file_lines (
    id BIGSERIAL PRIMARY KEY,
    import_file_id BIGINT NOT NULL REFERENCES import_files(id),
    item_code TEXT NOT NULL,
    product_description TEXT,
    batch_number TEXT NOT NULL,
    serial_number TEXT,
    expiry_date DATE,
    quantity NUMERIC(18, 3) NOT NULL,
    uom TEXT NOT NULL,
    unit_value NUMERIC(18, 4),
    currency TEXT,
    validation_status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE learning_rules (
    id BIGSERIAL PRIMARY KEY,
    document_type TEXT NOT NULL,
    source_text TEXT NOT NULL,
    target_field TEXT NOT NULL,
    confidence NUMERIC(5, 2) NOT NULL DEFAULT 50,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (document_type, source_text, target_field)
);

CREATE TABLE correction_events (
    id BIGSERIAL PRIMARY KEY,
    document_type TEXT NOT NULL,
    field_name TEXT NOT NULL,
    original_value TEXT,
    corrected_value TEXT,
    corrected_by BIGINT REFERENCES users(id),
    document_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE entity_aliases (
    id BIGSERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'customer', 'supplier', 'carrier', 'country', 'uom')),
    alias_text TEXT NOT NULL,
    master_code TEXT NOT NULL,
    confidence NUMERIC(5, 2) NOT NULL DEFAULT 50,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (entity_type, alias_text, master_code)
);

CREATE TABLE product_learning_profiles (
    id BIGSERIAL PRIMARY KEY,
    item_code TEXT NOT NULL UNIQUE,
    product_description TEXT NOT NULL,
    product_category TEXT NOT NULL,
    uom TEXT NOT NULL,
    shelf_life_months INTEGER,
    batch_tracking_required BOOLEAN NOT NULL DEFAULT TRUE,
    serial_tracking_required BOOLEAN NOT NULL DEFAULT FALSE,
    expiry_tracking_required BOOLEAN NOT NULL DEFAULT TRUE,
    storage_condition TEXT,
    temperature_requirement TEXT,
    regulatory_classification TEXT,
    hs_code TEXT,
    default_currency TEXT,
    profile_status TEXT NOT NULL DEFAULT 'complete',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE document_template_signatures (
    id BIGSERIAL PRIMARY KEY,
    template_signature TEXT NOT NULL UNIQUE,
    document_type TEXT NOT NULL,
    supplier_code TEXT,
    country TEXT,
    layout_characteristics JSONB,
    confidence NUMERIC(5, 2) NOT NULL DEFAULT 50,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE warehouse_candidates (
    id BIGSERIAL PRIMARY KEY,
    country TEXT NOT NULL,
    warehouse_name TEXT NOT NULL,
    created_from_import_file TEXT,
    status TEXT NOT NULL DEFAULT 'pending_validation',
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE country_document_requirement_rules (
    id BIGSERIAL PRIMARY KEY,
    country TEXT NOT NULL,
    vertical TEXT NOT NULL,
    material_code TEXT NOT NULL,
    required_document_type TEXT NOT NULL,
    confidence NUMERIC(5, 2) NOT NULL DEFAULT 50,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (country, vertical, material_code, required_document_type)
);

CREATE TABLE product_profile_edit_events (
    id BIGSERIAL PRIMARY KEY,
    item_code TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    edit_reason TEXT NOT NULL,
    edited_by BIGINT REFERENCES users(id),
    edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_import_files_status ON import_files (status);
CREATE INDEX idx_import_files_invoice ON import_files (invoice_number);
CREATE INDEX idx_import_files_awb ON import_files (awb_number);
CREATE INDEX idx_import_lines_item_batch ON import_file_lines (item_code, batch_number);
CREATE INDEX idx_learning_rules_lookup ON learning_rules (document_type, source_text);
CREATE INDEX idx_entity_alias_lookup ON entity_aliases (entity_type, alias_text);
CREATE INDEX idx_country_doc_req_lookup ON country_document_requirement_rules (country, vertical, material_code);
CREATE INDEX idx_product_profile_edits ON product_profile_edit_events (item_code, field_name);

CREATE VIEW inventory_value_by_warehouse AS
SELECT
    w.warehouse_code,
    w.warehouse_name,
    SUM(ib.quantity_available * ib.unit_value) AS inventory_value
FROM inventory_batches ib
JOIN warehouses w ON w.id = ib.warehouse_id
GROUP BY w.warehouse_code, w.warehouse_name;

CREATE VIEW expiry_buckets AS
SELECT
    p.item_code,
    p.product_description,
    ib.batch_number,
    w.warehouse_code,
    ib.quantity_available,
    ib.expiry_date,
    ib.expiry_date - CURRENT_DATE AS days_to_expiry,
    CASE
        WHEN ib.expiry_date - CURRENT_DATE BETWEEN 0 AND 90 THEN '0-90 Days'
        WHEN ib.expiry_date - CURRENT_DATE BETWEEN 91 AND 180 THEN '91-180 Days'
        WHEN ib.expiry_date - CURRENT_DATE BETWEEN 181 AND 365 THEN '181-365 Days'
        WHEN ib.expiry_date - CURRENT_DATE > 365 THEN 'Above 365 Days'
        ELSE 'Expired'
    END AS expiry_bucket
FROM inventory_batches ib
JOIN products p ON p.id = ib.product_id
JOIN warehouses w ON w.id = ib.warehouse_id;
