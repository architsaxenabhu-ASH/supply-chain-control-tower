"""Shared test setup.

The whole point here is isolation: before any application module is imported,
we repoint the database at a throwaway SQLite file in a temp directory. That
means running the tests never reads or writes the real prototype data under
``data/`` — they get a clean, disposable store every run.
"""

import os
import tempfile
from pathlib import Path

_TMP_DIR = tempfile.mkdtemp(prefix="control_tower_tests_")
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_TMP_DIR, 'test.db').as_posix()}"
