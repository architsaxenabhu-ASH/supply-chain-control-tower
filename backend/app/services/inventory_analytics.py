"""Healthcare inventory intelligence.

This module turns the live stock picture into the analyses a medical-device
business actually needs — not just "stock in hand minus sales", but money
(ABC), medical importance (VED), movement speed (FSN), demand predictability
(XYZ), expiry risk (FEFO), replenishment safety (reorder point + safety stock)
and supplier risk — combined into one plain-language Priority Score per item.

Everything is derived from the SAME live collections the rest of the app uses
(inventory batches, shipment demand, goods receipts). Nothing is hardcoded per
product, so the numbers move automatically as goods are received, shipped, or
sample data is injected during a demo.

Where a method needs data we do not yet capture (e.g. cold-chain temperature
logs or UDI device identifiers), it is reported honestly as "needs data"
rather than faked.
"""

from __future__ import annotations

from datetime import date
from statistics import pstdev

from pydantic import BaseModel

from app.schemas.warehouse import InventoryBatch
from app.services import warehouse_repository as repo


# --- Tunable assumptions (kept explicit so the business can see them) ---------

# How many trailing months of shipment demand we analyse.
ANALYSIS_MONTHS = 6
# Replenishment lead time assumption until real per-supplier lead times are
# captured from purchase orders. Surfaced to the user as an assumption.
DEFAULT_LEAD_TIME_DAYS = 30

# Target availability by medical importance (service-level segmentation) and
# the matching safety-factor Z from the normal distribution.
SERVICE_LEVEL = {"Vital": 0.99, "Essential": 0.97, "Desirable": 0.90}
SERVICE_Z = {"Vital": 2.33, "Essential": 1.88, "Desirable": 1.28}

# Demand statuses that count as real demand signal (exclude draft / cancelled).
_DEMAND_STATUSES = {"submitted", "approved", "dispatched", "delivered"}
_COMMITTED_STATUSES = {"approved", "dispatched", "delivered"}


# --- Response models ----------------------------------------------------------


class MethodStatus(BaseModel):
    key: str
    name: str  # the recognised methodology name
    plain_title: str  # what a business owner would call it
    what_it_tells_you: str
    status: str  # "live" | "needs_data"
    note: str | None = None


class ClassBucket(BaseModel):
    key: str
    label: str
    count: int
    value: float


class MatrixRow(BaseModel):
    abc: str
    vital: int
    essential: int
    desirable: int


class SkuIntelligence(BaseModel):
    item_code: str
    product_description: str
    product_category: str
    warehouses: list[str]
    on_hand_qty: float
    on_hand_value: float
    avg_monthly_demand: float
    annual_consumption_value: float
    months_cover: float | None
    abc_class: str
    criticality: str
    criticality_basis: str
    fsn_class: str
    xyz_class: str
    demand_cv: float | None
    reorder_point: float
    safety_stock: float
    service_level: float
    below_reorder: bool
    min_days_to_expiry: int | None
    nearest_expiry_date: str | None
    expiry_risk_qty: float
    expiry_risk_value: float
    supplier: str | None
    supplier_risk: str
    supplier_risk_basis: str
    priority_score: int
    priority_band: str
    review_cadence: str
    recommended_action: str


class Alert(BaseModel):
    kind: str  # reorder | expiry | dead_stock
    severity: str  # high | medium | low
    item_code: str
    batch_number: str | None = None
    title: str
    detail: str
    action: str


class OwnerMetrics(BaseModel):
    inventory_value: float
    critical_stockout_count: int
    critical_stockout_value: float
    expiry_risk_value: float
    dead_stock_value: float
    fill_rate: float | None
    inventory_turnover: float | None
    days_of_inventory: float | None
    supplier_delay_risk_count: int


