"""Learning Foundation (Phase 4, P7): /learning-insights.

Historical pattern aggregation over the decision store - no autonomous learning,
no prediction, no AI. Success = a decision whose recorded effectiveness is
"effective". Learning model: Problem + Context + Decision + Reason + Outcome.
"""

from __future__ import annotations

from collections import defaultdict

from app.schemas.decisions import DecisionLearningInsights, LearningPattern
from app.services.decision_repository import list_decisions

MIN_COUNT_FOR_SUCCESS_RANKING = 2


def _patterns(grouped: dict[str, list]) -> list[LearningPattern]:
    patterns: list[LearningPattern] = []
    for key, decisions in grouped.items():
        with_outcome = [d for d in decisions if d.effectiveness]
        effective = sum(1 for d in decisions if d.effectiveness == "effective")
        patterns.append(
            LearningPattern(
                key=key,
                count=len(decisions),
                effective=effective,
                success_rate_pct=round(effective / len(with_outcome) * 100, 1) if with_outcome else None,
            )
        )
    return patterns


def learning_insights() -> DecisionLearningInsights:
    decisions = list_decisions()
    with_outcome = [d for d in decisions if d.effectiveness]
    effective_total = sum(1 for d in decisions if d.effectiveness == "effective")

    by_type: dict[str, list] = defaultdict(list)
    by_owner: dict[str, list] = defaultdict(list)
    by_problem: dict[str, list] = defaultdict(list)
    for decision in decisions:
        by_type[decision.decision_type].append(decision)
        by_owner[decision.owner or "unassigned"].append(decision)
        by_problem[decision.problem_type or "unspecified"].append(decision)

    type_patterns = _patterns(by_type)
    most_common = sorted(type_patterns, key=lambda p: -p.count)[:10]
    most_successful = sorted(
        [p for p in type_patterns if p.count >= MIN_COUNT_FOR_SUCCESS_RANKING and p.success_rate_pct is not None],
        key=lambda p: -(p.success_rate_pct or 0),
    )[:10]

    return DecisionLearningInsights(
        total_decisions=len(decisions),
        decisions_with_outcome=len(with_outcome),
        overall_success_rate_pct=round(effective_total / len(with_outcome) * 100, 1) if with_outcome else None,
        most_common_decisions=most_common,
        most_successful_decisions=most_successful,
        by_owner=sorted(_patterns(by_owner), key=lambda p: -p.count),
        by_problem_type=sorted(_patterns(by_problem), key=lambda p: -p.count),
    )
