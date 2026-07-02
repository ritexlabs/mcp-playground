#!/usr/bin/env python3
"""
Run once after cloning to configure git for this repository.

What it does:
  1. Marks AI instruction files (CLAUDE.md, GEMINI.md, etc.) as
     skip-worktree so they are never accidentally staged or pushed.
  2. Points git to the project's tracked hooks directory
     (.github/hooks) to enable the pre-push safety check.

Works on Windows, macOS, and Linux (requires git in PATH).

Usage:
    python scripts/setup.py
"""

import subprocess
import sys
from pathlib import Path

REPO_DIR = Path(__file__).resolve().parent.parent

PROTECTED_FILES = [
    "CLAUDE.md",
    "GEMINI.md",
    ".gemini/styleguide.md",
]


def _git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", "-C", str(REPO_DIR)] + list(args),
        capture_output=True, text=True,
    )


def main() -> None:
    # Verify git is available
    probe = _git("rev-parse", "--show-toplevel")
    if probe.returncode != 0:
        print(
            "ERROR: git is not found or this directory is not a git repository.",
            file=sys.stderr,
        )
        print("Install Git from https://git-scm.com/ and reopen your terminal.")
        sys.exit(1)

    print("Marking AI instruction files as skip-worktree...")
    for rel in PROTECTED_FILES:
        full = REPO_DIR / rel
        if full.exists():
            r = _git("update-index", "--skip-worktree", rel)
            if r.returncode == 0:
                print(f"  skip-worktree : {rel}")
            else:
                print(f"  WARNING       : {rel} — {r.stderr.strip()}")

    print("\nSetting git hooks path to .github/hooks ...")
    r = _git("config", "core.hooksPath", ".github/hooks")
    if r.returncode != 0:
        print(f"  WARNING: {r.stderr.strip()}")
    else:
        print("  Git hooks path set to .github/hooks")

    print()
    print("Setup complete.")
    print("Edit CLAUDE.md, GEMINI.md, and .gemini/styleguide.md freely.")
    print("Your changes will never be staged or pushed.")


if __name__ == "__main__":
    main()
