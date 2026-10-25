#!/usr/bin/env python3
"""
BrandGuard CLI Wrapper (root entrypoint)
Delegates to backend/brandguard_cli.py.
"""
import sys
from pathlib import Path

import runpy

backend_cli = Path(__file__).resolve().parent / "backend" / "brandguard_cli.py"
if backend_cli.exists():
    runpy.run_path(str(backend_cli), run_name="__main__")
else:
    print(f"Error: {backend_cli} not found.")
    sys.exit(1)
