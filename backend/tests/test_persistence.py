"""Persistence is PostgreSQL-ready: DATABASE_URL drives the engine, and common
Postgres URL forms are normalised to the psycopg driver."""

from app.db import local_persistence as lp


def test_postgres_scheme_is_normalised(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgres://user:pass@host:5432/control_tower")
    assert lp.configured_database_url() == "postgresql+psycopg://user:pass@host:5432/control_tower"


def test_postgresql_scheme_is_normalised(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@host:5432/control_tower")
    assert lp.configured_database_url() == "postgresql+psycopg://user:pass@host:5432/control_tower"


def test_sqlite_url_is_supported(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite:///data/control_tower.db")
    assert lp.configured_database_url().startswith("sqlite:///")