class InventoryIntelligence(BaseModel):
    generated_at: str
    currency_note: str
    assumptions: dict[str, str]
    owner_metrics: OwnerMetrics
    abc_breakdown: list[ClassBucket]
    ved_breakdown: list[ClassBucket]
    fsn_breakdown: list[ClassBucket]
    xyz_breakdown: list[ClassBucket]
    abc_ved_matrix: list[MatrixRow]
    priority_bands: list[ClassBucket]
    skus: list[SkuIntelligence]
    alerts: list[Alert]
    methods: list[MethodStatus]


# --- Helpers ------------------------------------------------------------------


def _month_key(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _recent_month_keys(today: date, months: int) -> list[str]:
    """The trailing `months` month-buckets, oldest first, including this month."""
    keys: list[str] = []
    year, month = today.year, today.month
    for _ in range(months):
        keys.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    return list(reversed(keys))


def _line_demand_qty(status: str, requested: float, approved: float) -> float:
    """Realistic demand for a line: approved once committed, else requested."""
    if status in _COMMITTED_STATUSES and approved > 0:
        return approved
    return requested


def _abc_from_cumulative(share_before: float) -> str:
    # Pareto split by the share of value reached BEFORE this item, so an item
    # that spans the 70% line still counts as A (the items that make up the
    # first ~70% of value). First 70% = A, next 20% = B, last 10% = C.
    if share_before < 0.70:
        return "A"
    if share_before < 0.90:
        return "B"
    return "C"


def _xyz_from_cv(cv: float | None) -> str:
    if cv is None:
        return "Z"  # no/erratic demand → unpredictable
    if cv <= 0.5:
        return "X"
    if cv <= 1.0:
        return "Y"
    return "Z"


def _simulate_fefo_expiry(
    item_batches: list[InventoryBatch], avg_monthly_demand: float, today: date
) -> tuple[float, float]:
    """Walk stock forward First-Expiry-First-Out and see what would still be on
    the shelf when each batch expires. Returns (risk_qty, risk_value) in the
    inventory's base currency."""
    in_play = sorted(
        [b for b in item_batches if b.quantity_available > 0],
        key=lambda b: b.expiry_date,
    )
    remaining = [b.quantity_available for b in in_play]
    if avg_monthly_demand > 0:
        # Months until the last batch expires (capped so the loop is bounded).
        horizon = 0
        for b in in_play:
            months_left = max(0, (b.expiry_date - today).days) // 30
            horizon = max(horizon, months_left)
        horizon = min(horizon, 36)
        for month in range(1, horizon + 1):
            demand = avg_monthly_demand
            for i, b in enumerate(in_play):
                if remaining[i] <= 0:
                    continue
                # A batch can only satisfy demand while it is still in date.
                if (b.expiry_date - today).days < month * 30:
                    continue
                take = min(remaining[i], demand)
                remaining[i] -= take
                demand -= take
                if demand <= 0:
                    break

    risk_qty = 0.0
    risk_value = 0.0
    for i, b in enumerate(in_play):
        if remaining[i] > 0:
            risk_qty += remaining[i]
            risk_value += remaining[i] * b.unit_value
    return risk_qty, risk_value


def _priority_band(score: int) -> tuple[str, str]:
    if score >= 12:
        return "Tight control", "Daily review"
    if score >= 8:
        return "Close watch", "Weekly review"
    return "Routine", "Monthly review"


# --- Main computation ---------------------------------------------------------


def compute_inventory_intelligence() -> InventoryIntelligence:
    today = date.today()
    batches = repo.list_inventory_batches()
    shipments = repo.list_shipments()
    receipts = repo.list_goods_receipts()

    month_keys = _recent_month_keys(today, ANALYSIS_MONTHS)
    month_index = set(month_keys)

    # 1) Build monthly demand series per item from shipment lines, plus the
    #    share of demand that arrived as "urgent" (our best criticality signal).
    monthly_demand: dict[str, dict[str, float]] = {}
    urgent_demand: dict[str, float] = {}
    total_demand: dict[str, float] = {}
    fill_requested = 0.0
    fill_approved = 0.0

    for shipment in shipments:
        status = shipment.status.value if hasattr(shipment.status, "value") else str(shipment.status)
        status = status.lower()
        if status not in _DEMAND_STATUSES:
            continue
        mkey = _month_key(shipment.request_date)
        is_urgent = str(shipment.priority).lower() == "urgent"
        for line in shipment.lines:
            qty = _line_demand_qty(status, line.quantity_requested, line.quantity_approved)
            if qty <= 0:
                continue
            item = line.item_code
            total_demand[item] = total_demand.get(item, 0.0) + qty
            if is_urgent:
                urgent_demand[item] = urgent_demand.get(item, 0.0) + qty
            if mkey in month_index:
                bucket = monthly_demand.setdefault(item, {k: 0.0 for k in month_keys})
                bucket[mkey] = bucket.get(mkey, 0.0) + qty
            # Fill-rate uses committed shipments only.
            if status in _COMMITTED_STATUSES:
                fill_requested += line.quantity_requested
                fill_approved += line.quantity_approved

    # 2) Latest supplier per item from goods receipts (for supplier risk).
    item_suppliers: dict[str, set[str]] = {}
    item_last_supplier: dict[str, str] = {}
    for receipt in sorted(receipts, key=lambda r: r.receipt_date):
        for line in receipt.lines:
            item_suppliers.setdefault(line.item_code, set()).add(receipt.supplier)
            item_last_supplier[line.item_code] = receipt.supplier

    # 3) Aggregate stock to item level.
    by_item: dict[str, list[InventoryBatch]] = {}
    for b in batches:
        by_item.setdefault(b.item_code, []).append(b)

    # First pass: per-item base figures needed for portfolio-level ABC ranking.
    rows: list[dict] = []
    for item, item_batches in by_item.items():
        on_hand_qty = sum(b.quantity_available for b in item_batches)
        on_hand_value = sum(b.inventory_value for b in item_batches)
        unit_value = next((b.unit_value for b in item_batches if b.unit_value), 0.0)
        category = item_batches[0].product_category
        description = item_batches[0].product_description
        warehouses = sorted({b.warehouse_location for b in item_batches})

        series = monthly_demand.get(item, {k: 0.0 for k in month_keys})
        values = [series[k] for k in month_keys]
        demand_total_window = sum(values)
        avg_monthly = demand_total_window / ANALYSIS_MONTHS if ANALYSIS_MONTHS else 0.0
        mean = avg_monthly
        cv: float | None
        if mean > 0:
            cv = pstdev(values) / mean if len(values) > 1 else 0.0
        else:
            cv = None
        annual_consumption_value = avg_monthly * 12 * unit_value

        rows.append(
            {
                "item": item,
                "batches": item_batches,
                "category": category,
                "description": description,
                "warehouses": warehouses,
                "on_hand_qty": on_hand_qty,
                "on_hand_value": on_hand_value,
                "unit_value": unit_value,
                "avg_monthly": avg_monthly,
                "cv": cv,
                "annual_consumption_value": annual_consumption_value,
            }
        )

    # ABC ranking: prefer consumption value; if nothing has moved yet, fall
    # back to on-hand value so items are still ranked by money tied up.
    total_consumption = sum(r["annual_consumption_value"] for r in rows)
    abc_basis = "annual consumption value"
    if total_consumption <= 0:
        abc_basis = "on-hand inventory value"
        for r in rows:
            r["abc_value"] = r["on_hand_value"]
    else:
        for r in rows:
            r["abc_value"] = r["annual_consumption_value"]

    ranked = sorted(rows, key=lambda r: r["abc_value"], reverse=True)
    total_abc_value = sum(r["abc_value"] for r in ranked) or 1.0
    cumulative = 0.0
    for r in ranked:
        r["abc_class"] = _abc_from_cumulative(cumulative / total_abc_value)
        cumulative += r["abc_value"]

    # Second pass: criticality, FSN, reorder, expiry, supplier, priority.
    skus: list[SkuIntelligence] = []
    alerts: list[Alert] = []
    for r in rows:
        item = r["item"]
        abc = r["abc_class"]
        avg_monthly = r["avg_monthly"]
        cv = r["cv"]
        on_hand_qty = r["on_hand_qty"]
        unit_value = r["unit_value"]

        # --- VED criticality (derived from urgency + value + movement) -------
        urgency_share = (
            urgent_demand.get(item, 0.0) / total_demand[item] if total_demand.get(item) else 0.0
        )
        if urgency_share >= 0.5 or (abc == "A" and urgency_share > 0):
            criticality = "Vital"
            criticality_basis = (
                f"{round(urgency_share * 100)}% of recent orders were urgent"
                if urgency_share >= 0.5
                else "High-value item appearing on urgent orders"
            )
        elif abc in {"A", "B"} or urgency_share > 0:
            criticality = "Essential"
            criticality_basis = (
                "High-value item" if abc in {"A", "B"} else "Some urgent demand seen"
            )
        else:
            criticality = "Desirable"
            criticality_basis = "Standard demand and value"

        # --- FSN movement ----------------------------------------------------
        months_cover = (on_hand_qty / avg_monthly) if avg_monthly > 0 else None
        if avg_monthly <= 0:
            fsn = "Non-moving"
        elif months_cover is not None and months_cover <= 3:
            fsn = "Fast"
        else:
            fsn = "Slow"

        # --- XYZ predictability ---------------------------------------------
        xyz = _xyz_from_cv(cv)

        # --- Reorder point + safety stock -----------------------------------
        service_level = SERVICE_LEVEL[criticality]
        z = SERVICE_Z[criticality]
        avg_daily = avg_monthly / 30.0
        demand_in_lead = avg_daily * DEFAULT_LEAD_TIME_DAYS
        # Simplification: σ over lead time ≈ demand variability × lead-time demand.
        sigma_lead = (cv or 0.0) * demand_in_lead
        safety_stock = round(z * sigma_lead, 1)
        reorder_point = round(demand_in_lead + safety_stock, 1)
        below_reorder = avg_monthly > 0 and on_hand_qty <= reorder_point

        # --- Expiry risk (FEFO simulation) ----------------------------------
        risk_qty, risk_value = _simulate_fefo_expiry(r["batches"], avg_monthly, today)
        in_date = [b for b in r["batches"] if b.quantity_available > 0]
        if in_date:
            nearest = min(in_date, key=lambda b: b.days_to_expiry)
            min_days = nearest.days_to_expiry
            nearest_expiry = nearest.expiry_date.isoformat()
        else:
            min_days = None
            nearest_expiry = None

        # --- Supplier risk ---------------------------------------------------
        suppliers = item_suppliers.get(item, set())
        single_source = len(suppliers) <= 1
        if below_reorder and criticality == "Vital":
            supplier_risk = "High"
            supplier_risk_basis = "Vital item below reorder point"
        elif below_reorder:
            supplier_risk = "Watch"
            supplier_risk_basis = "Below reorder point"
        elif single_source and avg_monthly > 0 and months_cover is not None and months_cover < 2:
            supplier_risk = "Watch"
            supplier_risk_basis = "Single source and low cover"
        else:
            supplier_risk = "Normal"
            supplier_risk_basis = "No supply concern detected"

        # --- Priority score (cost + criticality + demand + expiry + supplier) -
        cost_score = {"A": 3, "B": 2, "C": 1}[abc]
        crit_score = {"Vital": 5, "Essential": 3, "Desirable": 1}[criticality]
        demand_score = {"X": 1, "Y": 2, "Z": 3}[xyz]
        if min_days is None:
            expiry_score = 1
        elif min_days <= 90:
            expiry_score = 5
        elif min_days <= 180:
            expiry_score = 3
        else:
            expiry_score = 1
        if risk_qty > 0:
            expiry_score = max(expiry_score, 3)
        supplier_score = {"High": 3, "Watch": 2, "Normal": 1}[supplier_risk]
        priority_score = cost_score + crit_score + demand_score + expiry_score + supplier_score
        band, cadence = _priority_band(priority_score)

        # --- Recommended action (plain language) ----------------------------
        if below_reorder and criticality in {"Vital", "Essential"}:
            action = "Reorder now — critical item is below its safe level"
        elif min_days is not None and min_days <= 90 and on_hand_qty > 0:
            action = "Dispatch oldest stock first (FEFO) before it expires"
        elif fsn == "Non-moving" and r["on_hand_value"] > 0:
            action = "Review demand — stock is not moving; pause reordering"
        elif risk_qty > 0:
            action = "Plan FEFO dispatch or transfer — some stock may expire unsold"
        elif below_reorder:
            action = "Reorder soon — below reorder point"
        else:
            action = "Healthy — normal monthly review"

        skus.append(
            SkuIntelligence(
                item_code=item,
                product_description=r["description"],
                product_category=r["category"],
                warehouses=r["warehouses"],
                on_hand_qty=round(on_hand_qty, 1),
                on_hand_value=round(r["on_hand_value"], 2),
                avg_monthly_demand=round(avg_monthly, 1),
                annual_consumption_value=round(r["annual_consumption_value"], 2),
                months_cover=(round(months_cover, 1) if months_cover is not None else None),
                abc_class=abc,
                criticality=criticality,
                criticality_basis=criticality_basis,
                fsn_class=fsn,
                xyz_class=xyz,
                demand_cv=(round(cv, 2) if cv is not None else None),
                reorder_point=reorder_point,
                safety_stock=safety_stock,
                service_level=service_level,
                below_reorder=below_reorder,
                min_days_to_expiry=min_days,
                nearest_expiry_date=nearest_expiry,
                expiry_risk_qty=round(risk_qty, 1),
                expiry_risk_value=round(risk_value, 2),
                supplier=item_last_supplier.get(item),
                supplier_risk=supplier_risk,
                supplier_risk_basis=supplier_risk_basis,
                priority_score=priority_score,
                priority_band=band,
                review_cadence=cadence,
                recommended_action=action,
            )
        )

        # --- Supervisor alerts ----------------------------------------------
        if below_reorder:
            alerts.append(
                Alert(
                    kind="reorder",
                    severity="high" if criticality in {"Vital", "Essential"} else "medium",
                    item_code=item,
                    title=f"{item} below reorder point",
                    detail=(
                        f"{round(on_hand_qty)} on hand vs reorder point {reorder_point}. "
                        f"{criticality} item."
                    ),
                    action="Raise purchase order",
                )
            )
        for b in r["batches"]:
            if b.quantity_available > 0 and 0 <= b.days_to_expiry <= 90:
                alerts.append(
                    Alert(
                        kind="expiry",
                        severity="high" if b.days_to_expiry <= 30 else "medium",
                        item_code=item,
                        batch_number=b.batch_number,
                        title=f"{item} batch {b.batch_number} near expiry",
                        detail=(
                            f"{round(b.quantity_available)} units expire in {b.days_to_expiry} days "
                            f"({b.expiry_date.isoformat()})."
                        ),
                        action="Push FEFO dispatch, discount, transfer, or return to vendor",
                    )
                )
        if fsn == "Non-moving" and r["on_hand_value"] > 0:
            alerts.append(
                Alert(
                    kind="dead_stock",
                    severity="low",
                    item_code=item,
                    title=f"{item} not moving",
                    detail=f"No demand in the last {ANALYSIS_MONTHS} months.",
                    action="Stop reorder and review demand",
                )
            )

    # --- Breakdowns ----------------------------------------------------------
    def _bucket(group_key, labels: dict[str, str], order: list[str]) -> list[ClassBucket]:
        agg: dict[str, dict[str, float]] = {k: {"count": 0, "value": 0.0} for k in order}
        for s in skus:
            key = group_key(s)
            agg.setdefault(key, {"count": 0, "value": 0.0})
            agg[key]["count"] += 1
            agg[key]["value"] += s.on_hand_value
        return [
            ClassBucket(
                key=k,
                label=labels.get(k, k),
                count=int(agg[k]["count"]),
                value=round(agg[k]["value"], 2),
            )
            for k in order
        ]

    abc_breakdown = _bucket(
        lambda s: s.abc_class,
        {"A": "A — top value", "B": "B — mid value", "C": "C — low value"},
        ["A", "B", "C"],
    )
    ved_breakdown = _bucket(
        lambda s: s.criticality,
        {"Vital": "Vital", "Essential": "Essential", "Desirable": "Desirable"},
        ["Vital", "Essential", "Desirable"],
    )
    fsn_breakdown = _bucket(
        lambda s: s.fsn_class,
        {"Fast": "Fast-moving", "Slow": "Slow-moving", "Non-moving": "Non-moving"},
        ["Fast", "Slow", "Non-moving"],
    )
    xyz_breakdown = _bucket(
        lambda s: s.xyz_class,
        {"X": "X — steady", "Y": "Y — variable", "Z": "Z — unpredictable"},
        ["X", "Y", "Z"],
    )
    priority_bands = _bucket(
        lambda s: s.priority_band,
        {"Tight control": "Tight control · daily", "Close watch": "Close watch · weekly", "Routine": "Routine · monthly"},
        ["Tight control", "Close watch", "Routine"],
    )

    # ABC–VED matrix (counts).
    matrix: list[MatrixRow] = []
    for a in ["A", "B", "C"]:
        row_skus = [s for s in skus if s.abc_class == a]
        matrix.append(
            MatrixRow(
                abc=a,
                vital=sum(1 for s in row_skus if s.criticality == "Vital"),
                essential=sum(1 for s in row_skus if s.criticality == "Essential"),
                desirable=sum(1 for s in row_skus if s.criticality == "Desirable"),
            )
        )

    # --- Owner metrics -------------------------------------------------------
    inventory_value = round(sum(s.on_hand_value for s in skus), 2)
    critical = [s for s in skus if s.below_reorder and s.criticality in {"Vital", "Essential"}]
    critical_value = round(sum(s.on_hand_value for s in critical), 2)
    expiry_risk_value = round(sum(s.expiry_risk_value for s in skus), 2)
    dead_stock_value = round(sum(s.on_hand_value for s in skus if s.fsn_class == "Non-moving"), 2)
    fill_rate = round(fill_approved / fill_requested, 3) if fill_requested > 0 else None
    annual_cogs = sum(s.annual_consumption_value for s in skus)
    turnover = round(annual_cogs / inventory_value, 2) if inventory_value > 0 and annual_cogs > 0 else None
    days_of_inventory = round(365 / turnover, 0) if turnover and turnover > 0 else None
    supplier_delay = sum(1 for s in skus if s.supplier_risk in {"Watch", "High"})

    owner = OwnerMetrics(
        inventory_value=inventory_value,
        critical_stockout_count=len(critical),
        critical_stockout_value=critical_value,
        expiry_risk_value=expiry_risk_value,
        dead_stock_value=dead_stock_value,
        fill_rate=fill_rate,
        inventory_turnover=turnover,
        days_of_inventory=days_of_inventory,
        supplier_delay_risk_count=supplier_delay,
    )

    # Sort the SKU list by priority (most important first) for the table.
    skus.sort(key=lambda s: (-s.priority_score, -s.on_hand_value))
    # Sort alerts: high severity and biggest first.
    severity_rank = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda a: severity_rank.get(a.severity, 3))

    methods = _method_catalogue()

    return InventoryIntelligence(
        generated_at=today.isoformat(),
        currency_note="Values are shown in the base book currency.",
        assumptions={
            "demand_window": f"Last {ANALYSIS_MONTHS} months of shipment demand",
            "lead_time": f"{DEFAULT_LEAD_TIME_DAYS} days (assumed until purchase-order lead times are captured)",
            "abc_basis": f"Ranked by {abc_basis}",
            "service_levels": "Vital 99% · Essential 97% · Desirable 90%",
            "criticality_note": "Criticality (VED) is estimated from order urgency, value and movement — confirm clinically.",
        },
        owner_metrics=owner,
        abc_breakdown=abc_breakdown,
        ved_breakdown=ved_breakdown,
        fsn_breakdown=fsn_breakdown,
        xyz_breakdown=xyz_breakdown,
        abc_ved_matrix=matrix,
        priority_bands=priority_bands,
        skus=skus,
        alerts=alerts,
        methods=methods,
    )


