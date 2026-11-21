#!/usr/bin/env python3
"""Copy the app's screenshots from the parent session's shots-raw folder
into this repository's screenshots/ directory, and print each file's size."""

import shutil
from pathlib import Path

SOURCE_DIR = Path("/home/hatch/workspace/bounty-20261121/gta6-cover-art-01/shots-raw")
DEST_DIR = Path(__file__).resolve().parent / "screenshots"
FILES = ["1-cover.jpg", "2-editor.jpg", "3-cover.jpg", "4-cover.jpg"]


def main() -> None:
    DEST_DIR.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        src = SOURCE_DIR / name
        dst = DEST_DIR / name
        shutil.copyfile(src, dst)
        print(f"{name}: {dst.stat().st_size} bytes")


if __name__ == "__main__":
    main()
