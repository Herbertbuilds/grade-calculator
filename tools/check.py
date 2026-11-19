#!/usr/bin/env python3
"""Static checks for a front end that has no build step.

There is no bundler or type checker to catch a broken file before it ships,
so this covers the three failures that actually break the page:

  1. src/app.js no longer parses.
  2. index.html points at a file that is not there.
  3. two elements share an id, which silently breaks every lookup.

Run it locally with `python3 tools/check.py`, or let CI do it.
"""

import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"

errors = []

html = (SRC / "index.html").read_text(encoding="utf-8")
css = (SRC / "style.css").read_text(encoding="utf-8")

node = shutil.which("node")
runs = node is not None and subprocess.run(
    [node, "-e", ""], capture_output=True
).returncode == 0
if not runs:
    print("warning: node is missing or broken, skipping the JavaScript syntax check")
else:
    check = subprocess.run(
        [node, "--check", str(SRC / "app.js")], capture_output=True, text=True
    )
    if check.returncode != 0:
        errors.append("src/app.js does not parse:\n" + check.stderr.strip())

local_refs = [
    ref
    for ref in re.findall(r'(?:href|src)="([^"]+)"', html)
    if not ref.startswith(("http://", "https://", "#", "mailto:", "data:"))
]
for ref in local_refs:
    target = SRC / ref.split("?")[0].split("#")[0]
    if not target.exists():
        errors.append(f"index.html points at a missing file: {ref}")

ids = re.findall(r'\bid="([^"]+)"', html)
duplicates = sorted({i for i in ids if ids.count(i) > 1})
if duplicates:
    errors.append("duplicate ids: " + ", ".join(duplicates))

if css.count("{") != css.count("}"):
    errors.append("style.css has unbalanced braces (truncated file?)")

print(f"checked {len(local_refs)} local references and {len(ids)} ids")

if errors:
    print()
    for error in errors:
        print(error, file=sys.stderr)
    sys.exit(1)

print("ok")
