from datetime import UTC, datetime
from typing import Any, Callable

from app.schemas.erp import ErpTemplate, ErpUploadPreview, ErpUploadPreviewRequest, ErpUploadRow
from app.services.import_repository import list_import_candidates
from app.services.security_repository import authenticate_token, permissions_for_role
from app.services.warehouse_repository import (
    get_product,
    list_dispatches,
    list_goods_receipts,
    list_inventory_batches,
    list_shipments,
)


ERP_TEMPLATES = [
    ErpTemplate(
        template_key="inventory_balance",
        template_name="Inventory Balance Upload",
        description="Current batch-level stock, value, expiry, and warehouse balance.",
        source_module="Inventory",
        columns=[
            "TEMPLATE",
            "MATERIAL_CODE",
            "MATERIAL_DESCRIPTION",
            "PRODUCT_CATEGORY",
            "BATCH_NUMBER",
            "WAREHOUSE",
            "QUANTITY",
            "UOM",
            "EXPIRY_DATE",
            "UNIT_VALUE",
            "INVENTORY_VALUE",
            "EXPIRY_BUCKET",
        ],
    ),
    ErpTemplate(
        template_key="goods_receipt",
        template_name="Goods Receipt Upload",
        description="Posted receipt lines ready for ERP GRN or stock receipt upload.",
        source_module="Receipts",
        columns=[
            "TEMPLATE",
            "MOVEMENT_TYPE",
            "GRN_NUMBER",
            "RECEIPT_DATE",
            "WAREHOUSE",
            "SUPPLIER",
            "MATERIAL_CODE",
            "BATCH_NUMBER",
            "QUANTITY",
            "UOM",
            "EXPIRY_DATE",
            "UNIT_VALUE",
        ],
    ),
    ErpTemplate(
        template_key="dispatch_issue",
        template_name="Dispatch Goods Issue Upload",
        description="Dispatched shipment lines ready for ERP goods issue upload.",
        source_module="Dispatches",
        columns=[
            "TEMPLATE",
            "MOVEMENT_TYPE",
            "DISPATCH_NUMBER",
            "SHIPMENT_ID",
            "DISPATCH_DATE",
            "CUSTOMER_NAME",
            "DESTINATION_COUNTRY",
            "TRANSPORTER",
            "TRACKING_NUMBER",
            "MATERIAL_CODE",
            "BATCH_NUMBER",
            "WAREHOUSE",
            "QUANTITY",
            "UOM",
        ],
    ),
    ErpTemplate(
        template_key="import_receipt",
        template_name="Import Receipt Upload",
        description="Validated import file lines staged for country ERP receipt templates.",
        source_module="Imports",
        columns=[
            "TEMPLATE",
            "SHIPMENT_NAME",
            "VERTICAL",
            "IMPORT_FILE",
            "STATUS",
            "DESTINATION_ENTITY",
            "DESTINATION_COUNTRY",
            "SUPPLIER",
            "INVOICE_NUMBER",
            "AWB_NUMBER",
            "MATERIAL_CODE",
            "MATERIAL_DESCRIPTION",
            "BATCH_NUMBER",
            "QUANTITY",
            "UOM",
            "EXPIRY_DATE",
            "UNIT_VALUE",
            "CURRENCY",
            "LINE_STATUS",
        ],
    ),
]

REQUIRED_FIELDS = {
    "inventory_balance": ["MATERIAL_CODE", "BATCH_NUMBER", "WAREHOUSE", "QUANTITY", "UOM", "EXPIRY_DATE"],
    "goods_receipt": ["GRN_NUMBER", "RECEIPT_DATE", "WAREHOUSE", "MATERIAL_CODE", "BATCH_NUMBER", "QUANTITY", "UOM"],
    "dispatch_issue": ["DISPATCH_NUMBER", "SHIPMENT_ID", "MATERIAL_CODE", "BATCH_NUMBER", "WAREHOUSE", "QUANTITY", "UOM"],
    "import_receipt": ["IMPORT_FILE", "DESTINATION_COUNTRY", "MATERIAL_CODE", "BATCH_NUMBER", "QUANTITY", "UOM", "EXPIRY_DATE"],
}


