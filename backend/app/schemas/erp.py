from typing import Any

from pydantic import BaseModel


class ErpTemplate(BaseModel):
    template_key: str
    template_name: str
    description: str
    source_module: str
    columns: list[str]


class ErpUploadPreviewRequest(BaseModel):
    template_key: str
    auth_token: str


class ErpUploadRow(BaseModel):
    row_number: int
    source_reference: str
    values: dict[str, Any]
    missing_fields: list[str]


class ErpUploadPreview(BaseModel):
    template_key: str
    template_name: str
    generated_at: str
    export_filename: str
    columns: list[str]
    rows: list[ErpUploadRow]
    total_rows: int
    valid_rows: int
    blocked_rows: int
    warnings: list[str] = []
