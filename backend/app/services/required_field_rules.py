from app.schemas.extraction import DocumentType, ExtractedField
from app.schemas.validation_rules import RequiredFieldCheck


REQUIRED_FIELD_GROUPS: dict[DocumentType, list[tuple[str, list[str]]]] = {
    DocumentType.COMMERCIAL_INVOICE: [
        ("Invoice Identity", ["Invoice Number"]),
        ("Invoice Date", ["Invoice Date"]),
        ("Seller", ["Supplier Name", "Shipper Name"]),
        ("Buyer", ["Customer Name", "Consignee Name"]),
        ("Product Identity", ["Product Code", "Product Name", "SKU", "Part Number", "Model Number"]),
        ("Quantity", ["Quantity"]),
        ("UOM", ["UOM"]),
        ("Traceability", ["Batch Number", "Lot Number", "Serial Number"]),
        ("Expiry", ["Expiry Date"]),
        ("Shipment Reference", ["AWB Number", "MAWB Number", "HAWB Number", "Shipment Reference"]),
    ],
    DocumentType.PACKING_LIST: [
        ("Packing List Identity", ["Packing List Number"]),
        ("Linked Invoice", ["Invoice Number"]),
        ("Product Identity", ["Product Code", "Product Name", "SKU", "Part Number", "Model Number"]),
        ("Quantity", ["Quantity"]),
        ("UOM", ["UOM"]),
        ("Traceability", ["Batch Number", "Lot Number", "Serial Number"]),
        ("Package Identity", ["Package Number", "Box Number", "Pallet Number", "Carton Number"]),
        ("Weight", ["Gross Weight", "Net Weight"]),
        ("Shipment Reference", ["AWB Number", "Shipment Reference", "Container Number"]),
    ],
    DocumentType.AIR_WAYBILL: [
        ("AWB Identity", ["AWB Number", "MAWB Number", "HAWB Number"]),
        ("Shipment Date", ["Shipment Date", "Issue Date"]),
        ("Shipper", ["Shipper Name", "Supplier Name"]),
        ("Consignee", ["Consignee Name", "Customer Name"]),
        ("Carrier", ["Carrier Name", "Carrier"]),
        ("Origin", ["Origin Airport"]),
        ("Destination", ["Destination Airport"]),
        ("Package Count", ["Number Of Packages"]),
        ("Weight", ["Gross Weight", "Chargeable Weight"]),
    ],
    DocumentType.BILL_OF_LADING: [
        ("BOL Identity", ["BOL Number"]),
        ("Container", ["Container Number"]),
        ("Seal", ["Seal Number"]),
        ("Loading Port", ["Port Of Loading"]),
        ("Discharge Port", ["Port Of Discharge"]),
    ],
    DocumentType.BILL_OF_ENTRY: [
        ("BOE Identity", ["BOE Number"]),
        ("BOE Date", ["BOE Date"]),
        ("HS Code", ["HS Code"]),
        ("Customs Value", ["Customs Value"]),
        ("Importer", ["Importer Name"]),
        ("Exporter", ["Exporter Name"]),
    ],
}


def check_required_fields(
    document_type: DocumentType,
    extracted_fields: list[ExtractedField],
) -> list[RequiredFieldCheck]:
    field_values = {
        field.field_name: field.corrected_value or field.extracted_value
        for field in extracted_fields
        if field.corrected_value or field.extracted_value
    }

    checks: list[RequiredFieldCheck] = []
    for requirement_name, accepted_fields in REQUIRED_FIELD_GROUPS[document_type]:
        matched_field = None
        matched_value = None

        for field_name in accepted_fields:
            value = field_values.get(field_name)
            if value:
                matched_field = field_name
                matched_value = value
                break

        checks.append(
            RequiredFieldCheck(
                requirement_name=requirement_name,
                accepted_fields=accepted_fields,
                is_satisfied=matched_field is not None,
                matched_field=matched_field,
                matched_value=matched_value,
            )
        )

    return checks