def _method_catalogue() -> list[MethodStatus]:
    """The full healthcare methodology set, with an honest live / needs-data
    status so management sees both what is working and what comes next."""
    return [
        MethodStatus(
            key="abc", name="ABC Analysis", plain_title="Where the money sits",
            what_it_tells_you="Which items tie up the most money", status="live",
        ),
        MethodStatus(
            key="ved", name="VED Analysis", plain_title="Medical importance",
            what_it_tells_you="Vital, Essential or Desirable for patient care", status="live",
            note="Estimated from order urgency, value and movement — confirm clinically.",
        ),
        MethodStatus(
            key="abc_ved", name="ABC–VED Matrix", plain_title="Money × importance",
            what_it_tells_you="Best single view of what needs the tightest control", status="live",
        ),
        MethodStatus(
            key="fsn", name="FSN Analysis", plain_title="How fast it moves",
            what_it_tells_you="Fast, Slow or Non-moving — finds dead stock", status="live",
        ),
        MethodStatus(
            key="xyz", name="XYZ Analysis", plain_title="How predictable demand is",
            what_it_tells_you="Steady vs unpredictable demand", status="live",
        ),
        MethodStatus(
            key="fefo", name="FEFO / Expiry", plain_title="Expiry risk",
            what_it_tells_you="Stock likely to expire before it is used or sold", status="live",
        ),
        MethodStatus(
            key="batch", name="Batch / Lot Traceability", plain_title="Find any batch",
            what_it_tells_you="Where each batch is — for recalls and complaints", status="live",
        ),
        MethodStatus(
            key="reorder", name="Reorder Point + Safety Stock", plain_title="When to reorder",
            what_it_tells_you="Reorder level and safety buffer per item", status="live",
            note="Uses an assumed lead time until purchase-order history is captured.",
        ),
        MethodStatus(
            key="service", name="Service-Level Segmentation", plain_title="Availability targets",
            what_it_tells_you="Higher availability for more critical items", status="live",
        ),
        MethodStatus(
            key="meio", name="Multi-Echelon Optimisation", plain_title="Stock across locations",
            what_it_tells_you="How much to hold at each location", status="needs_data",
            note="Activates once multiple stocking tiers are modelled.",
        ),
        MethodStatus(
            key="forecast", name="AI / Predictive Forecasting", plain_title="Demand forecast",
            what_it_tells_you="Future demand for seasonal or outbreak-driven items", status="needs_data",
            note="Needs more demand history to forecast reliably.",
        ),
        MethodStatus(
            key="scenario", name="Scenario / Simulation", plain_title="What-if planning",
            what_it_tells_you="Effect of demand spikes or supply delays", status="needs_data",
        ),
        MethodStatus(
            key="cold_chain", name="Cold Chain / Temperature", plain_title="Storage compliance",
            what_it_tells_you="Whether temperature-sensitive items stayed in range", status="needs_data",
            note="Activates when temperature monitoring is connected.",
        ),
        MethodStatus(
            key="udi", name="UDI / Device Traceability", plain_title="Device identification",
            what_it_tells_you="Unique device IDs from manufacture to patient", status="needs_data",
            note="Batch/lot traceability is live; UDI capture is the next step.",
        ),
    ]