def list_erp_templates() -> list[ErpTemplate]:
    return ERP_TEMPLATES


def preview_erp_upload(request: ErpUploadPreviewRequest) -> ErpUploadPreview:
    user = authenticate_token(request.auth_token)
    permissions = set(permissions_for_role(user.role_name))
    if not permissions.intersection({"reports_export", "import_approval", "goods_receipt", "security"}):
        raise ValueError(f"{user.role_name} is not allowed to generate ERP uploads.")

    template = get_template(request.template_key)
    row_builders: dict[str, Callable[[], list[tuple[str, dict[str, Any]]]]] = {
        "inventory_balance": inventory_balance_rows,
        "goods_receipt": goods_receipt_rows,
        "dispatch_issue": dispatch_issue_rows,
        "import_receipt": import_receipt_rows,
    }
    raw_rows = row_builders[template.template_key]()
    rows = [
        ErpUploadRow(
            row_number=index,
            source_reference=source_reference,
            values=normalize_row_values(values, template.columns),
            missing_fields=find_missing_fields(template.template_key, values),
        )
        for index, (source_reference, values) in enumerate(raw_rows, start=1)
    ]
    warnings: list[str] = []
    if not rows:
        warnings.append("No source transactions are available for this ERP template.")
    if any(row.missing_fields for row in rows):
        warnings.append("Some rows are blocked because mandatory ERP fields are missing.")

    timestamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
    return ErpUploadPreview(
        template_key=template.template_key,
        template_name=template.template_name,
        generated_at=datetime.now(UTC).isoformat(),
        export_filename=f"{template.template_key}-{timestamp}.csv",
        columns=template.columns,
        rows=rows,
        total_rows=len(rows),
        valid_rows=sum(1 for row in rows if not row.missing_fields),
        blocked_rows=sum(1 for row in rows if row.missing_fields),
        warnings=warnings,
    )


def get_template(template_key: str) -> ErpTemplate:
    normalized_key = template_key.strip().lower()
    template = next((saved_template for saved_template in ERP_TEMPLATES if saved_template.template_key == normalized_key), None)
    if not template:
        raise ValueError("Select a valid ERP template.")
    return template


def inventory_balance_rows() -> list[tuple[str, dict[str, Any]]]:
    rows: list[tuple[str, dict[str, Any]]] = []
    for batch in list_inventory_batches():
        product = get_product(batch.item_code)
        rows.append(
            (
                f"{batch.item_code}/{batch.batch_number}/{batch.warehouse_location}",
                {
                    "TEMPLATE": "INVENTORY_BALANCE",
                    "MATERIAL_CODE": batch.item_code,
                    "MATERIAL_DESCRIPTION": batch.product_description,
                    "PRODUCT_CATEGORY": batch.product_category,
                    "BATCH_NUMBER": batch.batch_number,
                    "WAREHOUSE": batch.warehouse_location,
                    "QUANTITY": batch.quantity_available,
                    "UOM": product.uom if product else "",
                    "EXPIRY_DATE": batch.expiry_date,
                    "UNIT_VALUE": batch.unit_value,
                    "INVENTORY_VALUE": batch.inventory_value,
                    "EXPIRY_BUCKET": batch.expiry_bucket,
                },
            )
        )
    return rows


