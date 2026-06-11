from pydantic import BaseModel, Field


class ReviewItem(BaseModel):
    reference: str
    source: str
    detail: dict = Field(default_factory=dict)


class ReviewResponse(BaseModel):
    review_type: str
    summary: dict = Field(default_factory=dict)
    items: list[ReviewItem] = Field(default_factory=list)
