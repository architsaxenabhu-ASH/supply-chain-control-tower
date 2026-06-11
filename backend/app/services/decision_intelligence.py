"""Decision Intelligence (Phase 4, P5): effectiveness, history, and rule-based
similarity over the existing /decisions store.

No AI - similarity is a transparent weighted overlap of problem type, decision
type, related entities, and context keywords. The system shows how similar
situations were handled; management decides.
"""

from __future__ import annotations

import re

from app.schemas.decisions import DecisionEffectiveness, SimilarDecision
from app.services.decision_repository import list_decisions

_STOPWORDS = {"the", "a", "an", "to", "of", "for", "and", "or", "is", "in", "on", "with", "due", "by"}


def decision_effectiveness(owner: str | None = None, problem_type: str | None = None) -> list[DecisionEffectiveness]:
    rows: list[DecisionEffectiveness] = []
    for decision in list_decisions():
        if owner and (decision.owner or "").lower() != owner.lower():
            continue
        if problem_type and (decision.problem_type or "").lower() != problem_type.lower():
            continue
        if decision.actual_outcome is None and decision.effectiveness is None:
            continue  # only decisions with a recorded outcome
        rows.append(
            DecisionEffectiveness(
                decision_id=decision.decision_id,
                decision_type=decision.decision_type,
                problem_type=decision.problem_type,
                owner=decision.owner,
                expected_outcome=decision.expected_outcome,
                actual_outcome=decision.actual_outcome,
                effectiveness=decision.effectiveness,
                status=decision.status,
            )
        )
    return rows


def decision_history(owner: str | None = None, problem_type: str | None = None, related: str | None = None):
    decisions = list_decisions()
    if owner:
        decisions = [d for d in decisions if (d.owner or "").lower() == owner.lower()]
    if problem_type:
        decisions = [d for d in decisions if (d.problem_type or "").lower() == problem_type.lower()]
    if related:
        needle = related.lower()
        decisions = [
            d
            for d in decisions
            if needle in (d.related_product or "").lower()
            or needle in (d.related_customer or "").lower()
            or needle in (d.related_supplier or "").lower()
            or needle in (d.related_shipment or "").lower()
            or needle in (d.related_batch or "").lower()
        ]
    return decisions


def _keywords(text: str | None) -> set[str]:
    if not text:
        return set()
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in _STOPWORDS and len(w) > 2}


def decision_similarity(
    problem_type: str | None = None,
    decision_type: str | None = None,
    context: str | None = None,
    related_product: str | None = None,
    related_customer: str | None = None,
    related_supplier: str | None = None,
    limit: int = 10,
) -> list[SimilarDecision]:
    context_words = _keywords(context)
    results: list[SimilarDecision] = []

    for decision in list_decisions():
        score = 0
        matched: list[str] = []
        if problem_type and (decision.problem_type or "").lower() == problem_type.lower():
            score += 40
            matched.append("problem_type")
        if decision_type and decision.decision_type.lower() == decision_type.lower():
            score += 20
            matched.append("decision_type")
        if related_product and (decision.related_product or "").lower() == related_product.lower():
            score += 20
            matched.append("related_product")
        if related_customer and (decision.related_customer or "").lower() == related_customer.lower():
            score += 15
            matched.append("related_customer")
        if related_supplier and (decision.related_supplier or "").lower() == related_supplier.lower():
            score += 15
            matched.append("related_supplier")
        if context_words:
            decision_words = _keywords(decision.context) | _keywords(decision.reason)
            overlap = context_words & decision_words
            if overlap:
                union = context_words | decision_words
                score += round(len(overlap) / len(union) * 25)
                matched.append("context")

        if score > 0:
            results.append(
                SimilarDecision(
                    decision_id=decision.decision_id,
                    decision_type=decision.decision_type,
                    problem_type=decision.problem_type,
                    owner=decision.owner,
                    reason=decision.reason,
                    expected_outcome=decision.expected_outcome,
                    actual_outcome=decision.actual_outcome,
                    effectiveness=decision.effectiveness,
                    similarity_score=score,
                    matched_on=matched,
                )
            )
    return sorted(results, key=lambda r: -r.similarity_score)[:limit]