def goods_receipt_rows() -> list[tuple[str, dict[str, Any]]]:
    rows: list[tuple[str, dict[str, Any]]] = []
    for receipt in list_goods_receipts():
        for line in receipt.lines:
            product = get_product(line.item_code)
            rows.append(
                (
                    f"{receipt.grn_number}/{line.item_code}/{line.batch_number}",
                    {
                        "TEMPLATE": "GOODS_RECEIPT",
                        "MOVEMENT_TYPE": "GR",
                        "GRN_NUMBER": receipt.grn_number,
                        "RECEIPT_DATE": receipt.receipt_date,
                        "WAREHOUSE": receipt.warehouse,
                        "SUPPLIER": receipt.supplier,
                        "MATERIAL_CODE": line.item_code,
                        "BATCH_NUMBER": line.batch_number,
                        "QUANTITY": line.quantity_received,
                        "UOM": product.uom if product else "",
                        "EXPIRY_DATE": line.expiry_date,
                        "UNIT_VALUE": line.unit_value,
                    },
                )
            )
    return rows


def dispatch_issue_rows() -> list[tuple[str, dict[str, Any]]]:
    rows: list[tuple[str, dict[str, Any]]] = []
    shipments_by_id = {shipment.shipment_id: shipment for shipment in list_shipments()}
    for dispatch in list_dispatches():
        shipment = shipments_by_id.get(dispatch.shipment_id)
        for line in shipment.lines if shipment else []:
            product = get_product(line.item_code)
            rows.append(
                (
                    f"{dispatch.dispatch_number}/{line.item_code}/{line.batch_number}",
                    {
                        "TEMPLATE": "DISPATCH_GOODS_ISSUE",
                        "MOVEMENT_TYPE": "GI",
                        "DISPATCH_NUMBER": dispatch.dispatch_number,
                        "SHIPMENT_ID": dispatch.shipment_id,
                        "DISPATCH_DATE": dispatch.dispatch_date,
                        "CUSTOMER_NAME": shipment.customer_name if shipment else "",
                        "DESTINATION_COUNTRY": shipment.destination_country if shipment else "",
                        "TRANSPORTER": dispatch.transporter_courier,
                        "TRACKING_NUMBER": dispatch.tracking_number,
                        "MATERIAL_CODE": line.item_code,
                        "BATCH_NUMBER": line.batch_number,
                        "WAREHOUSE": line.warehouse_location,
                        "QUANTITY": line.quantity_approved,
                        "UOM": product.uom if product else "",
                    },
                )
            )
    return rows


def import_receipt_rows() -> list[tuple[str, dict[str, Any]]]:
    rows: list[tuple[str, dict[str, Any]]] = []
    for candidate in list_import_candidates():
        for line in candidate.lines:
            rows.append(
                (
                    f"{candidate.import_file_number}/{line.item_code}/{line.batch_number or 'missing-batch'}",
                    {
                        "TEMPLATE": "IMPORT_RECEIPT",
                        "SHIPMENT_NAME": candidate.shipment_name or candidate.import_file_number,
                        "VERTICAL": candidate.shipment_vertical,
                        "IMPORT_FILE": candidate.import_file_number,
                        "STATUS": candidate.status.value,
                        "DESTINATION_ENTITY": candidate.destination_entity,
                        "DESTINATION_COUNTRY": candidate.destination_country,
                        "SUPPLIER": candidate.supplier_name,
                        "INVOICE_NUMBER": candidate.invoice_number,
                        "AWB_NUMBER": candidate.awb_number,
                        "MATERIAL_CODE": line.item_code,
                        "MATERIAL_DESCRIPTION": line.product_description,
                        "BATCH_NUMBER": line.batch_number,
                        "QUANTITY": line.quantity,
                        "UOM": line.uom,
                        "EXPIRY_DATE": line.expiry_date,
                        "UNIT_VALUE": line.unit_value,
                        "CURRENCY": line.currency,
                        "LINE_STATUS": line.product_profile_status,
                    },
                )
            )
    return rows


def normalize_row_values(values: dict[str, Any], columns: list[str]) -> dict[str, Any]:
    return {column: values.get(column) for column in columns}


def find_missing_fields(template_key: str, values: dict[str, Any]) -> list[str]:
    missing_fields: list[str] = []
    for field_name in REQUIRED_FIELDS.get(template_key, []):
        value = values.get(field_name)
        if value is None or str(value).strip() == "":
            missing_fields.append(field_name)
    return missing_fields
