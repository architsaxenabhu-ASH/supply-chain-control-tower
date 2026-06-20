"""Shared demo-presentation state.

A tiny, in-memory, process-wide counter that lets the demo presenter drive a
"live" walkthrough that every connected device sees at once — including a manager
watching from another city. It holds three numbers and nothing else:

  • epoch     — bumped on every reset; > 0 means "a presentation is running"
  • primary   — how many times "Primary Sales +" has been pressed (goods coming in)
  • secondary — how many times "Secondary Sales +" has been pressed (goods sold)

The frontend turns these counters into the growing figures it shows, so the data
stays identical on every device. This is a presentation aid only: it is not
persisted, touches no business tables, and resets to zero on restart.
"""

from __future__ import annotations

import threading
from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

_lock = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


_state: dict[str, object] = {"epoch": 0, "primary": 0, "secondary": 0, "updated_at": _now()}


class DemoState(BaseModel):
    epoch: int
    primary: int
    secondary: int
    updated_at: str


def _snapshot() -> DemoState:
    return DemoState(
        epoch=int(_state["epoch"]),
        primary=int(_state["primary"]),
        secondary=int(_state["secondary"]),
        updated_at=str(_state["updated_at"]),
    )


@router.get("/state", response_model=DemoState)
def get_state() -> DemoState:
    """Read the current demo counters (polled by every device)."""
    return _snapshot()


@router.post("/reset", response_model=DemoState)
def reset() -> DemoState:
    """Zero the business everywhere and begin a fresh presentation."""
    with _lock:
        _state["epoch"] = int(_state["epoch"]) + 1
        _state["primary"] = 0
        _state["secondary"] = 0
        _state["updated_at"] = _now()
    return _snapshot()


@router.post("/primary", response_model=DemoState)
def add_primary() -> DemoState:
    """One more pulse of Primary Sales (goods coming into the business)."""
    with _lock:
        if int(_state["epoch"]) == 0:
            _state["epoch"] = 1
        _state["primary"] = int(_state["primary"]) + 1
        _state["updated_at"] = _now()
    return _snapshot()


@router.post("/secondary", response_model=DemoState)
def add_secondary() -> DemoState:
    """One more pulse of Secondary Sales (goods sold out to customers)."""
    with _lock:
        if int(_state["epoch"]) == 0:
            _state["epoch"] = 1
        _state["secondary"] = int(_state["secondary"]) + 1
        _state["updated_at"] = _now()
    return _snapshot()
