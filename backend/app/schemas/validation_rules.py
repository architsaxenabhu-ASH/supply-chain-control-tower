from pydantic import BaseModel


class RequiredFieldCheck(BaseModel):
    requirement_name: str
    accepted_fields: list[str]
    is_satisfied: bool
    matched_field: str | None = None
    matched_value: str | None = None

