from app.schemas.extraction import ExtractedField
from app.schemas.master_candidates import MasterCandidate, MasterCandidateType


def generate_master_candidates(
    document_id: str,
    extracted_fields: list[ExtractedField],
) -> list[MasterCandidate]:
    values = {
        field.field_name: field.extracted_value
        for field in extracted_fields
        if field.extracted_value
    }

    candidates: list[MasterCandidate] = []

    add_party_candidate(
        candidates=candidates,
        document_id=document_id,
        values=values,
        candidate_type=MasterCandidateType.SUPPLIER,
        name_field="Supplier Name",
        code_field="Supplier Code",
        extra_fields=[
            "Supplier Address",
            "Supplier Country",
            "Supplier Tax ID",
            "Supplier GST/VAT Number",
            "Shipper Name",
            "Shipper Address",
        ],
    )
    add_party_candidate(
        candidates=candidates,
        document_id=document_id,
        values=values,
        candidate_type=MasterCandidateType.CUSTOMER,
        name_field="Customer Name",
        code_field="Customer Code",
        extra_fields=[
            "Customer Address",
            "Customer Country",
            "Customer Tax ID",
            "Customer GST/VAT Number",
            "Consignee Name",
            "Consignee Address",
        ],
    )
    add_party_candidate(
        candidates=candidates,
        document_id=document_id,
        values=values,
        candidate_type=MasterCandidateType.CARRIER,
        name_field="Carrier Name",
        code_field=None,
        extra_fields=["Carrier", "Forwarder", "Forwarder Name"],
    )
    add_party_candidate(
        candidates=candidates,
        document_id=document_id,
        values=values,
        candidate_type=MasterCandidateType.PRODUCT,
        name_field="Product Name",
        code_field="Product Code",
        extra_fields=[
            "SKU",
            "Part Number",
            "Model Number",
            "UDI Number",
            "GTIN",
            "Device Classification",
        ],
    )

    add_simple_candidates(candidates, document_id, values, MasterCandidateType.UOM, ["UOM"])
    add_simple_candidates(candidates, document_id, values, MasterCandidateType.CURRENCY, ["Currency"])
    add_simple_candidates(
        candidates,
        document_id,
        values,
        MasterCandidateType.COUNTRY,
        [
            "Country of Origin",
            "Country of Export",
            "Country of Import",
            "Supplier Country",
            "Customer Country",
        ],
    )

    return candidates


def add_party_candidate(
    candidates: list[MasterCandidate],
    document_id: str,
    values: dict[str, str],
    candidate_type: MasterCandidateType,
    name_field: str,
    code_field: str | None,
    extra_fields: list[str],
) -> None:
    candidate_name = values.get(name_field)
    candidate_code = values.get(code_field) if code_field else None

    if not candidate_name and candidate_type == MasterCandidateType.SUPPLIER:
        candidate_name = values.get("Shipper Name")
    if not candidate_name and candidate_type == MasterCandidateType.CUSTOMER:
        candidate_name = values.get("Consignee Name")
    if not candidate_name and candidate_type == MasterCandidateType.CARRIER:
        candidate_name = values.get("Carrier")

    if not candidate_name and not candidate_code:
        return

    source_fields = {
        field_name: value
        for field_name, value in values.items()
        if field_name in {name_field, code_field, *extra_fields}
    }

    candidates.append(
        MasterCandidate(
            document_id=document_id,
            candidate_type=candidate_type,
            candidate_name=candidate_name or candidate_code or "Unknown",
            candidate_code=candidate_code,
            source_fields=source_fields,
        )
    )


def add_simple_candidates(
    candidates: list[MasterCandidate],
    document_id: str,
    values: dict[str, str],
    candidate_type: MasterCandidateType,
    field_names: list[str],
) -> None:
    seen: set[str] = set()
    for field_name in field_names:
        value = values.get(field_name)
        if not value or value in seen:
            continue
        seen.add(value)
        candidates.append(
            MasterCandidate(
                document_id=document_id,
                candidate_type=candidate_type,
                candidate_name=value,
                source_fields={field_name: value},
            )
        )

