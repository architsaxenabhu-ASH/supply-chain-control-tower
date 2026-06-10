"""Learning engine foundation: document templates are collected and reinforced."""

from app.schemas.learning import DocumentTemplateRequest
from app.services import learning_repository as lr


def test_recording_same_template_twice_reinforces_one_record():
    lr.DOCUMENT_TEMPLATES.clear()
    lr.record_document_template(
        DocumentTemplateRequest(
            supplier_name="Meril Life Sciences",
            document_type="commercial_invoice",
            field_labels=["Invoice No.", "HSN code"],
            recorded_by="qa@example.com",
        )
    )
    lr.record_document_template(
        DocumentTemplateRequest(
            supplier_name="Meril Life Sciences",
            document_type="commercial_invoice",
            field_labels=["HSN code", "Material Code"],
            recorded_by="qa@example.com",
        )
    )

    templates = lr.list_document_templates()
    assert len(templates) == 1
    template = templates[0]
    assert template.sample_count == 2
    # Field labels are unioned across samples.
    assert set(template.field_labels) == {"Invoice No.", "HSN code", "Material Code"}


def test_distinct_supplier_or_doc_type_is_a_separate_template():
    lr.DOCUMENT_TEMPLATES.clear()
    lr.record_document_template(
        DocumentTemplateRequest(supplier_name="A", document_type="commercial_invoice", recorded_by="qa")
    )
    lr.record_document_template(
        DocumentTemplateRequest(supplier_name="A", document_type="packing_list", recorded_by="qa")
    )
    assert len(lr.list_document_templates()) == 2
